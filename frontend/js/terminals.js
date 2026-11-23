/* axon · terminals.js — detalhamento das terminações nervosas por grupo da topologia anatômica (v0.11)
 * Para cada músculo do grupo escolhido: ponto motor (entrada do nervo), ramificação intramuscular, placas motoras na zona
 * de inervação (faixa no meio do ventre), fusos neuromusculares (Ia, II, inervação γ), órgãos tendinosos de Golgi (Ib)
 * e terminações livres (III/IV). Para a pele: receptores por dermátomo. Geometria didática sobre a malha [PREMISSA];
 * localização da zona de inervação e números de unidades motoras [LITERATURA]. */
(function (g) {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (x, d = 0) => x == null || !isFinite(x) ? "—" : (+x).toFixed(d).replace(".", ",");
  const TG = { lit: ["LITERATURA", "t-lit"], pre: ["PREMISSA", "t-pre"], der: ["DERIVADO", "t-der"], hip: ["HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO", "t-hip"] };
  const tag = k => `<span class="tag ${TG[k][1]}">${TG[k][0]}</span>`;
  const ST = () => g.AxonStage;
  // topologia: região → grupo → músculos (regex sobre o nome FMA; {s} = lado)
  const TOPO = [
    ["Ombro e cintura escapular", [["Deltoide", "part of {s} deltoid"], ["Manguito rotador", "{s} (supraspinatus|infraspinatus|teres minor|subscapularis)"], ["Trapézio e romboides", "({s} rhomboid|part of {s} trapezius|{s} levator scapulae)"]]],
    ["Braço", [["Compartimento anterior (flexores)", "({s} biceps brachii|{s} brachialis|{s} coracobrachialis)"], ["Compartimento posterior (tríceps)", "({s} triceps brachii|{s} anconeus)"]]],
    ["Antebraço", [["Flexores (anterior)", "({s} flexor carpi|{s} palmaris longus|{s} flexor digitorum|{s} flexor pollicis longus|{s} pronator)"], ["Extensores (posterior)", "({s} extensor (carpi|digitorum|digiti|pollicis|indicis)|{s} supinator|{s} brachioradialis)"]]],
    ["Mão", [["Tenar", "({s} opponens pollicis|{s} flexor pollicis brevis|{s} abductor pollicis brevis)"], ["Hipotenar e interósseos", "(digiti minimi of {s} hand|interossei of {s} hand|lumbricals of {s} hand)"]]],
    ["Quadril e glúteo", [["Glúteos", "{s} gluteus"], ["Rotadores profundos", "({s} piriformis|{s} gemellus|{s} obturator|{s} quadratus femoris)"], ["Iliopsoas", "({s} psoas major|{s} iliacus)"]]],
    ["Coxa", [["Quadríceps (anterior)", "({s} rectus femoris|{s} vastus)"], ["Adutores (medial)", "({s} adductor|{s} gracilis|{s} pectineus)"], ["Isquiotibiais (posterior)", "({s} biceps femoris|{s} semitendinosus|{s} semimembranosus)"]]],
    ["Perna", [["Anterior (dorsiflexores)", "({s} tibialis anterior|{s} extensor hallucis longus|{s} extensor digitorum longus|{s} fibularis tertius)"], ["Lateral (fibulares)", "{s} fibularis (longus|brevis)"], ["Posterior (tríceps sural)", "({s} gastrocnemius|{s} soleus|{s} plantaris)"], ["Posterior profundo", "({s} tibialis posterior|{s} flexor digitorum longus|{s} flexor hallucis longus|{s} popliteus)"]]],
    ["Tronco", [["Paravertebrais", "({s} iliocostalis|{s} longissimus|{s} multifidus|{s} spinalis|{s} semispinalis)"], ["Parede abdominal", "({s} rectus abdominis|{s} external oblique|{s} internal oblique|{s} transversus abdominis)"], ["Peitoral e serrátil", "(part of {s} pectoralis major|{s} pectoralis minor|{s} serratus anterior)"]]],
    ["Cabeça e pescoço", [["Mastigação", "(part of {s} masseter|{s} temporalis|{s} pterygoid)"], ["Mímica facial", "({s} frontalis|{s} orbicularis oculi|{s} zygomaticus|{s} buccinator|{s} risorius|{s} mentalis|{s} levator labii)"], ["Pescoço", "({s} sternocleidomastoid|{s} scalenus|{s} splenius)"]]],
  ];
  // unidades motoras e razão de inervação [LITERATURA: Feinstein et al. 1955, Acta Anat 23:127-42]
  const MU = { "first dorsal interosseous": [119, 340], "tibialis anterior": [445, 657], "medial head of right gastrocnemius": [579, 1934], "medial head of left gastrocnemius": [579, 1934], "first lumbrical": [96, 108], platysma: [1096, 25] };
  const REF = {
    feinstein: "Feinstein B, Lindegård B, Nyman E, Wohlfart G. Morphologic studies of motor units in normal human muscles. Acta Anat. 1955;23:127-42.",
    iz: "Jahanmiri-Nezhad F, et al. Front Hum Neurosci. 2015;9:239 (zona de inervação no meio do ventre); localização por marcos de superfície (PubMed 16785107).",
    banks: "Banks RW. The muscle spindle. In: Engel AG, Franzini-Armstrong C, eds. Myology. 3rd ed. New York: McGraw-Hill; 2004 (fuso: Ia, II, γ).",
    jami: "Jami L. Golgi tendon organs in mammalian skeletal muscle: functional properties and central actions. Physiol Rev. 1992;72:623-66.",
    mense: "Mense S. Group III and IV receptors in skeletal muscle: are they specific or polymodal? Prog Brain Res. 1996;113:83-100.",
    jv79: "Johansson RS, Vallbo ÅB. Tactile sensibility in the human hand: relative and absolute densities of four types of mechanoreceptive units in glabrous skin. J Physiol. 1979;286:283-300.",
    abraira: "Abraira VE, Ginty DD. The sensory neurons of touch. Neuron. 2013;79:618-39.",
  };
  const T = { grp: null, sel: null, side: "right", list: [], skin: null };

  function pca(P) {
    const c = new (ST().ext().T.Vector3)(); P.forEach(p => c.add(p)); c.multiplyScalar(1 / P.length);
    let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0; P.forEach(p => { const x = p.x - c.x, y = p.y - c.y, z = p.z - c.z; xx += x * x; xy += x * y; xz += x * z; yy += y * y; yz += y * z; zz += z * z; });
    let v = [1, 1, 1]; for (let i = 0; i < 30; i++) { const w = [xx * v[0] + xy * v[1] + xz * v[2], xy * v[0] + yy * v[1] + yz * v[2], xz * v[0] + yz * v[1] + zz * v[2]]; const n = Math.hypot(...w) || 1; v = w.map(a => a / n); }
    const ax = new (ST().ext().T.Vector3)(...v); let t0 = 1e9, t1 = -1e9; P.forEach(p => { const t = p.clone().sub(c).dot(ax); if (t < t0) t0 = t; if (t > t1) t1 = t; });
    return { c, ax, t0, t1, L: t1 - t0 };
  }
  function partVerts(mesh, p) { const V3 = ST().ext().T.Vector3, pa = mesh.geometry.attributes.position, v0 = p.v0 ?? p.vo, out = []; for (let j = v0; j < v0 + p.nv; j++) out.push(new V3(pa.getX(j), pa.getY(j), pa.getZ(j))); return out; }
  function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  let G3 = null;
  function clear3D() { const E = ST().ext(); if (G3) { E.S.groups.L1.remove(G3); G3.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } G3 = null; }
  function build(groupLabel, re) {
    const E = ST().ext(), Tt = E.T, V3 = Tt.Vector3, mesh = E.S.meshByLayer.muscles; if (!mesh) return [];
    clear3D(); G3 = new Tt.Group(); G3.name = "terminals"; E.S.groups.L1.add(G3);
    const rx = new RegExp(re.replace(/\{s\}/g, T.side), "i"), parts = mesh.userData.parts.filter(p => rx.test(p.name)).slice(0, 14);
    const mat = (c, o = 1) => { const m = E.glow(E.lin(c), o); m.depthTest = false; return m; };
    const out = [];
    parts.forEach((p, pi) => {
      const P = partVerts(mesh, p); if (P.length < 30) return; const R = rng(42 + pi), F = pca(P);
      const inn = g.AxonRelations ? g.AxonRelations.innervation(p.name) : null, nerve = inn && E.S.anat.nerves.find(n => n.name === inn.modeled);
      // ponto motor: vértice do músculo mais próximo do trajeto do nervo
      let entry = F.c.clone(), nPt = null; if (nerve) { let bd = 1e9; P.forEach(q => nerve.p.forEach(np => { const d = (q.x - np[0]) ** 2 + (q.y - np[1]) ** 2 + (q.z - np[2]) ** 2; if (d < bd) { bd = d; entry = q.clone(); nPt = new V3(...np); } })); }
      // placas motoras na faixa central (t = 0,5 ± 0,05) puxadas 35 % para dentro
      const band = P.filter(q => { const t = (q.clone().sub(F.c).dot(F.ax) - F.t0) / F.L; return Math.abs(t - .5) < .05; });
      const K = Math.min(10, Math.max(4, Math.round(band.length / 12))), plates = [];
      for (let i = 0; i < K && band.length; i++) plates.push(band[Math.floor(R() * band.length)].clone().lerp(F.c, .35));
      const tube = (pts, r, col, o) => { const m = new Tt.Mesh(new Tt.TubeGeometry(new Tt.CatmullRomCurve3(pts), 16, r, 5, false), mat(col, o)); m.renderOrder = 34; G3.add(m); return m; };
      const dot = (p0, r, col, geo) => { const m = new Tt.Mesh(geo || new Tt.SphereGeometry(r, 10, 8), mat(col)); m.position.copy(p0); m.renderOrder = 35; G3.add(m); return m; };
      if (nPt) tube([nPt, lerp(nPt, entry, .5).add(F.ax.clone().multiplyScalar(.004)), entry], .0012, 0xd36cff, .95);
      plates.forEach(pl => { const midp = entry.clone().lerp(pl, .5).add(new V3((R() - .5) * .01, (R() - .5) * .01, (R() - .5) * .01)); tube([entry, midp, pl], .0006, 0xd36cff, .85);
        const disc = new Tt.Mesh(new Tt.TorusGeometry(.0024, .0008, 6, 14), mat(0xffd166)); disc.position.copy(pl); disc.lookAt(pl.clone().add(F.ax)); disc.renderOrder = 36; G3.add(disc); });
      // fusos (t 0,3–0,7) com γ e Ia/II; órgãos tendinosos nas junções (t 0,08 e 0,92)
      const at = t => { const target = F.t0 + t * F.L; let b = P[0], bd = 1e9; P.forEach(q => { const d = Math.abs(q.clone().sub(F.c).dot(F.ax) - target) + q.distanceTo(F.c) * .2; if (d < bd) { bd = d; b = q; } }); return b.clone().lerp(F.c, .45); };
      const spindles = [.32, .44, .58, .68].map(t => at(t + (R() - .5) * .04));
      spindles.forEach(sp => { const e = new Tt.Mesh(new Tt.SphereGeometry(.0028, 10, 8), mat(0x3ee6c5)); e.scale.set(1, 3.2, 1); e.position.copy(sp); e.quaternion.setFromUnitVectors(new V3(0, 1, 0), F.ax); e.renderOrder = 35; G3.add(e);
        tube([sp, sp.clone().lerp(entry, .5), entry], .0005, 0x4fb3ff, .9); });
      const gto = [.07, .93].map(at); gto.forEach(q => { dot(q, .0026, 0xffb36b); tube([q, q.clone().lerp(entry, .5), entry], .0005, 0x4fb3ff, .7); });
      for (let i = 0; i < 6; i++) dot(P[Math.floor(R() * P.length)].clone().lerp(F.c, .2), .0011, 0xff5d73);
      const mu = Object.entries(MU).find(([k]) => p.name.includes(k));
      const morph = g.AxonMorpho ? g.AxonMorpho.predict(null, inn ? inn.modeled || inn.nerve : "Ramo muscular") : null, aa = morph && morph.classes.find(c => c.cls === "Aα");
      out.push({ name: p.name, pt: p.pt || p.name, nerve: inn ? inn.nerve : "—", roots: inn ? inn.roots : "—", L: F.L * (E.S.anat.mm_per_unit || 450), plates: K, spindles: spindles.length, entryToIZ: entry.distanceTo(plates[0] || entry) * (E.S.anat.mm_per_unit || 450),
        mu: mu ? mu[1] : null, aa, entry: entry.toArray() });
    });
    ST().highlight({ parts: out.map(o => ({ layer: "muscles", name: o.name, color: 0xff8a3d, link: false })), nerves: [...new Set(out.map(o => (g.AxonRelations.innervation(o.name) || {}).modeled).filter(Boolean))], reveal: true });
    if (out[0]) E.focusOn(out[0].entry, null, .45);
    T.list = out; return out;
  }
  const lerp = (a, b, t) => a.clone().lerp(b, t);
  // pele: receptores amostrados no dermátomo
  function buildSkin(code) {
    const E = ST().ext(), Tt = E.T, V3 = Tt.Vector3, sk = E.S.meshByLayer.skin, pa = sk.geometry.attributes.position, da = sk.geometry.attributes.derm, k = E.DERM.indexOf(code); if (k < 0) return null;
    clear3D(); G3 = new Tt.Group(); G3.name = "terminals"; E.S.groups.L1.add(G3);
    const idx = []; for (let i = 0; i < pa.count; i += 2) if (Math.round(da.getX(i)) === k) idx.push(i);
    const R = rng(7), kinds = [["Meissner (Aβ, adaptação rápida I)", 0x7fe3ff], ["Merkel (Aβ, adaptação lenta I)", 0x4fb3ff], ["Ruffini (Aβ, adaptação lenta II)", 0x9be37a], ["Pacini (Aβ, adaptação rápida II)", 0xc99bff], ["Terminações livres (Aδ, C)", 0xff5d73]];
    const cnt = [0, 0, 0, 0, 0];
    for (let n = 0; n < Math.min(260, idx.length); n++) { const i = idx[Math.floor(R() * idx.length)], kind = R() < .45 ? 4 : Math.floor(R() * 4); cnt[kind]++;
      const m = new Tt.Mesh(new Tt.SphereGeometry(kind === 3 ? .0028 : .0016, 8, 6), E.glow(E.lin(kinds[kind][1]), 1)); m.material.depthTest = false; m.renderOrder = 35; m.position.set(pa.getX(i), pa.getY(i), pa.getZ(i)); G3.add(m); }
    ST().highlight({ seg: code, reveal: false }); const c = idx.length ? new V3(pa.getX(idx[0]), pa.getY(idx[0]), pa.getZ(idx[0])) : new V3(0, 0, 0); E.focusOn(c.toArray(), null, .6);
    return { code, kinds, cnt, n: idx.length };
  }

  function win(b) {
    const D = ST().ext().DERM;
    b.innerHTML = `<div class="card"><h4>Grupo da topologia anatômica</h4>
      <div class="row" style="gap:6px;flex-wrap:wrap"><select id="tmG"><option value="">— músculos: escolha o grupo —</option>${TOPO.map(([r, gs]) => `<optgroup label="${esc(r)}">${gs.map(([n, re]) => `<option value="${esc(r + "|" + n)}" ${T.grp === r + "|" + n ? "selected" : ""}>${esc(n)}</option>`).join("")}</optgroup>`).join("")}</select>
      <div class="seg mini"><button data-s="right" class="${T.side === "right" ? "on" : ""}">direito</button><button data-s="left" class="${T.side === "left" ? "on" : ""}">esquerdo</button></div>
      <select id="tmS"><option value="">— pele: dermátomo —</option>${D.map(d => `<option ${T.skin && T.skin.code === d ? "selected" : ""}>${d}</option>`).join("")}</select><button class="btn ghost" id="tmC">Limpar</button></div>
      <div class="tmleg"><span><i style="background:#d36cff"></i>axônio motor α e ramos</span><span><i style="background:#ffd166"></i>placa motora</span><span><i style="background:#3ee6c5"></i>fuso (γ)</span><span><i style="background:#4fb3ff"></i>aferentes Ia/II/Ib</span><span><i style="background:#ffb36b"></i>órgão tendinoso</span><span><i style="background:#ff5d73"></i>terminação livre III/IV</span></div></div>
      <div id="tmOut">${T.skin ? skinHTML(T.skin) : T.list.length ? listHTML() : `<p class="note">Escolha um grupo de músculos ou um dermátomo para ver as terminações até a placa motora ou os receptores da pele.</p>`}</div>
      <div class="card"><h4>Referências</h4><ol class="refs">${Object.values(REF).map(r => `<li>${esc(r)}</li>`).join("")}</ol></div>`;
    $("#tmG", b).onchange = e => { T.grp = e.target.value; T.skin = null; if (!T.grp) return; const [r, n] = T.grp.split("|"), re = TOPO.find(x => x[0] === r)[1].find(x => x[0] === n)[1];
      const go = () => { build(n, re); win(b); }; if (!ST().ext().S.musclesReady) { ST().ext().ensureMuscles(); document.addEventListener("axon:muscles", go, { once: true }); } else go(); };
    $$("[data-s]", b).forEach(x => x.onclick = () => { T.side = x.dataset.s; if (T.grp) $("#tmG", b).dispatchEvent(new Event("change")); else win(b); });
    $("#tmS", b).onchange = e => { const c = e.target.value; T.list = []; T.skin = c ? buildSkin(c) : null; win(b); };
    $("#tmC", b).onclick = () => { clear3D(); ST().clearHighlight(); T.list = []; T.skin = null; T.grp = null; win(b); };
    $$("tr[data-m]", b).forEach(tr => tr.onclick = () => { const o = T.list.find(x => x.name === tr.dataset.m); if (o) { ST().ext().focusOn(o.entry, null, .3); if (g.AxonMorpho) g.AxonMorpho.traceMuscle && g.AxonApp.isOpen("morpho") && g.AxonMorpho.traceMuscle(o.name, g.AxonApp.body("morpho")); } });
  }
  function listHTML() {
    return `<div class="card"><h4>${esc((T.grp || "").split("|")[1] || "")} · ${T.side === "right" ? "direito" : "esquerdo"} (${T.list.length} músculos)</h4>
      <div class="scroll"><table class="tbl mo"><tr><th>Músculo</th><th>Nervo · raízes</th><th>Comprimento</th><th>Placas (desenho)</th><th>Entrada → zona de inervação</th><th>Aα previsto</th><th>Unidades motoras</th></tr>
      ${T.list.map(o => `<tr data-m="${esc(o.name)}"><td><b>${esc(o.pt)}</b></td><td>${esc(o.nerve)} · ${esc(o.roots)}</td><td>${fmt(o.L)} mm</td><td>${o.plates} · fusos ${o.spindles}</td><td>${fmt(o.entryToIZ)} mm</td><td>${o.aa ? `${fmt(o.aa.D.med, 1)} µm · ${fmt(o.aa.cv)} m/s` : "—"}</td><td>${o.mu ? `${o.mu[0]} (razão ${o.mu[1]} fibras/UM) ${tag("lit")}` : "—"}</td></tr>`).join("")}</table></div>
      <p class="note">${tag("lit")} placas motoras concentradas numa faixa no meio do ventre (zona de inervação); fusos com aferentes Ia e II e inervação γ; órgãos tendinosos (Ib) na junção musculotendínea; terminações livres III/IV. ${tag("pre")} número de placas, fusos e ramos desenhados é ilustrativo: um músculo real tem de dezenas a milhares de unidades motoras e dezenas a centenas de fusos. ${tag("der")} comprimento e distâncias medidos na malha; calibre Aα pelo preditor morfométrico do paciente.</p></div>`;
  }
  function skinHTML(s) {
    return `<div class="card"><h4>Receptores da pele · dermátomo ${esc(s.code)}</h4><table class="tbl">${s.kinds.map(([n, c], i) => `<tr><td><i class="dotc" style="background:#${c.toString(16).padStart(6, "0")}"></i> ${esc(n)}</td><td>${s.cnt[i]} marcadores</td></tr>`).join("")}</table>
      <p class="note">${tag("lit")} quatro classes de mecanorreceptores Aβ (Meissner, Merkel, Ruffini, Pacini) e terminações livres Aδ/C; na polpa digital a densidade de unidades táteis chega a ~240/cm², e cai em direção à palma e ao dorso (Johansson & Vallbo 1979). ${tag("pre")} a distribuição desenhada é uniforme e ilustrativa.</p></div>`;
  }
  function boot() { const A = g.AxonApp; if (!A || !A.registerApp || !g.AxonStage) return setTimeout(boot, 80); A.registerApp("terminals", { title: "terminals", w: 700, h: 760, render: win, onClose: () => {} }); }
  boot();
  g.AxonTerminals = { TOPO, build, buildSkin, clear: clear3D, T };
})(window);
