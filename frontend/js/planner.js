/* axon · planner.js — plano terapêutico in silico: caso → alvo e objetivos → técnicas ordenadas por adequação (%),
   com justificativa por fator, parâmetros sugeridos, tempo de tratamento, riscos e benefícios, mapa interativo de
   parâmetros (frequência × intensidade), trajetória do desfecho e desfecho resumido (objetivo e subjetivo).
   Desfechos vêm da rede fisiológica (physio.js) com Monte Carlo de semente fixa [HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO];
   pesos de evidência e de praticidade são escolhas editoriais do simulador [PREMISSA], expostas e ajustáveis.
   Ferramenta de ensino e pesquisa: nada aqui é prescrição para pessoas. */
(function (g) {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), fmt = (v, d = 1) => (v == null || isNaN(v) ? "—" : (+v).toFixed(d).replace(".", ","));
  const A = () => g.AxonApp, P = () => g.AxonPhysio, M = () => g.AxonModel;
  const tag = (k, t) => A() ? A().tagHTML(k, t) : "";

  const REF = {
    johnson22: "Johnson MI, Paley CA, Jones G, Mulvey MR, Wittkopf PG. Efficacy and safety of TENS for acute and chronic pain in adults: systematic review and meta-analysis of 381 studies (meta-TENS). BMJ Open. 2022;12:e051073.",
    sluka03: "Sluka KA, Walsh D. Transcutaneous electrical nerve stimulation: basic science mechanisms and clinical effectiveness. J Pain. 2003;4(3):109-21.",
    han03: "Han JS. Acupuncture: neuropeptide release produced by electrical stimulation of different frequencies. Trends Neurosci. 2003;26(1):17-22.",
    vick18: "Vickers AJ et al. Acupuncture for chronic pain: update of an individual patient data meta-analysis. J Pain. 2018;19(5):455-74.",
    farmer21: "Farmer AD et al. Minimum reporting standards in research on transcutaneous vagus nerve stimulation (2020). Front Hum Neurosci. 2021;14:568051.",
    brjp18: "YNSA em condições dolorosas: revisão sistemática. BrJP. 2018;1(2):180-3.",
    oleson: "Oleson T. Auriculotherapy Manual. 3rd ed. Elsevier; 2003.",
    farrar01: "Farrar JT, Young JP Jr, LaMoreaux L, Werth JL, Poole MR. Clinical importance of changes in chronic pain intensity measured on an 11-point numerical pain rating scale. Pain. 2001;94(2):149-58.",
    fischer87: "Fischer AA. Pressure algometry over normal muscles: standard values, validity and reproducibility of pressure threshold. Pain. 1987;30(1):115-26.",
    melzack65: "Melzack R, Wall PD. Pain mechanisms: a new theory. Science. 1965;150(3699):971-9.",
  };
  const R = k => `<span class="ref" title="${esc(REF[k])}">[${k}]</span>`;

  // ------------------------------------------------------------ catálogo de técnicas (parâmetros didáticos da literatura)
  const TECH = {
    tens_conv: { n: "TENS convencional", ic: "tens", mod: "tens", f: 100, pw: 100, irel: 1.6, min: 30, spw: 5, wk: 2, ev: .6, prat: 1, inv: false,
      par: "80–120 Hz · 50–100 µs · intensidade sensorial forte e confortável, sem contração", mech: "portão segmentar: fibras Aβ no segmento doloroso", refs: ["melzack65", "sluka03", "johnson22"],
      ben: ["Não invasiva, autoaplicável", "Início de ação em minutos", "Poucos efeitos adversos relatados"], risk: ["Irritação cutânea sob o eletrodo", "Evitar sobre seio carotídeo, pele lesionada e próximo a marca-passo", "Efeito cai com o uso contínuo (tolerância)"] },
    tens_acu: { n: "TENS acupuntura-like", ic: "tens", mod: "tens", f: 3, pw: 200, irel: 2.8, min: 30, spw: 3, wk: 3, ev: .55, prat: 1, inv: false,
      par: "2–4 Hz · 200–250 µs · intensidade até contração muscular visível e tolerável", mech: "opioides endógenos (encefalina, β-endorfina) e modulação descendente", refs: ["sluka03", "han03", "johnson22"],
      ben: ["Efeito mais duradouro que o convencional", "Útil quando o portão falha (Aβ comprometidas)"], risk: ["Desconforto pela contração", "Fadiga muscular", "Mesmas contraindicações do TENS"] },
    ea: { n: "Eletroacupuntura 2/100 Hz", ic: "ea", mod: "ea", f: 2, pw: 200, irel: 2.2, min: 30, spw: 2, wk: 5, ev: .7, prat: .7, inv: true,
      par: "2/100 Hz alternado · 0,5–2 mA · 20–30 min · pares local + distal", mech: "encefalinas (2 Hz) e dinorfina (100 Hz) somadas; portão local", refs: ["han03", "vick18"],
      ben: ["Maior base de ensaios entre as técnicas com agulha", "Ação segmentar e sistêmica"], risk: ["Invasiva: dor no agulhamento, hematoma", "Pneumotórax em pontos torácicos (raro)", "Infecção se a assepsia falhar"] },
    tavns: { n: "taVNS (cymba conchae)", ic: "tavns", mod: "tavns", f: 25, pw: 250, irel: 1.4, min: 30, spw: 5, wk: 4, ev: .4, prat: .95, inv: false,
      par: "20–30 Hz · 200–250 µs · abaixo do limiar de dor, na cymba (ABVN)", mech: "aferência vagal → NTS → inibição descendente; via anti-inflamatória (hipótese)", refs: ["farmer21"],
      ben: ["Não invasiva, sem efeito segmentar necessário", "Alvo racional na dor nociplástica"], risk: ["Bradicardia em suscetíveis (monitorar FC)", "Irritação auricular", "Evidência clínica ainda emergente"] },
    acu: { n: "Acupressão", ic: "acu", mod: "acu", f: 0, pw: 0, irel: 1, P: 150, min: 15, spw: 7, wk: 4, ev: .4, prat: 1, inv: false,
      par: "100–200 kPa por 1–2 min por ponto, abaixo do limiar de dor à pressão", mech: "mecanotransdução Aβ e opioides", refs: ["fischer87"],
      ben: ["Autoaplicável, sem equipamento"], risk: ["Pressão acima do limiar provoca dor", "Cuidado em pele frágil e anticoagulados"] },
    aur: { n: "Auriculoterapia", ic: "aur", mod: "acu", f: 0, pw: 0, irel: 1, P: 100, min: 10, spw: 3, wk: 4, ev: .4, prat: .9, inv: false,
      par: "sementes ou agulhas semipermanentes · Shenmen, Simpático e ponto somatotópico", mech: "estímulo na concha (ABVN) e somatotopia (hipótese)", refs: ["oleson"],
      ben: ["Baixo custo, entre sessões"], risk: ["Pericondrite com agulhas", "Somatotopia sem validação anatômica"] },
    ynsa: { n: "Craniopuntura YNSA", ic: "ynsa", mod: "ea", f: 2, pw: 200, irel: 1.2, min: 20, spw: 2, wk: 4, ev: .35, prat: .7, inv: true,
      par: "agulhas nos pontos básicos do couro cabeludo, 20 min", mech: "estímulo remoto: opioides e modulação descendente (hipótese)", refs: ["brjp18"],
      ben: ["Distante da área dolorosa"], risk: ["Invasiva", "Ensaios pequenos e de baixa qualidade"] },
  };
  // adequação do mecanismo à origem da dor [PREMISSA editorial, coerente com os mecanismos citados]
  const FIT = {
    nociceptiva: { tens_conv: .9, tens_acu: .7, ea: .8, acu: .6, aur: .5, ynsa: .5, tavns: .4 },
    "neuropática": { tens_conv: .7, tens_acu: .65, ea: .7, acu: .4, aur: .4, ynsa: .5, tavns: .5 },
    "nociplástica": { tens_conv: .4, tens_acu: .6, ea: .7, acu: .4, aur: .6, ynsa: .5, tavns: .85 },
  };
  const W = { fit: .3, model: .3, ev: .2, safe: .12, prat: .08 };

  // ------------------------------------------------------------ entradas do modelo fisiológico por técnica
  function recruit(irel) {
    const st = A().state, mc = st.mc; if (!mc) return { FA: .5, FD: .02 };
    let k0 = 0; while (k0 < 199 && mc.FA[k0] < .05) k0++; const I = mc.I[k0] * irel; let k = 0; while (k < 199 && mc.I[k + 1] <= I) k++;
    return { FA: mc.FA[k], FD: mc.FD[k] };
  }
  function uFor(id, o = {}) {
    const t = TECH[id], demy = A().state.v.demy || 0, irel = o.irel ?? t.irel, f = o.f ?? t.f;
    const base = { on: true, Faa: 0, freq: f, segMatch: 1, vagalSite: 0, pressureKPa: 0, k: -2, dT: 0, demy };
    if (id === "acu") return { ...base, FA: M().acupressure(o.P ?? t.P), FD: Math.max(0, ((o.P ?? t.P) - 250) / 300), freq: 0, pressureKPa: o.P ?? t.P };
    if (id === "aur") return { ...base, FA: .3, FD: .02, freq: 0, segMatch: 0, vagalSite: .6, pressureKPa: 0 };
    if (id === "ynsa") return { ...base, FA: .3, FD: .04, segMatch: 0 };
    if (id === "tavns") { const r = recruit(irel); return { ...base, FA: r.FA * .8, FD: r.FD * .5, segMatch: 0, vagalSite: 1 }; }
    const r = recruit(irel); let FA = r.FA * (1 - .55 * demy), FD = r.FD;
    if (id === "ea") { FA = Math.min(1, FA * 1.1); return { ...base, FA, FD, Faa: clamp((irel - 1.8) / 2, 0, .6) }; }
    return { ...base, FA, FD, Faa: id === "tens_acu" ? clamp((irel - 2) / 2, 0, .5) : 0 };
  }
  function safety(id, o = {}) {
    const t = TECH[id], irel = o.irel ?? t.irel; let s = 1;
    if (t.inv) s -= .15; if (id === "tavns") s -= .08; if (irel > 3.2) s -= (irel - 3.2) * .25; if (id === "acu" && (o.P ?? t.P) > 250) s -= .3;
    return clamp(s, 0, 1);
  }
  const sessionsOf = o => clamp(Math.round(o.spw * o.wk), 1, 40);

  // ------------------------------------------------------------ plano
  const PL = { sel: null, o: {}, weights: { ...W }, cache: {} };
  function caseNow() { return (g.AxonSim && g.AxonSim.case) || (g.AxonCases && g.AxonCases.list[0]); }
  function plan(cs) {
    const fitT = FIT[cs.pain.origin] || FIT.nociceptiva, rows = [];
    Object.keys(TECH).forEach(id => {
      const o = PL.o[id] || {}, t = TECH[id], u = uFor(id, o), oc = P().outcome(cs, u, o.min ?? t.min, 5, 80);
      const red = clamp((cs.pain.baseline - oc.off.median) / Math.max(1, cs.pain.baseline), 0, 1);
      rows.push({ id, t, u, oc, red, F: { fit: fitT[id] ?? .4, ev: t.ev, safe: safety(id, o), prat: t.prat } });
    });
    const maxRed = Math.max(.01, ...rows.map(r => r.red));
    rows.forEach(r => { r.F.model = r.red / maxRed; const w = PL.weights; r.score = w.fit * r.F.fit + w.model * r.F.model + w.ev * r.F.ev + w.safe * r.F.safe + w.prat * r.F.prat; r.score /= (w.fit + w.model + w.ev + w.safe + w.prat); });
    rows.sort((a, b) => b.score - a.score); return rows;
  }
  function trajectory(cs, id, o, N = 60) {
    const t = TECH[id], u = uFor(id, o), n = Math.min(12, sessionsOf({ spw: o.spw ?? t.spw, wk: o.wk ?? t.wk })), pts = [];
    for (let s = 0; s <= n; s++) { if (s === 0) { pts.push({ s, med: cs.pain.baseline, p10: cs.pain.baseline, p90: cs.pain.baseline }); continue; } const oc = P().outcome(cs, u, o.min ?? t.min, s, N); pts.push({ s, med: oc.off.median, p10: oc.off.p10, p90: oc.off.p90, pResp: oc.off.pResp, during: oc.median }); }
    return pts;
  }
  function metrics(cs, id, o) {
    const t = TECH[id], u = uFor(id, o), S = P().newState(cs); for (let k = 0; k < (o.min ?? t.min); k += .5) P().step(S, u, .5);
    const tr = trajectory(cs, id, o, 40), last = tr[tr.length - 1], frac = clamp((cs.pain.baseline - last.med) / Math.max(1, cs.pain.baseline), 0, 1);
    const ppt0 = 450 * (1 - .05 * cs.pain.baseline), ppt1 = ppt0 * (1 + .5 * frac), emg0 = 40 * (1 + .05 * cs.pain.baseline), emg1 = emg0 * (1 - .45 * frac);
    return { tr, last, frac, ppt0, ppt1, emg0, emg1, rmssd0: cs.autonomic?.rmssd || 35, rmssd1: S.out.hrv, hr0: cs.autonomic?.hr || 75, hr1: S.out.hr, resp: last.pResp ?? 0 };
  }

  // ------------------------------------------------------------ gráficos interativos (canvas)
  function heatmap(cv, cs, id, o, onPick) {
    const t = TECH[id], ctx = cv.getContext("2d"), Wd = cv.width, H = cv.height, F = [1, 2, 3, 5, 8, 15, 25, 40, 60, 80, 100, 130], I = [.8, 1, 1.3, 1.6, 2, 2.4, 2.8, 3.2, 3.6, 4];
    const pad = { l: 40, b: 26, t: 8, r: 8 }, cw = (Wd - pad.l - pad.r) / F.length, ch = (H - pad.t - pad.b) / I.length; const key = id + JSON.stringify(o) + cs.id;
    let grid = PL.cache[key]; if (!grid) { grid = []; I.forEach((ir, j) => F.forEach((f, i) => { const u = uFor(id, { ...o, f, irel: ir }), oc = P().outcome(cs, u, o.min ?? t.min, 3, 14); grid.push({ i, j, red: (cs.pain.baseline - (oc.median + oc.off.median) / 2) / cs.pain.baseline, FD: u.FD }); })); PL.cache[key] = grid; }
    ctx.clearRect(0, 0, Wd, H);
    grid.forEach(c => { const v = clamp(c.red, -.2, .7), x = pad.l + c.i * cw, y = H - pad.b - (c.j + 1) * ch; const tcol = v > 0 ? `rgba(17,184,151,${.15 + v * 1.1})` : `rgba(224,72,90,${.2 - v * 2})`;
      ctx.fillStyle = tcol; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2); if (c.FD > .2) { ctx.strokeStyle = "rgba(224,72,90,.9)"; ctx.lineWidth = 1.5; ctx.strokeRect(x + 2, y + 2, cw - 4, ch - 4); } });
    ctx.fillStyle = "#9fc0bb"; ctx.font = "10px JetBrains Mono, monospace"; F.forEach((f, i) => i % 2 === 0 && ctx.fillText(f, pad.l + i * cw + 3, H - 10)); I.forEach((ir, j) => ctx.fillText(ir + "×", 4, H - pad.b - j * ch - ch / 2 + 3));
    ctx.fillText("Hz →", Wd - 34, H - 2); ctx.save(); ctx.translate(10, 12); ctx.fillText("× limiar Aβ", 14, 0); ctx.restore();
    const fx = F.reduce((b, f, i) => Math.abs(Math.log(f) - Math.log((o.f ?? t.f) || 1)) < Math.abs(Math.log(F[b]) - Math.log((o.f ?? t.f) || 1)) ? i : b, 0), iy = I.reduce((b, ir, j) => Math.abs(ir - (o.irel ?? t.irel)) < Math.abs(I[b] - (o.irel ?? t.irel)) ? j : b, 0);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.strokeRect(pad.l + fx * cw + 1, H - pad.b - (iy + 1) * ch + 1, cw - 2, ch - 2);
    const pick = e => { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * Wd, y = (e.clientY - r.top) / r.height * H; const i = clamp(Math.floor((x - pad.l) / cw), 0, F.length - 1), j = clamp(Math.floor((H - pad.b - y) / ch), 0, I.length - 1); onPick(F[i], I[j]); };
    let down = false; cv.onpointerdown = e => { down = true; cv.setPointerCapture(e.pointerId); pick(e); }; cv.onpointermove = e => down && pick(e); cv.onpointerup = () => down = false;
  }
  function trajChart(cv, tr, baseline, nSel, onPick) {
    const ctx = cv.getContext("2d"), Wd = cv.width, H = cv.height, pad = { l: 30, b: 22, t: 10, r: 10 }, n = tr.length - 1;
    const X = s => pad.l + s / Math.max(1, n) * (Wd - pad.l - pad.r), Y = v => pad.t + (1 - v / 10) * (H - pad.t - pad.b);
    ctx.clearRect(0, 0, Wd, H); ctx.strokeStyle = "rgba(160,230,220,.15)"; for (let v = 0; v <= 10; v += 2) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(Wd - pad.r, Y(v)); ctx.stroke(); }
    ctx.fillStyle = "rgba(17,184,151,.18)"; ctx.beginPath(); tr.forEach((p, i) => i ? ctx.lineTo(X(p.s), Y(p.p90)) : ctx.moveTo(X(p.s), Y(p.p90))); [...tr].reverse().forEach(p => ctx.lineTo(X(p.s), Y(p.p10))); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#3ee6c5"; ctx.lineWidth = 2.5; ctx.beginPath(); tr.forEach((p, i) => i ? ctx.lineTo(X(p.s), Y(p.med)) : ctx.moveTo(X(p.s), Y(p.med))); ctx.stroke();
    ctx.setLineDash([4, 4]); ctx.strokeStyle = "#f2b632"; ctx.beginPath(); ctx.moveTo(pad.l, Y(baseline * .7)); ctx.lineTo(Wd - pad.r, Y(baseline * .7)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#f2b632"; ctx.font = "10px JetBrains Mono, monospace"; ctx.fillText("−30 %", Wd - 46, Y(baseline * .7) - 4);
    ctx.fillStyle = "#9fc0bb"; for (let v = 0; v <= 10; v += 2) ctx.fillText(v, 8, Y(v) + 3); tr.forEach(p => ctx.fillText(p.s, X(p.s) - 3, H - 6));
    if (nSel != null) { ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.moveTo(X(Math.min(n, nSel)), pad.t); ctx.lineTo(X(Math.min(n, nSel)), H - pad.b); ctx.stroke(); }
    let down = false; const pick = e => { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * Wd; onPick(clamp(Math.round((x - pad.l) / (Wd - pad.l - pad.r) * n), 1, n)); };
    cv.onpointerdown = e => { down = true; cv.setPointerCapture(e.pointerId); pick(e); }; cv.onpointermove = e => down && pick(e); cv.onpointerup = () => down = false;
  }
  function painMapSVG(cs, frac) {   // ponto de referência da dor: área antes e depois (centralização) [HIPÓTESE]
    const d = cs.pain.dermatomes.join(" "), Y = /^V|C2/.test(d) ? 32 : /C[4-7]/.test(d) ? 70 : /T/.test(d) ? 110 : /L[1-3]/.test(d) ? 170 : 205, Xc = /C[6-8]/.test(d) ? 38 : 60;
    const r0 = 14 + cs.pain.baseline * 1.8, r1 = r0 * (1 - .6 * frac), dy = /L5|S1|C6|C7/.test(d) ? 24 * (1 - frac) : 0;
    return `<svg viewBox="0 0 120 260" class="painmap" aria-label="Mapa da dor antes e depois"><path d="M60 10a14 14 0 1 1 0 28a14 14 0 1 1 0-28M44 42h32l8 74 14 66-6 2-16-60h-4l-6 132h-10l-4-100-4 100h-10l-6-132h-4l-16 60-6-2 14-66z" fill="#e9eef0" stroke="#b9c9c6"/>
      <circle cx="${Xc}" cy="${Y + 24}" r="${r0}" fill="rgba(224,72,90,.22)" stroke="#e0485a" stroke-dasharray="3 3"/><circle cx="${Xc}" cy="${Y + 24 - dy * 0}" r="${r1}" fill="rgba(224,72,90,.55)"/>${dy ? `<path d="M${Xc} ${Y + 24 + r0} v${dy}" stroke="#e0485a" stroke-width="3" opacity=".35"/>` : ""}</svg>`;
  }

  // ------------------------------------------------------------ janela
  function render(b) {
    const cs = caseNow(); if (!cs || !A().state.mc) { b.innerHTML = `<p class="note">Carregando o modelo…</p>`; setTimeout(() => b.isConnected && render(b), 800); return; }
    const rows = plan(cs); if (!PL.sel || !TECH[PL.sel]) PL.sel = rows[0].id;
    const id = PL.sel, t = TECH[id], o = Object.assign({ f: t.f, irel: t.irel, min: t.min, spw: t.spw, wk: t.wk, P: t.P }, PL.o[id] || {}); PL.o[id] = o;
    const m = metrics(cs, id, o), top = rows[0], nS = sessionsOf(o), C = g.AxonCases;
    const pt = g.AxonDissect && g.AxonDissect.PT.applied;
    b.innerHTML = `
      <div class="card plan-head"><div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><label class="ctl" style="flex:1;min-width:200px"><span class="note">Caso</span><select id="plCase">${C.list.map(c => `<option value="${esc(c.id)}" ${c.id === cs.id ? "selected" : ""}>${esc(c.title)}</option>`).join("")}</select></label>
        <button class="btn ghost" id="plDesc">Descrever outro caso…</button></div>
        <p class="note">Dor <b>${esc(cs.pain.origin)}</b> · EVA <b>${cs.pain.baseline}</b> · segmentos <b>${esc(cs.pain.dermatomes.join(", "))}</b>${pt ? ` · ${pt.sex === "F" ? "mulher" : "homem"}, ${pt.age} anos, IMC ${fmt(pt.bmi)}` : ""}${cs.pain.structures && cs.pain.structures.length ? ` · ${esc(cs.pain.structures.slice(0, 3).join(", "))}` : ""}</p></div>
      <div class="card summary"><h4>Resumo do plano</h4>
        <div class="kvs"><div><span>Técnica sugerida</span><b>${esc(top.t.n)} · ${Math.round(top.score * 100)} %</b></div><div><span>Em análise</span><b>${esc(t.n)}</b></div>
        <div><span>Alvo</span><b>${esc(cs.pain.dermatomes.join(", "))} · ${esc(t.mech)}</b></div><div><span>Parâmetros</span><b>${t.mod === "acu" ? `${o.P} kPa` : `${o.f} Hz · ${fmt(o.irel)}× limiar Aβ · ${t.pw} µs`}</b></div>
        <div><span>Tempo</span><b>${o.min} min/sessão · ${o.spw}×/semana · ${o.wk} semanas (${nS} sessões)</b></div>
        <div><span>Desfecho estimado ao fim do curso</span><b>EVA ${fmt(cs.pain.baseline)} → ${fmt(m.last.med)} <small>(${fmt(m.last.p10)}–${fmt(m.last.p90)})</small> · resposta ≥ 30 %: ${Math.round(m.resp * 100)} %</b></div></div>
        <p class="note">EVA residual, 2 h após a última sessão; durante a sessão a dor prevista é ${fmt(m.last.during)}.</p>
        <p class="note">${tag("hip")} Rede fisiológica com Monte Carlo (semente 42). Redução de 30 % na EVA como diferença clinicamente importante ${R("farrar01")}. Não é prescrição.</p></div>
      <div class="card"><h4>Técnicas por adequação ao caso</h4>${rows.map((r, i) => `<button class="tech ${r.id === id ? "on" : ""}" data-t="${r.id}"><span class="ti">${g.AxonIcons[TECH[r.id].ic] || g.AxonIcons.app2}</span><span class="tn"><b>${i + 1}. ${esc(r.t.n)}</b><span class="note">${esc(r.t.mech)}</span></span><span class="tp"><b>${Math.round(r.score * 100)} %</b><i style="width:${Math.round(r.score * 100)}%"></i></span></button>`).join("")}
        <details><summary>Como o % é calculado</summary><table class="ftab"><tr><th>Fator</th><th>Peso</th><th>${esc(t.n)}</th></tr>${[["fit", "Mecanismo × origem da dor"], ["model", "Analgesia prevista pelo modelo (5 sessões)"], ["ev", "Força da evidência clínica"], ["safe", "Margem de segurança"], ["prat", "Praticidade / invasividade"]].map(([k, n]) => { const rr = rows.find(x => x.id === id); return `<tr><td>${n}</td><td><input type="range" min="0" max=".6" step=".02" value="${PL.weights[k]}" data-w="${k}" aria-label="peso ${n}"></td><td>${Math.round(rr.F[k] * 100)} %</td></tr>`; }).join("")}</table>
        <p class="note">${tag("pre")} Pesos editoriais do simulador, ajustáveis. Evidência: ${t.refs.map(R).join(" ")}</p></details></div>
      <div class="card"><h4>${esc(t.n)}: parâmetros e justificativa</h4><p>${esc(t.par)}</p>
        ${t.mod !== "acu" ? `<p class="note">Mapa interativo: arraste para escolher frequência e intensidade. Verde = mais redução prevista da EVA; vermelho/contorno = Aδ recrutadas (dor provocada).</p><canvas id="plHeat" width="420" height="230" style="width:100%;touch-action:none"></canvas>`
          : `<div class="ctl"><label><span>Pressão</span><output>${o.P} kPa</output></label><input type="range" id="plP" min="40" max="320" step="10" value="${o.P}"></div>`}
        <div class="grid3">${[["min", "Min/sessão", 10, 60, 5], ["spw", "Sessões/semana", 1, 7, 1], ["wk", "Semanas", 1, 12, 1]].map(([k, l, a, z, s]) => `<div class="ctl"><label><span>${l}</span><output>${o[k]}</output></label><input type="range" data-o="${k}" min="${a}" max="${z}" step="${s}" value="${o[k]}"></div>`).join("")}</div>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" id="plApply">Aplicar no simulador</button><button class="btn ghost" id="plMap">Ver pontos e mapas</button><button class="btn ghost" id="plWhy">Justificar por IA</button></div><div id="plWhyOut" class="note"></div></div>
      <div class="card"><h4>Trajetória da dor residual (EVA) por sessão</h4><canvas id="plTraj" width="420" height="190" style="width:100%;touch-action:none"></canvas><p class="note">Faixa: p10–p90 entre perfis fisiológicos sorteados. Arraste no gráfico para mudar o número de sessões.</p></div>
      <div class="card"><h4>Desfecho resumido</h4><div class="out2"><div><h5>Objetivo</h5><table class="ftab">
        <tr><td>EVA residual (mediana)</td><td>${fmt(cs.pain.baseline)} → <b>${fmt(m.last.med)}</b></td></tr><tr><td>EVA durante a sessão</td><td><b>${fmt(m.last.during)}</b></td></tr>
        <tr><td>Limiar de dor à pressão no ponto</td><td>${Math.round(m.ppt0)} → <b>${Math.round(m.ppt1)}</b> kPa ${R("fischer87")}</td></tr>
        <tr><td>EMG paravertebral (defesa)</td><td>${Math.round(m.emg0)} → <b>${Math.round(m.emg1)}</b> µV</td></tr>
        <tr><td>RMSSD na sessão</td><td>${Math.round(m.rmssd0)} → <b>${Math.round(m.rmssd1)}</b> ms</td></tr><tr><td>FC na sessão</td><td>${Math.round(m.hr0)} → <b>${Math.round(m.hr1)}</b> bpm</td></tr></table>
        <p class="note">${tag("pre")} Algometria, EMG e variabilidade derivadas da redução da dor prevista (relações didáticas).</p></div>
        <div><h5>Subjetivo</h5>${painMapSVG(cs, m.frac)}<p class="note">Círculo tracejado: área dolorosa inicial · cheio: após ${nS} sessões. ${/L5|S1|C6|C7/.test(cs.pain.dermatomes.join()) ? "Na dor radicular, a melhora costuma recuar dos sintomas distais para a raiz (centralização)." : ""} ${tag("hip")}</p></div></div>
        <h5>Benefícios e riscos</h5><div class="out2"><ul class="tight ok">${t.ben.map(x => `<li>${esc(x)}</li>`).join("")}</ul><ul class="tight warn">${t.risk.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div>`;
    // interações
    $("#plCase", b).onchange = e => { const c = C.list.find(x => x.id === e.target.value); if (g.AxonSim && g.AxonSim.selectCase) g.AxonSim.selectCase(c.id); else if (g.AxonSim) g.AxonSim.case = c; PL.cache = {}; render(b); document.dispatchEvent(new CustomEvent("axon:case", { detail: { id: c.id } })); };
    $("#plDesc", b).onclick = () => A().openApp("patient");
    $$(".tech", b).forEach(x => x.onclick = () => { PL.sel = x.dataset.t; render(b); });
    $$("[data-w]", b).forEach(x => x.onchange = () => { PL.weights[x.dataset.w] = +x.value; render(b); });
    $$("[data-o]", b).forEach(x => x.onchange = () => { o[x.dataset.o] = +x.value; render(b); });
    const pP = $("#plP", b); if (pP) pP.onchange = () => { o.P = +pP.value; render(b); };
    const hc = $("#plHeat", b); if (hc) heatmap(hc, cs, id, o, (f, ir) => { if (f === o.f && ir === o.irel) return; o.f = f; o.irel = ir; clearTimeout(PL.tm); PL.tm = setTimeout(() => render(b), 120); heatmap(hc, cs, id, o, () => {}); });
    trajChart($("#plTraj", b), m.tr, cs.pain.baseline, nS, n => { o.wk = Math.max(1, Math.round(n / o.spw)); clearTimeout(PL.tm); PL.tm = setTimeout(() => render(b), 150); });
    $("#plApply", b).onclick = () => applyToSim(id, o);
    $("#plMap", b).onclick = () => A().openApp("maps");
    $("#plWhy", b).onclick = async () => { const out = $("#plWhyOut", b); out.textContent = "redigindo…";
      const facts = { caso: { titulo: cs.title, origem: cs.pain.origin, eva: cs.pain.baseline, segmentos: cs.pain.dermatomes }, tecnica: t.n, adequacao_pct: Math.round(rows.find(r => r.id === id).score * 100), fatores_pct: Object.fromEntries(Object.entries(rows.find(r => r.id === id).F).map(([k, v]) => [k, Math.round(v * 100)])), parametros: t.par, tempo: `${o.min} min, ${o.spw}x/sem, ${o.wk} sem`, eva_final_mediana: +m.last.med.toFixed(1), p10: +m.last.p10.toFixed(1), p90: +m.last.p90.toFixed(1), prob_resposta_30: Math.round(m.resp * 100), riscos: t.risk, beneficios: t.ben, mecanismo: t.mech };
      try { const r = await fetch("api/ai/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ facts }) }).then(x => x.json()); out.innerHTML = esc(r.text || "") + " " + tag(r.mode === "ia" ? "der" : "pre"); }
      catch (e) { out.innerHTML = esc(`${t.n} obteve ${facts.adequacao_pct} % porque o mecanismo (${t.mech}) combina com dor ${cs.pain.origin} e o modelo prevê EVA ${facts.eva_final_mediana} após ${nS} sessões; a evidência clínica e os riscos (${t.risk[0].toLowerCase()}) pesam no resultado.`) + " " + tag("pre"); } };
  }
  function applyToSim(id, o) {
    const t = TECH[id], a = A(); a.setMod(t.mod); const p = a.state.p;
    if (t.mod === "acu") p.P = o.P;
    else {   // corrente no eletrodo para chegar a irel × limiar das Aβ na fibra-alvo (mesma cadeia de atenuação de sim.js) [PREMISSA]
      const st = a.state, mc = st.mc, out = a.compute(), M2 = M(); let k0 = 0; while (k0 < 199 && mc.FA[k0] < .05) k0++;
      const surface = t.mod !== "ea", d = surface ? (t.mod === "tavns" ? 1.0 : 1.2) + (st.v.fat || 0) : 1.0, r = clamp(d, .3, 1.5);
      const att = surface ? (t.mod === "tavns" ? .5 : .03 * Math.sqrt(4 / Math.max(.5, p.area))) : 1, scale = M2.Ith(9, r / 10) / M2.Ith(9, .1);
      p.f = o.f; p.pw = t.pw; p.I = +clamp(mc.I[k0] * o.irel * scale / Math.max(.05, (out.trans || 1) * att), .05, 50).toFixed(2);
    }
    a.renderRight(); a.update(); if (g.AxonSim) { g.AxonSim.minutes = o.min; }
    a.botSay(`${t.n} configurada: ${t.par}. Escolha o instrumento e o ponto no modo Simulação para aplicar.`);
    if (g.AxonSim && !g.AxonSim.active && g.AxonSim.toggle) g.AxonSim.toggle();
  }
  function boot() { const a = A(); if (!a || !a.registerApp || !g.AxonPhysio) return setTimeout(boot, 80);
    a.registerApp("planner", { title: "planner", w: 520, h: 760, render }); document.addEventListener("axon:case", () => { PL.cache = {}; a.isOpen("planner") && render(a.body("planner")); }); }
  boot();
  g.AxonPlanner = { TECH, FIT, plan, uFor, trajectory, metrics, PL, applyToSim };
})(window);
