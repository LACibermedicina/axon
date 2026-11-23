/* axon · dissect.js — dissecção por profundidade, corte do modelo, imagens simuladas (TC, RM, RX), EMG de superfície
   e paciente personalizável (sexo, idade, IMC, fototipo) com deformação da anatomia.
   Todas as imagens são reconstruídas a partir da malha 3D BodyParts3D do próprio simulador: não são exames reais.
   Tons de cinza por tecido e o sinal de EMG são aproximações didáticas [PREMISSA]. */
(function (g) {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ST = () => g.AxonStage, EXT = () => g.AxonStage && g.AxonStage.ext ? g.AxonStage.ext() : null;
  const tag = (k, t) => g.AxonApp ? g.AxonApp.tagHTML(k, t) : "";

  // ================================================================== profundidade (dissecção)
  const DEPTH = [
    { n: "Superfície", d: "Pele íntegra com dermátomos", skin: 1, on: ["skeleton", "organs"], off: ["muscles", "vessels", "nerves", "autonomic"] },
    { n: "Subcutâneo", d: "Pele translúcida, músculos aparecem", skin: .42, on: ["muscles", "organs"], off: ["vessels", "nerves", "autonomic"] },
    { n: "Músculos", d: "Pele quase transparente, músculos, vasos e nervos", skin: .1, on: ["muscles", "vessels", "nerves"], off: ["autonomic"] },
    { n: "Vísceras e nervos", d: "Sem pele e sem músculos: órgãos, vasos, nervos e cadeia simpática", skin: 0, on: ["organs", "vessels", "nerves", "autonomic"], off: ["muscles"] },
    { n: "Esqueleto e nervos", d: "Só ossos e trajetos nervosos", skin: 0, on: ["nerves", "skeleton"], off: ["organs", "vessels", "muscles", "autonomic"] },
    { n: "Esqueleto", d: "Só ossos", skin: 0, on: ["skeleton"], off: ["organs", "vessels", "muscles", "nerves", "autonomic"] },
  ];
  const D = { depth: 0, clip: { on: false, axis: "sagital", pos: 0, flip: false }, op: {}, plane: null };
  function setDepth(i) {
    const S = ST(); D.depth = i; const p = DEPTH[i];
    S.setSkinOpacity(p.skin); if (S.setRealSkin) S.setRealSkin(!!D.real && p.skin >= .98); const ex = EXT(); if (ex && ex.S.skinMeshes) ex.S.skinMeshes.forEach(m => m.visible = p.skin > 0);
    p.on.forEach(l => S.setLayer(l, true)); p.off.forEach(l => S.setLayer(l, false));
    document.dispatchEvent(new CustomEvent("axon:depth", { detail: { depth: i } }));
  }
  function setOpacity(layer, a) {
    const ex = EXT(); if (!ex) return; const m = ex.S.meshByLayer && ex.S.meshByLayer[layer]; D.op[layer] = a;
    if (layer === "skin") { ST().setSkinOpacity(a); return; }
    if (!m) return; m.material.transparent = a < 1 || layer === "organs"; m.material.opacity = layer === "organs" ? Math.min(.88, a) : a; m.material.depthWrite = a > .6; m.material.needsUpdate = true;
  }
  // ---- corte do modelo (plano de secção global, só no nível 1)
  function bounds() { const ex = EXT(), sk = ex && ex.S.meshByLayer && ex.S.meshByLayer.skin; if (!sk) return null; sk.geometry.computeBoundingBox(); return sk.geometry.boundingBox; }
  function axisN(axis) { return axis === "axial" ? [0, 1, 0] : axis === "sagital" ? [1, 0, 0] : [0, 0, 1]; }
  function applyClip() {
    const ex = EXT(); if (!ex) return; const { T, renderer } = ex;
    if (!D.clip.on || ST().level !== 1) { renderer.clippingPlanes = []; return; }
    const n = new T.Vector3(...axisN(D.clip.axis)); if (!D.clip.flip) n.negate();
    renderer.clippingPlanes = [new T.Plane(n, D.clip.flip ? -D.clip.pos : D.clip.pos)];
  }
  document.addEventListener("axon:scale", applyClip);

  // ================================================================== imagens simuladas (TC, RM T1/T2, RX) — preenchimento por estêncil
  const GRAY = {
    tc: { skin: 72, muscles: 132, organs: 118, vessels: 175, skeleton: 246, label: "TC (janela de partes moles/osso)" },
    t1: { skin: 220, muscles: 88, organs: 122, vessels: 22, skeleton: 70, label: "RM ponderada em T1" },
    t2: { skin: 175, muscles: 58, organs: 150, vessels: 30, skeleton: 46, label: "RM ponderada em T2" },
    rx: { skin: .055, muscles: .05, organs: .04, vessels: .03, skeleton: .17, label: "Radiografia (projeção)" },
  };
  const LAYERS = ["skin", "muscles", "organs", "vessels", "skeleton"];
  const IMG = { mode: "tc", axis: "axial", pos: null, zoom: 1.6, view: "ap", rt: null, W: 360, H: 360, guide: null };
  function renderImage(cv) {
    const ex = EXT(); if (!ex || !ex.S.meshByLayer) return false; const { T, S, renderer } = ex, bb = bounds(); if (!bb) return false;
    const W = IMG.W, H = IMG.H;
    if (!IMG.rt) IMG.rt = new T.WebGLRenderTarget(W, H, { stencilBuffer: true, depthBuffer: true });
    const ctr = bb.getCenter(new T.Vector3()), size = bb.getSize(new T.Vector3());
    const prev = { target: renderer.getRenderTarget(), auto: renderer.autoClear, clip: renderer.clippingPlanes, clear: renderer.getClearColor(new T.Color()), alpha: renderer.getClearAlpha(), tone: renderer.toneMapping };
    renderer.toneMapping = T.NoToneMapping; renderer.setRenderTarget(IMG.rt); renderer.setClearColor(0x000000, 1); renderer.autoClear = false; renderer.clear(true, true, true);
    const sc = new T.Scene(); let cam;
    if (IMG.mode === "rx") {
      const lat = IMG.view === "lat", half = Math.max(size.y, lat ? size.z : size.x) / 2 / IMG.zoom * 1.04;
      cam = new T.OrthographicCamera(-half * W / H, half * W / H, half, -half, .01, 20); cam.position.copy(ctr).add(lat ? new T.Vector3(8, 0, 0) : new T.Vector3(0, 0, 8)); cam.lookAt(ctr);
      if (IMG.focus) { cam.position.y = IMG.focus; cam.lookAt(new T.Vector3(ctr.x, IMG.focus, ctr.z)); }
      renderer.clippingPlanes = [];
      LAYERS.forEach(l => { const m = S.meshByLayer[l]; if (!m) return; const k = GRAY.rx[l];
        sc.add(new T.Mesh(m.geometry, new T.MeshBasicMaterial({ color: new T.Color(k, k, k), blending: T.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, side: T.DoubleSide }))); });
      renderer.render(sc, cam);
    } else {
      const n = new T.Vector3(...axisN(IMG.axis)), pos = IMG.pos != null ? IMG.pos : ctr.dot(n);
      const span = IMG.axis === "axial" ? Math.max(size.x, size.z) * .62 : IMG.axis === "sagital" ? Math.max(size.y, size.z) / 2 : Math.max(size.y, size.x) / 2;
      const half = span / IMG.zoom * 1.02;
      cam = new T.OrthographicCamera(-half * W / H, half * W / H, half, -half, .01, 40);
      const c2 = ctr.clone(); c2.addScaledVector(n, pos - ctr.dot(n)); if (IMG.axis === "axial" && IMG.center) { c2.x = IMG.center[0]; c2.z = IMG.center[1]; }
      cam.position.copy(c2).addScaledVector(n, 10); cam.up.set(...(IMG.axis === "axial" ? [0, 0, -1] : [0, 1, 0])); cam.lookAt(c2);
      const clipP = new T.Plane(n.clone().negate(), pos);   // mantém o lado oposto à câmera
      const quad = new T.Mesh(new T.PlaneGeometry(50, 50), null); quad.position.copy(c2).addScaledVector(n, -.001); quad.lookAt(cam.position);
      const back = new T.MeshBasicMaterial({ side: T.BackSide, colorWrite: false, depthWrite: false, depthTest: false, stencilWrite: true, stencilFunc: T.AlwaysStencilFunc, stencilZPass: T.IncrementWrapStencilOp, stencilFail: T.IncrementWrapStencilOp, stencilZFail: T.IncrementWrapStencilOp });
      const front = new T.MeshBasicMaterial({ side: T.FrontSide, colorWrite: false, depthWrite: false, depthTest: false, stencilWrite: true, stencilFunc: T.AlwaysStencilFunc, stencilZPass: T.DecrementWrapStencilOp, stencilFail: T.DecrementWrapStencilOp, stencilZFail: T.DecrementWrapStencilOp });
      LAYERS.forEach(l => {
        const m = S.meshByLayer[l]; if (!m) return; const v = GRAY[IMG.mode][l] / 255;
        renderer.clear(false, false, true);
        renderer.clippingPlanes = [clipP];
        const s1 = new T.Scene(); s1.add(new T.Mesh(m.geometry, back)); renderer.render(s1, cam);
        const s2 = new T.Scene(); s2.add(new T.Mesh(m.geometry, front)); renderer.render(s2, cam);
        renderer.clippingPlanes = [];
        quad.material = new T.MeshBasicMaterial({ color: new T.Color(v, v, v), depthTest: false, depthWrite: false, stencilWrite: true, stencilRef: 0, stencilFunc: T.NotEqualStencilFunc, stencilZPass: T.KeepStencilOp });
        const s3 = new T.Scene(); s3.add(quad); renderer.render(s3, cam); quad.material.dispose();
      });
      back.dispose(); front.dispose(); quad.geometry.dispose();
      IMG.lastPos = pos; IMG.half = half;
    }
    const buf = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(IMG.rt, 0, 0, W, H, buf);
    renderer.setRenderTarget(prev.target); renderer.autoClear = prev.auto; renderer.clippingPlanes = prev.clip; renderer.setClearColor(prev.clear, prev.alpha); renderer.toneMapping = prev.tone;
    // pós-processamento: vira a imagem, ruído quântico, borramento leve e contraste por modalidade
    const ctx = cv.getContext("2d"), im = ctx.createImageData(W, H), rnd = g.AxonModel ? g.AxonModel.mulberry32(7) : Math.random;
    // filtro de mediana 3×3 nos cortes: remove pontos soltos de malhas decimadas não fechadas
    const gray = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) gray[i] = buf[i * 4];
    let src = gray; if (IMG.mode !== "rx") { src = new Uint8Array(W * H); const nb = new Uint8Array(9);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { let k = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) nb[k++] = gray[(y + dy) * W + x + dx]; nb.sort(); src[y * W + x] = nb[4]; } }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = ((H - 1 - y) * W + x) * 4, o = (y * W + x) * 4; let v = src[(H - 1 - y) * W + x];
      if (IMG.mode === "rx") v = 255 * Math.pow(v / 255, .75);
      v = clamp(v + (v > 4 ? (rnd() - .5) * (IMG.mode === "tc" ? 9 : 12) : (rnd() - .5) * 4), 0, 255);
      im.data[o] = im.data[o + 1] = im.data[o + 2] = v; im.data[o + 3] = 255;
    }
    ctx.putImageData(im, 0, 0); ctx.filter = "blur(.6px)"; ctx.drawImage(cv, 0, 0); ctx.filter = "none";
    // anotações: orientação e régua (1 unidade da cena = mm_per_unit)
    const mmu = (ex.S.anat && ex.S.anat.mm_per_unit) || 448.6;
    ctx.fillStyle = "#7ff7e0"; ctx.font = "600 11px JetBrains Mono, monospace";
    const L = IMG.mode === "rx" ? (IMG.view === "lat" ? ["A", "P", "S", "I"] : ["D", "E", "S", "I"]) : IMG.axis === "axial" ? ["D", "E", "A", "P"] : IMG.axis === "sagital" ? ["A", "P", "S", "I"] : ["D", "E", "S", "I"];
    ctx.fillText(L[0], 6, H / 2); ctx.fillText(L[1], W - 14, H / 2); ctx.fillText(L[2], W / 2 - 4, 14); ctx.fillText(L[3], W / 2 - 4, H - 6);
    const halfU = IMG.mode === "rx" ? null : IMG.half; if (halfU) { const px50 = 50 / mmu / (2 * halfU) * W; ctx.fillRect(W - 14 - px50, H - 18, px50, 3); ctx.fillText("5 cm", W - 14 - px50, H - 22); }
    ctx.fillText(GRAY[IMG.mode].label + (IMG.mode === "rx" ? "" : ` · ${IMG.axis} ${((IMG.lastPos - (bb.min[IMG.axis === "axial" ? "y" : IMG.axis === "sagital" ? "x" : "z"])) * mmu / 10).toFixed(0)} cm`), 8, H - 6 - (halfU ? 18 : 0));
    return true;
  }
  // plano-guia no 3D mostrando onde está o corte
  function guide(on) {
    const ex = EXT(); if (!ex) return; const { T, scene } = ex;
    if (IMG.guide) { scene.remove(IMG.guide); IMG.guide.geometry.dispose(); IMG.guide = null; }
    if (!on || IMG.mode === "rx" || ST().level !== 1) return; const bb = bounds(); if (!bb) return; const size = bb.getSize(new T.Vector3()), ctr = bb.getCenter(new T.Vector3());
    const n = new T.Vector3(...axisN(IMG.axis)), pos = IMG.pos != null ? IMG.pos : ctr.dot(n);
    const w = IMG.axis === "axial" ? [size.x * 1.3, size.z * 1.6] : IMG.axis === "sagital" ? [size.z * 1.6, size.y * 1.05] : [size.x * 1.15, size.y * 1.05];
    const m = new T.Mesh(new T.PlaneGeometry(w[0], w[1]), new T.MeshBasicMaterial({ color: 0x3ee6c5, transparent: true, opacity: .16, side: T.DoubleSide, depthWrite: false }));
    m.position.copy(ctr).addScaledVector(n, pos - ctr.dot(n)); if (IMG.axis === "axial") m.rotation.x = -Math.PI / 2; else if (IMG.axis === "sagital") m.rotation.y = Math.PI / 2;
    m.renderOrder = 30; scene.add(m); IMG.guide = m;
  }

  // ================================================================== EMG de superfície sintético
  const EMG = { t: 0, buf: new Float32Array(600), i: 0, rms: 0 };
  function motorDrive() {
    const A = g.AxonApp; if (!A) return 0; const st = A.state, mod = A.MODS.find(m => m.id === st.mod); if (!mod || mod.kind !== "elec") return 0;
    const o = st.out || A.compute(); if (!o.ab) return 0;
    const iAa = o.ab * Math.pow(9 / 15, 1.1266) * 3.2;   // fibra motora Aα (15 µm) num tronco mais profundo [PREMISSA]
    return clamp((st.p.I / iAa - 1) / 1.5, 0, 1) * (g.AxonSim && g.AxonSim.running === false ? .6 : 1);
  }
  function drawEMG(cv, dt) {
    const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, A = g.AxonApp, f = A ? A.state.p.f || 0 : 0, drive = motorDrive();
    const per = f > 0 ? 1 / Math.min(f, 200) : 1e9, n = Math.max(1, Math.round(dt * 2000));
    let acc = 0;
    for (let k = 0; k < n; k++) {
      EMG.t += 1 / 2000; const ph = EMG.t % per; let v = (Math.random() - .5) * 18 + Math.sin(EMG.t * 2 * Math.PI * 60) * 2;     // ruído de fundo + 60 Hz
      if (drive > 0 && ph < .02) { const x = ph * 1000; v += 2400 * drive * (Math.exp(-((x - 6) ** 2) / 4) - .7 * Math.exp(-((x - 10) ** 2) / 6)); }  // onda M (bifásica)
      if (f > 0 && ph < .0006) v += 800;   // artefato de estímulo
      EMG.buf[EMG.i = (EMG.i + 1) % EMG.buf.length] = v; acc += v * v;
    }
    EMG.rms = EMG.rms * .9 + Math.sqrt(acc / n) * .1;
    ctx.fillStyle = "#04120f"; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = "rgba(127,247,224,.12)"; for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    ctx.strokeStyle = "#7ff7e0"; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let x = 0; x < W; x++) { const j = (EMG.i + 1 + Math.floor(x / W * EMG.buf.length)) % EMG.buf.length, y = H / 2 - clamp(EMG.buf[j] / 2600, -1, 1) * H * .45; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    return { rms: EMG.rms, drive };
  }

  // ================================================================== paciente: sexo, idade, IMC, fototipo — deformação da anatomia
  const FITZ = { I: [.95, .80, .72], II: [.90, .72, .62], III: [.86, .62, .52], IV: [.72, .50, .38], V: [.55, .36, .26], VI: [.38, .25, .18] };
  const PT = { sex: "M", age: 45, height: 175, weight: 75, fitz: "III", applied: null };
  const bmi = () => PT.weight / Math.pow(PT.height / 100, 2);
  function lm(ex) {
    const sk = ex.S.meshByLayer.skeleton; if (!sk) return null; const pa = sk.geometry.userData.p0 || sk.geometry.attributes.position.array;
    const cy = re => { const ps = sk.userData.parts.filter(p => re.test(p.name)); if (!ps.length) return null; let s = 0, n = 0; ps.forEach(p => { for (let j = p.v0; j < p.v0 + p.nv; j += 7) { s += pa[j * 3 + 1]; n++; } }); return s / n; };
    const yh = cy(/hip bone/), ys = cy(/clavicle/), yc = cy(/sternum/), bb = ex.S.meshByLayer.skin.geometry.boundingBox || (ex.S.meshByLayer.skin.geometry.computeBoundingBox(), ex.S.meshByLayer.skin.geometry.boundingBox);
    return yh && ys ? { yh, ys, yc: yc || (yh + ys) / 2 + (ys - yh) * .3, foot: bb.min.y } : null;
  }
  function warpFn(L, sex, dfat) {
    const s = sex === "F" ? 1 : 0, T0 = L.ys - L.yh, yw = L.yh + T0 * .42, G = (y, c, w) => Math.exp(-((y - c) ** 2) / (2 * w * w));
    const hScale = s ? .955 : 1, wScale = s ? .965 : 1;
    return (x, y, z, isSkin, nx, ny, nz) => {
      const sx = 1 + s * (.075 * G(y, L.yh, T0 * .22) - .06 * G(y, yw, T0 * .14) - .075 * G(y, L.ys, T0 * .12));
      let X = x * sx * wScale, Y = L.foot + (y - L.foot) * hScale, Z = z * wScale * (1 + s * .02 * G(y, L.yh, T0 * .25));
      if (isSkin) {
        if (s && z > 0) { const bx = T0 * .23, sg = T0 * .16, A = T0 * .13; Z += A * (Math.exp(-(((x - bx) ** 2) + (y - L.yc) ** 2) / (2 * sg * sg)) + Math.exp(-(((x + bx) ** 2) + (y - L.yc) ** 2) / (2 * sg * sg))); }
        if (dfat) { const w = .25 + .75 * G(y, (L.yh + L.yc) / 2, T0 * .55) + .4 * G(y, L.yh - T0 * .35, T0 * .3); X += nx * dfat * w; Y += ny * dfat * w * .4; Z += nz * dfat * w; }
      }
      return [X, Y, Z];
    };
  }
  function applyPatient() {
    const ex = EXT(); if (!ex || !ex.S.meshByLayer || !ex.S.meshByLayer.skeleton) return false; const { S, T } = ex;
    ["skin", "skeleton", "organs", "vessels", "muscles"].forEach(k => { const m = S.meshByLayer[k]; if (m && !m.geometry.userData.p0) { m.geometry.userData.p0 = m.geometry.attributes.position.array.slice(); if (k === "skin") m.geometry.userData.n0 = m.geometry.attributes.normal.array.slice(); } });
    const L = lm(ex); if (!L) return false;
    const dfat = clamp((bmi() - 23) * .0055, -.012, .1) * (PT.sex === "F" ? 1.12 : 1);   // ≈ 2,6 mm de tecido adiposo por ponto de IMC [PREMISSA]
    const W = warpFn(L, PT.sex, dfat);
    const warpMesh = (m, isSkin) => { const p0 = m.geometry.userData.p0, n0 = m.geometry.userData.n0, a = m.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) { const r = W(p0[i], p0[i + 1], p0[i + 2], isSkin, n0 ? n0[i] : 0, n0 ? n0[i + 1] : 0, n0 ? n0[i + 2] : 0); a[i] = r[0]; a[i + 1] = r[1]; a[i + 2] = r[2]; }
      m.geometry.attributes.position.needsUpdate = true; if (isSkin) m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere(); m.geometry.computeBoundingBox(); };
    ["skin", "skeleton", "organs", "vessels", "muscles"].forEach(k => S.meshByLayer[k] && warpMesh(S.meshByLayer[k], k === "skin"));
    // nervos, pontos reflexos e etiquetas acompanham
    [...S.layers.nerves.children, ...S.layers.autonomic.children].forEach(m => { if (!m.geometry || !m.geometry.attributes.position) return; if (!m.geometry.userData.p0) m.geometry.userData.p0 = m.geometry.attributes.position.array.slice(); warpMesh(m, false);
      if (m.userData.p0pos == null && m.position.lengthSq()) m.userData.p0pos = m.position.clone(); if (m.userData.p0pos) { const r = W(m.userData.p0pos.x, m.userData.p0pos.y, m.userData.p0pos.z, false); m.position.set(...r); } });
    if (S.rx) S.rx.markers.forEach(k => { const r = W(k.r.p[0], k.r.p[1], k.r.p[2], true, k.r.n[0], k.r.n[1], k.r.n[2]); k.grp.position.set(...r); const lb = S.labels.find(l => l.el === k.lb); if (lb) lb.pos.set(...r); });
    if (S.skin && S.skin.uniforms.tone) S.skin.uniforms.tone.value.set(...FITZ[PT.fitz]);
    // coerência biofísica: hipoderme do perfil acompanha o IMC; idade avançada → leve desmielinização [PREMISSA]
    const A = g.AxonApp; if (A) { A.state.v.fat = +clamp((bmi() - 22) * .06 + (PT.sex === "F" ? .15 : 0), 0, 1.2).toFixed(2); if (PT.age > 65) A.state.v.demy = Math.max(A.state.v.demy, +((PT.age - 65) / 60).toFixed(2)); A.renderRight(); A.update(); }
    PT.applied = { ...PT, bmi: bmi() }; document.dispatchEvent(new CustomEvent("axon:patient", { detail: PT.applied }));
    return true;
  }
  // texto livre → paciente + caso (IA no servidor; sem servidor, leitura por regras)
  function parseLocal(txt) {
    const t = txt.toLowerCase(), out = {};
    if (/\b(mulher|feminin|paciente do sexo feminino|senhora|ela )/.test(t)) out.sex = "F"; else if (/\b(homem|masculin|senhor|ele )/.test(t)) out.sex = "M";
    const a = t.match(/(\d{1,3})\s*anos/); if (a) out.age = +a[1];
    const h = t.match(/(\d[.,]\d{2})\s*m\b|(\d{3})\s*cm/); if (h) out.height = h[1] ? parseFloat(h[1].replace(",", ".")) * 100 : +h[2];
    const w = t.match(/(\d{2,3})\s*kg/); if (w) out.weight = +w[1];
    const im = t.match(/imc\s*(?:de\s*)?(\d{2}(?:[.,]\d)?)/); if (im && !w) out.bmi = parseFloat(im[1].replace(",", "."));
    const f = t.match(/fototipo\s*(vi|iv|v|i{1,3}|[1-6])\b/); if (f) out.fitz = { "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V", "6": "VI" }[f[1]] || f[1].toUpperCase();
    const e = t.match(/(?:eva|dor)\s*(?:de\s*)?(\d{1,2})(?:\s*\/\s*10)?/); if (e) out.eva = Math.min(10, +e[1]);
    const SITES = [[/lomb|ciát|ciat|l5|s1/, ["L5", "S1"], "lombar"], [/cervic|pescoço|c6|c7/, ["C6", "C7"], "cervical"], [/joelho/, ["L3", "L4"], "joelho"], [/ombro/, ["C5", "C6"], "ombro"], [/punho|túnel|tunel|carpo|mão/, ["C6", "C7"], "punho e mão"], [/cabeça|enxaqueca|cefale|migr/, ["V1", "C2"], "cabeça"], [/face|trigêm|trigem/, ["V2"], "face"], [/fibromial|difus|generaliz/, ["C5", "T4", "L3"], "difusa"], [/pé|neuropatia diab/, ["L4", "L5", "S1"], "pés"], [/tórax|torác|costela/, ["T4", "T5"], "torácica"]];
    for (const [re, d, n] of SITES) if (re.test(t)) { out.dermatomes = d; out.site = n; break; }
    out.origin = /queima|choque|formig|parest|neurop|radic/.test(t) ? "neuropática" : /difusa|fibromial|central/.test(t) ? "nociplástica" : "nociceptiva";
    return out;
  }
  async function fromPrompt(txt) {
    let r = null;
    const tk = g.AxonBoot && g.AxonBoot.task("ai-patient", "Interpretando a descrição do caso por IA", 10, "paciente e caso fictícios · sem dados identificáveis"); tk && tk.progress(.3, "enviando ao servidor…");
    try { const res = await fetch("api/ai/patient", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: txt }) }); tk && tk.progress(.8, "recebendo…"); if (res.ok) { const j = await res.json(); if (j.mode === "ia") r = j.data; } } catch (e) {}
    tk && (r ? tk.done("interpretado pela IA") : tk.done("leitura local (IA indisponível)"));
    const loc = parseLocal(txt), d = Object.assign({}, loc, r || {});
    if (d.sex) PT.sex = d.sex; if (d.age) PT.age = clamp(d.age, 1, 110); if (d.height) PT.height = clamp(d.height, 120, 215);
    if (d.weight) PT.weight = clamp(d.weight, 30, 220); else if (d.bmi) PT.weight = Math.round(d.bmi * Math.pow(PT.height / 100, 2));
    if (d.fitz && FITZ[d.fitz]) PT.fitz = d.fitz;
    applyPatient();
    // caso clínico fictício (sem dados identificáveis) para o simulador e o plano
    const C = g.AxonCases; let caseId = null;
    if (C && (d.dermatomes || d.eva)) {
      const cs = { schema: "axon-case/1", id: "prompt-" + Date.now().toString(36), title: d.title || `Caso descrito · dor ${d.site || "localizada"}`, fictional: true,
        patient: { age: PT.age, sex: PT.sex, bmi: +bmi().toFixed(1) }, summary: txt.slice(0, 600),
        pain: { origin: d.origin || "nociceptiva", mechanism: d.mechanism || "Descrito pelo usuário (texto livre)", baseline: d.eva ?? 6, dermatomes: (d.dermatomes || ["L5"]).filter(x => C.DERMS.includes(x)), structures: d.structures || [], descriptors: d.descriptors || [], inflammation: d.inflammation ?? .3, sensitization: d.sensitization ?? (d.origin === "nociplástica" ? .65 : .35) },
        autonomic: { hr: 76, rmssd: 34 }, proposals: [] };
      if (!cs.pain.dermatomes.length) cs.pain.dermatomes = ["L5"];
      const err = C.validate(cs); if (!err.length) { C.list.unshift(cs); caseId = cs.id; try { const keep = JSON.parse(localStorage.getItem("axon.cases") || "[]"); keep.unshift(cs); localStorage.setItem("axon.cases", JSON.stringify(keep.slice(0, 20))); } catch (e) {} }
    }
    return { data: d, ai: !!r, caseId };
  }

  // ================================================================== janelas
  function depthWin(b) {
    const ex = EXT(), cur = D.depth;
    b.innerHTML = `<div class="card"><h4>Profundidade de visualização</h4>
      <input type="range" id="dpR" min="0" max="5" step="1" value="${cur}" style="width:100%" aria-label="Profundidade"><div class="dsteps">${DEPTH.map((d, i) => `<button class="${i === cur ? "on" : ""}" data-d="${i}" title="${esc(d.d)}"><b>${i}</b>${esc(d.n)}</button>`).join("")}</div>
      <p class="note" id="dpN">${esc(DEPTH[cur].d)}</p></div>
      <div class="card"><h4>Aparência da pele</h4><label class="rowc"><input type="checkbox" id="realSk" ${D.real ? "checked" : ""}> Pele realista (opaca, com textura, brilho e espalhamento)</label>
        <label class="rowc"><input type="checkbox" id="dermSk" ${D.derm !== false ? "checked" : ""}> Mostrar dermátomos</label><p class="note">O tom acompanha o fototipo do paciente.</p></div>
      <div class="card"><h4>Camadas</h4>${[["skin", "Pele"], ["muscles", "Músculos"], ["organs", "Órgãos"], ["vessels", "Vasos"], ["skeleton", "Ossos"]].map(([k, n]) => `<div class="ctl"><label><span>${n}</span><output>${Math.round((D.op[k] ?? 1) * 100)} %</output></label><input type="range" min="0" max="1" step=".05" value="${D.op[k] ?? 1}" data-op="${k}"></div>`).join("")}</div>
      <div class="card"><h4>Corte (secção)</h4><label class="rowc"><input type="checkbox" id="clOn" ${D.clip.on ? "checked" : ""}> Cortar o modelo</label>
        <div class="seg" id="clAx">${["sagital", "coronal", "axial"].map(a => `<button data-a="${a}" class="${a === D.clip.axis ? "on" : ""}">${a}</button>`).join("")}</div>
        <div class="ctl"><label><span>Posição</span><output id="clV"></output></label><input type="range" id="clP" min="0" max="1" step=".002" value=".5"></div>
        <label class="rowc"><input type="checkbox" id="clF" ${D.clip.flip ? "checked" : ""}> Mostrar o outro lado</label>
        <p class="note">O corte vale só no nível 1. Para ver a secção em tons de cinza, abra <b>Imagens</b>.</p></div>`;
    $("#realSk", b).onchange = e => { D.real = e.target.checked; if (D.real) setDepth(0); ST().setRealSkin(D.real); };
    $("#dermSk", b).onchange = e => { D.derm = e.target.checked; ST().setLayer("dermatomes", D.derm); };
    $("#dpR", b).oninput = e => { setDepth(+e.target.value); depthWin(b); };
    $$(".dsteps button", b).forEach(x => x.onclick = () => { setDepth(+x.dataset.d); depthWin(b); });
    $$("[data-op]", b).forEach(i => i.oninput = () => { setOpacity(i.dataset.op, +i.value); i.previousElementSibling.querySelector("output").textContent = Math.round(i.value * 100) + " %"; });
    const bb = bounds(), ax = () => D.clip.axis === "axial" ? "y" : D.clip.axis === "sagital" ? "x" : "z";
    const setPos = f => { if (!bb) return; D.clip.pos = bb.min[ax()] + (bb.max[ax()] - bb.min[ax()]) * f; const mm = (D.clip.pos - bb.min[ax()]) * ((ex && ex.S.anat && ex.S.anat.mm_per_unit) || 448.6) / 10; $("#clV", b).textContent = mm.toFixed(0) + " cm"; applyClip(); };
    const pr = $("#clP", b); if (bb) pr.value = clamp((D.clip.pos - bb.min[ax()]) / (bb.max[ax()] - bb.min[ax()]), 0, 1) || .5; setPos(+pr.value);
    pr.oninput = () => setPos(+pr.value); $("#clOn", b).onchange = e => { D.clip.on = e.target.checked; applyClip(); }; $("#clF", b).onchange = e => { D.clip.flip = e.target.checked; applyClip(); };
    $$("#clAx button", b).forEach(x => x.onclick = () => { D.clip.axis = x.dataset.a; depthWin(b); });
  }
  let imgTimer = 0, emgRaf = 0;
  function imageWin(b) {
    const bb = bounds();
    b.innerHTML = `<div class="seg" id="imM">${[["tc", "TC"], ["t1", "RM T1"], ["t2", "RM T2"], ["rx", "RX"], ["emg", "EMG"]].map(([k, n]) => `<button data-m="${k}" class="${(IMG.tab || "tc") === k ? "on" : ""}">${n}</button>`).join("")}</div>
      <div id="imBody"></div><p class="note">${tag("pre")} Imagens reconstruídas da malha 3D do simulador (tons de cinza por tecido, ruído e borramento simulados). Não são exames de pacientes reais e não servem para diagnóstico.</p>`;
    $$("#imM button", b).forEach(x => x.onclick = () => { IMG.tab = x.dataset.m; if (x.dataset.m !== "emg") IMG.mode = x.dataset.m; imageWin(b); });
    const body = $("#imBody", b); cancelAnimationFrame(emgRaf);
    if ((IMG.tab || "tc") === "emg") {
      body.innerHTML = `<canvas id="emgC" width="420" height="170" style="width:100%;border-radius:10px"></canvas><div class="kv"><span>RMS</span><b id="emgR">—</b><span>Recrutamento motor (Aα)</span><b id="emgD">—</b></div>
        <p class="note">EMG de superfície sobre o músculo-alvo: onda M a cada pulso quando a corrente alcança as fibras motoras, artefato de estímulo e ruído de fundo. Ajuste a amplitude e a frequência no painel de parâmetros. ${tag("pre")}</p>`;
      let last = performance.now(); const loop = now => { const cv = $("#emgC", b); if (!cv) return; const r = drawEMG(cv, Math.min(.05, (now - last) / 1000)); last = now; $("#emgR", b).textContent = r.rms.toFixed(0) + " µV"; $("#emgD", b).textContent = Math.round(r.drive * 100) + " %"; emgRaf = requestAnimationFrame(loop); }; emgRaf = requestAnimationFrame(loop);
      guide(false); return;
    }
    const isRX = IMG.mode === "rx", ax = IMG.axis === "axial" ? "y" : IMG.axis === "sagital" ? "x" : "z";
    body.innerHTML = `${isRX ? `<div class="seg" id="imV"><button data-v="ap" class="${IMG.view !== "lat" ? "on" : ""}">Ântero-posterior</button><button data-v="lat" class="${IMG.view === "lat" ? "on" : ""}">Perfil</button></div>`
      : `<div class="seg" id="imA">${["axial", "sagital", "coronal"].map(a => `<button data-a="${a}" class="${a === IMG.axis ? "on" : ""}">${a}</button>`).join("")}</div>
         <div class="ctl"><label><span>Nível do corte</span><output id="imPv"></output></label><input type="range" id="imP" min="0" max="1" step=".002"></div>`}
      <div class="ctl"><label><span>Zoom</span><output>${IMG.zoom.toFixed(1)}×</output></label><input type="range" id="imZ" min="1" max="4" step=".1" value="${IMG.zoom}"></div>
      <canvas id="imC" width="${IMG.W}" height="${IMG.H}" style="width:100%;aspect-ratio:1;border-radius:12px;background:#000"></canvas>
      <div class="row" style="gap:6px;margin-top:6px"><button class="btn ghost" id="imSync">Cortar o 3D neste plano</button><button class="btn ghost" id="imHere">Corte na estrutura selecionada</button></div>`;
    const draw = () => { clearTimeout(imgTimer); imgTimer = setTimeout(() => { const cv = $("#imC", b); if (cv && !renderImage(cv)) { const c = cv.getContext("2d"); c.fillStyle = "#000"; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = "#9fc"; c.font = "13px sans-serif"; c.fillText("Aguardando a anatomia 3D carregar…", 20, 40); } guide(!isRX); }, 60); };
    if (isRX) $$("#imV button", b).forEach(x => x.onclick = () => { IMG.view = x.dataset.v; imageWin(b); });
    else {
      $$("#imA button", b).forEach(x => x.onclick = () => { IMG.axis = x.dataset.a; IMG.pos = null; imageWin(b); });
      const pr = $("#imP", b), mmu = (EXT() && EXT().S.anat && EXT().S.anat.mm_per_unit) || 448.6;
      const setP = f => { if (!bb) return; IMG.pos = bb.min[ax] + (bb.max[ax] - bb.min[ax]) * f; $("#imPv", b).textContent = ((IMG.pos - bb.min[ax]) * mmu / 10).toFixed(0) + " cm"; draw(); };
      pr.value = bb && IMG.pos != null ? (IMG.pos - bb.min[ax]) / (bb.max[ax] - bb.min[ax]) : IMG.axis === "axial" ? .55 : .5; pr.oninput = () => setP(+pr.value); setP(+pr.value);
      $("#imSync", b).onclick = () => { D.clip = { on: true, axis: IMG.axis, pos: IMG.pos, flip: false }; applyClip(); };
      $("#imHere", b).onclick = () => { const s = g.AxonApp && g.AxonApp.state.structure; if (!s || !s.point || !bb) return; IMG.pos = s.point[ax === "y" ? 1 : ax === "x" ? 0 : 2]; if (IMG.axis === "axial") IMG.center = [s.point[0], s.point[2]]; imageWin(b); };
    }
    $("#imZ", b).oninput = e => { IMG.zoom = +e.target.value; e.target.previousElementSibling.querySelector("output").textContent = IMG.zoom.toFixed(1) + "×"; draw(); };
    draw();
  }
  function patientWin(b) {
    const B = bmi();
    b.innerHTML = `<div class="card"><h4>Descreva o paciente e o caso</h4><textarea id="ptT" rows="4" style="width:100%" placeholder="Ex.: Mulher, 52 anos, 1,62 m, 78 kg, fototipo IV. Dor lombar irradiada para a perna esquerda há 3 meses, queimação, EVA 7, pior ao sentar."></textarea>
      <div class="row" style="gap:6px"><button class="btn" id="ptGo">Gerar paciente e caso</button><span class="note" id="ptSt"></span></div><p class="note">Use apenas casos fictícios ou anonimizados: não informe nome, documentos ou datas de nascimento.</p></div>
      <div class="card"><h4>Aspecto</h4><div class="seg" id="ptSex"><button data-s="M" class="${PT.sex === "M" ? "on" : ""}">♂ Homem</button><button data-s="F" class="${PT.sex === "F" ? "on" : ""}">♀ Mulher</button></div>
        ${[["age", "Idade", 18, 95, 1, "anos"], ["height", "Altura", 140, 205, 1, "cm"], ["weight", "Peso", 40, 160, 1, "kg"]].map(([k, l, a, z, s, u]) => `<div class="ctl"><label><span>${l}</span><output>${PT[k]} ${u}</output></label><input type="range" data-k="${k}" min="${a}" max="${z}" step="${s}" value="${PT[k]}"></div>`).join("")}
        <p class="note">IMC <b id="ptB">${B.toFixed(1)}</b> kg/m² · hipoderme do perfil ${(g.AxonApp ? g.AxonApp.state.v.fat : 0)} mm a mais</p>
        <div class="ctl"><label><span>Fototipo (Fitzpatrick)</span></label><div class="seg" id="ptF">${Object.keys(FITZ).map(k => `<button data-f="${k}" class="${PT.fitz === k ? "on" : ""}" style="background:rgb(${FITZ[k].map(v => Math.round(v * 255)).join(",")});color:${["V", "VI", "IV"].includes(k) ? "#fff" : "#222"}">${k}</button>`).join("")}</div></div>
        <button class="btn" id="ptAp">Aplicar ao modelo</button></div>
      <div class="note">${tag("pre")} A forma feminina, a estatura e o tecido adiposo são deformações aproximadas da mesma malha anatômica (BodyParts3D, masculina): servem para ensino, não reproduzem a anatomia de uma pessoa.</div>`;
    $$("#ptSex button", b).forEach(x => x.onclick = () => { PT.sex = x.dataset.s; patientWin(b); });
    $$("#ptF button", b).forEach(x => x.onclick = () => { PT.fitz = x.dataset.f; patientWin(b); applyPatient(); });
    $$("[data-k]", b).forEach(i => i.oninput = () => { PT[i.dataset.k] = +i.value; i.previousElementSibling.querySelector("output").textContent = i.value + " " + { age: "anos", height: "cm", weight: "kg" }[i.dataset.k]; $("#ptB", b).textContent = bmi().toFixed(1); });
    $("#ptAp", b).onclick = () => { const ok = applyPatient(); $("#ptSt", b).textContent = ok ? "" : "aguarde a anatomia carregar"; patientWin(b); };
    $("#ptGo", b).onclick = async () => { const t = $("#ptT", b).value.trim(); if (!t) return; $("#ptSt", b).textContent = "interpretando…";
      const r = await fromPrompt(t); patientWin(b); $("#ptSt", b).textContent = (r.ai ? "interpretado pela IA" : "interpretado por regras (sem IA)") + (r.caseId ? " · caso criado" : "");
      if (r.caseId) document.dispatchEvent(new CustomEvent("axon:case", { detail: { id: r.caseId } })); };
  }
  function boot() {
    const A = g.AxonApp; if (!A || !A.registerApp || !g.AxonStage) return setTimeout(boot, 80);
    A.registerApp("depth", { title: "depth", w: 360, h: 560, render: depthWin });
    A.registerApp("imaging", { title: "imaging", w: 420, h: 640, render: imageWin, onClose: () => { guide(false); cancelAnimationFrame(emgRaf); } });
    A.registerApp("patient", { title: "patient", w: 380, h: 640, render: patientWin });
  }
  boot();
  g.AxonDissect = { setDepth, setOpacity, applyClip, renderImage, applyPatient, fromPrompt, parseLocal, PT, D, IMG, DEPTH, motorDrive };
})(window);
