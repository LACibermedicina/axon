/* axon · preditor morfométrico do axônio no feixe (v0.9)
 * Entrada: parâmetros biométricos (idade, sexo, altura, peso) e clínicos (temperatura do membro, HbA1c,
 * tempo de diabetes, desmielinização e perda de fibras finas do caso) + o nervo/região escolhidos.
 * Saída por classe de fibra (Aα, Aβ, Aγ, Aδ, B, C): diâmetro externo (p10/mediana/p90), diâmetro do axônio,
 * g-ratio, espessura da mielina, internodo, velocidade de condução, densidade relativa, papel aferente/eferente,
 * e o prolongamento do axônio até a placa motora (ou do receptor até o corno dorsal) com a latência prevista.
 * Toda saída leva etiqueta de procedência. Cálculo determinístico (quantis analíticos). Não é medida de um paciente real. */
(function (g) {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), fmt = (x, d = 1) => (+x).toFixed(d).replace(".", ",");
  const TAGS = { lit: ["LITERATURA", "t-lit"], pre: ["PREMISSA", "t-pre"], der: ["DERIVADO", "t-der"], mod: ["RESULTADO DE MODELO - SEMENTE 42", "t-mod"], hip: ["HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO", "t-hip"] };
  const tag = k => `<span class="tag ${TAGS[k][1]}">${TAGS[k][0]}</span>`;

  const REF = {
    eg: "Erlanger J, Gasser HS. Electrical Signs of Nervous Activity. Univ. Pennsylvania Press; 1937. Classificação A/B/C; grupos I–IV de Lloyd (1943).",
    hursh: "Hursh JB. Conduction velocity and diameter of nerve fibers. Am J Physiol. 1939;127:131-9. doi:10.1152/ajplegacy.1939.127.1.131",
    boyd: "Boyd IA, Kalu KU. Scaling factor relating conduction velocity and diameter for myelinated afferent nerve fibres in the cat hind limb. J Physiol. 1979;289:277-97 (5,7 m/s/µm grupo I/α; 4,6 grupos II, III, γ).",
    arb: "Arbuthnott ER, Boyd IA, Kalu KU. Ultrastructural dimensions of myelinated peripheral nerve fibres in the cat and their relation to conduction velocity. J Physiol. 1980;308:125-57 (g ≈ 0,62–0,75).",
    rushton: "Rushton WAH. A theory of the effects of fibre size in medullated nerve. J Physiol. 1951;115:101-22 (g ótimo ≈ 0,6).",
    goldman: "Goldman L, Albus JS. Computation of impulse conduction in myelinated fibers. Biophys J. 1968;8:596-607 (internodo proporcional ao diâmetro).",
    tohgi: "Tohgi H, Tsukagoshi H, Toyokura Y. Quantitative changes with age in normal sural nerves. Acta Neuropathol. 1977;38:213-20. doi:10.1007/BF00688067 (densidade de fibras finas na 8ª década ≈ 74 % da 2ª).",
    jacobs: "Jacobs JM, Love S. Qualitative and quantitative morphology of human sural nerve at different ages. Brain. 1985;108:897-924.",
    oveis: "Oveisgharan S, et al. Morphometric characteristics of the tibial nerve in older adults (AxonDeepSeg, N = 140). 2025: idade maior → fibras, axônios e mielina menores, menos fibras > 8 µm; g-ratio sem associação.",
    letz: "Estudo de 92 adultos normais (PubMed 1308101): VC −0,9 m/s por década de 15 a 44 anos, igual em homens e mulheres; altura, idade, sexo e temperatura analisados.",
    rivner01: "Rivner MH, Swift TR, Malik K. Influence of age and height on nerve conduction. Muscle Nerve. 2001;24:1134-41 (3 969 normais; correlação da VC com a altura mais forte que com a idade).",
    rivner90: "Rivner MH, et al. Toward more rational nerve conduction interpretations: the effect of height. Muscle Nerve. 1990;13:232-9 (sural r = −0,71; fibular r = −0,68; mediano sem correlação).",
    soud: "Soudmand R, Ward LC, Swift TR. Effect of height on nerve conduction velocity. Neurology. 1982;32:407-10 (afilamento axonal distal nos membros inferiores).",
    stetson: "Stetson DS, Albers JW, Silverstein BA, Wolfe RA. Effects of age, sex, and anthropometric factors on nerve conduction measures. Muscle Nerve. 1992;15:1095-104 (sexo não é preditor independente da altura).",
    temp: "Redução clínica de ~1,5–2,4 m/s por °C de resfriamento (1,7 m/s/°C de superfície); o fator de correção é menor quando a VC basal é baixa — Wu PBJ et al. Am J Phys Med Rehabil. 1993;72:369-71.",
    peterson: "Peterson M, et al. Association between HbA1c and peripheral neuropathy in a 10-year follow-up. Diabet Med. 2017;34:1756-64 (+1 % HbA1c ≈ −1 % na amplitude do sural; VC pouco associada).",
    dmmorph: "Morfometria do sural no diabetes: perda de fibras grandes; distribuição bimodal passa a unimodal com pico de fibras finas (Bull Tokyo Med Dent Univ. 1984;31:209-24).",
    awang: "Awang MS, et al. Nerve conduction study among healthy Malays: influence of age, height and BMI. Malays J Med Sci. 2006;13:19-23 (lentificação com IMC).",
    ochoa: "Fibras amielínicas do sural são ~3–5 vezes mais numerosas que as mielinizadas (revisão: Histol Histopathol, revistas.um.es).",
    iz: "Zona de placas motoras admitida no meio das fibras musculares; localização por marcos de superfície em músculos comumente injetados (PubMed 16785107). Zona de inervação do bíceps braquial em faixa estreita no meio do ventre: Jahanmiri-Nezhad F, et al. Front Hum Neurosci. 2015;9:239.",
    nmj: "Atraso da junção neuromuscular e da condução terminal ≈ 0,5–1 ms (fisiologia clássica da latência motora distal).",
  };

  // Classes de fibra: faixa de diâmetro externo (µm) [LITERATURA], centro e dispersão de referência no adulto jovem [PREMISSA dentro da faixa]
  const CL = {
    "Aα": { lo: 12, hi: 20, mu: 14, sd: 1.8, k: 4.4, g: .70, my: true, aff: "Ia (fuso) · Ib (órgão tendinoso de Golgi)", eff: "motoneurônio α → placa motora (fibras extrafusais)", grp: "I", col: "#d36cff" },
    "Aβ": { lo: 6, hi: 12, mu: 9, sd: 1.5, k: 4.6, g: .62, my: true, aff: "II · mecanorreceptores cutâneos (Meissner, Merkel, Ruffini, Pacini) e terminação secundária do fuso", eff: null, grp: "II", col: "#4fb3ff" },
    "Aγ": { lo: 3, hi: 6, mu: 4.5, sd: .7, k: 4.6, g: .70, my: true, aff: null, eff: "motoneurônio γ → fibras intrafusais (sensibilidade do fuso)", grp: "—", col: "#3ee6c5" },
    "Aδ": { lo: 1, hi: 5, mu: 3, sd: .8, k: 4.6, g: .70, my: true, aff: "III · nociceptores mecânicos/térmicos (dor rápida), frio", eff: null, grp: "III", col: "#ff8a3d" },
    "B": { lo: 1, hi: 3, mu: 2, sd: .4, k: 4.6, g: .72, my: true, aff: null, eff: "pré-ganglionar autonômico (ramos comunicantes brancos T1–L2, vago, S2–S4)", grp: "—", col: "#ffd166" },
    "C": { lo: .2, hi: 1.5, mu: .8, sd: .25, k: null, g: 1, my: false, aff: "IV · nociceptores polimodais (dor lenta), calor, prurido, peptidérgicos", eff: "pós-ganglionar simpático (vasos, glândulas sudoríparas, piloereção)", grp: "IV", col: "#ff5d73" },
  };
  // Composição por tipo de nervo (fração do total de axônios) [PREMISSA; faixas de classe e razão amielínicas/mielinizadas da literatura]
  const KIND = {
    cutaneo: { n: "Nervo cutâneo", mix: { "Aβ": .09, "Aδ": .14, "C": .77 }, ex: "sural, safeno, ramo superficial do radial" },
    misto: { n: "Nervo misto de membro", mix: { "Aα": .12, "Aγ": .04, "Aβ": .1, "Aδ": .12, "B": .0, "C": .62 }, ex: "mediano, ulnar, radial, tibial, fibular, femoral, ciático" },
    muscular: { n: "Ramo muscular", mix: { "Aα": .28, "Aγ": .12, "Aβ": .06, "Aδ": .14, "C": .4 }, ex: "ramo para um músculo" },
    vago: { n: "Vago cervical", mix: { "Aβ": .01, "Aδ": .05, "B": .08, "C": .86 }, ex: "nervo vago (X)" },
    abvn: { n: "Ramo auricular do vago", mix: { "Aβ": .18, "Aδ": .12, "C": .7 }, ex: "concha da orelha" },
    raizv: { n: "Raiz ventral", mix: { "Aα": .6, "Aγ": .3, "B": .1 }, ex: "eferente motora (e B em T1–L2, S2–S4)" },
    raizd: { n: "Raiz dorsal / gânglio", mix: { "Aα": .06, "Aβ": .12, "Aδ": .14, "C": .68 }, ex: "aferente somática e visceral" },
    trig: { n: "Ramo do trigêmeo", mix: { "Aβ": .12, "Aδ": .16, "C": .72 }, ex: "V1, V2, V3 (sensitivo)" },
  };
  function kindOf(nerve) {
    const n = (nerve || "").toLowerCase();
    if (/auricular|abvn|concha/.test(n)) return "abvn"; if (/vago|vagus/.test(n)) return "vago";
    if (/trigêmeo|trigemin|maxilar|mandibular|oftálmico|v1|v2|v3/.test(n)) return "trig";
    if (/raiz.*ventral|ventral/.test(n)) return "raizv"; if (/raiz|gânglio|dorsal/.test(n)) return "raizd";
    if (/sural|safeno|cutâneo|superficial do radial|intercostal/.test(n)) return n.includes("intercostal") ? "misto" : "cutaneo";
    if (/ramo muscular|motor/.test(n)) return "muscular"; return "misto";
  }
  const regionOf = nerve => /ciátic|tibial|fibular|sural|femoral|safeno|plantar|glúte|obturat|lombar|sacral|l[45]|s[12]/i.test(nerve || "") ? "inferior" : /mediano|ulnar|radial|musculocut|axilar|braquial|c[5-8]/i.test(nerve || "") ? "superior" : "outro";

  // ------------------------------------------------------------------ paciente (biometria + clínica)
  const CLIN = { temp: 33, hba1c: 5.4, dmYears: 0, nerve: "Nervo mediano", touched: {} };
  function caseNow() { return (g.AxonSim && g.AxonSim.case) || (g.AxonCases && g.AxonCases.list[0]) || null; }
  function patient() {
    const P = (g.AxonDissect && g.AxonDissect.PT) || { sex: "M", age: 45, height: 175, weight: 75 }, cs = caseNow();
    const eff = { demy: 0, sfl: 0 }; (cs && cs.conditions || []).forEach(c => { if (c.effect) { eff.demy += c.effect.demy || 0; eff.sfl += c.effect.sfl || 0; } });
    const dm = cs && (cs.conditions || []).some(c => /^dm$|diabet/i.test(c.id + " " + c.label));
    const st = g.AxonApp && g.AxonApp.state && g.AxonApp.state.v ? g.AxonApp.state.v : {};
    return { sex: P.sex, age: P.age, height: P.height, weight: P.weight, bmi: P.weight / ((P.height / 100) ** 2),
      temp: CLIN.temp, hba1c: CLIN.touched.hba1c ? CLIN.hba1c : (dm ? 8 : CLIN.hba1c), dmYears: CLIN.touched.dmYears ? CLIN.dmYears : (dm ? 10 : CLIN.dmYears),
      demy: clamp(eff.demy + (st.demy || 0), 0, .9), sfl: clamp(eff.sfl, 0, .9), caseTitle: cs ? cs.title : null };
  }

  // ------------------------------------------------------------------ modelo
  function factors(p, nerve) {
    const reg = regionOf(nerve), large = c => c === "Aα" || c === "Aβ";
    const decAge = Math.max(0, p.age - 30) / 10;
    const F = [];
    // idade: −0,9 m/s por década sobre ~55 m/s ≈ −1,6 %/década no calibre das fibras grandes [DERIVADO]; perda de fibras grandes após 60 [PREMISSA guiada]
    const sAge = 1 - .016 * decAge, nAgeL = 1 - .08 * Math.max(0, p.age - 60) / 10, nAge = 1 - .26 * clamp((p.age - 15) / 60, 0, 1);
    F.push({ k: "Idade", v: `${p.age} anos`, e: `calibre das fibras grandes × ${fmt(sAge, 3)}; densidade total × ${fmt(nAge, 2)}${p.age > 60 ? `; fibras > 8 µm × ${fmt(nAgeL, 2)}` : ""}`, t: "der", r: ["letz", "tohgi", "jacobs", "oveis"] });
    // altura: só nervos do membro inferior (afilamento distal); 2 %/10 cm [PREMISSA calibrada; direção e significância LITERATURA]
    const sH = reg === "inferior" ? 1 - .02 * (p.height - 170) / 10 : 1;
    F.push({ k: "Altura", v: `${p.height} cm`, e: reg === "inferior" ? `afilamento distal: calibre × ${fmt(sH, 3)} (membro inferior)` : "sem efeito no membro superior (mediano sem correlação)", t: reg === "inferior" ? "pre" : "lit", r: ["rivner90", "rivner01", "soud"] });
    F.push({ k: "Sexo", v: p.sex === "F" ? "feminino" : "masculino", e: "sem efeito independente da altura", t: "lit", r: ["stetson"] });
    // IMC: −0,25 %/unidade acima de 25 na VC [PREMISSA calibrada]
    const sBMI = 1 - .0025 * Math.max(0, p.bmi - 25);
    F.push({ k: "IMC", v: fmt(p.bmi), e: p.bmi > 25 ? `VC × ${fmt(sBMI, 3)}; nervo mais profundo sob a hipoderme` : "sem ajuste", t: "pre", r: ["awang"] });
    // temperatura: 1,7 m/s/°C abaixo de 33 °C de pele, proporcional à VC basal [LITERATURA + DERIVADO]
    const dT = Math.max(0, 33 - p.temp);
    F.push({ k: "Temperatura do membro", v: `${fmt(p.temp)} °C`, e: dT > 0 ? `−1,7 m/s por °C abaixo de 33 °C (proporcional à VC basal)` : "referência (33 °C)", t: "lit", r: ["temp"] });
    // diabetes: perda axonal (≈1 %/1 % HbA1c acima de 5,7) + duração [LITERATURA como proxy; PREMISSA]
    const xa = Math.max(0, p.hba1c - 5.7), nDML = (1 - .01 * xa) * (1 - .015 * p.dmYears), sDM = 1 - .004 * p.dmYears, nDMC = 1 - .02 * p.dmYears;
    F.push({ k: "Glicemia / diabetes", v: `HbA1c ${fmt(p.hba1c)} % · ${p.dmYears} anos`, e: xa > 0 || p.dmYears ? `fibras grandes × ${fmt(nDML, 2)}, calibre × ${fmt(sDM, 3)}; fibras C × ${fmt(Math.max(.2, nDMC), 2)}` : "sem ajuste", t: "pre", r: ["peterson", "dmmorph"] });
    // desmielinização e perda de fibras finas do caso [PREMISSA]
    F.push({ k: "Desmielinização (caso)", v: fmt(p.demy, 2), e: p.demy ? `g-ratio → ${fmt(.62 + (.85 - .62) * p.demy, 2)}; VC × ${fmt(1 - .6 * p.demy, 2)}` : "ausente", t: "pre", r: ["arb", "rushton"] });
    F.push({ k: "Perda de fibras finas (caso)", v: fmt(p.sfl, 2), e: p.sfl ? `Aδ e C × ${fmt(1 - p.sfl, 2)}` : "ausente", t: "pre", r: ["dmmorph"] });
    const scale = c => (large(c) ? sAge * sDM : 1) * sH;
    const count = c => nAge * (large(c) ? (p.age > 60 ? nAgeL : 1) * nDML : 1) * (c === "C" ? Math.max(.2, nDMC) * (1 - p.sfl) : c === "Aδ" ? 1 - p.sfl : 1);
    const cvK = (c, cv0) => Math.max(.2, (cv0 - 1.7 * dT * cv0 / 50) * sBMI * (CL[c].my ? 1 - .6 * p.demy : 1));
    return { F, scale, count, cvK, gOf: c => CL[c].my ? CL[c].g + (.85 - CL[c].g) * p.demy : 1, reg };
  }
  // quantis analíticos da normal (z10 = −1,2816) escalada pelos fatores e limitada à faixa da classe: determinístico e idêntico ao backend
  const Z = { p10: -1.2815516, med: 0, p90: 1.2815516 };
  function predict(pIn, nerve) {
    const p = pIn || patient(), nv = nerve || CLIN.nerve, kind = kindOf(nv), K = KIND[kind], f = factors(p, nv);
    let tot = 0; const raw = Object.entries(K.mix).filter(([, v]) => v > 0).map(([c, v]) => { const w = v * f.count(c); tot += w; return [c, v, w]; });
    const classes = raw.map(([c, v0, w]) => {
      const d = CL[c], s = f.scale(c), q = z => clamp((d.mu + d.sd * z) * s, d.lo * .6, d.hi * 1.05), D = { p10: q(Z.p10), med: q(Z.med), p90: q(Z.p90) };
      const gg = f.gOf(c), ax = D.med * gg, cv0 = d.my ? d.k * D.med : .5 + (D.med - .2) / 1.3 * 1.5;
      return { cls: c, role: [d.aff && "aferente", d.eff && "eferente"].filter(Boolean).join(" / "), aff: d.aff, eff: d.eff, col: d.col,
        D, axon: ax, g: gg, myelin: d.my ? (D.med - ax) / 2 : 0, internode: d.my ? 100 * D.med : null, cv: f.cvK(c, cv0), cv0,
        share: w / tot, share0: v0, density: w / v0, inDomain: d.my && D.med >= 1 && D.med <= 16, range: [d.lo, d.hi] };
    });
    const relDensity = tot;   // em relação ao nervo de referência (adulto jovem)
    return { nerve: nv, kind, kindName: K.n, region: f.reg, patient: p, classes, factors: f.F, density: relDensity };
  }
  // composição para o feixe do Nível 3 (só mielinizadas, domínio verificado 1–16 µm)
  function fascSpec() {
    const r = predict(null, CLIN.nerve), my = r.classes.filter(c => CL[c.cls].my), t = my.reduce((a, c) => a + c.share, 0) || 1;
    return { density: clamp(r.density / (Object.values(KIND[r.kind].mix).reduce((a, b) => a + b, 0)), .35, 1.2),
      mix: my.map(c => ({ cls: c.cls, p: c.share / t, mu: c.D.med, sd: Math.max(.3, (c.D.p90 - c.D.p10) / 2.56), isA: c.cls === "Aα" || c.cls === "Aβ" })), nerve: r.nerve };
  }

  // ------------------------------------------------------------------ prolongamento do axônio (raiz → nervo → alvo)
  const ST = () => g.AxonStage;
  function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += pts[i].distanceTo(pts[i - 1]); return L; }
  function axonPath(o) {   // o = { muscle, root, nerve, target:[x,y,z], kind:"motor"|"sens" }
    const E = ST().ext(), S = E.S, V3 = E.V3; if (!S.anat) return null;
    const NV = S.anat.nerves, cord = NV.find(n => n.kind === "cord"), side = /\b(left|E)\b/.test(o.muscle || o.nerve || "") ? "E" : "D";
    const segs = (o.root || "").match(/[CTLS]\d+|V\d/g) || [];
    const rootName = segs.length ? `Raiz ${segs[Math.min(1, segs.length - 1)]} ${side}` : null, root = NV.find(n => n.name === rootName);
    const nerve = NV.find(n => n.name === o.nerve) || null;
    let target = o.target ? V3(...o.target) : null;
    if (!target && o.muscle) { const ps = E.partsOf("muscles", [o.muscle]); if (ps.length) target = E.centroid(ps[0].mesh, ps[0].p); }
    if (!target) return null;
    const pts = []; const near = (arr, v) => { let b = 0, bd = 1e9; arr.forEach((q, i) => { const d = V3(...q).distanceTo(v); if (d < bd) { bd = d; b = i; } }); return b; };
    if (root) { const rp = root.p.map(q => V3(...q)); const cEnd = cord ? V3(...cord.p[near(cord.p, rp[0])]).distanceTo(rp[0]) < V3(...cord.p[near(cord.p, rp[rp.length - 1])]).distanceTo(rp[rp.length - 1]) : true;
      (cEnd ? rp : rp.reverse()).forEach(v => pts.push(v)); }
    if (nerve) { const a = pts.length ? near(nerve.p, pts[pts.length - 1]) : 0, b = near(nerve.p, target); const step = a <= b ? 1 : -1; for (let i = a; i !== b + step; i += step) pts.push(V3(...nerve.p[i])); }
    pts.push(target);
    const clean = pts.filter((v, i) => !i || v.distanceTo(pts[i - 1]) > 1e-4); if (clean.length < 2) return null;
    const p = patient(), mm = polyLen(clean) * (S.anat.mm_per_unit || 450) * (p.height / 170);
    return { pts: clean, mm, rootName: root ? rootName : null, nerveName: nerve ? nerve.name : null, target };
  }
  let pathGrp = null, pathRaf = 0;
  function clearPath() { const E = ST() && ST().ext(); cancelAnimationFrame(pathRaf); if (pathGrp && E) { E.S.groups.L1 && E.S.groups.L1.remove(pathGrp); } pathGrp = null; }
  function drawPath(P, col = 0xd36cff, kind = "motor") {
    clearPath(); if (!P) return; const E = ST().ext(), T = E.T, G = E.S.groups.L1; if (!G) return;
    pathGrp = new T.Group(); pathGrp.name = "axonPath";
    const m = E.tube(P.pts, .0028, E.glow(E.lin(col), .95), Math.max(40, P.pts.length * 6), 6); m.material.depthTest = false; m.renderOrder = 30; pathGrp.add(m);
    const halo = E.tube(P.pts, .007, E.glow(E.lin(col), .18), Math.max(40, P.pts.length * 6), 6); halo.material.depthTest = false; halo.renderOrder = 29; pathGrp.add(halo);
    const end = kind === "motor" ? P.pts[P.pts.length - 1] : P.pts[0];
    const plate = new T.Mesh(new T.TorusGeometry(.012, .0035, 10, 32), E.glow(E.lin(kind === "motor" ? 0xffd166 : 0x7fd0ff), 1)); plate.position.copy(kind === "motor" ? end : P.pts[P.pts.length - 1]); plate.material.depthTest = false; plate.renderOrder = 31; pathGrp.add(plate);
    const pulse = new T.Mesh(new T.SphereGeometry(.009, 16, 16), E.glow(E.lin(0xffffff), 1)); pulse.material.depthTest = false; pulse.renderOrder = 32; pathGrp.add(pulse);
    const curve = new T.CatmullRomCurve3(P.pts); let t0 = performance.now();
    const loop = now => { const u = (((now - t0) / 1600) % 1 + 1) % 1; pulse.position.copy(curve.getPointAt(kind === "motor" ? u : 1 - u)); pathRaf = requestAnimationFrame(loop); }; pathRaf = requestAnimationFrame(loop);
    G.add(pathGrp);
  }

  // ------------------------------------------------------------------ janela
  const NERVES = ["Nervo mediano", "Nervo ulnar", "Nervo radial", "Ramo superficial do radial", "Nervo musculocutâneo", "Nervo femoral", "Nervo ciático", "Nervo tibial", "Nervo fibular comum", "Nervo sural", "Nervo safeno", "Nervo intercostal", "Trigêmeo V2", "Nervo vago", "Ramo auricular do vago", "Raiz L5 ventral", "Raiz L5 dorsal / gânglio", "Ramo muscular (tibial anterior)"];
  const W = { sel: null, muscle: null };
  function histo(r) {
    const Wd = 400, H = 150, x = d => 30 + Math.log10(d / .15) / Math.log10(22 / .15) * (Wd - 40);
    let h = `<svg viewBox="0 0 ${Wd} ${H}" class="morph-h" role="img" aria-label="Distribuição prevista de diâmetros por classe de fibra">`;
    [.2, .5, 1, 2, 5, 10, 20].forEach(t => h += `<line x1="${x(t)}" x2="${x(t)}" y1="12" y2="${H - 22}" stroke="currentColor" opacity=".12"/><text x="${x(t)}" y="${H - 8}" text-anchor="middle" class="zl">${String(t).replace(".", ",")}</text>`);
    h += `<rect x="${x(1)}" y="12" width="${x(16) - x(1)}" height="${H - 34}" fill="#3ee6c5" opacity=".06"/><text x="${x(16) - 4}" y="22" text-anchor="end" class="zl">domínio verificado 1–16 µm</text>`;
    const mx = Math.max(...r.classes.map(c => c.share));
    r.classes.forEach(c => { const y0 = H - 22, sd = (Math.log(c.D.p90) - Math.log(c.D.p10)) / 2.56 || .1, mu = Math.log(c.D.med), A = (c.share / mx) * (H - 44);
      let d = ""; for (let i = 0; i <= 60; i++) { const lx = mu - 3 * sd + i / 60 * 6 * sd, v = Math.exp(-.5 * ((lx - mu) / sd) ** 2); d += `${i ? "L" : "M"}${x(Math.exp(lx)).toFixed(1)},${(y0 - A * v).toFixed(1)}`; }
      h += `<path d="${d}" fill="${c.col}" fill-opacity=".28" stroke="${c.col}" stroke-width="1.6" data-c="${c.cls}" class="hc ${W.sel === c.cls ? "on" : ""}"/><text x="${x(c.D.med)}" y="${y0 - A - 4}" text-anchor="middle" class="zl" fill="${c.col}">${c.cls}</text>`; });
    return h + `<text x="${Wd / 2}" y="${H}" text-anchor="middle" class="zl">diâmetro externo da fibra (µm, escala log)</text></svg>`;
  }
  function morphoWin(b) {
    const p = patient(), r = predict(p, CLIN.nerve), M = g.AxonModel, Tg = ST() && ST().ext().S.T;
    const thr = c => { try { return c.inDomain && M && Tg ? M.interp(Tg, c.D.med, 1) : null; } catch (e) { return null; } };
    const tA = r.classes.find(c => c.cls === "Aβ"), tRef = tA ? thr(tA) : null;
    b.innerHTML = `<div class="card"><h4>Paciente e clínica</h4>
        <p class="note">${p.sex === "F" ? "♀" : "♂"} ${p.age} anos · ${p.height} cm · ${p.weight} kg (IMC ${fmt(p.bmi)})${p.caseTitle ? ` · caso: <b>${esc(p.caseTitle)}</b>` : ""} — biometria editável na janela <a href="#" id="moPt">Paciente</a>.</p>
        <div class="grid3">${[["temp", "Temperatura do membro", 24, 36, .5, "°C"], ["hba1c", "HbA1c", 4.5, 13, .1, "%"], ["dmYears", "Tempo de diabetes", 0, 40, 1, "anos"]].map(([k, l, a, z, s, u]) => `<div class="ctl"><label><span>${l}</span><output>${fmt(p[k], k === "dmYears" ? 0 : 1)} ${u}</output></label><input type="range" min="${a}" max="${z}" step="${s}" value="${p[k]}" data-m="${k}"></div>`).join("")}</div>
        <div class="ctl"><label><span>Nervo / região</span></label><select id="moN">${NERVES.map(n => `<option ${n === CLIN.nerve ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        <p class="note">${esc(r.kindName)} (${esc(KIND[r.kind].ex)}) · densidade relativa ${fmt(r.density / Object.values(KIND[r.kind].mix).reduce((a, x) => a + x, 0) * 100, 0)} % do adulto jovem ${tag("der")}</p></div>
      <div class="card"><h4>Diâmetros previstos no feixe</h4>${histo(r)}
        <div class="scroll"><table class="tbl mo"><tr><th>Classe</th><th>Papel</th><th>D fibra (p10–p90)</th><th>Axônio</th><th>g</th><th>Mielina</th><th>Internodo</th><th>VC</th><th>% axônios</th><th>Limiar rel.</th></tr>
        ${r.classes.map(c => { const t = thr(c); return `<tr data-c="${c.cls}" class="${W.sel === c.cls ? "on" : ""}"><td><b style="color:${c.col}">${c.cls}</b></td><td>${esc(c.role)}</td><td>${fmt(c.D.med)} µm <small>(${fmt(c.D.p10)}–${fmt(c.D.p90)})</small></td><td>${fmt(c.axon, 2)} µm</td><td>${CL[c.cls].my ? fmt(c.g, 2) : "—"}</td><td>${CL[c.cls].my ? fmt(c.myelin, 2) + " µm" : "Remak"}</td><td>${c.internode ? fmt(c.internode / 1000, 2) + " mm" : "—"}</td><td>${fmt(c.cv, c.cv < 3 ? 2 : 0)} m/s</td><td>${fmt(c.share * 100, 0)} %</td><td>${t && tRef ? "×" + fmt(t / tRef, 2) : c.inDomain ? "—" : "fora do domínio"}</td></tr>`; }).join("")}</table></div>
        <p class="note">${tag("lit")} faixas de classe (Erlanger–Gasser, Lloyd), VC = k·D (Boyd & Kalu, gato: 4,6 para II, III, γ; Hursh: ≈ 6; para α humano usa-se 4,4 ${tag("der")}, que reproduz a VC motora clínica de 50–65 m/s), g 0,62–0,75 (Arbuthnott et al.). ${tag("pre")} internodo ≈ 100·D; composição do nervo; dispersão. ${tag("der")} quantis p10/p90 da distribuição de referência escalada pelos fatores (determinístico, igual ao backend <span class="mono">/api/morpho</span>). Limiar relativo ao Aβ a 1 mm pelo núcleo verificado (1–16 µm).</p>
        <div id="moDet"></div></div>
      <div class="card"><h4>Fatores biométricos e clínicos aplicados</h4><table class="tbl">${r.factors.map(F => `<tr><td><b>${esc(F.k)}</b><br><small>${esc(F.v)}</small></td><td>${esc(F.e)} ${tag(F.t)}<br><small>${F.r.map(k => esc(REF[k].split(".")[0])).join("; ")}</small></td></tr>`).join("")}</table></div>
      <div class="card"><h4>Prolongamento do axônio até o alvo</h4>
        <p class="note">Escolha um músculo para traçar o axônio motor α da raiz até a placa motora (zona de inervação no meio do ventre muscular ${tag("lit")}), ou um ponto reflexo para o trajeto aferente até o corno dorsal.</p>
        <div class="row" style="gap:6px;flex-wrap:wrap"><select id="moM"><option value="">— músculo —</option>${MUS.map(m => `<option ${W.muscle === m[0] ? "selected" : ""} value="${m[0]}">${m[1]}</option>`).join("")}</select>
        <select id="moR"><option value="">— ponto reflexo —</option>${(ST() ? ST().reflexPoints() : []).map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select><button class="btn ghost" id="moClr">Limpar trajeto</button></div>
        <div id="moPath"></div></div>
      <div class="card"><h4>Referências</h4><ol class="refs">${Object.values(REF).map(x => `<li>${esc(x)}</li>`).join("")}</ol></div>`;
    $("#moPt", b).onclick = e => { e.preventDefault(); g.AxonApp.openApp("patient"); };
    $$("[data-m]", b).forEach(i => i.oninput = () => { CLIN[i.dataset.m] = +i.value; CLIN.touched[i.dataset.m] = true; clearTimeout(W.t); W.t = setTimeout(() => { morphoWin(b); syncFascicle(); }, 120); });
    $("#moN", b).onchange = e => { CLIN.nerve = e.target.value; morphoWin(b); syncFascicle(); };
    const showDet = c => { W.sel = c; const k = r.classes.find(x => x.cls === c), d = CL[c]; $$("tr[data-c]", b).forEach(t => t.classList.toggle("on", t.dataset.c === c)); $$(".hc", b).forEach(t => t.classList.toggle("on", t.dataset.c === c));
      $("#moDet", b).innerHTML = `<div class="detail"><b style="color:${d.col}">${c}</b> · faixa ${fmt(d.lo)}–${fmt(d.hi)} µm ${tag("lit")}<br>${d.aff ? `<b>Aferente:</b> ${esc(d.aff)}<br>` : ""}${d.eff ? `<b>Eferente:</b> ${esc(d.eff)}<br>` : ""}
        Calibre do axônio ${fmt(k.axon, 2)} µm, mielina ${CL[c].my ? fmt(k.myelin, 2) + " µm" : "ausente (feixe de Remak)"}, VC ${fmt(k.cv, 1)} m/s (sem os fatores: ${fmt(k.cv0, 1)} m/s). ${k.inDomain ? "Dentro do domínio do núcleo biofísico verificado." : "Fora do domínio verificado: valores ilustrativos."}</div>`; };
    $$("tr[data-c], .hc", b).forEach(t => t.onclick = () => showDet(t.dataset.c)); if (W.sel && r.classes.some(c => c.cls === W.sel)) showDet(W.sel);
    $("#moM", b).onchange = e => { W.muscle = e.target.value; traceMuscle(W.muscle, b); };
    $("#moR", b).onchange = e => tracePoint(e.target.value, b);
    $("#moClr", b).onclick = () => { clearPath(); ST().clearHighlight(); $("#moPath", b).innerHTML = ""; };
    if (W.muscle) traceMuscle(W.muscle, b, true);
  }
  // músculos de referência (nomes FMA da malha) para o traçado motor
  const MUS = [["right tibialis anterior", "Tibial anterior D (fibular profundo, L4–L5)"], ["right gastrocnemius", "Gastrocnêmio D (tibial, S1–S2)"], ["right vastus lateralis", "Vasto lateral D (femoral, L2–L4)"], ["right biceps femoris", "Bíceps femoral D (ciático, L5–S2)"],
    ["right abductor pollicis brevis", "Abdutor curto do polegar D (mediano, C8–T1)"], ["right first dorsal interosseous", "1º interósseo dorsal D (ulnar, C8–T1)"], ["right biceps brachii", "Bíceps braquial D (musculocutâneo, C5–C7)"], ["right deltoid", "Deltoide D (axilar, C5–C6)"], ["right extensor carpi radialis longus", "Extensor radial longo do carpo D (radial, C6–C7)"]];
  function resolveMuscle(name) { const E = ST().ext(), mesh = E.S.meshByLayer && E.S.meshByLayer.muscles; if (!mesh) return null; const parts = mesh.userData.parts; const base = name.replace(/^right |^left /, ""), side = name.startsWith("left") ? "left" : "right";
    const hit = parts.find(p => p.name === name) || parts.find(p => p.name.includes(base) && p.name.includes(side)) || parts.find(p => p.name.includes(base)); return hit ? hit.name : null; }
  function traceMuscle(name, b, quiet) {
    const st = ST(), E = st.ext(); if (!E.S.musclesReady) { E.ensureMuscles(); $("#moPath", b).innerHTML = `<p class="note">Carregando músculos…</p>`; document.addEventListener("axon:muscles", () => traceMuscle(name, b), { once: true }); return; }
    const real = resolveMuscle(name); if (!real) { $("#moPath", b).innerHTML = `<p class="note">Músculo não encontrado na malha.</p>`; return; }
    const inn = g.AxonRelations ? g.AxonRelations.innervation(real) : null; if (!inn) return;
    const P = axonPath({ muscle: real, root: inn.roots, nerve: inn.modeled, kind: "motor" });
    st.highlight({ parts: [{ layer: "muscles", name: real, color: 0xff8a3d, link: false }], nerves: inn.modeled ? [inn.modeled] : [], seg: inn.roots.replace(/–/, "-").split("-").length > 1 ? inn.roots : inn.roots, reveal: true });
    drawPath(P, 0xd36cff, "motor");
    const r = predict(null, inn.modeled || inn.nerve), a = r.classes.find(c => c.cls === "Aα");
    const lat = P && a ? P.mm / a.cv + .8 : null;
    $("#moPath", b).innerHTML = P ? `<table class="tbl"><tr><td>Alvo</td><td><b>${esc(real)}</b> · placa motora na zona de inervação (meio do ventre) ${tag("lit")}</td></tr>
      <tr><td>Trajeto</td><td>${esc(P.rootName || "raiz " + inn.roots)} → ${esc(inn.nerve)}${P.nerveName ? ` (${esc(P.nerveName)})` : ""} → ramo muscular</td></tr>
      <tr><td>Comprimento do axônio α</td><td><b>${fmt(P.mm / 10, 1)} cm</b> ${tag("der")} <small>(malha × altura/170 cm)</small></td></tr>
      <tr><td>Calibre previsto (Aα)</td><td>${a ? `${fmt(a.D.med)} µm · axônio ${fmt(a.axon, 1)} µm · VC ${fmt(a.cv, 0)} m/s` : "—"} ${tag("der")}</td></tr>
      <tr><td>Latência raiz → contração</td><td><b>${lat ? fmt(lat, 1) + " ms" : "—"}</b> <small>(condução + ~0,8 ms de junção neuromuscular ${tag("pre")})</small></td></tr>
      <tr><td>Aferências do mesmo músculo</td><td>Ia/Ib (Aα) do fuso e do órgão tendinoso → corno ventral (reflexo miotático, ${esc(inn.roots)}); II (Aβ) do fuso; III/IV (Aδ, C) de dor muscular → corno dorsal</td></tr></table>` : `<p class="note">Trajeto não disponível para este alvo.</p>`;
    if (!quiet && P) E.focusOn([P.target.x, P.target.y, P.target.z], null, .45);
    document.dispatchEvent(new CustomEvent("axon:morpho", { detail: { muscle: real, nerve: inn.modeled, roots: inn.roots, path: P } }));
  }
  function tracePoint(id, b) {
    const st = ST(), E = st.ext(), rp = st.reflexPoints().find(x => x.id === id); if (!rp) return;
    const P = axonPath({ nerve: rp.nerve, root: rp.seg, target: rp.p, kind: "sens" });
    st.selectReflex(id, false); drawPath(P, 0x4fb3ff, "sens");
    const r = predict(null, rp.nerve || "cutâneo"), cls = ["Aβ", "Aδ", "C"].map(c => r.classes.find(x => x.cls === c)).filter(Boolean);
    $("#moPath", b).innerHTML = P ? `<table class="tbl"><tr><td>Ponto</td><td><b>${esc(rp.name)}</b> · ${esc(rp.note || "")}</td></tr>
      <tr><td>Trajeto aferente</td><td>receptor → ${esc(rp.nerve || "nervo cutâneo")} → gânglio da raiz dorsal ${esc(rp.seg || "")} → corno dorsal</td></tr>
      <tr><td>Comprimento</td><td><b>${fmt(P.mm / 10, 1)} cm</b> ${tag("der")}</td></tr>
      ${cls.map(c => `<tr><td><b style="color:${c.col}">${c.cls}</b></td><td>${fmt(c.D.med)} µm · ${fmt(c.cv, c.cv < 3 ? 2 : 0)} m/s · chegada em <b>${fmt(P.mm / c.cv, c.cls === "C" ? 0 : 1)} ms</b></td></tr>`).join("")}</table>
      <p class="note">A diferença de chegada entre Aβ e C é a base da "primeira" e "segunda" dor e do controle de portão. ${tag("der")}</p>` : `<p class="note">Trajeto não disponível.</p>`;
    document.dispatchEvent(new CustomEvent("axon:morpho", { detail: { point: id, nerve: rp.nerve, seg: rp.seg, path: P } }));
  }
  function syncFascicle() { const st = ST(); if (st && st.rebuildFascicle && st.ext().S.built[3]) { st.rebuildFascicle(); st.setParams({}); } }

  function boot() { const A = g.AxonApp; if (!A || !A.registerApp || !g.AxonStage) return setTimeout(boot, 80);
    A.registerApp("morpho", { title: "morpho", w: 560, h: 760, render: morphoWin, onClose: () => {} });
    document.addEventListener("axon:case", () => { if (A.isOpen("morpho")) morphoWin(A.body("morpho")); syncFascicle(); });
  }
  boot();
  g.AxonMorpho = { predict, patient, factors, fascSpec, axonPath, drawPath, clearPath, kindOf, regionOf, CL, KIND, REF, CLIN, traceMuscle, tracePoint, MUS };
})(window);
