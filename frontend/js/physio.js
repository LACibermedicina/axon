/* axon · physio.js — rede de fenômenos secundários (biofísicos → bioquímicos → sistêmicos) e
 * simulação da resposta do "paciente" no Modo Simulação.
 *
 * NATUREZA DESTE MÓDULO: modelo DIDÁTICO de mediadores com dinâmica de 1ª ordem.
 *  • A entrada (frações de fibras recrutadas, carga, temperatura) vem do núcleo verificado.
 *  • Os mecanismos (portão medular, opioides endógenos por frequência, modulação descendente,
 *    via colinérgica anti-inflamatória, simpático, sensibilização central, tolerância) estão
 *    descritos na literatura; seus PESOS, constantes de tempo e a EVA resultante são
 *    [HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO] e não constituem predição clínica.
 *  • O "desfecho hipotético" é uma distribuição Monte Carlo (semente 42) sobre a incerteza dos pesos. */
(function (g) {
  "use strict";
  const REF = {
    gate: "Melzack R, Wall PD. Science. 1965;150:971-9.",
    han: "Han JS. Trends Neurosci. 2003;26:17-22.",
    vagal: "Tracey KJ. Nature. 2002;420:853-9 (reflexo inflamatório).",
    sens: "Woolf CJ. Pain. 2011;152(3 Suppl):S2-15 (sensibilização central).",
    taVNS: "Farmer AD et al. Front Hum Neurosci. 2021;14:568051."
  };
  // ------------------------------------------------------------- grafo (colunas = níveis de organização)
  const NODES = [
    { id: "field", label: "Campo elétrico / mecânico", col: 0, tag: "der" },
    { id: "charge", label: "Densidade de carga (Shannon)", col: 0, tag: "der" },
    { id: "heat", label: "Aquecimento (Pennes)", col: 0, tag: "der" },
    { id: "aalpha", label: "Fibras Aα (motoras)", col: 1, tag: "mod" },
    { id: "abeta", label: "Fibras Aβ", col: 1, tag: "mod" },
    { id: "adelta", label: "Fibras Aδ", col: 1, tag: "mod" },
    { id: "abvn", label: "Aferentes vagais (ABVN)", col: 1, tag: "lit" },
    { id: "gate", label: "Portão medular (interneurônios inibitórios)", col: 2, tag: "lit" },
    { id: "windup", label: "Somação temporal / sensibilização", col: 2, tag: "lit" },
    { id: "twitch", label: "Contração muscular", col: 2, tag: "lit" },
    { id: "withdraw", label: "Reflexo de retirada", col: 2, tag: "lit" },
    { id: "enk", label: "Encefalinas / β-endorfina (2–10 Hz)", col: 3, tag: "lit" },
    { id: "dyn", label: "Dinorfina (80–100 Hz)", col: 3, tag: "lit" },
    { id: "nts", label: "NTS → LC / rafe / PAG", col: 3, tag: "hip" },
    { id: "desc", label: "Inibição descendente", col: 3, tag: "hip" },
    { id: "tol", label: "Tolerância (alta frequência)", col: 3, tag: "hip" },
    { id: "symp", label: "Tônus simpático", col: 4, tag: "hip" },
    { id: "vagal", label: "Tônus vagal eferente", col: 4, tag: "hip" },
    { id: "ai", label: "Via colinérgica anti-inflamatória (α7nAChR)", col: 4, tag: "hip" },
    { id: "pain", label: "Dor (EVA)", col: 5, tag: "hip" },
    { id: "hr", label: "Frequência cardíaca", col: 5, tag: "hip" },
    { id: "hrv", label: "VFC (RMSSD)", col: 5, tag: "hip" },
    { id: "eda", label: "Condutância da pele", col: 5, tag: "hip" }
  ];
  const EDGES = [
    ["field", "aalpha", 1], ["field", "abeta", 1], ["field", "adelta", 1], ["field", "abvn", 1], ["field", "charge", 1], ["field", "heat", 1],
    ["abeta", "gate", 1, "gate"], ["adelta", "windup", 1, "sens"], ["adelta", "withdraw", 1], ["aalpha", "twitch", 1],
    ["abeta", "enk", 1, "han"], ["adelta", "enk", 1, "han"], ["abeta", "dyn", 1, "han"], ["dyn", "tol", 1, "han"],
    ["abvn", "nts", 1, "taVNS"], ["nts", "desc", 1], ["enk", "desc", 1], ["nts", "vagal", 1], ["vagal", "ai", 1, "vagal"],
    ["gate", "pain", -1, "gate"], ["enk", "pain", -1, "han"], ["dyn", "pain", -1, "han"], ["tol", "dyn", -1], ["desc", "pain", -1], ["ai", "pain", -1, "vagal"],
    ["windup", "pain", 1, "sens"], ["withdraw", "pain", 1], ["heat", "pain", 1], ["pain", "symp", 1], ["adelta", "symp", 1], ["vagal", "symp", -1],
    ["symp", "hr", 1], ["vagal", "hr", -1], ["symp", "hrv", -1], ["vagal", "hrv", 1], ["symp", "eda", 1]
  ];
  // pesos nominais [HIPÓTESE]; o Monte Carlo varia ±40 %
  const CARRY = .07;   // fração da analgesia da sessão que persiste até a próxima [PREMISSA calibrada: curso de ~10 sessões → redução de ~30–45 % da EVA]
  const W0 = { gate: .38, opioid: .3, desc: .28, ai: .35, sens: .5, stimPain: 3.2, tolK: .6, hrSymp: 16, hrVagal: 7, hrvVagal: .5, hrvSymp: .35 };
  const TAU = { gate: .3, enk: 6, dyn: 4, nts: 1.5, desc: 7, vagal: 1, ai: 18, symp: 1.2, windup: 2.5, tol: 15 }; // minutos

  function newState(cs, w = W0) {
    const p = cs.pain; return { t: 0, w, base: p.baseline, infl: p.inflammation ?? .3, sens0: p.sensitization ?? .3, origin: p.origin, hr0: cs.autonomic?.hr || 75, rmssd0: cs.autonomic?.rmssd || 35,
      m: { gate: 0, enk: 0, dyn: 0, nts: 0, desc: 0, vagal: 0, ai: 0, symp: .3, windup: p.sensitization ?? .3, tol: 0 },
      out: { pain: p.baseline, hr: cs.autonomic?.hr || 75, hrv: cs.autonomic?.rmssd || 35, eda: 4 }, events: [], hist: [] };
  }
  // u = entrada do instante: { FA, FD, Faa, freq, segMatch, vagalSite, pressureKPa, k, dT, on, demy }
  function step(S, u, dtMin) {
    const m = S.m, w = S.w, relax = (k, target) => { m[k] += (target - m[k]) * (1 - Math.exp(-dtMin / TAU[k])); };
    const on = u.on ? 1 : 0, FA = u.FA * on, FD = u.FD * on, Faa = (u.Faa || 0) * on;
    const low = u.freq > 0 && u.freq <= 10, high = u.freq >= 50 && u.freq <= 150;
    relax("gate", FA * u.segMatch * (1 - .55 * (u.demy || 0)));
    relax("enk", on * (low ? 1 : u.freq < 50 ? .5 : .2) * Math.min(1, (FA + FD) * 1.4));
    relax("tol", on * (high ? 1 : 0) * Math.min(1, FA * 1.5));
    relax("dyn", on * (high ? 1 : .15) * Math.min(1, FA * 1.4) * (1 - w.tolK * m.tol));
    relax("nts", on * u.vagalSite * Math.min(1, FA * 1.6));
    relax("desc", Math.min(1, .6 * m.nts + .5 * m.enk) * (S.origin === "nociplástica" ? 1.15 : 1));
    relax("vagal", m.nts);
    relax("ai", m.vagal);
    relax("windup", Math.min(1, S.sens0 + FD * 1.2));
    const painNow = S.out.pain / 10; relax("symp", Math.min(1, .2 + .5 * painNow + .6 * FD - .5 * m.vagal));
    const red = w.gate * m.gate * (S.origin === "nociplástica" ? .6 : 1) + w.opioid * (m.enk + m.dyn) + w.desc * m.desc + w.ai * m.ai * S.infl * 2;
    const sens = 1 + w.sens * (m.windup - S.sens0);
    let pain = S.base * Math.max(0, 1 - red) * sens + w.stimPain * FD + Math.max(0, (u.pressureKPa || 0) - 250) / 60 + Math.max(0, (u.dT || 0) - 1.5) * 2;
    pain = Math.max(0, Math.min(10, pain));
    S.out.pain = pain;
    S.out.hr = S.hr0 * (1 + (w.hrSymp * (m.symp - .3) - w.hrVagal * m.vagal - (u.vagalSite && on ? 4 * FA : 0)) / 100);
    S.out.hrv = S.rmssd0 * (1 + w.hrvVagal * m.vagal - w.hrvSymp * (m.symp - .3));
    S.out.eda = 2 + 8 * m.symp;
    S.t += dtMin;
    const ev = [];
    if (Faa > .05) ev.push({ k: "twitch", txt: "Contração muscular (Aα recrutadas)", tag: "mod" });
    if (FD > .25) ev.push({ k: "withdraw", txt: "Reflexo de retirada (Aδ recrutadas)", tag: "lit" });
    if (S.out.hr < S.hr0 * .9) ev.push({ k: "brady", txt: "Queda de FC > 10 % — interromper (bradicardia)", tag: "hip" });
    if (u.k >= 1.75) ev.push({ k: "shannon", txt: "Shannon k ≥ 1,75 — risco eletroquímico", tag: "lit" });
    if ((u.pressureKPa || 0) > 300) ev.push({ k: "pressure", txt: "Pressão acima do limiar de dor à pressão", tag: "pre" });
    S.events = ev;
    S.hist.push({ t: S.t, pain, hr: S.out.hr, hrv: S.out.hrv, eda: S.out.eda, FA, FD });
    return S;
  }
  // nível de ativação de cada nó (0–1) para o grafo ao vivo
  function activity(S, u) {
    const m = S.m, on = u.on ? 1 : 0;
    return { field: on * Math.min(1, (u.FA + u.FD) * 1.5 + .2), charge: Math.min(1, Math.max(0, (u.k + 3) / 4.75)), heat: Math.min(1, (u.dT || 0) / 2),
      aalpha: on * (u.Faa || 0), abeta: on * u.FA, adelta: on * u.FD, abvn: on * u.vagalSite * u.FA, gate: m.gate, windup: m.windup, twitch: on * ((u.Faa || 0) > .05 ? 1 : 0), withdraw: on * (u.FD > .25 ? 1 : 0),
      enk: m.enk, dyn: m.dyn, nts: m.nts, desc: m.desc, tol: m.tol, symp: m.symp, vagal: m.vagal, ai: m.ai, pain: S.out.pain / 10, hr: Math.min(1, Math.abs(S.out.hr - S.hr0) / 15), hrv: Math.min(1, Math.abs(S.out.hrv - S.rmssd0) / 15), eda: m.symp };
  }
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /* Desfecho hipotético: N sessões simuladas com pesos perturbados (±40 %), mesma entrada.
   * Retorna mediana e intervalo 10–90 % da EVA final e P(redução ≥ 30 %). */
  function outcome(cs, u, minutes = 20, sessions = 1, N = 300) {
    const rng = mulberry(42), finals = [], offs = [], hrs = [];
    const carry = S => { S.base = Math.max(cs.pain.baseline * .25, S.base - CARRY * S.w.opioid / .3 * (S.base - S.out.pain)); };
    for (let k = 0; k < N; k++) {
      const w = Object.fromEntries(Object.entries(W0).map(([a, v]) => [a, v * (.6 + .8 * rng())]));
      let S = newState(cs, w);
      for (let s2 = 0; s2 < sessions; s2++) { for (let t = 0; t < minutes; t += .5) step(S, u, .5); if (s2 < sessions - 1) { carry(S); for (let t = 0; t < 60; t += 2) step(S, Object.assign({}, u, { on: false }), 2); } }
      finals.push(S.out.pain); hrs.push(S.out.hr);
      // dor residual: 2 h após a última sessão, sem estímulo (o que persiste do curso)
      carry(S); for (let t = 0; t < 120; t += 2) step(S, Object.assign({}, u, { on: false }), 2); offs.push(S.out.pain);
    }
    finals.sort((a, b) => a - b); offs.sort((a, b) => a - b); const q = (arr, p) => arr[Math.floor(p * (N - 1))];
    const resp = finals.filter(v => v <= cs.pain.baseline * .7).length / N, respOff = offs.filter(v => v <= cs.pain.baseline * .7).length / N;
    return { median: q(finals, .5), p10: q(finals, .1), p90: q(finals, .9), pResp: resp, off: { median: q(offs, .5), p10: q(offs, .1), p90: q(offs, .9), pResp: respOff },
      baseline: cs.pain.baseline, hrMed: hrs.sort((a, b) => a - b)[N >> 1], N, seed: 42, tag: "HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO" };
  }
  g.AxonPhysio = { NODES, EDGES, REF, W0, TAU, newState, step, activity, outcome };
})(window);
