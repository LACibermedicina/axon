/* axon · sim.js — Modo Simulação gamificado.
 * O usuário escolhe um caso clínico FICTÍCIO, seleciona o instrumento, aplica-o sobre a pele ou a
 * estrutura-alvo no corpo 3D e acompanha, no monitor, a resposta hipotética do "paciente":
 * recrutamento (núcleo verificado) → rede de fenômenos secundários (physio.js, HIPÓTESE) → EVA, FC,
 * VFC, condutância da pele e reflexos. Ferramenta de ensino: não é predição clínica. */
(function (g) {
  "use strict";
  const A = g.AxonApp, M = g.AxonModel, P = g.AxonPhysio, CS = g.AxonCases, C = g.AxonCharts, ST = () => g.AxonStage;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)], esc = A.esc, tag = A.tagHTML;
  const fmt = (v, d = 1) => (v == null || !isFinite(v)) ? "—" : Number(v).toFixed(d).replace(".", ",");
  const TOOLS = [["tens", "Eletrodo TENS"], ["ea", "Agulha EA"], ["acu", "Sonda de pressão"], ["tavns", "Eletrodo auricular"], ["lifu", "Transdutor LIFU"]];
  const DERMS = CS.DERMS;
  const sim = { active: false, case: CS.list[0], tool: "tens", app: null, depth: 8, running: false, S: null, u: null, minutes: 20, speed: 1, score: 0, steps: {}, badges: new Set(), log: [], outcome: null };
  g.AxonSim = sim;

  // ---------------------------------------------------------------- entradas do modelo a partir da aplicação
  const LAMBDA = { tens: 3.2, ea: 2.5, tavns: 2.0, lifu: 25, scs: 4, ti: 4.5 };   // mm — comprimento de atenuação efetivo pele→fibra [PREMISSA didática]
  function inputs() {
    const st = A.state, p = st.p, out = A.compute(), ap = sim.app;
    const u = { on: sim.running, FA: 0, FD: 0, Faa: 0, freq: p.f, segMatch: 0, vagalSite: 0, pressureKPa: 0, k: out.sh ? out.sh.k : -4, dT: out.th.dT, demy: st.v.demy, att: 1, rEff: null, inDomain: false };
    if (!ap) return u;
    const tgt = sim.case.pain.dermatomes, di = DERMS.indexOf(ap.derm);
    u.segMatch = tgt.includes(ap.derm) ? 1 : tgt.some(d => Math.abs(DERMS.indexOf(d) - di) === 1) ? .5 : 0;
    if (ap.type === "acu") { u.FA = M.acupressure(p.P); u.FD = Math.max(0, (p.P - 250) / 300); u.pressureKPa = p.P; u.freq = 0; u.k = -4; return u; }
    if (ap.type === "lifu") { u.FA = Math.min(1, p.U / 2500); u.FD = Math.max(0, (p.U - 1500) / 3000); u.freq = 0; return u; }
    /* Alvo das fibras recrutadas [PREMISSA didática]:
     *  • superfície (TENS, TI, taVNS): ramos cutâneos na derme — r = espessura de pele (1,2 mm; 1,0 mm na concha) + tecido adiposo do perfil;
     *    só uma fração da corrente do eletrodo chega à fibra (espalhamento ∝ 1/√área).
     *  • agulha (EA) e eletrodo implantado (SCS): r = distância da ponta ao tronco nervoso mais próximo.
     *  • tronco profundo: usado para estimar o recrutamento motor (Aα) e a contração. */
    const surface = ["tens", "ti", "tavns"].includes(ap.type), fatMM = (st.v.fat || 0);
    let d = surface ? (ap.type === "tavns" ? 1.0 : 1.2) + fatMM : ap.type === "ea" ? Math.max(.3, Math.abs(ap.mm - sim.depth)) : Math.max(.3, ap.mm);
    const frac = surface ? (ap.type === "tavns" ? .5 : .03 * Math.sqrt(4 / Math.max(.5, p.area))) : 1;
    const r = Math.min(1.5, Math.max(.3, d)); u.rEff = d; u.inDomain = d <= 1.5;
    u.att = frac * (d <= 1.5 ? 1 : Math.exp(-(d - 1.5) / (LAMBDA[ap.type] || 3)));
    const trans = out.trans, Ieff = p.I * trans * u.att, mc = st.mc;
    let k = 0; const scale = M.Ith(9, r / 10) / M.Ith(9, .1);   // desloca as curvas do fascículo para a distância efetiva (núcleo verificado)
    const Ic = Ieff / scale; while (k < 199 && mc.I[k + 1] <= Ic) k++;
    u.FA = mc.FA[k]; u.FD = mc.FD[k];
    const dm = surface ? ap.mm : d, Im = p.I * trans * frac * (dm <= 1.5 ? 1 : Math.exp(-(dm - 1.5) / (LAMBDA[ap.type] || 3)));
    const Iaa = M.Ith(15, Math.min(1.5, Math.max(.3, dm)) / 10) * 1e3; u.Faa = /auricular|Trigêmeo|intercostal/i.test(ap.nerve) ? 0 : Math.max(0, Math.min(1, (Im / Iaa - 1) * 1.5));
    if (ap.type === "tavns") u.vagalSite = ap.ear ? 1 : 0;
    return u;
  }

  // ---------------------------------------------------------------- aplicação do instrumento no corpo
  function applyAt(detail, kind) {
    if (!sim.active) return;
    const pt = detail.point, nrm = detail.normal; if (!pt) return;
    const nn = ST().placeTool(sim.tool, pt, nrm);
    const ear = /ear|orelha|Concha/i.test(detail.en || detail.name || "") || (detail.code === "C2" && pt[1] > 1.4 && Math.abs(pt[0]) > .06) || (nn && /auricular/i.test(nn.name) && nn.mm < 12);
    sim.app = { type: sim.tool, point: pt, derm: detail.code || nearestDerm(detail), structure: detail.name || null, nerve: nn ? nn.name : "—", mm: nn ? nn.mm : 15, ear };
    const modMap = { tens: "tens", ea: "ea", acu: "acu", tavns: "tavns", lifu: "lifu" };
    if (A.state.mod !== modMap[sim.tool]) A.setMod(modMap[sim.tool]);
    logEv(`Aplicado: ${toolName(sim.tool)} em ${sim.app.derm || sim.app.structure} · nervo mais próximo: ${sim.app.nerve} a ${fmt(sim.app.mm)} mm`, "info");
    checkSteps(); renderAll();
  }
  function nearestDerm(d) { return d.code || "—"; }
  const toolName = t => (TOOLS.find(x => x[0] === t) || [t, t])[1];
  function logEv(txt, kind = "info") { sim.log.unshift({ t: sim.S ? sim.S.t : 0, txt, kind }); sim.log = sim.log.slice(0, 40); }

  // ---------------------------------------------------------------- sessão
  let timer = null;
  function start() {
    if (!sim.app) { A.botSay("Primeiro selecione um instrumento e clique na pele ou na estrutura-alvo."); return; }
    if (!sim.S) sim.S = P.newState(sim.case);
    sim.running = true; logEv("Sessão iniciada", "info"); checkSteps();
    clearInterval(timer); timer = setInterval(tick, 250);
  }
  function pause() { sim.running = false; clearInterval(timer); logEv("Sessão pausada", "info"); renderAll(); }
  function reset() { pause(); sim.S = null; sim.score = 0; sim.badges.clear(); sim.log = []; sim.outcome = null; renderAll(); }
  let lastEv = {};
  function tick() {
    const u = inputs(); sim.u = u; const dt = .25 * sim.speed;
    P.step(sim.S, u, dt);
    sim.S.events.forEach(e => { if (!lastEv[e.k] || sim.S.t - lastEv[e.k] > 1.5) { lastEv[e.k] = sim.S.t; logEv(e.txt, e.k); if (["twitch", "withdraw"].includes(e.k)) ST().reflex(e.k); sim.score -= e.k === "withdraw" ? 15 : e.k === "shannon" ? 25 : e.k === "brady" ? 30 : 5; } });
    if (sim.S.t >= sim.minutes) { pause(); finish(); }
    renderMonitor(); renderNetwork();
  }
  function finish() {
    const S = sim.S, red = (S.base - S.out.pain) / S.base, safe = !sim.log.some(l => ["shannon", "brady", "pressure"].includes(l.kind)), sel = sim.u && sim.u.FD < .05;
    sim.score += Math.round(Math.max(0, red) * 200) + (safe ? 50 : 0) + (sel ? 30 : 0);
    if (red >= .3) sim.badges.add("Redução ≥ 30 %"); if (safe) sim.badges.add("Dentro das fronteiras"); if (sel) sim.badges.add("Seletivo (Aδ < 5 %)");
    if (Object.values(sim.steps).filter(Boolean).length >= 7) sim.badges.add("Protocolo completo");
    logEv(`Sessão concluída: EVA ${fmt(S.base)} → ${fmt(S.out.pain)} (${fmt(red * 100, 0)} %)`, "done"); sim.steps.done = true;
    A.botSay(`Sessão concluída. EVA ${fmt(S.base)} → ${fmt(S.out.pain)}. Resultado hipotético do modelo didático.`);
    renderAll();
  }

  // ---------------------------------------------------------------- passo a passo (missão)
  function steps() {
    const c = sim.case, prop = (c.proposals || [])[0] || {}, p = A.state.p;
    return [
      ["case", `Escolher o caso: ${c.title}`, !!sim.caseChosen],
      ["tool", `Selecionar o instrumento da proposta (${toolName(prop.modality === "tavns" ? "tavns" : prop.modality)})`, sim.tool === prop.modality],
      ["apply", `Aplicar sobre o alvo (${(c.pain.dermatomes || []).join(", ")}${prop.target && !c.pain.dermatomes.includes(prop.target) ? " / " + prop.target : ""})`, !!sim.app && (sim.app.ear && prop.target === "ABVN" || c.pain.dermatomes.includes(sim.app.derm))],
      ["params", `Ajustar parâmetros (${prop.params ? Object.entries(prop.params).map(([k, v]) => k + " " + v).join(" · ") : "—"})`, !!prop.params && (!prop.params.f || Math.abs(p.f - prop.params.f) <= prop.params.f * .25)],
      ["safety", "Conferir as fronteiras (Shannon k < 1,75; ΔT ≤ 1 °C)", (() => { const o = A.state.out; return o && (!o.sh || o.sh.k < 1.75) && o.th.dT <= 1; })()],
      ["run", "Iniciar a sessão e observar o monitor", !!sim.S && sim.S.t > 0],
      ["complete", `Completar ${sim.minutes} min de sessão`, !!sim.steps.done],
      ["outcome", "Avaliar o desfecho hipotético e comparar propostas", !!sim.outcome]
    ];
  }
  function checkSteps() { steps().forEach(([k, , ok]) => { if (ok && !sim.steps[k]) { sim.steps[k] = true; sim.score += 10; } }); }

  // ---------------------------------------------------------------- janelas
  function caseHTML(c) {
    return `<div class="card"><h4>${esc(c.title)} ${c.imported ? '<span class="badge">importado</span>' : ""}</h4><p>${esc(c.summary || "")}</p>
      <table class="mini"><tr><td>Origem da dor</td><td><b>${esc(c.pain.origin)}</b></td></tr><tr><td>Mecanismo</td><td>${esc(c.pain.mechanism || "—")}</td></tr>
      <tr><td>EVA inicial</td><td class="n">${fmt(c.pain.baseline)}</td></tr><tr><td>Dermátomos</td><td>${c.pain.dermatomes.map(esc).join(", ")}</td></tr>
      <tr><td>Estruturas</td><td>${(c.pain.structures || []).map(esc).join(" · ")}</td></tr><tr><td>Componente inflamatório</td><td class="n">${fmt((c.pain.inflammation ?? .3) * 100, 0)} %</td></tr>
      <tr><td>Sensibilização central</td><td class="n">${fmt((c.pain.sensitization ?? .3) * 100, 0)} %</td></tr><tr><td>FC · RMSSD</td><td class="n">${c.autonomic?.hr || "—"} bpm · ${c.autonomic?.rmssd || "—"} ms</td></tr></table>
      ${(c.conditions || []).length ? `<p class="note">Condições aplicadas ao perfil anatômico: ${(c.conditions).map(q => esc(q.label)).join("; ")} ${tag("hip")}</p>` : ""}
      <p class="note">Caso fictício e didático · sem dados de paciente.</p></div>
      <div class="card"><h4>Propostas terapêuticas</h4>${(c.proposals || []).map((q, i) => `<div style="margin:6px 0"><b>${esc(toolName(q.modality))}</b> — ${esc(q.site)}<br><span class="note">${esc(q.rationale || "")}</span><br><button class="btn ghost" data-prop="${i}" style="margin-top:4px">Carregar proposta ${i + 1}</button></div>`).join("")}</div>
      <div class="card"><h4>Objetivos</h4><ul>${(c.objectives || []).map(o => `<li>${esc(o)}</li>`).join("")}</ul></div>`;
  }
  let simTab = "case";
  const SIMAPP = { title: "sim", w: 420, h: 520, pos: d => ({ x: 70, y: 100 }), render(b) { this.draw(b); }, draw(b) {
    if (!b || !b.isConnected) return;
    const tabs = [["case", "Caso"], ["steps", "Passo a passo"], ["outcome", "Desfecho"], ["import", "Importar"]];
    let h = `<div class="wtabs">${tabs.map(([k, l]) => `<button data-k="${k}" class="${k === simTab ? "on" : ""}">${l}</button>`).join("")}</div>`;
    if (simTab === "case") h += `<div class="ctl"><label for="caseSel"><span>Caso clínico</span></label><select id="caseSel">${CS.list.map(c => `<option value="${esc(c.id)}" ${c.id === sim.case.id ? "selected" : ""}>${esc(c.title)}</option>`).join("")}</select></div>${caseHTML(sim.case)}`;
    if (simTab === "steps") h += `<ol class="steps">${steps().map(([k, txt, ok]) => `<li class="${ok ? "done" : ""}">${ok ? "✓ " : ""}${esc(txt)}</li>`).join("")}</ol><p class="note">Cada passo concluído vale 10 pontos. Pontuação atual: <b>${sim.score}</b></p>`;
    if (simTab === "outcome") h += outcomeHTML();
    if (simTab === "import") h += `<div class="card"><h4>Importar casos (JSON, esquema axon-case/1)</h4><p class="note">Use apenas casos fictícios ou anonimizados. Campos de identificação (nome, CPF, e-mail, telefone, endereço, prontuário, nascimento) são recusados.</p>
      <input type="file" id="caseFile" accept="application/json,.json" style="width:100%;margin:6px 0"><textarea id="caseText" style="width:100%;height:120px;background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:8px;font:12px var(--mono)" placeholder="Cole aqui um caso ou uma lista de casos em JSON"></textarea>
      <div class="row" style="margin-top:6px"><button class="btn" id="caseImp">Validar e importar</button><button class="btn ghost" id="caseTpl">Carregar modelo</button></div><div id="caseMsg" class="note" style="margin-top:6px"></div></div>`;
    b.innerHTML = h;
    $$(".wtabs button", b).forEach(x => x.onclick = () => { simTab = x.dataset.k; this.draw(b); });
    if (simTab === "case") { $("#caseSel", b).onchange = e => selectCase(e.target.value); $$("[data-prop]", b).forEach(x => x.onclick = () => loadProposal(+x.dataset.prop)); }
    if (simTab === "outcome") { const bt = $("#runOut", b); if (bt) bt.onclick = () => { evaluate(); this.draw(b); }; }
    if (simTab === "import") {
      $("#caseTpl", b).onclick = () => { $("#caseText", b).value = CS.TEMPLATE; };
      $("#caseFile", b).onchange = async e => { const f = e.target.files[0]; if (f) $("#caseText", b).value = await f.text(); };
      $("#caseImp", b).onclick = () => { const r = CS.importJSON($("#caseText", b).value); if (r.added.length) selectCase(r.added[0]); const msg = $("#caseMsg", b); if (msg) msg.innerHTML = r.ok ? `Importado: ${r.added.map(esc).join(", ")}` : `<span style="color:var(--risk)">${r.errors.map(esc).join("<br>")}</span>`; };
    }
  } };
  A.registerApp("sim", SIMAPP);
  function outcomeHTML() {
    const o = sim.outcome;
    let h = `<div class="card"><h4>Desfecho hipotético</h4><p class="note">Monte Carlo (N = 300, semente 42) sobre a incerteza dos pesos da rede fisiológica (±40 %), com a aplicação e os parâmetros atuais, ${sim.minutes} min, 1 e 5 sessões. ${tag("hip")}</p><button class="btn" id="runOut">Avaliar agora</button></div>`;
    if (!o) return h;
    const bar = (r, base) => { const L = v => (v / 10 * 100).toFixed(1) + "%"; return `<div style="position:relative;height:22px;background:rgba(255,255,255,.06);border-radius:6px;margin:6px 0"><i style="position:absolute;left:${L(r.p10)};width:calc(${L(r.p90)} - ${L(r.p10)});top:4px;bottom:4px;background:rgba(62,230,197,.35);border-radius:4px"></i><i style="position:absolute;left:${L(r.median)};top:0;bottom:0;width:3px;background:#3ee6c5"></i><i style="position:absolute;left:${L(base)};top:0;bottom:0;width:2px;background:#ff8a3d"></i></div>`; };
    h += `<div class="card"><h4>Aplicação atual</h4>${o.rows.map(r => `<p><b>${r.label}</b>: EVA ${fmt(r.baseline)} → mediana ${fmt(r.median)} (10–90 %: ${fmt(r.p10)}–${fmt(r.p90)}) · P(redução ≥ 30 %) = ${fmt(r.pResp * 100, 0)} %</p>${bar(r, r.baseline)}`).join("")}<p class="note">laranja = EVA inicial · verde = mediana e faixa 10–90 %</p></div>`;
    if (o.props.length) h += `<div class="card"><h4>Comparação das propostas (aplicação ideal no alvo)</h4><table class="mini"><tr><th>Proposta</th><th>EVA mediana</th><th>P(≥30 %)</th></tr>${o.props.map(r => `<tr><td>${esc(r.label)}</td><td class="n">${fmt(r.median)}</td><td class="n">${fmt(r.pResp * 100, 0)} %</td></tr>`).join("")}</table></div>`;
    h += `<div class="card"><h4>Ramificações secundárias que mais pesaram</h4><ul>${o.drivers.map(d => `<li>${esc(d)}</li>`).join("")}</ul><p class="note">Leitura qualitativa da rede: relações descritas na literatura; magnitudes hipotéticas. Não é prognóstico clínico.</p></div>`;
    return h;
  }
  function evaluate() {
    const u = Object.assign(inputs(), { on: true }), c = sim.case;
    const rows = [Object.assign(P.outcome(c, u, sim.minutes, 1), { label: "1 sessão" }), Object.assign(P.outcome(c, u, sim.minutes, 5), { label: "5 sessões" })];
    const props = (c.proposals || []).map(q => { const uq = { on: true, FA: q.modality === "acu" ? M.acupressure(q.params.P || 60) : .35, FD: .02, Faa: 0, freq: q.params.f || 0, segMatch: q.target === "ABVN" ? 0 : 1, vagalSite: q.target === "ABVN" ? 1 : 0, pressureKPa: q.params.P || 0, k: -2, dT: 0, demy: A.state.v.demy };
      return Object.assign(P.outcome(c, uq, sim.minutes, 5), { label: `${toolName(q.modality)} · ${q.site}` }); });
    const S = P.newState(c); for (let t = 0; t < sim.minutes; t += .5) P.step(S, u, .5);
    const m = S.m, drivers = [];
    if (m.gate > .15) drivers.push(`Portão medular ativo (${fmt(m.gate * 100, 0)} %) — Aβ no segmento doloroso`);
    if (u.segMatch === 0 && u.vagalSite === 0) drivers.push("Aplicação fora do segmento doloroso: o portão não atua; resta a via opioide/descendente");
    if (m.enk > .15) drivers.push(`Opioides endógenos de baixa frequência (${fmt(m.enk * 100, 0)} %), latência de minutos`);
    if (m.dyn > .15) drivers.push(`Dinorfina de alta frequência (${fmt(m.dyn * 100, 0)} %) com tolerância ${fmt(m.tol * 100, 0)} %`);
    if (m.nts > .1) drivers.push(`Aferência vagal → NTS → inibição descendente (${fmt(m.desc * 100, 0)} %) e via anti-inflamatória (${fmt(m.ai * 100, 0)} %)`);
    if (u.FD > .05) drivers.push(`Recrutamento de Aδ (${fmt(u.FD * 100, 0)} %) alimenta a sensibilização e a dor provocada`);
    if (A.state.v.demy > 0) drivers.push("Desmielinização reduz a eficácia do portão (condução Aβ comprometida)");
    if (!u.inDomain && u.rEff) drivers.push(`Distância efetiva ${fmt(u.rEff)} mm fora do domínio verificado: recrutamento estimado por atenuação [PREMISSA]`);
    sim.outcome = { rows, props, drivers: drivers.length ? drivers : ["Ativação baixa: aumente a amplitude dentro das fronteiras ou aproxime o instrumento do alvo"] };
    checkSteps(); sim.score += 10;
  }
  function selectCase(id) {
    const c = CS.list.find(x => x.id === id); if (!c) return; sim.case = c; sim.caseChosen = true; reset();
    const v = A.state.v; Object.keys(v).forEach(k => v[k] = 0); (c.conditions || []).forEach(q => Object.entries(q.effect || {}).forEach(([k, val]) => v[k] = Math.max(v[k], val)));
    A.renderRight(); A.update(); checkSteps(); A.botSay(`Caso: ${c.title}. Dor ${c.pain.origin}, EVA ${c.pain.baseline}. Alvo: ${c.pain.dermatomes.join(", ")}.`); renderAll();
  }
  function loadProposal(i) {
    const q = sim.case.proposals[i]; if (!q) return; sim.tool = q.modality; A.setMod(q.modality === "tavns" ? "tavns" : q.modality);
    const p = A.state.p; Object.entries(q.params || {}).forEach(([k, v]) => { if (k === "depth") sim.depth = v; else p[k] = v; });
    A.renderRight(); A.update(); renderTray(); checkSteps(); A.botSay(`Proposta carregada: ${toolName(q.modality)} em ${q.site}. Agora clique no alvo no corpo.`); renderAll();
  }

  // ---------------------------------------------------------------- monitor gamificado
  function face(eva) { const k = Math.max(0, Math.min(1, eva / 10)), mouth = 12 - k * 22, brow = k * 6, col = `hsl(${120 - k * 120},55%,62%)`;
    return `<svg viewBox="0 0 100 100" width="86" height="86" aria-label="Expressão do paciente"><circle cx="50" cy="50" r="44" fill="${col}" opacity=".9"/><circle cx="50" cy="50" r="44" fill="none" stroke="#0b1d22" stroke-width="2"/>
      <path d="M28 ${36 + brow * .3} l14 ${-2 + brow}" stroke="#0b1d22" stroke-width="3.5" stroke-linecap="round"/><path d="M72 ${36 + brow * .3} l-14 ${-2 + brow}" stroke="#0b1d22" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="36" cy="46" r="4.5" fill="#0b1d22"/><circle cx="64" cy="46" r="4.5" fill="#0b1d22"/><path d="M32 68 Q50 ${68 + mouth} 68 68" stroke="#0b1d22" stroke-width="4" fill="none" stroke-linecap="round"/>${k > .7 ? '<path d="M75 40 q4 8 0 12" stroke="#4fb3ff" stroke-width="3" fill="none"/>' : ""}</svg>`; }
  A.registerApp("monitor", { title: "monitor", w: 470, h: 520, pos: (d, W) => ({ x: Math.max(500, d.right - W + 40), y: 100 }), render(b) { renderMonitor(b); }, draw(b) { renderMonitor(b); } });
  function renderMonitor(b = A.body("monitor")) {
    if (!b) return; const S = sim.S, u = sim.u || inputs(), o = S ? S.out : { pain: sim.case.pain.baseline, hr: sim.case.autonomic?.hr || 75, hrv: sim.case.autonomic?.rmssd || 35, eda: 4 };
    const ap = sim.app, light = (ok, w) => `<span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${ok ? "var(--ok)" : w ? "var(--warn)" : "var(--risk)"}"></span>`;
    const out = A.state.out || {};
    b.innerHTML = `<div style="display:grid;grid-template-columns:96px minmax(0,1fr);gap:10px;align-items:center">${face(o.pain)}
        <div><div style="font:700 30px var(--mono)">EVA ${fmt(o.pain)}</div><div class="note">t = ${fmt(S ? S.t : 0)} / ${sim.minutes} min · ${sim.running ? "em sessão" : "parado"} · pontos <b style="color:var(--accent)">${sim.score}</b></div>
        <div class="row" style="margin-top:6px"><button class="btn" id="mStart">${sim.running ? "Pausar" : "Iniciar"}</button><button class="btn ghost" id="mReset">Reiniciar</button>
        <select id="mSpeed" style="width:auto"><option value="1">1 min/s</option><option value="2">2 min/s</option><option value="4">4 min/s</option></select></div></div></div>
      <div class="gauges" style="margin-top:8px;grid-template-columns:repeat(4,minmax(0,1fr))">
        <div class="card" style="padding:6px"><div class="note">FC</div><b class="mono">${fmt(o.hr, 0)} bpm</b></div><div class="card" style="padding:6px"><div class="note">VFC (RMSSD)</div><b class="mono">${fmt(o.hrv, 0)} ms</b></div>
        <div class="card" style="padding:6px"><div class="note">Condutância</div><b class="mono">${fmt(o.eda)} µS</b></div><div class="card" style="padding:6px"><div class="note">Aβ · Aδ · Aα</div><b class="mono">${fmt(u.FA * 100, 0)}·${fmt(u.FD * 100, 0)}·${fmt((u.Faa || 0) * 100, 0)} %</b></div></div>
      <canvas class="cv" id="mChart" style="height:140px"></canvas>
      <div class="card" style="margin-top:6px"><h4>Aplicação</h4><p class="note">${ap ? `${esc(toolName(ap.type))} · ${esc(ap.derm || ap.structure || "")} · nervo mais próximo: ${esc(ap.nerve)} a ${fmt(ap.mm)} mm${ap.type === "ea" ? ` · agulha a ${fmt(sim.depth)} mm de profundidade` : ""} · ${u.inDomain ? "dentro do domínio verificado" : "fora do domínio: estimativa por atenuação " + tag("pre")}` : "Selecione um instrumento na bandeja do palco e clique na pele ou estrutura-alvo."}</p>
        <p class="note">${light(!out.sh || out.sh.k < 1.75, out.sh && out.sh.k < 2)} Shannon k ${out.sh ? fmt(out.sh.k, 2) : "—"} · ${light((out.th?.dT || 0) <= 1, (out.th?.dT || 0) <= 2)} ΔT ${fmt(out.th?.dT || 0, 2)} °C · ${light(o.hr >= (sim.case.autonomic?.hr || 75) * .9, false)} FC estável · segmento ${u.segMatch === 1 ? "coincide" : u.segMatch ? "adjacente" : "diferente"} do doloroso</p></div>
      <div class="card"><h4>Eventos e reflexos</h4><div style="max-height:120px;overflow:auto">${sim.log.map(l => `<div class="note">[${fmt(l.t)} min] ${esc(l.txt)}</div>`).join("") || '<p class="note">—</p>'}</div>
        ${sim.badges.size ? `<p>${[...sim.badges].map(bd => `<span class="badge" style="margin:2px">${esc(bd)}</span>`).join(" ")}</p>` : ""}</div>
      <p class="note">Resposta do “paciente”: modelo didático de mediadores ${tag("hip")} alimentado pelo recrutamento do núcleo ${tag("mod")}. Não é predição clínica.</p>`;
    $("#mStart", b).onclick = () => sim.running ? pause() : start(); $("#mReset", b).onclick = reset;
    const sp = $("#mSpeed", b); sp.value = String(sim.speed); sp.onchange = e => sim.speed = +e.target.value;
    if (S && S.hist.length > 1) { const H = S.hist; C.plot($("#mChart", b), { yr: [0, 10], xlabel: "min", series: [{ x: H.map(h => h.t), y: H.map(h => h.pain), color: "#ff8a3d", label: "EVA" }, { x: H.map(h => h.t), y: H.map(h => (h.hr - 40) / 10), color: "#ff5d5d", label: "FC (esc.)", w: 1 }, { x: H.map(h => h.t), y: H.map(h => h.hrv / 10), color: "#3ee6c5", label: "RMSSD/10", w: 1 }] }); }
  }

  // ---------------------------------------------------------------- rede fisiológica ao vivo
  A.registerApp("network", { title: "network", w: 720, h: 340, pos: (d, W, H) => ({ x: Math.max(70, d.left + (d.width - W) / 2), y: Math.max(120, d.bottom - H + 30) }), render(b) { renderNetwork(b); }, draw(b) { renderNetwork(b); } });
  function renderNetwork(b = A.body("network")) {
    if (!b) return; const S = sim.S || P.newState(sim.case), act = P.activity(S, sim.u || inputs());
    const cols = ["Biofísico", "Fibras", "Medular / reflexo", "Neuroquímico / supraespinal", "Autonômico / imune", "Desfechos"];
    const W = 1000, Hh = 560, cx = i => 70 + i * 172, byCol = {}; P.NODES.forEach(n => (byCol[n.col] = byCol[n.col] || []).push(n));
    const pos = {}; Object.entries(byCol).forEach(([c, ns]) => ns.forEach((n, i) => pos[n.id] = [cx(+c), 70 + i * (Hh - 100) / Math.max(1, ns.length - 1) * (ns.length > 1 ? 1 : 0) + (ns.length === 1 ? (Hh - 100) / 2 : 0)]));
    const tc = { lit: "#4fb3ff", hip: "#ff5d5d", mod: "#c084fc", der: "#3ee6c5", pre: "#ffb547" };
    const edges = P.EDGES.map(([a, z, sgn, ref]) => { const [x1, y1] = pos[a], [x2, y2] = pos[z], w = .6 + 5 * (act[a] || 0); return `<path d="M${x1 + 62} ${y1} C${x1 + 110} ${y1} ${x2 - 110} ${y2} ${x2 - 62} ${y2}" stroke="${sgn > 0 ? "#ffb547" : "#3ee6c5"}" stroke-width="${w.toFixed(1)}" opacity="${(.25 + .6 * (act[a] || 0)).toFixed(2)}" fill="none"${sgn < 0 ? ' stroke-dasharray="6 4"' : ""}><title>${a} → ${z} (${sgn > 0 ? "excita" : "inibe"})${ref ? " · " + P.REF[ref] : ""}</title></path>`; }).join("");
    const nodes = P.NODES.map(n => { const [x, y] = pos[n.id], a = act[n.id] || 0; return `<g transform="translate(${x - 62},${y - 19})"><rect width="124" height="38" rx="9" fill="rgba(10,30,36,.95)" stroke="${tc[n.tag]}" stroke-width="1.5"/><rect width="${(124 * Math.min(1, a)).toFixed(1)}" height="38" rx="9" fill="${tc[n.tag]}" opacity=".28"/><text x="62" y="16" text-anchor="middle" font-size="10.5" fill="#e8fbff" font-weight="700">${esc(n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label)}</text><text x="62" y="30" text-anchor="middle" font-size="10" fill="#9fc">${fmt(a * 100, 0)} %</text><title>${esc(n.label)} · ${n.tag.toUpperCase()}</title></g>`; }).join("");
    b.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" style="width:100%;height:calc(100% - 40px);min-height:300px">${cols.map((c, i) => `<text x="${cx(i)}" y="24" text-anchor="middle" font-size="12" fill="#9fc" font-weight="700">${c}</text>`).join("")}${edges}${nodes}</svg>
      <p class="note">Linha cheia laranja = excita · tracejada verde = inibe · espessura = atividade atual. Bordas: ${tag("lit")} ${tag("mod")} ${tag("der")} ${tag("hip")}. Passe o mouse para ver a referência.</p>`;
  }

  // ---------------------------------------------------------------- bandeja de instrumentos no palco
  function renderTray() {
    let tr = $("#simTray"); if (!sim.active) { if (tr) tr.remove(); return; }
    if (!tr) { tr = document.createElement("div"); tr.id = "simTray"; tr.className = "simtray"; $("#stage").appendChild(tr); }
    tr.innerHTML = `<b>Modo Simulação</b><div class="seg" style="grid-template-columns:repeat(5,minmax(0,1fr))">${TOOLS.map(([k, n]) => `<button data-tool="${k}" class="${k === sim.tool ? "on" : ""}" title="${n}">${n.split(" ").slice(-1)[0]}</button>`).join("")}</div>
      ${sim.tool === "ea" ? `<div class="ctl"><label for="eaDepth"><span>Profundidade da agulha</span><output>${fmt(sim.depth)} mm</output></label><input type="range" id="eaDepth" min="1" max="40" step="0.5" value="${sim.depth}"></div>` : ""}
      <p class="note">Clique na pele (dermátomo) ou num órgão para aplicar ${esc(toolName(sim.tool))}. Caso: <b>${esc(sim.case.title)}</b></p>`;
    $$("[data-tool]", tr).forEach(x => x.onclick = () => { sim.tool = x.dataset.tool; ST().clearTool(); sim.app = null; renderTray(); checkSteps(); renderAll(); });
    const dp = $("#eaDepth", tr); if (dp) dp.oninput = e => { sim.depth = +e.target.value; dp.previousElementSibling.querySelector("output").textContent = fmt(sim.depth) + " mm"; renderMonitor(); };
  }
  function renderAll() { const b = A.body("sim"); if (b) SIMAPP.draw(b); renderMonitor(); renderNetwork(); renderTray(); }
  function toggle(on = !sim.active) {
    sim.active = on; ST().setSimMode(on); renderTray();
    const left = $("#left"); if (left) { if (on && !left.classList.contains("collapsed")) { left.querySelector(".side-h button").click(); sim.collapsedLeft = true; } else if (!on && sim.collapsedLeft) { left.querySelector(".side-h button").click(); sim.collapsedLeft = false; } }
    if (on) { if (ST().level !== 1) ST().setLevel(1); A.openApp("sim"); A.openApp("monitor"); A.openApp("network"); A.botSay("Modo Simulação: escolha o caso, o instrumento e clique no alvo do corpo."); }
    else { pause(); ST().clearTool(); ["sim", "monitor", "network"].forEach(id => A.closeApp && A.closeApp(id)); }
    const btn = $("#simBtn"); if (btn) btn.classList.toggle("on", on);
  }
  document.addEventListener("axon:dermatome", e => { if (sim.active) applyAt(e.detail); });
  document.addEventListener("axon:structure", e => { if (sim.active && e.detail.layer !== "nervo" && e.detail.point) applyAt(Object.assign({ code: null }, e.detail)); });
  sim.toggle = toggle; sim.inputs = inputs; sim.evaluate = evaluate; sim.selectCase = selectCase;
})(window);
