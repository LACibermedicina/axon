/* axon · context.js — os níveis de zoom correspondem à estrutura escolhida.
   Ao selecionar pele, músculo, nervo, osso ou crânio/encéfalo, os níveis 2 a 5 passam a mostrar aquele tecido:
   N2 a pilha de camadas do tecido; N3 o fascículo correspondente (nervoso, muscular, coluna cortical, ósteon);
   N4 a terminação correspondente (nó de Ranvier, placa motora, receptor cutâneo, axônio do SNC).
   Um minimapa iconificado mostra onde se está no corpo do paciente e permite voltar a qualquer nível.
   Geometria ilustrativa [PREMISSA didática]; organização das camadas segundo a anatomia descritiva [LITERATURA]. */
(function (g) {
  "use strict";
  const ST = () => g.AxonStage, E = () => ST().ext();
  const C = { ctx: { kind: "pele", name: null, point: null, region: null, side: null }, over: {}, base: {}, labs: {} };
  const KIND = {
    pele: { ic: "🖐", n: "Pele", l3: "Nervo cutâneo", l4: "Receptor cutâneo (Pacini)" },
    musculo: { ic: "💪", n: "Músculo", l3: "Fascículo muscular", l4: "Placa motora (junção neuromuscular)" },
    nervo: { ic: "〰", n: "Nervo", l3: "Fascículo nervoso", l4: "Axônio · nós de Ranvier" },
    osso: { ic: "🦴", n: "Osso", l3: "Ósteon (sistema de Havers)", l4: "Axônio no canal de Havers" },
    cranio: { ic: "🧠", n: "Crânio e encéfalo", l3: "Coluna cortical", l4: "Axônio do SNC (oligodendrócito)" },
    orgao: { ic: "🫁", n: "Órgão", l3: "Fascículo nervoso", l4: "Axônio · nós de Ranvier" },
    vaso: { ic: "🩸", n: "Vaso", l3: "Fascículo nervoso", l4: "Axônio · nós de Ranvier" },
  };
  // ----------------------------------------------------------------- região do corpo pelo ponto (proporções corporais) [PREMISSA]
  function regionOf(p) {
    if (!p) return null; const S = E().S, sk = S.meshByLayer && S.meshByLayer.skin; if (!sk) return null;
    const bb = sk.geometry.boundingBox || (sk.geometry.computeBoundingBox(), sk.geometry.boundingBox), H = bb.max.y - bb.min.y, f = (p[1] - bb.min.y) / H, ax = Math.abs(p[0]) / H;
    const side = Math.abs(p[0]) < .012 * H ? null : p[0] < 0 ? "direito" : "esquerdo";
    let r;
    if (f > .87) r = f > .925 ? "couro cabeludo" : "face"; else if (f > .815) r = "pescoço";
    else if (ax > .115 && f > .42) r = f > .66 ? "braço" : f > .52 ? "antebraço" : "mão";
    else if (f > .52) r = f > .68 ? "tórax" : f > .585 ? "abdome" : "pelve";
    else r = f > .29 ? "coxa" : f > .055 ? "perna" : "pé";
    return { r, side, f, x: p[0] / H, scalp: f > .9 };
  }
  function kindOf(d) {
    const n = ((d.en || "") + " " + (d.name || "")).toLowerCase(), L = d.layer || "";
    // a camada de onde veio o clique decide primeiro (ex.: "tibialis anterior" é músculo, não tíbia)
    if (L === "muscles") return "musculo"; if (L === "nervo") return "nervo"; if (L === "vessels") return "vaso";
    if (L === "skeleton") return /skull|cranial|frontal bone|parietal|occipital bone|temporal bone|sphenoid|ethmoid|calvaria/.test(n) ? "cranio" : "osso";
    if (L === "organs") return /brain|cerebr|cerebell|encéfal|pons|medulla oblong/.test(n) ? "cranio" : "orgao";
    if (/brain|cerebr|cerebell|encéfal|córtex|cortex|gyrus|hemisph|pons|medulla oblong/.test(n)) return "cranio";
    if (L === "skeleton" || /\bbone\b|osso|vertebra|femur|tibia|fibula|humerus|radius|ulna|\brib\b|sternum|patella|scapula|clavicle|sacrum/.test(n))
      return /skull|cranial|frontal bone|parietal|occipital bone|temporal bone|sphenoid|ethmoid|calvaria/.test(n) ? "cranio" : "osso";
    if (L === "muscles" || /muscle|músculo|tendon/.test(n)) return "musculo";
    if (L === "nervo" || /nerve|nervo|plexus/.test(n)) return "nervo";
    if (L === "vessels" || /artery|vein|arter|veia/.test(n)) return "vaso";
    if (L === "organs") return "orgao";
    return "pele";
  }
  function set(d, quiet) {
    if (!d) return; const reg = regionOf(d.point || null); let kind = d.kind || kindOf(d);
    if (kind === "pele" && reg && reg.scalp) kind = "cranio";                       // couro cabeludo → camadas do escalpo, crânio e encéfalo
    C.ctx = { kind, name: d.name || d.en || null, en: d.en || null, point: d.point || null, region: reg ? reg.r : null, side: reg ? reg.side : null, reg, code: d.code || null };
    C.key = kind + "|" + (C.ctx.name || "");
    const l = ST().level; if (!quiet && l >= 2) apply(l); drawMap();
  }
  // ----------------------------------------------------------------- utilidades de cena
  function grp(l) { return E().S.groups["L" + l]; }
  function clearOver(l) {
    const G = grp(l), o = C.over[l]; if (o && G) { G.remove(o); o.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }
    (C.labs[l] || []).forEach(el => { el.remove(); const S = E().S; S.labels = S.labels.filter(L => L.el !== el); }); C.labs[l] = []; C.over[l] = null;
    const b = C.base[l]; if (b) { b.forEach(([o, k, v]) => { if (k === "label") { if (v) o.dataset.hidden = v; else delete o.dataset.hidden; } else if (k === "scale") o.scale.copy(v); else if (k === "pos") o.position.copy(v); else o[k] = v; }); } C.base[l] = [];
  }
  const keep = (l, o, k) => C.base[l].push([o, k, k === "scale" ? o.scale.clone() : k === "pos" ? o.position.clone() : k === "label" ? (o.dataset.hidden || "") : o[k]]);
  function lab(l, G, pos, text, cls) { const el = E().label(grp(l), pos, text, cls || "small"); el.classList.add("ctxl"); C.labs[l].push(el); return el; }
  function baseLabels(l) { const S = E().S, G = grp(l); return S.labels.filter(L => L.group === G && !L.el.classList.contains("ctxl")); }
  function hideBase(l, test) { const G = grp(l); G.children.forEach(ch => { if (ch === C.over[l]) return; if (!test || test(ch)) { keep(l, ch, "visible"); ch.visible = false; } }); }
  function hideBaseLabels(l, test) { baseLabels(l).forEach(L => { if (!test || test(L.el.textContent)) { keep(l, L.el, "label"); L.el.dataset.hidden = "1"; } }); }
  function shrinkBase(l, s, at) { const G = grp(l), V = E().V3; G.children.forEach(ch => { if (ch === C.over[l]) return; keep(l, ch, "scale"); keep(l, ch, "pos"); ch.scale.multiplyScalar(s); ch.position.multiplyScalar(s).add(V(...at)); }); }
  // ----------------------------------------------------------------- materiais
  function mats() {
    const { phys, glass } = E();
    if (C.M) return C.M;
    C.M = { epi: phys(0xcf9a84, { tex: "skin", rep: [5, 1] }), derm: phys(0xd88d8f, { tex: "dermis", rep: [6, 1], ns: 1 }), fat: phys(0xf6d58b, { tex: "fat", rep: [3, 1], ns: 1.4, roughness: .35, clearcoat: .6 }),
      fascia: phys(0xeeeae2, { tex: "collagen", rep: [4, 1], clearcoat: .9, roughness: .25 }), muscle: phys(0xa8323a, { tex: "muscle", rep: [2, 1] }),
      periost: phys(0xe9d6bc, { tex: "collagen", rep: [4, 1], clearcoat: .5 }), cortical: phys(0xf0e8d6, { tex: "bone", rep: [3, 1], roughness: .6 }), trab: phys(0xc98f70, { tex: "bone", rep: [5, 2], roughness: .8 }),
      ctd: phys(0xe2c2b0, { tex: "collagen", rep: [4, 1] }), galea: phys(0xf2ede2, { tex: "collagen", rep: [6, 1], clearcoat: .8, roughness: .3 }), areolar: glass(0xf6e4d6, .55), dura: phys(0xcfc6b4, { tex: "collagen", rep: [5, 1], clearcoat: .6 }),
      csf: glass(0x9fd8ff, .35), pia: phys(0xd68c8c, { roughness: .4 }), gray: phys(0xb88a86, { tex: "brain", rep: [4, 1] }), white: phys(0xf0e8de, { tex: "brain", rep: [4, 1] }),
      fiber: phys(0xb7323c, { tex: "muscle", rep: [1, 9], ns: 1.2, roughness: .45, clearcoat: .3 }), endo: glass(0xf5d0c8, .18), peri: glass(0xf0c4b8, .22, { clearcoat: .8 }),
      lam: glass(0xf3ead6, .28, { clearcoat: 1 }), canal: phys(0x2b0f12, { roughness: .9 }), axon: phys(0xffd39b, { emissive: 0x4a2a00, emissiveIntensity: .35, roughness: .4, clearcoat: .5 }),
      plate: E().glow(0x3ee6c5, .95), neuron: phys(0x8f6bd8, { emissive: 0x2a1650, emissiveIntensity: .4, roughness: .4 }), olig: phys(0x6bb8d8, { emissive: 0x0f3a50, emissiveIntensity: .4, roughness: .4 }) };
    return C.M;
  }
  // ----------------------------------------------------------------- Nível 2: pilha de camadas do tecido escolhido
  const STACK = {
    musculo: () => [["Epiderme", 1, "epi"], ["Derme", 3, "derm"], ["Hipoderme (adiposo)", 6 * fatK(), "fat"], ["Epimísio (fáscia muscular)", 1, "fascia"], ["Músculo", 26, "muscle"]],
    osso: () => [["Epiderme", 1, "epi"], ["Derme", 3, "derm"], ["Hipoderme", 4 * fatK(), "fat"], ["Periósteo", 1, "periost"], ["Osso cortical (compacto)", 8, "cortical"], ["Osso trabecular e medula", 18, "trab"]],
    // SCALP (pele, tecido conjuntivo denso, aponeurose, tecido areolar frouxo, pericrânio) + crânio + meninges + córtex [LITERATURA: anatomia do couro cabeludo e das meninges]
    cranio: () => [["Pele do couro cabeludo", 4, "epi"], ["Tecido conjuntivo denso (nervos e vasos)", 4, "ctd"], ["Aponeurose epicrânica (gálea)", 1.5, "galea"], ["Tecido areolar frouxo", 2.5, "areolar"], ["Pericrânio", 1, "periost"],
      ["Tábua externa", 2, "cortical"], ["Díploe", 3, "trab"], ["Tábua interna", 1.5, "cortical"], ["Dura-máter", 1, "dura"], ["Aracnoide e líquor (espaço subaracnóideo)", 2, "csf"], ["Pia-máter", .5, "pia"], ["Córtex (substância cinzenta)", 3, "gray"], ["Substância branca", 6, "white"]],
  };
  const fatK = () => { const v = (g.AxonApp && g.AxonApp.state.v) || {}; return Math.max(.25, 1 + (v.fat || 0) * .9 - (v.wasting || 0) * .7); };
  function l2(G, k) {
    const { T, V3, tube, S } = E(), M = mats(), W = 2.8, Z = 1.6, TOT = 1.335, nm = C.ctx.name;
    if (STACK[k]) {
      hideBase(2, ch => ch.isMesh && ch.geometry && ch.geometry.type === "BoxGeometry" && ch.position.y < 0);
      hideBaseLabels(2, t => S.LAYERS_N.includes(t));
      if (k === "cranio") { hideBase(2, ch => ch.isInstancedMesh && ch.geometry.type === "SphereGeometry"); if (S.tissue.nv) { keep(2, S.tissue.nv, "visible"); S.tissue.nv.visible = false; } if (S.tissue.branches) { keep(2, S.tissue.branches, "visible"); S.tissue.branches.visible = false; } }
      const L = STACK[k](), sum = L.reduce((s, x) => s + x[1], 0); let y = 0; const Y = {};
      L.forEach(([n, h, mk], i) => { const hh = h / sum * TOT, m = new T.Mesh(new T.BoxGeometry(W, hh, Z), M[mk]); m.position.y = y - hh / 2 - (i === 0 ? .002 : 0); m.castShadow = m.receiveShadow = true; G.add(m);
        Y[mk + (Y[mk] ? i : "")] = [y, y - hh]; Y[n] = [y, y - hh]; lab(2, G, [-W / 2 - .02, y - hh / 2, Z / 2], n === "Músculo" && nm ? `Músculo · ${nm}` : n); y -= hh; });
      if (k === "musculo") {           // fascículos, ponto motor e zona de inervação (placas motoras no meio do ventre) [LITERATURA]
        const [y0, y1] = Y["Músculo"], m4 = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(0, 0, Math.PI / 2)), N = 48;
        const fas = new T.InstancedMesh(new T.CylinderGeometry(.07, .07, W * .98, 14), M.fiber, N);
        for (let i = 0; i < N; i++) { const row = i % 6, col = Math.floor(i / 6); m4.compose(V3(0, y0 - .08 - row * (y0 - y1 - .12) / 5.4, -Z / 2 + .1 + col * (Z - .2) / 7), q, V3(1, 1, 1)); fas.setMatrixAt(i, m4); } G.add(fas);
        const nvY = S.tissue.nv ? S.tissue.nv.position.y : -.4, ym = (y0 + y1) / 2;
        G.add(tube([[.25, nvY, 0], [.3, (nvY + y0) / 2, .1], [.32, y0 - .05, .15], [.3, ym, .2]], .02, E().nerveMat(0xf2d6a2, .5), 40, 8)); lab(2, G, [.32, y0 - .02, .25], "Ponto motor: o ramo motor entra no músculo", "");
        const pl = new T.InstancedMesh(new T.SphereGeometry(.012, 8, 6), M.plate, 90); for (let i = 0; i < 90; i++) { const r = Math.random; m4.compose(V3(.05 + (r() - .5) * .3, y0 - .1 - r() * (y0 - y1 - .2), (r() - .5) * Z * .9), new T.Quaternion(), V3(1, .5, 1)); pl.setMatrixAt(i, m4); } G.add(pl);
        lab(2, G, [.05, y1 + .1, Z / 2], "Zona de inervação: placas motoras no meio do ventre");
      }
      if (k === "osso") { const [y0, y1] = Y["Osso trabecular e medula"], m4 = new T.Matrix4(), N = 160, tr = new T.InstancedMesh(new T.BoxGeometry(.02, .14, .02), M.cortical, N), r = Math.random;
        for (let i = 0; i < N; i++) { m4.compose(V3((r() - .5) * W * .95, y0 - .03 - r() * (y0 - y1 - .06), (r() - .5) * Z * .95), new T.Quaternion().setFromEuler(new T.Euler(r() * 3, r() * 3, r() * 3)), V3(1, 1, 1)); tr.setMatrixAt(i, m4); } G.add(tr);
        lab(2, G, [W / 2 + .05, (y0 + y1) / 2, 0], nm ? `Osso · ${nm}` : "Osso"); }
      if (k === "cranio") { const [c0, c1] = Y["Tecido conjuntivo denso (nervos e vasos)"], yc = (c0 + c1) / 2;
        G.add(tube([[-W / 2, yc, .25], [0, yc - .01, .3], [W / 2, yc, .28]], .018, E().nerveMat(0xf2d6a2, .55), 40, 8)); G.add(tube([[-W / 2, yc, -.2], [0, yc + .005, -.25], [W / 2, yc, -.22]], .022, E().phys(0xb5202e, { clearcoat: .9 }), 40, 8));
        lab(2, G, [W / 2 + .05, yc, .25], "Nervos e vasos do couro cabeludo correm no tecido conjuntivo denso", "");
        const [g0, g1] = Y["Córtex (substância cinzenta)"], m4 = new T.Matrix4(), N = 70, nr = new T.InstancedMesh(new T.ConeGeometry(.018, .05, 6), M.neuron, N), r = Math.random;
        for (let i = 0; i < N; i++) { m4.compose(V3((r() - .5) * W * .95, g0 - .02 - r() * (g0 - g1 - .04), (r() - .5) * Z * .95), new T.Quaternion(), V3(1, 1, 1)); nr.setMatrixAt(i, m4); } G.add(nr);
        lab(2, G, [W / 2 + .05, (g0 + g1) / 2, 0], "Neurônios corticais", ""); }
    }
    if (k === "nervo" && nm) lab(2, G, [W / 2 + .05, (S.tissue.nv ? S.tissue.nv.position.y : -.4) + .15, 0], `Nervo · ${nm}`, "");
    if ((k === "orgao" || k === "vaso") && nm) lab(2, G, [0, .25, Z / 2], `${KIND[k].n} selecionado: ${nm} · a parede corporal acima dele`, "");
  }
  // ----------------------------------------------------------------- Nível 3: fascículo correspondente
  function l3(G, k) {
    const { T, V3, tube } = E(), M = mats(), Lx = 3.4, r = Math.random;
    if (k === "musculo") {
      shrinkBase(3, .3, [0, 1.55, 0]); hideBaseLabels(3);
      const per = new T.Mesh(new T.CylinderGeometry(1, 1, Lx, 72, 1, true), M.peri); per.rotation.z = Math.PI / 2; G.add(per);
      const m4 = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(0, 0, Math.PI / 2)), pts = [];
      for (let ring = 0; ring < 5; ring++) { const n = ring === 0 ? 1 : ring * 6; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, d = ring * .19; pts.push([Math.cos(a) * d, Math.sin(a) * d]); } }
      const fb = new T.InstancedMesh(new T.CylinderGeometry(.085, .085, Lx * .985, 20), M.fiber, pts.length), en = new T.InstancedMesh(new T.CylinderGeometry(.093, .093, Lx * .98, 20, 1, true), M.endo, pts.length);
      pts.forEach(([y, z], i) => { m4.compose(V3(0, y, z), q, V3(1, 1, 1)); fb.setMatrixAt(i, m4); en.setMatrixAt(i, m4); }); G.add(fb); G.add(en);
      // axônios motores Aα descem do ramo intramuscular e terminam em placas na superfície das fibras
      const ends = [3, 9, 14, 22, 31, 40].map(i => pts[i]).filter(Boolean); ends.forEach(([y, z], j) => { const x = -.6 + j * .25;
        G.add(tube([[x - .4, 1.45, 0], [x - .2, 1.15, z * .3], [x, y + .3, z], [x + .05, y + .09, z]], .012, M.axon, 30, 6));
        const p = new T.Mesh(new T.SphereGeometry(.045, 16, 10), M.plate); p.scale.set(1.4, .35, 1); p.position.set(x + .05, y + .088, z); G.add(p); });
      const sp = new T.Mesh(new T.SphereGeometry(1, 24, 16), E().glass(0xffe2a8, .55)); sp.scale.set(.9, .06, .06); sp.position.set(.6, -.38, .55); G.add(sp);
      lab(3, G, [0, 1.05, .3], "Fascículo muscular · perimísio"); lab(3, G, [Lx / 2, .2, .6], "Fibras musculares · endomísio (estriação)"); lab(3, G, [-.5, 1.55, .3], "Ramo nervoso intramuscular (fascículo ao alto)", "");
      lab(3, G, [-.1, .55, .4], "Axônios motores Aα → placas motoras", ""); lab(3, G, [.6, -.5, .7], "Fuso neuromuscular (fibras intrafusais · aferentes Ia e II)");
    } else if (k === "cranio") {
      hideBase(3); hideBaseLabels(3);
      const bands = [["I molecular", .14, 0xd8b4a8], ["II granular externa", .16, 0xcfa49c], ["III piramidal externa", .3, 0xc69690], ["IV granular interna", .16, 0xbd8a86], ["V piramidal interna", .3, 0xb47f7d], ["VI multiforme", .2, 0xab7676], ["Substância branca", .5, 0xefe6dc]];
      let y = 1.05; bands.forEach(([n, h, c], i) => { const m = new T.Mesh(new T.CylinderGeometry(1, 1, h, 64), E().phys(c, { tex: i === 6 ? "brain" : "brain", rep: [2, 1], transparent: true, opacity: .55, depthWrite: false })); m.position.y = y - h / 2; G.add(m); lab(3, G, [1.05, y - h / 2, 0], n); y -= h; });
      const pyr = (x, z, yb, s) => { const c = new T.Mesh(new T.ConeGeometry(.05 * s, .14 * s, 8), M.neuron); c.position.set(x, yb, z); G.add(c); G.add(tube([[x, yb + .06 * s, z], [x + .02, yb + .35 * s, z], [x, 1.02, z]], .006, M.neuron, 20, 5)); G.add(tube([[x, yb - .06 * s, z], [x - .02, -.5, z + .05], [x, -1.35, z]], .009, M.axon, 30, 6)); };
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; pyr(Math.cos(a) * .55, Math.sin(a) * .55, .45 - (i % 2) * .05, .8); pyr(Math.cos(a + .5) * .35, Math.sin(a + .5) * .35, -.15, 1.25); }
      lab(3, G, [-1.05, -.15, 0], "Neurônio piramidal da camada V (axônio desce à substância branca)", ""); lab(3, G, [0, -1.25, .4], "Axônios mielinizados por oligodendrócitos");
    } else if (k === "osso") {
      hideBase(3); hideBaseLabels(3);
      for (let i = 0; i < 7; i++) { const R = .22 + i * .11, m = new T.Mesh(new T.CylinderGeometry(R, R, Lx, 64, 1, true), M.lam); m.rotation.z = Math.PI / 2; G.add(m); }
      const can = new T.Mesh(new T.CylinderGeometry(.2, .2, Lx, 32), M.canal); can.rotation.z = Math.PI / 2; G.add(can);
      G.add(tube([[-Lx / 2, .06, .05], [Lx / 2, .06, .05]], .05, E().phys(0xb5202e, { clearcoat: .9 }), 20, 10)); G.add(tube([[-Lx / 2, -.08, -.04], [Lx / 2, -.08, -.04]], .03, E().nerveMat(0xf2d6a2, .55), 20, 8));
      G.add(tube([[.4, .1, 0], [.4, .5, .2], [.45, 1.05, .3]], .05, M.canal, 20, 8));
      const oc = new T.InstancedMesh(new T.SphereGeometry(.025, 8, 6), E().phys(0x6b4a3a), 70); const m4 = new T.Matrix4(); for (let i = 0; i < 70; i++) { const a = r() * 6.283, R = .3 + Math.floor(r() * 6) * .11; m4.compose(V3((r() - .5) * Lx, Math.cos(a) * R, Math.sin(a) * R), new T.Quaternion(), V3(2, .6, 1)); oc.setMatrixAt(i, m4); } G.add(oc);
      lab(3, G, [0, 1.0, .3], "Ósteon · lamelas concêntricas"); lab(3, G, [Lx / 2, 0, .3], "Canal de Havers: arteríola, vênula e nervo", ""); lab(3, G, [.45, 1.1, .3], "Canal de Volkmann"); lab(3, G, [-1, -.6, .5], "Osteócitos nas lacunas");
    } else {
      const nm = C.ctx.name; if (nm) lab(3, G, [0, 1.35, 0], k === "pele" ? `Nervo cutâneo de ${C.ctx.region || "região"}: predominam Aβ, Aδ e C` : `Fascículo de ${nm}`, "");
    }
  }
  // ----------------------------------------------------------------- Nível 4: terminação correspondente
  function l4(G, k) {
    const { T, V3, tube } = E(), M = mats(), S = E().S, xEnd = 1.1;   // a terminação sai do axônio por um ramo e fica dentro da vista
    if (k === "musculo") {
      const fb = new T.Mesh(new T.CylinderGeometry(.55, .55, 5, 48), M.fiber); fb.rotation.z = Math.PI / 2; fb.position.set(1.0, -1.18, 0); G.add(fb);
      G.add(tube([[xEnd - .6, -.2, 0], [xEnd, -.3, 0], [xEnd + .2, -.45, 0], [xEnd + .1, -.55, 0]], .09, M.axon, 40, 12));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, bx = xEnd + .1 + Math.cos(a) * .32, bz = Math.sin(a) * .25; G.add(tube([[xEnd + .1, -.55, 0], [bx, -.57, bz]], .035, M.axon, 10, 6)); const bt = new T.Mesh(new T.SphereGeometry(.075, 16, 12), M.axon); bt.position.set(bx, -.59, bz); G.add(bt); }
      const ep = new T.Mesh(new T.SphereGeometry(.5, 32, 16), M.plate); ep.scale.set(1.1, .06, .8); ep.position.set(xEnd + .1, -.63, 0); G.add(ep);
      lab(4, G, [xEnd + .1, -.8, .7], "Junção neuromuscular: ACh liberada na fenda → receptores nicotínicos da placa motora", ""); lab(4, G, [-.8, -1.7, .6], "Fibra muscular (sarcolema e estriações)");
    } else if (k === "pele") {
      const cx = xEnd + .5, cy = -.95;
      for (let i = 0; i < 10; i++) { const s = .08 + i * .045, m = new T.Mesh(new T.SphereGeometry(1, 32, 20), E().glass(i % 2 ? 0xf3e6cf : 0xfffaf0, .22, { clearcoat: 1 })); m.scale.set(s * 2.2, s, s); m.position.set(cx, cy, 0); G.add(m); }
      G.add(tube([[xEnd - .6, -.2, 0], [xEnd - .2, -.6, 0], [cx - .9, cy, 0], [cx + .5, cy, 0]], .05, M.axon, 40, 8));
      lab(4, G, [cx, cy - .65, .3], "Corpúsculo de Pacini: terminação de fibra Aβ (vibração), lamelas em cebola", "");
    } else if (k === "cranio") {
      hideBase(4, ch => ch.isMesh && ch.geometry && ch.geometry.type === "SphereGeometry" && ch.geometry.parameters && Math.abs(ch.geometry.parameters.radius - .09) < 1e-6);   // núcleos de Schwann: não existem no SNC
      const ol = new T.Mesh(new T.SphereGeometry(.22, 24, 16), M.olig); ol.position.set(0, 1.4, .3); G.add(ol);
      (S.nodes || []).slice(0, 4).forEach((n, i) => { const x = n.position.x - .75; G.add(tube([[0, 1.3, .3], [x * .5, 1.0, .35], [x, .36, .2]], .025, M.olig, 24, 6)); });
      lab(4, G, [0, 1.75, .3], "Oligodendrócito: no SNC uma só célula mieliniza vários internodos (no SNP é a célula de Schwann)", "");
    } else if (k === "osso") lab(4, G, [0, 1.6, 0], "Axônio sensitivo do canal de Havers (dor óssea)", "");
  }
  function l5(G, k) { if (C.ctx.name || C.ctx.region) lab(5, G, [0, 1.6, 0], `Membrana do axônio · ${KIND[k].n.toLowerCase()}${C.ctx.name ? " · " + C.ctx.name : ""}`, ""); }
  // ----------------------------------------------------------------- aplicação ao nível vigente
  function apply(l) {
    if (l < 2) { drawMap(); return; } const G = grp(l); if (!G) { setTimeout(() => apply(l), 120); return; }
    const S = E().S; if (!S.LAYERS_N) S.LAYERS_N = (E().LAYERS || []).map(x => x[0]);
    clearOver(l); C.base[l] = []; C.labs[l] = [];
    const k = C.ctx.kind, TT = E().T, O = new TT.Group(); O.name = "ctx"; G.add(O); C.over[l] = O;
    try { ({ 2: l2, 3: l3, 4: l4, 5: l5 })[l](O, k); } catch (e) { console.warn("contexto", e); }
    C.applied = C.applied || {}; C.applied[l] = C.key; E().syncLabels(); drawMap();
  }
  // ----------------------------------------------------------------- minimapa e trilha iconificada
  const SIL = "M50 6c7 0 11 5 11 12s-4 12-11 12-11-5-11-12 4-12 11-12zM38 34h24c7 0 11 4 12 10l6 34-6 2-7-30v28l3 54h-9l-5-46h-2l-5 46h-9l3-54V50l-7 30-6-2 6-34c1-6 5-10 12-10z";
  function drawMap() {
    const host = document.getElementById("stage"); if (!host) return; let m = document.getElementById("ctxMap");
    if (!m) { m = document.createElement("div"); m.id = "ctxMap"; m.className = "ctxmap notr"; host.appendChild(m); }
    const c = C.ctx, l = ST().level, K = KIND[c.kind] || KIND.pele, P = g.AxonDissect && g.AxonDissect.PT, preg = P && P.sex === "F" && P.preg > 14;
    let dot = ""; if (c.reg) { const x = 50 + c.reg.x * 154, y = 4 + (1 - c.reg.f) * 154; dot = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" class="cm-dot"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" class="cm-ring"/>`; }
    const where = c.region ? `${c.region}${c.side ? " " + c.side : ""}` : "corpo inteiro";
    const crumbs = [[1, "🧍", "Corpo", where], [2, K.ic, K.n, c.name || where], [3, "▦", K.l3, ""], [4, c.kind === "musculo" ? "⚡" : c.kind === "pele" ? "◎" : "⟜", K.l4, ""], [5, "⫶", "Membrana", "canais iônicos"]];
    m.innerHTML = `<button class="cm-body" data-tip="Você está em: ${where}${c.name ? " · " + c.name : ""}. Clique para voltar ao corpo inteiro neste ponto"><svg viewBox="0 0 100 162"><path d="${SIL}" class="cm-sil"/>${preg ? `<ellipse cx="56" cy="62" rx="7" ry="9" class="cm-sil"/>` : ""}${dot}</svg></button>
      <div class="cm-crumbs">${crumbs.map(([n, ic, t, s]) => `<button data-l="${n}" class="${n === l ? "on" : n < l ? "past" : ""}" data-tip="Nível ${n} · ${t}${s ? " · " + s : ""}"><i>${ic}</i>${n === l ? `<span>${t}</span>` : ""}</button>`).join("<b>›</b>")}</div>`;
    m.querySelector(".cm-body").onclick = () => { ST().setLevel(1); if (c.point) setTimeout(() => E().focusOn(c.point, null, .35), 300); };
    m.querySelectorAll("[data-l]").forEach(b => b.onclick = () => ST().setLevel(+b.dataset.l));
  }
  // ----------------------------------------------------------------- eventos
  function boot() {
    if (!g.AxonStage || !ST().ext || !ST().ext().S || !document.getElementById("stage")) return setTimeout(boot, 150);
    document.addEventListener("axon:structure", e => set(e.detail || {}));
    document.addEventListener("axon:dermatome", e => { const d = e.detail || {}; set({ kind: "pele", name: d.code ? "dermátomo " + d.code : null, point: d.point, code: d.code }); });
    document.addEventListener("axon:acupoint", e => { const d = e.detail || {}; set({ kind: "pele", name: d.id, point: d.p }); });
    document.addEventListener("axon:scale", e => { const l = e.detail && e.detail.level; if (l >= 2 && (!C.applied || C.applied[l] !== C.key)) apply(l); else drawMap(); });
    document.addEventListener("axon:patient", () => { C.applied = {}; drawMap(); });
    drawMap();
  }
  boot();
  g.AxonContext = { C, set, apply, regionOf, kindOf, KIND, get ctx() { return C.ctx; } };
})(window);
