/* axon · interact.js — interação direta no corpo, explicação dinâmica e sessão de testes (v0.11)
 *  • 1 clique: seleciona a área (palco) · 2º clique no mesmo lugar, depois de uma pausa: aplica a ferramenta escolhida
 *    (ou abre o painel de ferramentas) · clique duplo segurando: entra no nível estrutural seguinte naquele ponto
 *  • clicar e segurar: aplicação contínua — a intensidade sobe em rampa até o alvo e o tempo de exposição corre;
 *    a resposta sensorial (percepção, parestesia, desconforto, contração) acompanha os parâmetros
 *  • lupa: amplia sem mudar de nível; aviso quando a estrutura fica pequena demais na tela
 *  • cada aplicação calcula, por classe de fibra, o diâmetro mínimo recrutado (D*) com o núcleo verificado e o
 *    preditor morfométrico, desenha o trajeto ativado e o assistente explica o cálculo, o motivo, o que acontece e o que se busca
 *  • "Iniciar testes" abre uma sessão: cada interação vai para o registro (exportável e enviado às notas). */
(function (g) {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (x, d = 1) => x == null || !isFinite(x) ? "—" : (+x).toFixed(d).replace(".", ",");
  const TG = { lit: ["LITERATURA", "t-lit"], pre: ["PREMISSA", "t-pre"], der: ["DERIVADO", "t-der"], mod: ["RESULTADO DE MODELO - SEMENTE 42", "t-mod"], hip: ["HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO", "t-hip"] };
  const tag = k => `<span class="tag ${TG[k][1]}">${TG[k][0]}</span>`;
  const A = () => g.AxonApp, ST = () => g.AxonStage, M = () => g.AxonModel;
  const LAMBDA = { tens: 3.2, ea: 2.5, tavns: 2.0, lifu: 25, acu: 3, hist: 25 };
  const TOOLN = { tens: "Eletrodo TENS", ea: "Agulha de eletroacupuntura", acu: "Sonda de pressão", tavns: "Eletrodo auricular (taVNS)", lifu: "Transdutor LIFU", hist: "Transdutor de histotripsia" };
  const IX = { last: null, lastClick: null, hold: null, lupa: false, res: null, test: { on: false, id: null, start: null, entries: [] }, Dsel: 9, depth: 10, rampS: 4, adv: false };
  const tool = () => (g.AxonWorkbench && g.AxonWorkbench.WB.instr) || null;
  const phi = z => .5 * (1 + Math.tanh(.7978845608 * (z + .044715 * z * z * z)));

  // ---------------------------------------------------------------- cálculo
  function Dstar(Ieff, rcm, pw) {   // diâmetro cujo limiar iguala a corrente efetiva (núcleo verificado: 1–16 µm)
    const th = D => M().Ith(D, rcm, { pw }) * 1e3;
    if (Ieff < th(16)) return { D: Infinity, thMin: th(16) }; if (Ieff >= th(1)) return { D: 1, thMin: th(16) };
    let lo = Math.log(1), hi = Math.log(16); for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (th(Math.exp(m)) > Ieff) lo = m; else hi = m; } return { D: Math.exp((lo + hi) / 2), thMin: th(16) };
  }
  function evaluate(det, o = {}) {
    const st = A().state, p = st.p, out = A().compute(), tl = o.tool || tool() || ({ tens: "tens", ea: "ea", acu: "acu", tavns: "tavns", lifu: "lifu", hist: "hist" }[st.mod]) || "tens";
    const I = o.I != null ? o.I : p.I, pw = (p.pw || 100) * 1e-6, trans = out.trans, nn = det.nn || { name: "nervo cutâneo", mm: 12 };
    const surface = tl === "tens" || tl === "tavns", needle = tl === "ea", fat = st.v.fat || 0;
    const dCut = surface ? (tl === "tavns" ? 1.0 : 1.2) + fat : needle ? Math.max(.3, Math.abs(nn.mm - IX.depth)) : Math.max(.3, nn.mm);
    const frac = surface ? (tl === "tavns" ? .5 : .03 * Math.sqrt(4 / Math.max(.5, p.area))) : 1;
    const att = d => d <= 1.5 ? 1 : Math.exp(-(d - 1.5) / (LAMBDA[tl] || 3));
    const Ieff = I * trans * frac * att(dCut), rcm = Math.min(1.5, Math.max(.3, dCut)) / 10;
    const pred = g.AxonMorpho ? g.AxonMorpho.predict(null, /auricular|concha|orelha/i.test(det.name || nn.name) ? "Ramo auricular do vago" : surface ? "Nervo cutâneo" : nn.name) : null;
    const lim = [];
    let classes = [];
    if (tl === "acu") {
      const FA = M().acupressure(p.P); classes = [{ cls: "Aβ", frac: FA, note: "mecanorreceptores por pressão" }, { cls: "Aδ", frac: Math.max(0, (p.P - 250) / 300), note: "acima do limiar de dor à pressão" }];
      lim.push("Acupressão: modelo de recrutamento mecânico simplificado (curva sigmoide da pressão) " + "[PREMISSA]");
    } else if (tl === "hist" && g.AxonHisto) {
      // ablação: foco a p.depth cm; fibras dentro da lesão perdem a condução, sem seletividade por calibre
      const H = g.AxonHisto, ctx = g.AxonContext && g.AxonContext.ctx, tis = ctx && ctx.kind === "musculo" ? "musculo" : ctx && ctx.kind === "nervo" ? "nervo" : ctx && ctx.kind === "osso" ? "osso" : "mole";
      const F = H.focal(Object.assign({}, p, { depth: p.depth || 4 }), tis), dist = Math.abs(nn.mm - (p.depth || 4) * 10), hit = H.onNerve(F, dist);
      classes = ["Aα", "Aβ", "Aδ", "C"].map(c => ({ cls: c, frac: hit.hit, note: "destruição mecânica (irreversível)" }));
      IX.hist = { F, dist, hit };
      lim.push(`Histotripsia: pressão in situ ${fmt(F.pin, 1)} MPa (limiar ${fmt(F.pt, 1)} MPa no tecido ${tis}); probabilidade de cavitação por pulso ${fmt(F.P1 * 100, 0)} %; lesão ≈ ${fmt(F.rl * 2, 1)} × ${fmt(F.al * 2, 1)} mm; ${hit.txt}. Ablação, não neuromodulação [LITERATURA: Maxwell 2013; Vlaisavljevich 2015] [PREMISSA: atenuação linear, zona focal ideal]`);
    } else if (tl === "lifu") {
      classes = [{ cls: "Aβ", frac: Math.min(1, p.U / 2500) }, { cls: "Aδ", frac: Math.max(0, (p.U - 1500) / 3000) }]; lim.push("LIFU: neuromodulação ultrassônica tem mecanismo em investigação; curva ilustrativa [HIPÓTESE]");
    } else {
      const ds = Dstar(Ieff, rcm, pw);
      classes = (pred ? pred.classes : []).filter(c => g.AxonMorpho.CL[c.cls].my && c.cls !== "Aα").map(c => { const sd = Math.max(.25, (c.D.p90 - c.D.p10) / 2.563); const f = ds.D === Infinity ? 0 : 1 - phi((ds.D - c.D.med) / sd);
        return { cls: c.cls, frac: Math.max(0, Math.min(1, f)), Dmed: c.D.med, sd, cv: c.cv, share: c.share }; });
      // motor: tronco profundo
      const dm = surface ? nn.mm : dCut, Im = I * trans * frac * att(dm), dsm = Dstar(Im, Math.min(1.5, Math.max(.3, dm)) / 10, pw), aa = pred && pred.classes.find(c => c.cls === "Aα");
      const motor = aa ? 1 - phi((dsm.D - aa.D.med) / Math.max(.25, (aa.D.p90 - aa.D.p10) / 2.563)) : (dsm.D < 13 ? .3 : 0);
      classes.unshift({ cls: "Aα", frac: dsm.D === Infinity ? 0 : Math.max(0, Math.min(1, motor)), Dmed: aa ? aa.D.med : 14, note: `tronco a ${fmt(dm, 0)} mm` });
      IX.lastDs = ds.D;
      if (dCut > 1.5) lim.push(`Distância de ${fmt(dCut)} mm fora do domínio verificado (0,3–1,5 mm): atenuação exponencial didática [PREMISSA]`);
      if (surface) lim.push(`Só uma fração (${fmt(frac * 100, 1)} %) da corrente do eletrodo chega ao ramo cutâneo (espalhamento ∝ 1/√área) [PREMISSA]`);
      lim.push("Fibras C (amielínicas) fora do núcleo nodal: limiar muito maior, não calculado aqui");
    }
    const f = c => (classes.find(x => x.cls === c) || {}).frac || 0;
    const per = f("Aδ") > .25 ? ["dor", "#ff5d5d"] : f("Aδ") > .05 ? ["desconforto / picada", "#ffb36b"] : f("Aβ") > .3 ? ["parestesia forte, confortável", "#ffd166"] : f("Aβ") > .02 ? ["formigamento (limiar de percepção)", "#3ee6c5"] : ["imperceptível", "#8fb3bd"];
    lim.push("Limiares de percepção, desconforto e dor como frações de Aβ/Aδ recrutadas: convenção didática [PREMISSA]");
    lim.push("Geometria anatômica genérica (BodyParts3D) deformada pela biometria; nervos periféricos como trajetos didáticos [PREMISSA]");
    // alertas do paciente: gestação, ascite, caquexia
    const alerts = [], V = st.v || {}, D = g.AxonDissect, zone = D && D.trunkZone ? D.trunkZone(det.point) : null, elec = ["tens", "ea", "tavns"].includes(tl);
    const code = (det.name || "").toUpperCase(), SAF = g.AxonAcuData && g.AxonAcuData.SAFETY;
    if (V.preg > 0) {
      if (elec && zone) alerts.push(`Gestação de ${V.preg} semanas: corrente elétrica sobre ${zone === "lombossacral" ? "a região lombossacral" : zone === "pelve" ? "a pelve" : "o abdome"} é contraindicada ou exige precaução [LITERATURA: Electrophysical agents – contraindications and precautions, Physiother Can 2010;62(5):1-80]`);
      if (SAF && SAF.pregnancy.includes(code)) alerts.push(`${code} está entre os pontos tradicionalmente evitados na gestação (estímulo uterino) [LITERATURA: OMS, Guidelines on basic training and safety in acupuncture, 1999]`);
    }
    if (V.ascites >= 2 && zone && zone !== "lombossacral" && (tl === "ea" || tl === "acu")) alerts.push(`Ascite grau ${V.ascites}: parede abdominal distendida; agulha ou pressão profunda no abdome podem atingir líquido e vísceras [PREMISSA]`);
    if (tl === "hist") { alerts.push("Histotripsia é ablativa: o tecido no foco é destruído de forma irreversível; não é neuromodulação [LITERATURA: Xu 2021]");
      if (IX.hist && IX.hist.hit.hit > 0) alerts.push(`O nervo ${nn.name || ""} está dentro da lesão simulada: perda de condução em todas as classes de fibra`);
      if (zone === "abdome" || zone === "pelve") alerts.push("No abdome, gás intestinal no trajeto do feixe bloqueia ou desvia a energia [PREMISSA]"); }
    if (V.wasting > .3 && tl === "ea") alerts.push("Pouca gordura subcutânea (caquexia simulada): nervos, vasos e ossos ficam mais superficiais; reduza a profundidade [PREMISSA]");
    const sh = out.sh;
    return { alerts, t: Date.now(), tool: tl, mod: st.mod, I, f: p.f, pw: p.pw, area: p.area, P: p.P, depth: needle ? IX.depth : null, point: det.point, derm: det.code || null, name: det.name || null, nerve: nn.name, mm: nn.mm,
      dCut, frac, trans, Ieff, Dstar: IX.lastDs, classes, motor: f("Aα"), perception: per[0], perColor: per[1], shannon: sh ? sh.k : null, shannonOk: sh ? sh.ok !== false : true,
      patient: g.AxonMorpho ? g.AxonMorpho.patient() : null, caseTitle: g.AxonSim && g.AxonSim.case ? g.AxonSim.case.title : null, lim, holdS: o.holdS || 0, source: det.source || "corpo" };
  }

  // ---------------------------------------------------------------- explicação (assistente) e feedback visual
  function explainShort(r) {
    const top = r.classes.filter(c => c.frac > .02).map(c => `${c.cls} ${fmt(c.frac * 100, 0)} %`).join(", ") || "nenhuma classe";
    return `Calculei o limiar de cada classe de fibra a ${fmt(r.dCut)} mm do ramo nervoso (${short(r.nerve)}). Com ${fmt(r.I)} mA (${fmt(r.Ieff, 3)} mA efetivos), recrutam-se: ${top}. Sensação prevista: ${r.perception}.`;
  }
  const short = n => String(n || "").replace(/ right$/, " (D)").replace(/ left$/, " (E)");
  function explainHTML(r) {
    if (!r) return `<p class="note">Aplique um instrumento no corpo (2º clique no mesmo ponto ou clique e segure) para ver o cálculo explicado.</p>`;
    const goal = r.tool === "tavns" ? "verificar se a corrente ativa as aferentes Aβ do ramo auricular do vago sem recrutar Aδ (dor) — condição para modular o NTS"
      : r.tool === "ea" ? "verificar quais classes a agulha recruta conforme a distância da ponta ao tronco e se há contração (Aα), base dos efeitos de 2 Hz e 100 Hz"
      : r.tool === "acu" ? "verificar se a pressão fica abaixo do limiar de dor à pressão enquanto ativa mecanorreceptores"
      : "verificar se a intensidade ativa Aβ (controle de portão) sem atingir Aδ (dor) ou Aα (contração)";
    return `<div class="card xp"><h4 class="ih" data-tip="O que foi calculado nesta aplicação">🧮 Cálculo</h4><p>${esc(explainShort(r))} ${tag("mod")}</p>
      <h4 class="ih" data-tip="Por que o modelo chega a esse resultado">💡 Por quê</h4><p>O limiar de uma fibra mielinizada cai com o diâmetro e sobe com a distância ao eletrodo (função de ativação no modelo nodal de 41 nós). Por isso, a uma mesma corrente, as fibras mais grossas respondem primeiro: o menor diâmetro recrutado agora é <b>D* = ${isFinite(r.Dstar) ? fmt(r.Dstar) + " µm" : "> 16 µm (nenhuma)"}</b>. ${tag("lit")}</p>
      <h4 class="ih" data-tip="O que está acontecendo no tecido e no nervo">▶ Agora</h4><p>${esc(TOOLN[r.tool] || r.tool)} em ${esc(r.derm ? "dermátomo " + r.derm : r.name || "ponto")}; nervo mais próximo: ${esc(short(r.nerve))} a ${fmt(r.mm, 0)} mm. Sensação: <b style="color:${r.perColor}">${esc(r.perception)}</b>${r.motor > .05 ? " · contração muscular prevista" : ""}. O trajeto ativado aparece em azul no corpo, com o pulso na velocidade da classe mais recrutada.</p>
      <h4 class="ih" data-tip="O que se busca descobrir com este teste">🎯 Objetivo</h4><p>${esc(goal)}.</p>
      <h4 class="ih" data-tip="Fração recrutada de cada classe de fibra">🧵 Fibras</h4><table class="tbl">${r.classes.map(c => `<tr><td><b>${c.cls}</b></td><td><div class="bar"><i style="width:${(c.frac * 100).toFixed(0)}%"></i></div></td><td>${fmt(c.frac * 100, 0)} %</td><td><small>${c.Dmed ? "D mediano " + fmt(c.Dmed) + " µm" : esc(c.note || "")}</small></td></tr>`).join("")}</table>
      <h4 class="ih" data-tip="Escolha um diâmetro de fibra e veja o limiar nesse ponto">⌀ Diâmetro</h4><div class="ctl"><label><span>Diâmetro da fibra</span><output id="xD">${fmt(IX.Dsel)} µm</output></label><input type="range" id="xDs" min="1" max="16" step=".1" value="${IX.Dsel}"></div><div id="xDo">${dsel(r)}</div>
      ${(r.alerts || []).length ? `<div class="warnbox"><b>⚠ Atenção ao paciente simulado</b><ul class="lim">${r.alerts.map(a => `<li>${esc(a)}</li>`).join("")}</ul></div>` : ""}
      <details class="limd"><summary class="ih" data-tip="O que o modelo não representa, em linguagem didática">ⓘ Limitações (${r.lim.length})</summary><ul class="lim">${r.lim.map(l => `<li>${esc(l)}</li>`).join("")}</ul></details>
      <details ${IX.adv ? "open" : ""} id="xAdv"><summary class="ih" data-tip="Todas as variáveis da interação e a fórmula usada">⚙ Avançado</summary><table class="tbl">${[
        ["Corrente programada", fmt(r.I, 2) + " mA"], ["Transmissão tecidual", fmt(r.trans, 3)], ["Fração que chega ao ramo", fmt(r.frac, 4)], ["Corrente efetiva", fmt(r.Ieff, 4) + " mA"],
        ["Distância eletrodo–fibra", fmt(r.dCut, 2) + " mm"], ["Largura de pulso · frequência", `${r.pw} µs · ${r.f} Hz`], ["Área do eletrodo", fmt(r.area) + " cm²"], ["Shannon k", r.shannon == null ? "—" : fmt(r.shannon, 2) + (r.shannonOk ? " (dentro de k < 1,85)" : " (acima do limite)")],
        ["Paciente", r.patient ? `${r.patient.sex} ${r.patient.age} anos · ${r.patient.height} cm · IMC ${fmt(r.patient.bmi)}` : "—"], ["Tempo de exposição", fmt(r.holdS) + " s"]].map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}</td></tr>`).join("")}</table>
        <p class="note">Ith(D, r) = V<sub>th</sub>/h(D, r) com o modelo nodal verificado (semente 42); D* por bissecção em log D; fração recrutada = 1 − Φ((D* − D<sub>med</sub>)/σ) com a distribuição do preditor morfométrico.</p></details>
      <div class="ibar" style="position:static;padding-top:8px"><button class="ib" id="xNote" data-tip="Anotar esta interação nas notas (post-its)">📝</button><button class="ib" id="xTests" data-tip="${IX.test.on ? "Ver o registro de testes" : "Iniciar uma sessão de testes"}">🧪</button></div></div>`;
  }
  function dsel(r) {
    const D = IX.Dsel, rcm = Math.min(1.5, Math.max(.3, r.dCut)) / 10, th = M().Ith(D, rcm, { pw: (r.pw || 100) * 1e-6 }) * 1e3, cls = Object.entries(g.AxonMorpho.CL).filter(([, c]) => c.my && D >= c.lo && D <= c.hi).map(([k]) => k).join(" / ") || "—";
    const on = r.Ieff >= th;
    return `<p>Uma fibra de <b>${fmt(D)} µm</b> (${esc(cls)}) a ${fmt(r.dCut)} mm tem limiar de <b>${fmt(th, 3)} mA</b>; a corrente efetiva é ${fmt(r.Ieff, 3)} mA → <b style="color:${on ? "#3ee6c5" : "#ff9a8a"}">${on ? "recrutada" : "não recrutada"}</b>. ${tag("mod")}</p>`;
  }
  function feedback(r) {
    const Mo = g.AxonMorpho; if (!Mo || !r.point) return;
    const best = [...r.classes].filter(c => c.cls !== "Aα").sort((a, b) => b.frac - a.frac)[0], col = !best || best.frac < .02 ? 0x8fb3bd : { "Aβ": 0x4fb3ff, "Aδ": 0xff8a3d, "Aγ": 0x3ee6c5, B: 0xffd166 }[best.cls] || 0x4fb3ff;
    const nerve = /nervo cutâneo|procedural/.test(r.nerve) ? null : r.nerve; const seg = r.derm && /^[CTLS]\d/.test(r.derm) ? r.derm : null;
    const P = Mo.axonPath({ nerve, root: seg, target: r.point, kind: "sens" }); if (P) Mo.drawPath(P, col, "sens");
    if (nerve) ST().highlight({ nerves: [nerve], nerveColor: col, seg: seg || undefined, reveal: false });
    if (r.motor > .05) ST().reflex("twitch");
  }
  function botSay(t) { try { A().botSay(t); } catch (e) {} }

  // ---------------------------------------------------------------- aplicar
  function applyAt(det, o = {}) {
    const tl = o.tool || tool(); if (!tl) { openTools("Escolha uma ferramenta para testar neste ponto."); IX.pending = det; return null; }
    const nn = ST().placeTool(tl, det.point, det.normal); det.nn = nn;
    if (det.ear && tl === "tavns") det.name = det.name || "concha (orelha)";
    const r = evaluate(det, Object.assign({ tool: tl }, o)); IX.res = r; feedback(r);
    if (!o.quiet) botSay(explainShort(r) + ((r.alerts || []).length ? " ⚠ " + r.alerts[0].replace(/\s*\[[^\]]+\]$/, "") : ""));
    log(r); render(); document.dispatchEvent(new CustomEvent("axon:interact", { detail: r }));
    return r;
  }
  function openVisibility(det) {
    A().openApp("depth"); const b = A().body("depth"); if (b && det) { const box = document.createElement("div"); box.className = "card vishint"; box.innerHTML = `<h4>Selecionado: ${esc(det.name || det.layer || "estrutura")}</h4><p class="note">Camada: <b>${esc(det.layer || "—")}</b>. Ajuste abaixo o que fica visível nesta vista; <a href="#" data-hide>ocultar esta camada</a> · <a href="#" data-only>mostrar só esta camada</a>.</p>`;
      b.prepend(box); const L = det.layer === "skeleton" ? "skeleton" : det.layer;
      box.querySelector("[data-hide]").onclick = ev => { ev.preventDefault(); if (L) ST().setLayer(L, false); };
      box.querySelector("[data-only]").onclick = ev => { ev.preventDefault(); ["skin", "muscles", "skeleton", "organs", "vessels", "nerves", "autonomic"].forEach(k => ST().setLayer(k, k === L)); }; }
    botSay("Painel de visibilidade: escolha o que mostrar ou ocultar nesta vista.");
  }
  function openTools(msg) { A().openApp("tools"); if (msg) botSay(msg); }
  function log(r) { if (!IX.test.on) return; IX.test.entries.push(Object.assign({ n: IX.test.entries.length + 1 }, r)); if (A().isOpen("tests")) testsWin(A().body("tests")); }

  // ---------------------------------------------------------------- gestos no canvas
  function hitAt(e) {
    const E = ST().ext(), cv = E.renderer.domElement, rc = cv.getBoundingClientRect(), T = E.T, ray = new T.Raycaster(), m = new T.Vector2((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
    ray.setFromCamera(m, E.camera); if (g.AxonAcu) { const ap = g.AxonAcu.pick(ray); if (ap) return { point: ap.p.p.toArray(), normal: ap.p.n ? ap.p.n.toArray() : null, code: ap.p.derm, name: `${ap.id} (${ap.side})`, acu: ap.id }; }
    const vis = (E.S.anatMeshes || []).filter(o => { let x = o; while (x) { if (!x.visible) return false; x = x.parent; } return true; });
    const h = ray.intersectObjects(vis)[0]; if (!h) return null; const geo = h.object.geometry, n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
    const det = { point: h.point.toArray(), normal: n.toArray(), layer: h.object.userData.layer };
    if (geo.attributes.derm) det.code = E.DERM[Math.round(geo.attributes.derm.getX(h.face.a))];
    if (geo.attributes.pid) { const pt = h.object.userData.parts[Math.round(geo.attributes.pid.getX(h.face.a))]; det.name = pt.pt || pt.name; det.en = pt.name; if (/ear/.test(pt.name)) det.ear = true; }
    return det;
  }
  function hud(e, txt, p, col) {
    let h = $("#ixHud"); if (!h) { h = document.createElement("div"); h.id = "ixHud"; h.className = "ixhud"; document.body.appendChild(h); }
    if (!txt) { h.hidden = true; return; } h.hidden = false; if (e) { h.style.left = e.clientX + 18 + "px"; h.style.top = e.clientY - 10 + "px"; }
    h.innerHTML = `<svg viewBox="0 0 36 36" width="34" height="34"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="4"/><circle cx="18" cy="18" r="15" fill="none" stroke="${col || "#3ee6c5"}" stroke-width="4" stroke-dasharray="${(p * 94.2).toFixed(1)} 94.2" transform="rotate(-90 18 18)"/></svg><div>${txt}</div>`;
  }
  function bindCanvas() {
    const cv = ST().ext().renderer.domElement; let down = null, timer = 0;
    cv.addEventListener("pointerdown", e => {
      if (e.button !== 0) return; const now = performance.now(), lc = IX.lastClick;
      down = { x: e.clientX, y: e.clientY, t: now, moved: 0, dbl: lc && now - lc.t < 500 && Math.hypot(e.clientX - lc.x, e.clientY - lc.y) < 18, used: false };
      clearTimeout(timer); timer = setTimeout(() => { if (!down || down.moved > 5) return; down.used = true;
        if (down.dbl) { const det = hitAt(e); const L = ST().level; if (L === 1 && det && g.AxonContext) g.AxonContext.set(det, true); if (L < 5) { if (det && L === 1) ST().ext().focusOn(det.point, det.normal, .3); setTimeout(() => ST().setLevel(L + 1), 120); botSay(`Entrando no nível ${L + 1} a partir deste ponto.`); } return; }
        const det = hitAt(e); if (!det) return; if (!tool()) { openTools("Escolha uma ferramenta: depois, clique e segure para aplicar com rampa de intensidade."); return; }
        startHold(e, det); }, 450);
    }, true);
    cv.addEventListener("pointermove", e => { if (down) { down.moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0); if (down.moved > 5) clearTimeout(timer); } if (IX.hold) IX.hold.e = e; }, true);
    cv.addEventListener("pointerup", e => {
      clearTimeout(timer); const d = down; down = null; if (!d) return;
      if (IX.hold) { e.stopImmediatePropagation(); endHold(); return; }
      if (d.used) { e.stopImmediatePropagation(); IX.lastClick = null; return; }
      if (d.moved > 5) return;
      const now = performance.now(), lc = IX.lastClick;
      // cliques rápidos em sequência: o 4º abre o painel de visibilidade (o que mostrar ou ocultar nesta vista)
      IX.burst = IX.burst && now - IX.burst.t < 500 && Math.hypot(e.clientX - IX.burst.x, e.clientY - IX.burst.y) < 24 ? { n: IX.burst.n + 1, t: now, x: e.clientX, y: e.clientY } : { n: 1, t: now, x: e.clientX, y: e.clientY };
      if (IX.burst.n >= 4) { e.stopImmediatePropagation(); IX.burst = null; IX.lastClick = null; const det = hitAt(e); openVisibility(det); return; }
      if (lc && now - lc.t > 650 && now - lc.t < 10000 && Math.hypot(e.clientX - lc.x, e.clientY - lc.y) < 18) {   // 2º clique tardio no mesmo ponto
        e.stopImmediatePropagation(); IX.lastClick = null; const det = hitAt(e); if (!det) return;
        if (tool()) applyAt(det); else { IX.pending = det; openTools("Escolha a ferramenta para testar neste ponto."); } return;
      }
      if (g.AxonAcu && g.AxonAcu.S.show) { const det = hitAt(e); if (det && det.acu) { e.stopImmediatePropagation(); g.AxonAcu.select(det.acu, false); if (g.AxonAtlas) g.AxonAtlas.open("acu", det.acu); IX.lastClick = { x: e.clientX, y: e.clientY, t: now, det }; return; } }
      IX.lastClick = { x: e.clientX, y: e.clientY, t: now }; setTimeout(checkView, 400);
    }, true);
    cv.addEventListener("wheel", e => { if (!IX.lupa) return; e.preventDefault(); e.stopImmediatePropagation(); const k = ST().ext().cam; k.goal = null; k.dist = Math.max(.04, Math.min(8, k.dist * Math.exp(e.deltaY * .001))); }, { capture: true, passive: false });
  }
  function startHold(e, det) {
    const st = A().state, target = st.p.I, t0 = performance.now(), tl = tool(); const nn = ST().placeTool(tl, det.point, det.normal); det.nn = nn;
    IX.hold = { e, det, t0, target, last: 0 }; botSay(`Aplicação contínua com rampa até ${fmt(target)} mA em ${IX.rampS} s. Solte para encerrar.`);
    const step = () => { const H = IX.hold; if (!H) return; const s = (performance.now() - H.t0) / 1000, I = tl === "acu" ? target : Math.min(target, target * s / IX.rampS);
      if (s - H.last > .12) { H.last = s; const r = evaluate(det, { I, holdS: s, tool: tl }); H.r = r; IX.res = r; if (A().isOpen("explain")) render();
        hud(H.e, `<b>${esc(TOOLN[tl])}</b><br>${fmt(I, 2)} mA · ${fmt(s)} s<br><span style="color:${r.perColor}">${esc(r.perception)}</span>${r.motor > .05 ? "<br>contração" : ""}`, Math.min(1, s / IX.rampS), r.perColor); }
      H.raf = requestAnimationFrame(step); }; step();
  }
  function endHold() { const H = IX.hold; IX.hold = null; if (!H) return; cancelAnimationFrame(H.raf); hud(null); const r = H.r || evaluate(H.det, { I: 0, holdS: 0 }); IX.res = r; feedback(r); botSay(explainShort(r) + ` Exposição: ${fmt(r.holdS)} s.`); log(r); render(); A().openApp("explain"); }

  // ---------------------------------------------------------------- lupa e verificação de visibilidade
  function lupaUI() {
    let el = $("#ixLupa"); if (!el) { el = document.createElement("div"); el.id = "ixLupa"; el.className = "ixlupa notr"; ($("#stage") || document.body).appendChild(el); }
    el.innerHTML = `<button data-z="in" title="Ampliar sem mudar de nível">＋</button><button data-z="lupa" class="${IX.lupa ? "on" : ""}" title="Lupa: a roda amplia sem trocar de nível">🔍</button><button data-z="out" title="Reduzir">－</button><div class="ixhint" id="ixHint" hidden></div>`;
    $$("button", el).forEach(b => b.onclick = () => { const k = ST().ext().cam; k.goal = null; if (b.dataset.z === "lupa") { IX.lupa = !IX.lupa; lupaUI(); botSay(IX.lupa ? "Lupa ligada: a roda do mouse amplia sem mudar de nível. Para entrar no nível seguinte, clique duas vezes e segure." : "Lupa desligada: a roda volta ao zoom por níveis."); return; }
      k.dist = Math.max(.04, k.dist * (b.dataset.z === "in" ? .7 : 1.4)); });
  }
  function checkView() {
    const host = ST().ext().renderer.domElement, w = host.clientWidth, hint = $("#ixHint"); if (!hint) return;
    const k = ST().ext().cam, small = w < 700 || (ST().level === 1 && k.dist > 2.2);
    hint.hidden = !small; if (small) { hint.innerHTML = `${w < 700 ? "Área de visualização pequena" : "Estruturas pequenas na tela"} · <a href="#" id="ixZoom">ampliar sem trocar de nível</a>`; $("#ixZoom").onclick = ev => { ev.preventDefault(); const r = IX.res; if (r && r.point) ST().ext().focusOn(r.point, null, .35); else { k.goal = null; k.dist *= .45; } IX.lupa = true; lupaUI(); }; }
  }

  // ---------------------------------------------------------------- janelas
  function render() { if (A().isOpen("explain")) explainWin(A().body("explain")); }
  function explainWin(b) {
    b.innerHTML = `<div class="ibar" style="position:static"><span class="ib" data-tip="Gestos: 1 clique seleciona · 2º clique no mesmo ponto (após uma pausa) aplica · clique e segure aplica com rampa de ${IX.rampS} s · duplo clique segurando entra no nível seguinte · 4 cliques: o que fica visível · 🔍 amplia sem trocar de nível">✋</span>
      ${tool() ? `<span class="ist" data-tip="Instrumento em uso">${esc(TOOLN[tool()] || tool())}</span>` : `<button class="ib" id="xT" data-tip="Escolher o instrumento">✚</button>`}<span class="sp"></span>
      ${tool() === "ea" ? `<label class="ictl" data-tip="Profundidade da agulha (mm)">↧<input type="number" id="xDep" min="1" max="40" step=".5" value="${IX.depth}"></label>` : ""}<label class="ictl" data-tip="Rampa: segundos até a intensidade programada ao clicar e segurar">⤴<input type="number" id="xR" min="1" max="15" step=".5" value="${IX.rampS}"></label></div>
      ${explainHTML(IX.res)}`;
    const xt = $("#xT", b); if (xt) xt.onclick = ev => { ev.preventDefault(); openTools(); };
    const dp = $("#xDep", b); if (dp) dp.onchange = e => { IX.depth = +e.target.value; };
    $("#xR", b).onchange = e => { IX.rampS = Math.max(1, +e.target.value); };
    const ds = $("#xDs", b); if (ds) ds.oninput = e => { IX.Dsel = +e.target.value; $("#xD", b).textContent = fmt(IX.Dsel) + " µm"; $("#xDo", b).innerHTML = dsel(IX.res); };
    const ad = $("#xAdv", b); if (ad) ad.ontoggle = () => { IX.adv = ad.open; };
    const nb = $("#xNote", b); if (nb) nb.onclick = () => g.AxonNotes && g.AxonNotes.fromInteraction(IX.res);
    const tb = $("#xTests", b); if (tb) tb.onclick = () => { if (!IX.test.on) startTests(); A().openApp("tests"); };
  }
  function startTests() {
    IX.test = { on: true, id: "T" + Date.now().toString(36).toUpperCase(), start: Date.now(), entries: [], caseTitle: g.AxonSim && g.AxonSim.case ? g.AxonSim.case.title : null, patient: g.AxonMorpho ? g.AxonMorpho.patient() : null };
    botSay("Testes iniciados: cada aplicação fica registrada com todas as variáveis, para o relatório e o diário de bordo."); document.dispatchEvent(new CustomEvent("axon:tests", { detail: { on: true, id: IX.test.id } })); syncBtn();
  }
  function stopTests() {
    const T = IX.test; T.on = false; T.end = Date.now(); botSay(`Testes encerrados: ${T.entries.length} interações registradas.`);
    if (g.AxonNotes) g.AxonNotes.ingestSession(T); document.dispatchEvent(new CustomEvent("axon:tests", { detail: { on: false, id: T.id, n: T.entries.length } })); syncBtn();
  }
  function syncBtn() { $$("[data-ix=tests]").forEach(b => { b.classList.toggle("on", IX.test.on); b.title = IX.test.on ? "Encerrar testes" : "Iniciar testes"; }); }
  const CSVH = ["n", "hora", "ferramenta", "mA", "Hz", "µs", "cm²", "dermátomo", "estrutura", "nervo", "mm", "d_fibra_mm", "I_efetiva_mA", "D*_µm", "Aα", "Aβ", "Aδ", "percepção", "exposição_s", "Shannon_k"];
  function row(e) { const f = c => fmt(((e.classes.find(x => x.cls === c) || {}).frac || 0) * 100, 0); return [e.n, new Date(e.t).toLocaleTimeString(), e.tool, fmt(e.I, 2), e.f, e.pw, e.area, e.derm || "", e.name || "", short(e.nerve), fmt(e.mm, 0), fmt(e.dCut, 2), fmt(e.Ieff, 4), isFinite(e.Dstar) ? fmt(e.Dstar, 2) : ">16", f("Aα"), f("Aβ"), f("Aδ"), e.perception, fmt(e.holdS, 1), e.shannon == null ? "" : fmt(e.shannon, 2)]; }
  function download(name, txt, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  // registro de testes: barra de ícones (descrição ao passar o mouse), um teste por linha que se abre ao clicar
  const TV = { full: false, lim: false, open: null };
  const TOOLIC = { tens: "⚡", ea: "📍", acu: "👆", tavns: "👂", lifu: "〰", hist: "💥" };
  function testsWin(b) {
    const T = IX.test, n = T.entries.length, pc = (e, c) => ((e.classes.find(x => x.cls === c) || {}).frac || 0) * 100;
    const ib = (id, ic, tip, on, dis) => `<button class="ib${on ? " on" : ""}" id="${id}" data-tip="${esc(tip)}" aria-label="${esc(tip)}" ${dis ? "disabled" : ""}>${ic}</button>`;
    b.innerHTML = `<div class="ibar">${T.on ? ib("tsStop", "■", "Encerrar a sessão de testes; ela vai para as notas e o diário de bordo", false, false) : ib("tsStart", "▶", "Iniciar uma sessão de testes: cada aplicação passa a ser registrada com todas as variáveis", false, false)}
        <span class="ist">${T.on ? `<i class="dotlive"></i>${n} ${n === 1 ? "teste" : "testes"}` : n ? `${n} ${n === 1 ? "teste" : "testes"}` : "pronto para registrar"}${T.caseTitle ? ` · <span title="${esc(T.caseTitle)}">${esc(T.caseTitle.slice(0, 26))}</span>` : ""}</span>
        <span class="sp"></span>${ib("tsFull", "▦", "Tabela completa com todas as colunas", TV.full, !n)}${ib("tsLim", "ⓘ", "Limitações do modelo em linguagem didática", TV.lim, false)}${ib("tsCsv", "⤓", "Baixar CSV (planilha)", false, !n)}${ib("tsJson", "{ }", "Baixar JSON (dados completos)", false, !n)}</div>
      ${!n ? `<div class="empty"><div class="eic">🧪</div><p>${T.on ? "Aplique um instrumento no corpo: cada aplicação aparece aqui." : "Toque em ▶ para começar. Cada aplicação no corpo vira uma linha."}</p></div>` : TV.full
        ? `<div class="scroll"><table class="tbl mo"><tr>${CSVH.map(h => `<th>${h}</th>`).join("")}</tr>${T.entries.slice().reverse().map(e => `<tr>${row(e).map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table></div>`
        : `<ul class="tlist">${T.entries.slice().reverse().map(e => `<li class="${TV.open === e.n ? "open" : ""}" data-n="${e.n}"><div class="tl-h" data-tip="${esc(e.perception)} · clique para ver todas as variáveis">
            <span class="tl-ic">${TOOLIC[e.tool] || "•"}</span><span class="tl-n">${esc(e.name || e.derm || "ponto")}<small>${new Date(e.t).toLocaleTimeString().slice(0, 5)} · ${fmt(e.I, 1)} mA · ${e.f} Hz</small></span>
            <span class="tl-b"><i style="--v:${pc(e, "Aβ")}%" class="ab" data-tip="Aβ (tato) ${fmt(pc(e, "Aβ"), 0)} %"></i><i style="--v:${pc(e, "Aδ")}%" class="ad" data-tip="Aδ (dor) ${fmt(pc(e, "Aδ"), 0)} %"></i></span>
            <span class="tl-p" style="--c:${e.perColor || "#9fc7c0"}"></span>${(e.alerts || []).length ? `<span class="tl-w" data-tip="${esc(e.alerts[0])}">⚠</span>` : ""}</div>
            ${TV.open === e.n ? `<dl class="tl-d">${CSVH.map((h, i) => `<dt>${h}</dt><dd>${esc(row(e)[i])}</dd>`).join("")}</dl>` : ""}</li>`).join("")}</ul>`}
      ${TV.lim ? `<div class="card lim-c"><ul class="lim">${[...new Set(T.entries.flatMap(e => e.lim))].map(l => `<li>${esc(l)}</li>`).join("") || "<li>As limitações de cada interação aparecem aqui depois do primeiro teste.</li>"}</ul></div>` : ""}`;
    const on = (id, f) => { const x = $("#" + id, b); if (x) x.onclick = f; };
    on("tsStart", () => { startTests(); testsWin(b); }); on("tsStop", () => { stopTests(); testsWin(b); });
    on("tsFull", () => { TV.full = !TV.full; testsWin(b); }); on("tsLim", () => { TV.lim = !TV.lim; testsWin(b); });
    on("tsCsv", () => download(`axon-testes-${T.id}.csv`, [CSVH, ...T.entries.map(row)].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n"), "text/csv"));
    on("tsJson", () => download(`axon-testes-${T.id}.json`, JSON.stringify(T, null, 1), "application/json"));
    $$(".tlist .tl-h", b).forEach(h => h.onclick = () => { const k = +h.parentNode.dataset.n; TV.open = TV.open === k ? null : k; testsWin(b); });
  }
  function boot() {
    if (!A() || !A().registerApp || !ST() || !ST().ext || !ST().ext().renderer) return setTimeout(boot, 120);
    A().registerApp("explain", { title: "explain", w: 520, h: 760, render: explainWin }); A().registerApp("tests", { title: "tests", w: 760, h: 560, render: testsWin });
    bindCanvas(); lupaUI(); new ResizeObserver(() => checkView()).observe(ST().ext().renderer.domElement);
    document.addEventListener("axon:instr", () => { if (IX.pending && tool()) { const d = IX.pending; IX.pending = null; applyAt(d); } render(); });
  }
  boot();
  g.AxonInteract = { IX, Dstar, phi, applyAt, evaluate, startTests, stopTests, explainShort, get result() { return IX.res; } };
})(window);
