/* axon · relations.js — modo músculo ↔ nervo (inervação, raízes, miótomo, músculos e pontos indiretamente
   relacionados) e mapa do sistema nervoso central e autônomo com fibras aferentes e eferentes por região, ligado ao caso.
   Inervação: Standring (Gray's Anatomy, 42ª ed.) e Kendall (Muscles: Testing and Function) [LITERATURA];
   o trajeto 3D dos nervos é a premissa didática do simulador [PREMISSA]. */
(function (g) {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tag = (k, t) => g.AxonApp ? g.AxonApp.tagHTML(k, t) : "";
  const REFS = { gray: "Standring S (ed.). Gray's Anatomy: The Anatomical Basis of Clinical Practice. 42nd ed. Elsevier; 2020.", kendall: "Kendall FP, McCreary EK, Provance PG, et al. Muscles: Testing and Function with Posture and Pain. 5th ed. Lippincott Williams & Wilkins; 2005.",
    janig: "Jänig W. The Integrative Action of the Autonomic Nervous System. Cambridge University Press; 2006.", basbaum: "Basbaum AI, Fields HL. Endogenous pain control systems: brainstem spinal pathways and endorphin circuitry. Annu Rev Neurosci. 1984;7:309-38.",
    head: "Head H. On disturbances of sensation with especial reference to the pain of visceral disease. Brain. 1893;16:1-133.", travell: "Simons DG, Travell JG, Simons LS. Myofascial Pain and Dysfunction: The Trigger Point Manual. 2nd ed. Williams & Wilkins; 1999." };

  // regex do nome FMA → [nervo, nervo modelado (sem lado), raízes]
  const INN = [
    [/tibialis anterior|extensor digitorum longus|extensor hallucis longus|fibularis tertius|extensor digitorum brevis|extensor hallucis brevis/, "fibular profundo", "Nervo fibular comum", "L4–L5"],
    [/fibularis longus|fibularis brevis/, "fibular superficial", "Nervo fibular comum", "L5–S1"],
    [/gastrocnemius|soleus|plantaris|calcaneal tendon/, "tibial", "Nervo tibial", "S1–S2"],
    [/popliteus|tibialis posterior|flexor digitorum longus|flexor hallucis longus/, "tibial", "Nervo tibial", "L5–S1"],
    [/flexor digitorum brevis|flexor accessorius|abductor hallucis/, "plantar medial/lateral (tibial)", "Nervo tibial", "S1–S2"],
    [/semitendinosus|semimembranosus|long head of .*biceps femoris|biceps femoris/, "isquiático (divisão tibial)", "Nervo ciático", "L5–S2"],
    [/rectus femoris|vastus|sartorius|iliacus/, "femoral", "Nervo femoral", "L2–L4"],
    [/pectineus/, "femoral (e obturatório)", "Nervo femoral", "L2–L3"],
    [/gracilis|adductor (longus|brevis|magnus)|obturator externus/, "obturatório", "Plexo lombar", "L2–L4"],
    [/psoas/, "ramos ventrais L1–L3", "Plexo lombar", "L1–L3"],
    [/quadratus lumborum/, "ramos ventrais T12–L4", "Plexo lombar", "T12–L3"],
    [/gluteus maximus/, "glúteo inferior", "Plexo sacral", "L5–S2"],
    [/gluteus medius|gluteus minimus|tensor fasciae latae/, "glúteo superior", "Plexo sacral", "L4–S1"],
    [/piriformis|gemellus|obturator internus|quadratus femoris/, "ramos do plexo sacral", "Plexo sacral", "L4–S2"],
    [/pubococcygeus|puborectalis|iliococcygeus|coccygeus/, "nervo do levantador do ânus / pudendo", "Plexo sacral", "S3–S4"],
    [/deltoid|teres minor/, "axilar", "Plexo braquial", "C5–C6"],
    [/supraspinatus|infraspinatus/, "supraescapular", "Plexo braquial", "C5–C6"],
    [/subscapularis|teres major/, "subescapulares", "Plexo braquial", "C5–C7"],
    [/latissimus dorsi/, "toracodorsal", "Plexo braquial", "C6–C8"],
    [/pectoralis major/, "peitorais lateral e medial", "Plexo braquial", "C5–T1"],
    [/pectoralis minor/, "peitoral medial", "Plexo braquial", "C8–T1"],
    [/serratus anterior/, "torácico longo", "Plexo braquial", "C5–C7"],
    [/rhomboid|levator scapulae/, "dorsal da escápula", "Plexo braquial", "C4–C5"],
    [/scalenus/, "ramos ventrais cervicais", "Plexo braquial", "C3–C8"],
    [/biceps brachii|brachialis|coracobrachialis/, "musculocutâneo", "Nervo musculocutâneo", "C5–C7"],
    [/triceps|anconeus|brachioradialis|extensor carpi|supinator|extensor digitorum$|extensor digitorum(?! (longus|brevis))|extensor digiti minimi|extensor pollicis|abductor pollicis longus|extensor indicis/, "radial", "Nervo radial", "C6–C8"],
    [/pronator|flexor carpi radialis|palmaris longus|flexor digitorum superficialis|flexor pollicis longus|opponens pollicis|abductor pollicis brevis|flexor digitorum profundus/, "mediano", "Nervo mediano", "C6–T1"],
    [/flexor carpi ulnaris|adductor pollicis|interosse|hypothenar|abductor digiti minimi|opponens digiti/, "ulnar", "Nervo ulnar", "C8–T1"],
    [/trapezius|sternocleidomastoid/, "acessório (XI) e ramos C2–C4", null, "C3–C4"],
    [/frontalis|occipitalis|temporoparietalis|corrugator|levator labii|zygomaticus|depressor|levator anguli|mentalis|buccinator|risorius|orbicularis|nasalis|procerus|platysma/, "facial (VII)", "Nervo facial", "VII"],
    [/temporalis|masseter|pterygoid/, "mandibular (V3)", "Trigêmeo V3", "V3"],
    [/rectus abdominis|external oblique|internal oblique|transversus abdominis|pyramidalis/, "toracoabdominais T7–T12", "Nervo intercostal T10", "T7–L1"],
    [/iliocostalis lumborum|lumbar rotator|multifidus/, "ramos dorsais lombares", "Raiz L4", "L1–L5"],
    [/iliocostalis thoracis|longissimus thoracis|spinalis thoracis|semispinalis thoracis/, "ramos dorsais torácicos", "Raiz T8", "T1–T12"],
    [/cervicis|capitis/, "ramos dorsais cervicais", "Raiz C4", "C1–C6"],
    [/intercostal/, "intercostais", "Nervo intercostal T6", "T1–T11"],
  ];
  const SEGS = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12", "L1", "L2", "L3", "L4", "L5", "S1", "S2", "S3", "S4", "S5"];
  const segIx = s => SEGS.indexOf(s), range = r => { const m = (r || "").match(/([CTLS]\d+)(?:–([CTLS]\d+))?/); return m ? [segIx(m[1]), segIx(m[2] || m[1])] : null; };
  const overlap = (a, b) => a && b && a[0] <= b[1] && b[0] <= a[1];
  function innervation(name) {
    const n = name.toLowerCase(); for (const [re, nerve, model, roots] of INN) if (re.test(n)) {
      const side = /\bright\b/.test(n) ? "right" : /\bleft\b/.test(n) ? "left" : null;
      const modeled = !model ? null : /^Raiz /.test(model) ? `${model} ${side === "left" ? "E" : "D"}` : `${model}${model === "Nervo intercostal T10" || model === "Nervo intercostal T6" ? " " + (side || "right") : side ? " " + side : " right"}`;
      return { nerve, modeled, roots, side };
    }
    return null;
  }

  // ------------------------------------------------------------ modo relação
  const REL = { on: false, last: null };
  function relate(struct) {
    const S = g.AxonStage, ex = S.ext(), mus = ex.S.meshByLayer && ex.S.meshByLayer.muscles; if (!struct) return null;
    const inn = innervation(struct.en || struct.name); if (!inn) return { struct, inn: null };
    const rg = range(inn.roots), parts = [{ layer: "muscles", name: struct.en || struct.name, color: "#ff7a2f" }];
    const sibs = [];
    if (mus && rg) mus.userData.parts.forEach(p => { if (p.name === (struct.en || struct.name)) return; const i2 = innervation(p.name); if (!i2 || i2.side !== inn.side) return; const r2 = range(i2.roots);
      if (r2 && overlap(rg, r2) && i2.nerve === inn.nerve) sibs.push({ layer: "muscles", name: p.name, color: "#ffd34d", link: false, pt: p.pt || p.name, via: "mesmo nervo" });
      else if (r2 && overlap(rg, r2) && sibs.length < 40 && Math.abs(r2[0] - rg[0]) <= 1) sibs.push({ layer: "muscles", name: p.name, color: "#f5e6a8", link: false, pt: p.pt || p.name, via: "mesmo segmento" }); });
    const pts = (S.reflexPoints() || []).filter(p => { const r2 = range(p.seg || p.derm); return r2 && rg && overlap(rg, r2); });
    const from = struct.point || null, segTxt = /^[CTLS]/.test(inn.roots) ? inn.roots : null;
    const out = S.highlight({ parts: [...parts, ...sibs.slice(0, 24)], nerves: inn.modeled ? [inn.modeled] : [], seg: segTxt, points: pts.map(p => p.id), from });
    REL.last = { struct, inn, sibs, pts, out }; return REL.last;
  }
  function relWin(b) {
    const L = REL.last;
    b.innerHTML = `<div class="card"><label class="rowc"><input type="checkbox" id="relOn" ${REL.on ? "checked" : ""}> <b>Modo relação</b>: clicar num músculo mostra o nervo, as raízes e o que mais depende delas</label>
      <p class="note">Ative a profundidade "Músculos" em <b>Camadas</b> ou clique num músculo visível. Laranja: músculo escolhido · ciano: nervo · amarelo: mesmo nervo · creme: mesmo segmento · dourado na pele: faixa segmentar · halos: pontos reflexos do segmento.</p></div>
      ${L ? (L.inn ? `<div class="card"><h4>${esc(L.struct.name)}</h4><div class="kv2"><b>Nervo</b><span>${esc(L.inn.nerve)}</span></div><div class="kv2"><b>Raízes</b><span>${esc(L.inn.roots)}</span></div>
        <div class="kv2"><b>Modelado no 3D</b><span>${esc(L.inn.modeled || "não modelado")}</span></div>${tag("lit", "gray")}</div>
        <div class="card"><h4>Indiretamente relacionados (${L.sibs.length})</h4><p class="note">Um problema no nervo ou nas raízes (compressão, neuropatia, sensibilização segmentar) pode alterar força, tônus e dor nestes músculos e pontos.</p>
        <ul class="tight">${L.sibs.slice(0, 18).map(s => `<li><span class="sw" style="--c:${s.color}"></span>${esc(s.pt)} <em class="note">${s.via}</em></li>`).join("")}</ul>
        <h4>Pontos reflexos no segmento</h4><div class="ptlist">${L.pts.map(p => `<button class="ptb" data-go="${p.id}"><b>${esc(p.id)}</b><span>${esc(p.seg || p.derm)}</span></button>`).join("") || `<p class="note">Nenhum ponto mapeado nesse segmento.</p>`}</div></div>`
        : `<div class="card"><h4>${esc(L.struct.name)}</h4><p class="note">Sem inervação cadastrada para esta estrutura (ainda). A tabela cobre os principais músculos de tronco e membros.</p></div>`) : `<div class="card"><p class="note">Nenhum músculo escolhido ainda.</p></div>`}
      <p class="note">Fontes: ${esc(REFS.gray)} · ${esc(REFS.kendall)}</p>`;
    $("#relOn", b).onchange = e => { REL.on = e.target.checked; if (REL.on) { g.AxonDissect && g.AxonDissect.setDepth(2); g.AxonApp.botSay("Modo relação ligado: clique num músculo."); } };
    $$("[data-go]", b).forEach(x => x.onclick = () => g.AxonStage.selectReflex(x.dataset.go, true));
  }
  document.addEventListener("axon:structure", e => { const d = e.detail; if (!REL.on || !d || d.layer !== "muscles") return; relate(d); const A = g.AxonApp; if (!A.isOpen("relations")) A.openApp("relations"); else relWin(A.body("relations")); });

  // ------------------------------------------------------------ SNC e sistema autônomo
  const ORG = [
    { id: "heart", n: "Coração", fma: "wall of heart", sym: "T1–T4", par: "vago (X)", aff: "T1–T4 → precórdio e braço esquerdo", y: 150 },
    { id: "lung", n: "Pulmões", fma: "lung", sym: "T2–T5", par: "vago (X)", aff: "T2–T5", y: 175 },
    { id: "stomach", n: "Estômago", fma: "stomach", sym: "T6–T9", par: "vago (X)", aff: "T6–T9 → epigástrio", y: 205 },
    { id: "liver", n: "Fígado e vesícula", fma: "gallbladder", sym: "T7–T9", par: "vago (X)", aff: "T7–T9 → hipocôndrio e escápula direitos", y: 230 },
    { id: "gut", n: "Intestino delgado", fma: null, sym: "T9–T11", par: "vago (X)", aff: "T9–T11 → periumbilical", y: 255 },
    { id: "kidney", n: "Rins e ureteres", fma: "kidney", sym: "T10–L1", par: "vago (X)", aff: "T10–L1 → flanco e virilha", y: 280 },
    { id: "colon", n: "Cólon distal e reto", fma: null, sym: "L1–L2", par: "pélvicos S2–S4", aff: "S2–S4", y: 305 },
    { id: "bladder", n: "Bexiga", fma: "urinary bladder", sym: "T11–L2", par: "pélvicos S2–S4", aff: "T11–L2 e S2–S4 → suprapúbica", y: 330 },
  ];
  let cnsSel = null;
  function cnsSVG(caseSegs) {
    const segY = i => 120 + i * 9.4, x0 = 150;
    const inCase = s => caseSegs.includes(s);
    let h = `<svg viewBox="0 0 460 440" class="map cns" role="img" aria-label="Sistema nervoso central e autônomo">
      <ellipse cx="150" cy="52" rx="74" ry="46" fill="#f4d9e4" stroke="#c48aa3" stroke-width="2"/><text x="96" y="40" class="zl">córtex (S1, ínsula, cíngulo)</text>
      <ellipse cx="150" cy="70" rx="18" ry="10" fill="#e9b7cb"/><text x="172" y="74" class="zl">tálamo</text>
      <rect x="138" y="86" width="24" height="12" rx="5" fill="#d9a0b9"/><text x="166" y="95" class="zl">mesencéfalo · PAG</text>
      <rect x="136" y="98" width="28" height="10" rx="5" fill="#cf93ad"/><text x="168" y="106" class="zl">ponte · locus coeruleus</text>
      <rect x="138" y="108" width="24" height="10" rx="5" fill="#c4869f"/><text x="56" y="116" class="zl">bulbo · NTS · RVM</text>
      <rect x="${x0 - 6}" y="118" width="12" height="${SEGS.length * 9.4 + 4}" rx="6" fill="#ffe7a3" stroke="#d4a72c"/>`;
    SEGS.forEach((s, i) => { const y = segY(i), on = inCase(s), sym = i >= 8 && i <= 21, par = i >= 26 && i <= 28;
      h += `<g class="seg ${on ? "on" : ""}" data-s="${s}" tabindex="0" role="button" aria-label="segmento ${s}"><rect x="${x0 - 30}" y="${y - 4}" width="60" height="8.4" fill="transparent"/>
        <path d="M${x0 - 6} ${y}h-22" stroke="${on ? "#1f8fd6" : "#7cc8f5"}" stroke-width="${on ? 3 : 1.6}"/><path d="M${x0 + 6} ${y}h22" stroke="${on ? "#e0485a" : "#f3a1aa"}" stroke-width="${on ? 3 : 1.6}"/>
        <text x="${x0 - 52}" y="${y + 3}" class="zl ${on ? "b" : ""}">${s}</text>${sym ? `<circle cx="${x0 + 36}" cy="${y}" r="3.2" fill="#f0703c"/>` : ""}${par ? `<circle cx="${x0 + 36}" cy="${y}" r="3.2" fill="#8a6cf0"/>` : ""}</g>`; });
    h += `<path d="M${x0 + 36} ${segY(8)}V${segY(21)}" stroke="#f0703c" stroke-width="2"/><text x="${x0 + 42}" y="${segY(8) - 6}" class="zl">cadeia simpática T1–L2</text>
      <path d="M162 112C230 112 250 140 300 150" stroke="#8a6cf0" stroke-width="2.5" fill="none"/><text x="200" y="124" class="zl">vago (X)</text>`;
    ORG.forEach(o => { const r = range(o.sym), y1 = segY(r[0]), y2 = segY(r[1]), on = cnsSel === o.id || r && caseSegs.some(s => segIx(s) >= r[0] && segIx(s) <= r[1]);
      h += `<g class="org ${on ? "on" : ""}" data-o="${o.id}" tabindex="0" role="button" aria-label="${esc(o.n)}"><path d="M${x0 + 39} ${(y1 + y2) / 2}C${x0 + 120} ${(y1 + y2) / 2} 260 ${o.y} 300 ${o.y}" stroke="#f0703c" stroke-width="${on ? 2.4 : 1.2}" fill="none" opacity="${on ? 1 : .55}"/>
        ${/vago/.test(o.par) ? `<path d="M300 150C310 ${o.y - 20} 300 ${o.y} 304 ${o.y}" stroke="#8a6cf0" stroke-width="${on ? 2 : 1}" fill="none" opacity=".7"/>` : `<path d="M${x0 + 39} ${segY(27)}C250 ${segY(27)} 280 ${o.y} 300 ${o.y}" stroke="#8a6cf0" stroke-width="${on ? 2 : 1}" fill="none" opacity=".7"/>`}
        <rect x="300" y="${o.y - 9}" width="150" height="18" rx="9" fill="${on ? "#fff1d1" : "#fff"}" stroke="${on ? "#f2b632" : "#d6e8e3"}"/><text x="310" y="${o.y + 4}" class="zl">${esc(o.n)}</text></g>`; });
    h += `<g class="lg"><text x="8" y="430" class="zl"><tspan fill="#1f8fd6">━ aferente (raiz dorsal)</tspan>  <tspan fill="#e0485a">━ eferente (raiz ventral)</tspan>  <tspan fill="#f0703c">● simpático</tspan>  <tspan fill="#8a6cf0">● parassimpático</tspan></text></g></svg>`;
    return h;
  }
  function cnsWin(b) {
    const cs = g.AxonSim && g.AxonSim.case, segs = cs ? cs.pain.dermatomes.filter(d => /^[CTLS]/.test(d)) : [];
    const o = ORG.find(x => x.id === cnsSel);
    b.innerHTML = `<p class="note">${cs ? `Caso: <b>${esc(cs.title)}</b> — segmentos ${segs.join(", ") || "craniais"} destacados.` : "Sem caso ativo."} Clique num segmento ou num órgão para destacar no corpo 3D.</p>
      <div class="mapwrap">${cnsSVG(segs)}</div>
      <div class="card">${o ? `<h4>${esc(o.n)}</h4><div class="kv2"><b>Simpático</b><span>${esc(o.sym)}</span></div><div class="kv2"><b>Parassimpático</b><span>${esc(o.par)}</span></div><div class="kv2"><b>Aferência visceral e dor referida</b><span>${esc(o.aff)}</span></div>${tag("lit", "head")}`
        : `<h4>Vias da dor e da modulação</h4><ul class="tight"><li><b>Ascendente:</b> nociceptor (Aδ, C) → corno dorsal (lâminas I, II, V) → trato espinotalâmico → tálamo → córtex.</li><li><b>Portão segmentar:</b> Aβ ativa interneurônios inibitórios no mesmo segmento (TENS convencional).</li><li><b>Descendente:</b> PAG → RVM e locus coeruleus → corno dorsal (serotonina, noradrenalina, opioides) ${tag("lit", "basbaum")}</li><li><b>Vagal:</b> ABVN → NTS → LC e rafe; via anti-inflamatória colinérgica (hipótese em investigação) ${tag("hip")}</li></ul>`}</div>
      <p class="note">Fontes: ${esc(REFS.gray)} · ${esc(REFS.janig)} · ${esc(REFS.head)}</p>`;
    $$(".seg", b).forEach(x => { const go = () => { g.AxonStage.highlight({ seg: x.dataset.s, reveal: false }); g.AxonApp.botSay(`Segmento ${x.dataset.s}: faixa da pele destacada no corpo.`); }; x.onclick = go; x.onkeydown = e => (e.key === "Enter" || e.key === " ") && go(); });
    $$(".org", b).forEach(x => { const go = () => { cnsSel = x.dataset.o; const oo = ORG.find(y => y.id === cnsSel); cnsWin(b);
      g.AxonStage.highlight({ parts: oo.fma ? [{ layer: "organs", name: oo.fma, color: "#c06bff" }, { layer: "organs", name: "right " + oo.fma, color: "#c06bff" }] : [], seg: oo.sym, nerves: ["Tronco simpático right", "Tronco simpático left"], nerveColor: "#f0703c" }); };
      x.onclick = go; x.onkeydown = e => (e.key === "Enter" || e.key === " ") && go(); });
  }
  function boot() { const A = g.AxonApp; if (!A || !A.registerApp) return setTimeout(boot, 80);
    A.registerApp("relations", { title: "relations", w: 400, h: 600, render: relWin }); A.registerApp("cns", { title: "cns", w: 520, h: 720, render: cnsWin });
    document.addEventListener("axon:case", () => A.isOpen("cns") && cnsWin(A.body("cns"))); }
  boot();
  g.AxonRelations = { innervation, relate, INN, ORG, REL, REFS };
})(window);
