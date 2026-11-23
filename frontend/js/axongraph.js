/* axon · grafo 3D de correlações (v0.9)
 * Do foco (ponto reflexo, músculo ou segmento) ao tecido, ao nervo, às classes de fibra aferentes e
 * eferentes (com o calibre previsto pelo AxonMorpho), ao segmento medular, às vias, aos centros
 * supraespinais e aos órgãos, sistemas, músculos e pontos indiretamente correlacionados.
 * Arestas por nível de correlação: 1 anatômica direta · 2 segmentar · 3 reflexa/referida · 4 neuromodulatória/sistêmica.
 * Esquema didático: a posição dos nós não é anatômica. Cada nó abre uma ficha com a literatura. */
(function (g) {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (x, d = 1) => (+x).toFixed(d).replace(".", ",");
  const TAGS = { lit: ["LITERATURA", "t-lit"], pre: ["PREMISSA", "t-pre"], der: ["DERIVADO", "t-der"], hip: ["HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO", "t-hip"] };
  const tag = k => `<span class="tag ${TAGS[k][1]}">${TAGS[k][0]}</span>`;
  const SEGS = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12", "L1", "L2", "L3", "L4", "L5", "S1", "S2", "S3", "S4", "S5"];
  const si = s => SEGS.indexOf(s);
  const segRange = r => { const m = String(r || "").match(/([CTLS]\d+)(?:\s*[–-]\s*([CTLS]\d+))?/); if (!m) return null; const a = si(m[1]), b = si(m[2] || m[1]); return a < 0 || b < 0 ? null : [Math.min(a, b), Math.max(a, b)]; };
  const ovl = (a, b, pad = 0) => a && b && a[0] - pad <= b[1] && b[0] - pad <= a[1];
  const segTxt = r => r ? (r[0] === r[1] ? SEGS[r[0]] : `${SEGS[r[0]]}–${SEGS[r[1]]}`) : "—";

  const REF = {
    todd: "Todd AJ. Neuronal circuitry for pain processing in the dorsal horn. Nat Rev Neurosci. 2010;11:823-36.",
    willis: "Willis WD, Westlund KN. Neuroanatomy of the pain system and of the pathways that modulate pain. J Clin Neurophysiol. 1997;14:2-31.",
    melzack: "Melzack R, Wall PD. Pain mechanisms: a new theory. Science. 1965;150:971-9.",
    millan: "Millan MJ. Descending control of pain. Prog Neurobiol. 2002;66:355-474.",
    craig: "Craig AD. How do you feel? Interoception: the sense of the physiological condition of the body. Nat Rev Neurosci. 2002;3:655-66.",
    tracey: "Tracey KJ. Physiology and immunology of the cholinergic antiinflammatory pathway. J Clin Invest. 2007;117:289-96.",
    peuker: "Peuker ET, Filler TJ. The nerve supply of the human auricle. Clin Anat. 2002;15:35-7.",
    han: "Han JS. Acupuncture: neuropeptide release produced by electrical stimulation of different frequencies. Trends Neurosci. 2003;26:17-22.",
    liddell: "Liddell EGT, Sherrington CS. Reflexes in response to stretch (myotatic reflexes). Proc R Soc B. 1924;96:212-42.",
  };
  const R2 = () => Object.assign({}, (g.AxonRelations && g.AxonRelations.REFS) || {}, (g.AxonMorpho && g.AxonMorpho.REF) || {}, REF);

  // camadas do grafo (eixo x)
  const LAY = ["Foco", "Tecido e receptores", "Nervo periférico", "Fibras", "Segmento medular", "Vias", "Centros supraespinais", "Órgãos, sistemas e correlações indiretas"];
  const TYPE = { focus: [0xffffff, .11], tissue: [0xf0b48a, .07], nerve: [0x3ee6c5, .08], aff: [0x4fb3ff, .065], eff: [0xd36cff, .065], seg: [0xffd166, .08], path: [0x9fb8ff, .06], cns: [0xf4a6c6, .075], organ: [0xc084fc, .075], point: [0xff6fa8, .055], muscle: [0xff8a3d, .055], system: [0x7cf2a0, .07] };
  const LEVEL = { 1: ["anatômica direta", 0xe8f4ff, "lit"], 2: ["segmentar (dermátomo/miótomo)", 0x3ee6c5, "lit"], 3: ["reflexa / dor referida", 0xffa24a, "lit"], 4: ["neuromodulatória / sistêmica", 0xb48cff, "hip"] };

  // ------------------------------------------------------------------ construção do grafo a partir do foco
  function build(focus) {
    const N = [], E = [], id = {}, M = g.AxonMorpho, REL = g.AxonRelations;
    const add = (key, o) => { if (id[key]) return id[key]; const n = Object.assign({ key, refs: [], rows: [] }, o); id[key] = n; N.push(n); return n; };
    const link = (a, b, level, label, t, refs) => { if (a && b && a !== b && !E.some(e => e.a === a && e.b === b)) E.push({ a, b, level, label, tag: t || LEVEL[level][2], refs: refs || [] }); };
    let rg = null, nerveName = null, nerveLbl = null, side = "D";
    // ---- foco
    let F;
    if (focus.kind === "point") {
      const rp = focus.rp; rg = segRange(rp.seg || rp.derm); nerveName = rp.nerve; side = /left/.test(rp.nerve || "") ? "E" : "D";
      F = add("focus", { type: "focus", layer: 0, label: rp.name, desc: rp.note || "", rows: [["Categoria", { acu: "acuponto (OMS 2008)", aur: "ponto auricular", tp: "ponto-gatilho miofascial", head: "zona de Head" }[rp.cat] || rp.cat], ["Segmento", rp.seg || "—"], ["Nervo", rp.nerve || "—"], rp.tcm ? ["MTC (tradicional)", rp.tcm + " " + tag("hip")] : null].filter(Boolean), refs: [rp.ref].filter(Boolean), tag: rp.tag === "LITERATURA" ? "lit" : "pre", show: { point: rp.id } });
      const t = add("t-skin", { type: "tissue", layer: 1, label: `Pele · dermátomo ${rp.derm || rp.seg || ""}`, desc: "Receptores cutâneos: Meissner, Merkel, Ruffini e Pacini (Aβ); terminações livres (Aδ, C).", show: { seg: rp.seg } });
      link(F, t, 1, "localização");
      (rp.muscles || []).forEach((m, i) => { const mm = add("t-m" + i, { type: /bone/.test(m) ? "tissue" : "muscle", layer: 1, label: m, desc: /bone/.test(m) ? "Referência óssea do ponto." : "Músculo sob o ponto: fusos (Ia, II), órgãos tendinosos (Ib), terminações III/IV.", show: { parts: [{ layer: /bone/.test(m) ? "skeleton" : "muscles", name: m }] } }); link(F, mm, 1, "plano profundo"); });
      (rp.organs || []).forEach((o, i) => { const on = add("o-p" + i, { type: "organ", layer: 7, label: o, desc: rp.refers || "", refs: [R2().head] }); link(F, on, 3, "dor referida (Head)"); });
    } else if (focus.kind === "muscle") {
      const inn = REL ? REL.innervation(focus.name) : null; rg = inn ? segRange(inn.roots) : null; nerveName = inn ? inn.modeled : null; nerveLbl = inn ? inn.nerve : null; side = /left/.test(focus.name) ? "E" : "D";
      F = add("focus", { type: "focus", layer: 0, label: focus.name, desc: "Músculo esquelético: placa motora na zona de inervação, perto do meio do ventre.", rows: [["Nervo", inn ? inn.nerve : "—"], ["Raízes (miótomo)", inn ? inn.roots : "—"]], refs: [R2().kendall, R2().gray, R2().iz].filter(Boolean), tag: "lit", show: { parts: [{ layer: "muscles", name: focus.name }] } });
      const ep = add("t-ep", { type: "tissue", layer: 1, label: "Placa motora (junção neuromuscular)", desc: "Acetilcolina → receptores nicotínicos; uma fibra α inerva todas as fibras de uma unidade motora.", refs: [R2().iz, R2().nmj].filter(Boolean), tag: "lit", trace: "motor" });
      const sp = add("t-sp", { type: "tissue", layer: 1, label: "Fuso muscular e órgão tendinoso", desc: "Fuso: Ia e II (comprimento e velocidade), inervação γ. Órgão tendinoso de Golgi: Ib (tensão).", refs: [REF.liddell], tag: "lit" });
      link(F, ep, 1, "inervação motora"); link(F, sp, 1, "propriocepção");
    } else {
      rg = segRange(focus.seg);
      F = add("focus", { type: "focus", layer: 0, label: `Segmento ${segTxt(rg)}`, desc: "Dermátomo, miótomo e esclerótomo do mesmo nível medular.", refs: [R2().gray].filter(Boolean), tag: "lit", show: { seg: focus.seg } });
      const t = add("t-skin", { type: "tissue", layer: 1, label: `Dermátomo ${segTxt(rg)}`, desc: "Área cutânea suprida pela raiz dorsal.", show: { seg: focus.seg } }); link(F, t, 1, "inervação cutânea");
    }
    // ---- nervo
    const pretty = s => String(s || "").replace(/ right$/, " (D)").replace(/ left$/, " (E)");
    const nv = nerveName ? add("n", { type: "nerve", layer: 2, label: pretty(nerveName), desc: nerveLbl ? `Ramo: ${nerveLbl}.` : "Nervo periférico modelado.", show: { nerves: [nerveName] }, refs: [R2().gray].filter(Boolean), tag: "lit" }) : null;
    if (nv) { N.filter(n => n.layer === 1).forEach(t => link(t, nv, 1, "inervação")); }
    // ---- fibras (com predição)
    const pred = M ? M.predict(null, nerveName || (focus.kind === "muscle" ? "Ramo muscular" : "Nervo cutâneo")) : null;
    const fib = {};
    const fibNode = (cls, dir) => { const c = pred && pred.classes.find(x => x.cls === cls), d = M && M.CL[cls]; const key = `f-${cls}-${dir}`;
      return (fib[key] = add(key, { type: dir, layer: 3, label: `${cls} ${dir === "aff" ? "aferente" : "eferente"}`, cls,
        desc: dir === "aff" ? (d && d.aff) || "" : (d && d.eff) || "",
        rows: c ? [["Diâmetro da fibra", `${fmt(c.D.med)} µm (${fmt(c.D.p10)}–${fmt(c.D.p90)})`], ["Axônio · g", `${fmt(c.axon, 2)} µm · ${d.my ? fmt(c.g, 2) : "amielínico"}`], ["Velocidade", `${fmt(c.cv, c.cv < 3 ? 2 : 0)} m/s`], ["Fração de axônios", `${fmt(c.share * 100, 0)} %`]] : [["Faixa", d ? `${d.lo}–${d.hi} µm` : "—"]],
        refs: [R2().eg, R2().boyd, R2().arb].filter(Boolean), tag: c ? "der" : "lit", morph: true, trace: dir === "eff" && cls === "Aα" ? "motor" : dir === "aff" ? "sens" : null })); };
    const src = nv || F;
    const affs = focus.kind === "muscle" ? ["Aα", "Aβ", "Aδ", "C"] : ["Aβ", "Aδ", "C"];
    affs.forEach(c => link(src, fibNode(c, "aff"), 1, "conduz"));
    if (focus.kind === "muscle") { link(src, fibNode("Aα", "eff"), 1, "motor α"); link(src, fibNode("Aγ", "eff"), 1, "motor γ"); }
    link(src, fibNode("C", "eff"), 1, "simpático pós-ganglionar");
    // ---- segmento medular
    const st = rg ? segTxt(rg) : "—";
    const drg = add("s-drg", { type: "seg", layer: 4, label: `Gânglio da raiz dorsal ${st}`, desc: "Corpos celulares das fibras aferentes (pseudounipolares).", show: rg ? { seg: st } : null, refs: [R2().gray].filter(Boolean), tag: "lit" });
    const dh12 = add("s-dh12", { type: "seg", layer: 4, label: "Corno dorsal · lâminas I–II", desc: "Aδ e C nociceptivos; substância gelatinosa (interneurônios do portão).", refs: [REF.todd], tag: "lit" });
    const dh35 = add("s-dh35", { type: "seg", layer: 4, label: "Corno dorsal · lâminas III–V (WDR)", desc: "Aβ e convergência: neurônios de faixa dinâmica ampla recebem pele, músculo e víscera do mesmo segmento.", refs: [REF.todd, REF.melzack], tag: "lit" });
    ["Aβ", "Aδ", "C", "Aα"].forEach(c => fib[`f-${c}-aff`] && link(fib[`f-${c}-aff`], drg, 1, "soma no GRD"));
    if (fib["f-Aδ-aff"]) link(drg, dh12, 1, "Aδ/C → I–II"); link(drg, dh35, 1, "Aβ → III–V");
    link(dh35, dh12, 4, "portão: Aβ inibe transmissão de Aδ/C", "lit", [REF.melzack]);
    if (focus.kind === "muscle") {
      const vh = add("s-vh", { type: "seg", layer: 4, label: `Corno ventral ${st} · motoneurônios α/γ`, desc: "Coluna motora do miótomo; reflexo miotático monossináptico (Ia → α).", refs: [REF.liddell], tag: "lit", show: rg ? { seg: st } : null });
      link(vh, fib["f-Aα-eff"], 1, "axônio motor α"); link(vh, fib["f-Aγ-eff"], 1, "axônio γ"); link(fib["f-Aα-aff"], vh, 3, "reflexo miotático (Ia → α)", "lit", [REF.liddell]);
    }
    const symp = rg && rg[1] >= si("T1") && rg[0] <= si("L2"), para = rg && rg[1] >= si("S2") && rg[0] <= si("S4");
    const iml = add("s-iml", { type: "seg", layer: 4, label: symp ? `Coluna intermediolateral ${st}` : "Cadeia simpática (T1–L2)", desc: symp ? "Neurônios pré-ganglionares simpáticos (fibras B) do mesmo segmento." : "A inervação simpática do membro vem de T1–L2 pela cadeia e retorna pelos ramos cinzentos.", refs: [R2().janig].filter(Boolean), tag: "lit" });
    link(iml, fib["f-C-eff"], 1, "pré (B) → gânglio → pós (C)"); link(dh35, iml, 3, "reflexo somatossimpático", "lit", [R2().janig].filter(Boolean));
    // ---- vias e centros
    const stt = add("p-stt", { type: "path", layer: 5, label: "Trato espinotalâmico (anterolateral)", desc: "Dor e temperatura; cruza no segmento.", refs: [REF.willis], tag: "lit" });
    const dcml = add("p-dc", { type: "path", layer: 5, label: "Coluna dorsal – lemnisco medial", desc: "Tato fino, vibração e propriocepção consciente (Aβ, Ia).", refs: [REF.willis], tag: "lit" });
    const desc = add("p-desc", { type: "path", layer: 5, label: "Vias descendentes (PAG–RVM, LC)", desc: "Modulação inibitória/facilitadora por opioides endógenos, serotonina e noradrenalina.", refs: [REF.millan, R2().basbaum].filter(Boolean), tag: "lit" });
    link(dh12, stt, 1, "lâmina I → STT"); link(dh35, stt, 1, "WDR → STT"); if (fib["f-Aβ-aff"]) link(fib["f-Aβ-aff"], dcml, 1, "ramo ascendente"); if (fib["f-Aα-aff"]) link(fib["f-Aα-aff"], dcml, 1, "propriocepção");
    link(desc, dh12, 4, "inibição descendente", "lit", [REF.millan]);
    const thal = add("c-th", { type: "cns", layer: 6, label: "Tálamo (VPL/VPM, núcleos mediais)", desc: "Relé somatossensitivo e nociceptivo.", refs: [REF.willis], tag: "lit" });
    const s1 = add("c-s1", { type: "cns", layer: 6, label: "Córtex S1 · ínsula · cíngulo anterior", desc: "Discriminação (S1), interocepção (ínsula), afeto da dor (cíngulo).", refs: [REF.craig], tag: "lit" });
    const pag = add("c-pag", { type: "cns", layer: 6, label: "PAG · RVM · locus coeruleus", desc: "Núcleos do controle descendente; alvo dos efeitos de frequência da EA (2 Hz encefalinas/endorfinas; 100 Hz dinorfina).", refs: [REF.millan, REF.han], tag: "lit" });
    link(stt, thal, 1, "projeção"); link(dcml, thal, 1, "projeção"); link(thal, s1, 1, "radiação talâmica"); link(stt, pag, 1, "colaterais espinomesencefálicos"); link(pag, desc, 1, "origem");
    // ---- vago (pontos auriculares, ABVN, ou foco vagal)
    const vagal = /vago|auricular|concha/i.test((nerveName || "") + " " + (focus.rp ? focus.rp.name + focus.rp.id : ""));
    if (vagal) {
      const nts = add("c-nts", { type: "cns", layer: 6, label: "Núcleo do trato solitário (NTS)", desc: "Recebe as aferências do ramo auricular e do vago; projeta para LC, PAG, hipotálamo e núcleo ambíguo/dorsal motor.", refs: [REF.peuker, R2().farmer21 || ""], tag: "lit" });
      link(fib["f-Aβ-aff"], nts, 1, "aferência vagal"); link(nts, pag, 4, "modulação descendente", "hip");
      const cap = add("sy-cap", { type: "system", layer: 7, label: "Via colinérgica anti-inflamatória", desc: "Eferência vagal → baço → redução de TNF (modelo experimental).", refs: [REF.tracey], tag: "hip" });
      const card = add("sy-card", { type: "system", layer: 7, label: "Controle cardíaco vagal (VFC)", desc: "Núcleo ambíguo → nó sinusal; RMSSD como marcador.", refs: [R2().janig].filter(Boolean), tag: "lit" });
      link(nts, cap, 4, "eferência vagal", "hip"); link(nts, card, 4, "barorreflexo / tônus vagal", "lit");
    }
    // ---- órgãos por convergência segmentar (simpático e parassimpático pélvico)
    (REL ? REL.ORG : []).forEach(o => { const os = segRange(o.sym), op = /S2/.test(o.par) ? [si("S2"), si("S4")] : null;
      if (ovl(os, rg) || ovl(op, rg)) { const on = add("o-" + o.id, { type: "organ", layer: 7, label: o.n, desc: `Simpático ${o.sym}; parassimpático ${o.par}. Dor referida: ${o.aff}.`, rows: [["Correlação", ovl(os, rg) ? `segmento ${o.sym} compartilhado` : "parassimpático sacral"]], refs: [R2().head, R2().janig].filter(Boolean), tag: "lit", show: o.fma ? { parts: [{ layer: "organs", name: o.fma }] } : null });
        link(dh35, on, 3, "convergência víscero-somática (dor referida)", "lit", [R2().head].filter(Boolean)); link(iml, on, 4, "eferência autonômica do segmento", "lit"); } });
    // ---- indiretos: outros pontos e músculos do mesmo segmento/nervo
    const pts = g.AxonStage ? g.AxonStage.reflexPoints() : [];
    pts.filter(p => !(focus.rp && p.id === focus.rp.id)).forEach(p => { const pr = segRange(p.seg || p.derm), sameN = nerveName && p.nerve && p.nerve.replace(/ (right|left)$/, "") === nerveName.replace(/ (right|left)$/, "");
      if (sameN || ovl(pr, rg, 1)) { const lvl = sameN ? 1 : ovl(pr, rg) ? 2 : 3; const pn = add("x-" + p.id, { type: "point", layer: 7, label: p.name, desc: `${p.note || ""} Segmento ${p.seg || "—"}.`, rows: [["Relação", sameN ? "mesmo nervo" : ovl(pr, rg) ? "mesmo segmento" : "segmento adjacente (±1)"]], refs: [p.ref].filter(Boolean), tag: "lit", show: { point: p.id } });
        link(sameN && nv ? nv : drg, pn, lvl, sameN ? "mesmo nervo" : lvl === 2 ? "mesmo dermátomo" : "segmento adjacente"); } });
    if (REL && rg) { const seen = new Set(); REL.INN.forEach(([re, nerve, model, roots]) => { const r2 = segRange(roots); if (!ovl(r2, rg) || seen.size >= 6) return; const nm = re.source.split("|")[0].replace(/[\\^$.*()?]/g, "").replace(/ \(.*/, ""); if (!nm || seen.has(nerve)) return; seen.add(nerve);
      const mn = add("x-m-" + nerve, { type: "muscle", layer: 7, label: `${nm} (${nerve})`, desc: `Miótomo ${roots}: mesmo segmento, fraqueza ou dor muscular podem coexistir.`, rows: [["Raízes", roots]], refs: [R2().kendall].filter(Boolean), tag: "lit" }); link(focus.kind === "muscle" ? N.find(n => n.key === "s-vh") : drg, mn, 2, "mesmo miótomo"); }); }
    const op = add("sy-op", { type: "system", layer: 7, label: "Sistema opioide endógeno", desc: "Encefalinas, β-endorfina e dinorfina conforme a frequência do estímulo.", refs: [REF.han], tag: "lit" }); link(pag, op, 4, "liberação de peptídeos", "lit", [REF.han]);
    return { nodes: N, edges: E, focus, seg: rg, nerve: nerveName, pred };
  }

  // ------------------------------------------------------------------ renderização 3D (Three.js próprio da janela)
  const V = { r: null, sc: null, cam: null, grp: null, raf: 0, graph: null, sel: null, rot: { th: 0, ph: 1.32, d: 12.5, t: 0 }, auto: true, lv: { 1: true, 2: true, 3: true, 4: true }, follow: true, focus: null };
  function layout(G) {
    const byL = {}; G.nodes.forEach(n => (byL[n.layer] = byL[n.layer] || []).push(n));
    Object.entries(byL).forEach(([L, ns]) => { const k = ns.length, R = k === 1 ? 0 : .5 + .26 * k; ns.forEach((n, i) => { const a = i / k * Math.PI * 2 + L * .7; n.pos = [(L - 3.5) * 1.55, Math.cos(a) * R * .9, Math.sin(a) * R]; }); });
  }
  function draw3D(cv, lab) {
    const T = g.THREE, G = V.graph; if (!T || !G) return; layout(G);
    if (!V.r) { V.r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); V.r.setPixelRatio(Math.min(2, g.devicePixelRatio || 1)); V.sc = new T.Scene(); V.cam = new T.PerspectiveCamera(40, 1, .1, 100);
      V.sc.add(new T.HemisphereLight(0xe8f8ff, 0x101820, 1.1)); const dl = new T.DirectionalLight(0xffffff, .8); dl.position.set(3, 6, 5); V.sc.add(dl); }
    if (V.grp) V.sc.remove(V.grp); V.grp = new T.Group(); V.sc.add(V.grp);
    const lin = h => new T.Color(h);
    G.nodes.forEach(n => { const [col, sz] = TYPE[n.type] || [0xffffff, .06], m = new T.Mesh(new T.SphereGeometry(sz * 1.6, 24, 18), new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .35, roughness: .35, metalness: .1, transparent: true }));
      m.position.set(...n.pos); m.userData.n = n; n.mesh = m; V.grp.add(m); });
    G.edges.forEach(e => { const [, col] = LEVEL[e.level], p0 = new T.Vector3(...e.a.pos), p2 = new T.Vector3(...e.b.pos), p1 = p0.clone().lerp(p2, .5).add(new T.Vector3(0, .25 * (e.level - 1), 0));
      const geo = new T.BufferGeometry().setFromPoints(new T.QuadraticBezierCurve3(p0, p1, p2).getPoints(24));
      const mat = e.level === 4 ? new T.LineDashedMaterial({ color: col, dashSize: .12, gapSize: .08, transparent: true, opacity: .8 }) : new T.LineBasicMaterial({ color: col, transparent: true, opacity: e.level === 1 ? .85 : .7 });
      const l = new T.Line(geo, mat); if (e.level === 4) l.computeLineDistances(); l.userData.e = e; e.line = l; V.grp.add(l); });
    lab.innerHTML = G.nodes.map((n, i) => `<div class="gl-l t-${n.type}" data-i="${i}">${esc(n.label)}</div>`).join("") + LAY.map((t, i) => `<div class="gl-col" data-l="${i}">${esc(t)}</div>`).join("");
    applyFilter();
    cancelAnimationFrame(V.raf); const tick = () => { V.raf = requestAnimationFrame(tick); if (!cv.isConnected) { cancelAnimationFrame(V.raf); return; } render(cv, lab); }; tick();
  }
  function render(cv, lab) {
    const T = g.THREE, w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    if (cv.width !== Math.floor(w * V.r.getPixelRatio())) { V.r.setSize(w, h, false); V.cam.aspect = w / h; V.cam.updateProjectionMatrix(); }
    if (V.auto) { V.rot.t += .006; V.rot.th = Math.sin(V.rot.t) * .55; } const { th, ph, d } = V.rot; V.cam.position.set(d * Math.sin(ph) * Math.sin(th), d * Math.cos(ph), d * Math.sin(ph) * Math.cos(th)); V.cam.lookAt(0, 0, 0);
    V.r.render(V.sc, V.cam);
    const v = new T.Vector3(), els = lab.children;
    V.graph.nodes.forEach((n, i) => { const el = els[i]; v.set(...n.pos).project(V.cam); const vis = n.mesh.visible && v.z < 1; el.style.display = vis ? "" : "none"; if (!vis) return;
      el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px,${((1 - v.y) / 2 * h).toFixed(1)}px)`; el.style.opacity = n.mesh.material.opacity; });
    $$(".gl-col", lab).forEach(el => { const L = +el.dataset.l; v.set((L - 3.5) * 1.55, 3.3, 0).project(V.cam); el.style.opacity = Math.max(0, 1 - Math.abs(Math.sin(V.rot.th)) * 1.6); el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px,${((1 - v.y) / 2 * h).toFixed(1)}px)`; });
  }
  function applyFilter() {
    const G = V.graph; if (!G) return; const sel = V.sel, near = new Set();
    if (sel) { near.add(sel); G.edges.forEach(e => { if (!V.lv[e.level]) return; if (e.a === sel) near.add(e.b); if (e.b === sel) near.add(e.a); }); }
    G.edges.forEach(e => { const on = V.lv[e.level]; e.line.visible = on; e.line.material.opacity = !sel ? (e.level === 1 ? .85 : .7) : (e.a === sel || e.b === sel) ? 1 : .08; });
    const linked = new Set(); G.edges.forEach(e => { if (V.lv[e.level]) { linked.add(e.a); linked.add(e.b); } });
    G.nodes.forEach(n => { n.mesh.visible = n.key === "focus" || linked.has(n); n.mesh.material.opacity = !sel || near.has(n) ? 1 : .18; n.mesh.scale.setScalar(n === sel ? 1.6 : 1); });
  }

  // ------------------------------------------------------------------ ficha do nó
  function detail(n, box) {
    const G = V.graph, ins = G.edges.filter(e => (e.a === n || e.b === n) && V.lv[e.level]);
    box.innerHTML = `<div class="gd-h"><span class="gdot t-${n.type}"></span><b>${esc(n.label)}</b> <small>${esc(LAY[n.layer])}</small> ${n.tag ? tag(n.tag) : ""}</div>
      ${n.desc ? `<p>${esc(n.desc)}</p>` : ""}${n.rows.length ? `<table class="tbl">${n.rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join("")}</table>` : ""}
      <h5>Correlações (${ins.length})</h5><ul class="gd-l">${ins.map(e => { const o = e.a === n ? e.b : e.a; return `<li><span class="lv lv${e.level}">${e.level}</span> ${e.a === n ? "→" : "←"} <a href="#" data-k="${esc(o.key)}">${esc(o.label)}</a> <small>${esc(e.label || LEVEL[e.level][0])}</small> ${tag(e.tag)}</li>`; }).join("")}</ul>
      ${(n.refs || []).filter(Boolean).length ? `<h5>Literatura</h5><ol class="refs">${[...new Set(n.refs.filter(Boolean))].map(r => `<li>${esc(r)}</li>`).join("")}</ol>` : ""}
      <div class="row" style="gap:6px;flex-wrap:wrap">${n.show ? `<button class="btn" id="gdShow">Mostrar no corpo</button>` : ""}${n.trace || (n.morph && G.focus.kind !== "segment") ? `<button class="btn ghost" id="gdTrace">Traçar o axônio no corpo</button>` : ""}${n.morph ? `<button class="btn ghost" id="gdMorph">Calibre e fatores do paciente</button>` : ""}</div>`;
    $$("a[data-k]", box).forEach(a => a.onclick = ev => { ev.preventDefault(); const o = G.nodes.find(x => x.key === a.dataset.k); if (o) select(o, box); });
    const sb = $("#gdShow", box); if (sb) sb.onclick = () => showInBody(n);
    const tb = $("#gdTrace", box); if (tb) tb.onclick = () => trace(n);
    const mb = $("#gdMorph", box); if (mb) mb.onclick = () => { if (G.nerve && g.AxonMorpho) g.AxonMorpho.CLIN.nerve = /vago|auricular/i.test(G.nerve) ? (/auricular/i.test(G.nerve) ? "Ramo auricular do vago" : "Nervo vago") : G.nerve.replace(/ (right|left)$/, ""); g.AxonApp.openApp("morpho"); };
  }
  function select(n, box) { V.sel = n; V.auto = false; applyFilter(); detail(n, box || $("#gDet")); }
  function showInBody(n) {
    const st = g.AxonStage; if (!st || !n.show) return; const s = n.show;
    if (s.point) { st.selectReflex(s.point, true); return; }
    st.highlight({ parts: (s.parts || []).map(p => Object.assign({ color: 0xff8a3d }, p)), nerves: s.nerves || [], seg: s.seg || (V.graph.seg ? segTxt(V.graph.seg) : null), reveal: true });
  }
  function trace(n) {
    const M = g.AxonMorpho, G = V.graph, f = G.focus; if (!M) return;
    if (f.kind === "muscle") { const inn = g.AxonRelations.innervation(f.name); const P = M.axonPath({ muscle: f.name, root: inn.roots, nerve: inn.modeled, kind: "motor" }); M.drawPath(P, n.type === "aff" ? 0x4fb3ff : 0xd36cff, n.type === "aff" ? "sens" : "motor"); return P; }
    if (f.kind === "point") { const rp = f.rp, P = M.axonPath({ nerve: rp.nerve, root: rp.seg, target: rp.p, kind: "sens" }); M.drawPath(P, 0x4fb3ff, "sens"); return P; }
  }

  // ------------------------------------------------------------------ janela
  function focusOptions() {
    const pts = g.AxonStage ? g.AxonStage.reflexPoints() : [], mus = (g.AxonMorpho && g.AxonMorpho.MUS) || [];
    const cs = (g.AxonSim && g.AxonSim.case) || (g.AxonCases && g.AxonCases.list[0]); const segs = cs && cs.pain && cs.pain.dermatomes ? cs.pain.dermatomes.filter(s => si(s) >= 0) : [];
    return [...pts.map(p => ["p:" + p.id, "Ponto · " + p.name]), ...mus.map(m => ["m:" + m[0], "Músculo · " + m[1]]), ...[...new Set([...segs, "C6", "T4", "T10", "L5", "S1"])].map(s => ["s:" + s, `Segmento · ${s}${segs.includes(s) ? " (caso)" : ""}`])];
  }
  function resolveFocus(v) {
    const [k, rest] = [v.slice(0, 1), v.slice(2)];
    if (k === "p") { const rp = g.AxonStage.reflexPoints().find(p => p.id === rest); return rp ? { kind: "point", rp, key: v } : null; }
    if (k === "m") { const E = g.AxonStage.ext(), mesh = E.S.meshByLayer && E.S.meshByLayer.muscles; let name = rest;
      if (mesh) { const base = rest.replace(/^(right|left) /, ""), side = rest.startsWith("left") ? "left" : "right"; const hit = mesh.userData.parts.find(p => p.name === rest) || mesh.userData.parts.find(p => p.name.includes(base) && p.name.includes(side)); if (hit) name = hit.name; }
      return { kind: "muscle", name, key: v }; }
    return { kind: "segment", seg: rest, key: v };
  }
  function graphWin(b) {
    const opts = focusOptions(); if (!V.focus) { const cs = (g.AxonSim && g.AxonSim.case) || (g.AxonCases && g.AxonCases.list[0]); const s0 = cs && cs.pain && cs.pain.dermatomes && cs.pain.dermatomes.find(s => si(s) >= 0); V.focus = resolveFocus(s0 ? "s:" + s0 : "p:LI4"); }
    V.graph = build(V.focus); V.sel = null;
    const G = V.graph, cnt = l => G.edges.filter(e => e.level === l).length;
    b.innerHTML = `<div class="gbar"><select id="gF">${opts.map(([v, l]) => `<option value="${esc(v)}" ${V.focus && V.focus.key === v ? "selected" : ""}>${esc(l)}</option>`).join("")}${V.focus && !opts.some(o => o[0] === V.focus.key) ? `<option selected>${esc(V.focus.name || V.focus.key)}</option>` : ""}</select>
        <label class="rowc"><input type="checkbox" id="gFol" ${V.follow ? "checked" : ""}> seguir seleção no corpo</label><button class="btn ghost" id="gRot">${V.auto ? "Pausar giro" : "Girar"}</button></div>
      <div class="gwrap"><canvas id="gCv"></canvas><div class="glabels" id="gLab"></div>
        <div class="glegend">${Object.entries(LEVEL).map(([l, [t, c]]) => `<label><input type="checkbox" data-lv="${l}" ${V.lv[l] ? "checked" : ""}><i style="background:#${c.toString(16).padStart(6, "0")}" class="${l === "4" ? "dash" : ""}"></i>${l} · ${esc(t)} <small>(${cnt(+l)})</small></label>`).join("")}</div></div>
      <div class="gtypes">${Object.entries({ focus: "foco", tissue: "tecido/receptor", nerve: "nervo", aff: "fibra aferente", eff: "fibra eferente", seg: "segmento", path: "via", cns: "centro", organ: "órgão", system: "sistema", point: "ponto", muscle: "músculo" }).map(([k, t]) => `<span><i class="gdot t-${k}"></i>${t}</span>`).join("")}</div>
      <div class="card gdet" id="gDet"><p class="note">Clique num nó para abrir a ficha: descrição, calibre previsto (fibras), correlações por nível e literatura. Arraste para girar, role para aproximar. ${tag("pre")} Posições esquemáticas, não anatômicas.</p></div>`;
    const cv = $("#gCv", b), lab = $("#gLab", b); V.r && V.r.dispose && (V.r.dispose(), V.r = null);
    draw3D(cv, lab);
    $("#gF", b).onchange = e => { V.focus = resolveFocus(e.target.value); graphWin(b); };
    $("#gFol", b).onchange = e => { V.follow = e.target.checked; };
    $("#gRot", b).onclick = e => { V.auto = !V.auto; e.target.textContent = V.auto ? "Pausar giro" : "Girar"; };
    $$("[data-lv]", b).forEach(c => c.onchange = () => { V.lv[c.dataset.lv] = c.checked; applyFilter(); if (V.sel) detail(V.sel, $("#gDet", b)); });
    let drag = null; const ray = new g.THREE.Raycaster(), mv = new g.THREE.Vector2();
    cv.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, m: 0 }; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.m += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY; V.rot.th -= dx * .008; V.rot.ph = Math.max(.25, Math.min(2.9, V.rot.ph - dy * .008)); if (drag.m > 4) V.auto = false; };
    cv.onpointerup = e => { const m = drag ? drag.m : 99; drag = null; if (m > 4) return; const r = cv.getBoundingClientRect(); mv.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(mv, V.cam);
      const hit = ray.intersectObjects(V.graph.nodes.filter(n => n.mesh.visible).map(n => n.mesh))[0]; if (hit) select(hit.object.userData.n, $("#gDet", b)); else { V.sel = null; applyFilter(); } };
    cv.ondblclick = () => { if (V.sel) showInBody(V.sel); };
    cv.onwheel = e => { e.preventDefault(); V.rot.d = Math.max(5, Math.min(24, V.rot.d * (1 + Math.sign(e.deltaY) * .08))); };
    lab.onclick = e => { const el = e.target.closest(".gl-l"); if (el) select(V.graph.nodes[+el.dataset.i], $("#gDet", b)); };
  }
  function boot() { const A = g.AxonApp; if (!A || !A.registerApp || !g.AxonStage || !g.THREE) return setTimeout(boot, 80);
    A.registerApp("graph", { title: "graph", w: 760, h: 780, render: graphWin, onClose: () => { cancelAnimationFrame(V.raf); if (V.r) { V.r.dispose(); V.r = null; } } });
    const refocus = f => { if (!V.follow || !f || !A.isOpen("graph")) return; V.focus = f; graphWin(A.body("graph")); };
    document.addEventListener("axon:reflex", e => { const d = e.detail && e.detail.point; if (d && d.id) { const rp = g.AxonStage.reflexPoints().find(p => p.id === d.id); if (rp) refocus({ kind: "point", rp, key: "p:" + rp.id }); } });
    document.addEventListener("axon:structure", e => { const d = e.detail; if (d && d.layer === "muscles" && (d.en || d.name)) refocus({ kind: "muscle", name: d.en || d.name, key: "m:" + (d.en || d.name) }); });
  }
  boot();
  g.AxonGraph = { build, LEVEL, LAY, V, select: k => { const n = V.graph && V.graph.nodes.find(x => x.key === k); if (n) select(n); return n; } };
})(window);
