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
  const PT = { sex: "M", age: 45, height: 175, weight: 75, fitz: "III", preg: 0, ascites: 0, waist: 0, applied: null };
  const bmi = () => PT.weight / Math.pow(PT.height / 100, 2);
  // ------------------------------------------------------------------ corpo do paciente (v0.12)
  // Uma única malha anatômica (BodyParts3D, masculina, ~165 cm) é deformada para o paciente simulado:
  // estatura, sexo, adiposidade (IMC), caquexia, gestação (útero que cresce com a idade gestacional e empurra
  // a parede abdominal), ascite e perímetro abdominal-alvo. Tudo [PREMISSA] salvo onde indicado.
  const MMU = 448.563, U = 10 / MMU;                 // 1 cm em unidades da malha
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const G1 = (d, s) => Math.exp(-(d * d) / (2 * s * s));
  const HIDE_F = /penis|testis|prostate|seminal vesicle/i;
  let LM = null;
  function partVerts(m, re, step = 3) { const a = m.geometry.userData.p0 || m.geometry.attributes.position.array, out = [];
    m.userData.parts.filter(p => re.test(p.name)).forEach(p => { for (let j = p.v0; j < p.v0 + p.nv; j += step) out.push([a[j * 3], a[j * 3 + 1], a[j * 3 + 2]]); }); return out; }
  function hull(pts) { pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (pts.length < 3) return pts; const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = []; for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); }
  const perim = h => h.reduce((s, p, i) => s + Math.hypot(p[0] - h[(i + 1) % h.length][0], p[1] - h[(i + 1) % h.length][1]), 0);
  function lm(ex) {
    const S = ex.S, sk = S.meshByLayer.skeleton, skin = S.meshByLayer.skin; if (!sk || !skin) return null;
    if (LM && LM.skin === skin) return LM;
    const mean = (v, k) => v.reduce((s, q) => s + q[k], 0) / Math.max(1, v.length);
    const hip = partVerts(sk, /hip bone/), cla = partVerts(sk, /clavicle/), ste = partVerts(sk, /sternum/); if (!hip.length || !cla.length) return null;
    const yh = mean(hip, 1), ys = mean(cla, 1), yc = ste.length ? mean(ste, 1) : (yh + ys) / 2 + (ys - yh) * .3;
    const crest = Math.max(...hip.map(q => q[1])), xiph = ste.length ? Math.min(...ste.map(q => q[1])) : yc - (ys - yh) * .2;
    let mid = hip.filter(q => Math.abs(q[0]) < .03); if (mid.length < 5) mid = hip.filter(q => Math.abs(q[0]) < .06);
    const sym = { y: mean(mid, 1), z: Math.max(...mid.map(q => q[2])) }, hw = Math.max(...hip.map(q => Math.abs(q[0])));
    // coluna: face anterior por faixa de 1 cm
    const spv = partVerts(sk, /vertebra|sacrum|coccyx/, 2), SPB = new Map(); spv.forEach(q => { const k = Math.round(q[1] / U); SPB.set(k, Math.max(SPB.get(k) ?? -9, q[2])); });
    const zSpine = y => { const k = Math.round(y / U); for (let d = 0; d < 8; d++) { if (SPB.has(k + d)) return SPB.get(k + d); if (SPB.has(k - d)) return SPB.get(k - d); } return sym.z - 10 * U; };
    // genitais masculinos (para a forma feminina)
    const org = S.meshByLayer.organs, gv = org ? partVerts(org, /penis|testis/) : []; const gen = gv.length ? { x0: Math.min(...gv.map(q => q[0])) - 1.5 * U, x1: Math.max(...gv.map(q => q[0])) + 1.5 * U, y0: Math.min(...gv.map(q => q[1])) - 2 * U, y1: Math.max(...gv.map(q => q[1])) + 1 * U, z0: Math.min(...gv.map(q => q[2])) - 1 * U } : null;
    // mapa da face anterior da pele no tronco (célula de 1 cm)
    const sa = skin.geometry.userData.p0 || skin.geometry.attributes.position.array, FR = new Map(), fk = (x, y) => Math.round(x / U) * 100000 + Math.round(y / U);
    const ylo = sym.y - 12 * U, yhi = ys; const slice = [];
    const yU = crest;                                     // umbigo ≈ nível da crista ilíaca (L4) [LITERATURA: anatomia de superfície]
    for (let i = 0; i < sa.length; i += 3) { const x = sa[i], y = sa[i + 1], z = sa[i + 2]; if (y < ylo || y > yhi || Math.abs(x) > hw * 1.35) continue;
      if (z > 0) { const k = fk(x, y); if (!FR.has(k) || FR.get(k) < z) FR.set(k, z); }
      if (Math.abs(y - yU) < .6 * U && Math.abs(x) <= hw * 1.02) { const n0 = skin.geometry.userData.n0; slice.push([x, z, n0 ? n0[i] : 0, n0 ? n0[i + 1] : 0, n0 ? n0[i + 2] : 0]); } }
    const front = (x, y) => { const i0 = Math.round(x / U), j0 = Math.round(y / U); for (let r = 0; r < 4; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) { const v = FR.get((i0 + di) * 100000 + j0 + dj); if (v !== undefined) return v; } return sym.z; };
    const cz = slice.length ? (Math.min(...slice.map(q => q[1])) + Math.max(...slice.map(q => q[1]))) / 2 : 0;
    const bb = skin.geometry.boundingBox || (skin.geometry.computeBoundingBox(), skin.geometry.boundingBox);
    LM = { skin, yh, ys, yc, crest, xiph, sym, hw, zSpine, gen, front, yU, cz, slice, foot: bb.min.y, top: bb.max.y };
    return LM;
  }
  // altura do fundo uterino acima da sínfise, em cm. Regra de McDonald: AFU (cm) ≈ semanas entre 20 e 36 [LITERATURA];
  // 12 sem: fundo na sínfise; 20 sem: na cicatriz umbilical [LITERATURA]; depois de 36 sem, leve descida (insinuação) [PREMISSA]
  const sfh = w => w < 12 ? 0 : w < 20 ? (w - 12) * 2.5 : w <= 36 ? w : 36 - (w - 36) * .4;
  function uterus(L, w, dfat) {
    const len = w < 12 ? 7.5 + w * .4 : Math.max(12, .9 * sfh(w) + 3);        // não grávido ≈ 7,5 × 5 × 2,5 cm [LITERATURA]; proporções do útero gravídico [PREMISSA]
    const a = Math.max(2.5, .36 * len) * U, b = len / 2 * U, c = Math.max(1.4, .33 * len) * U, cy = L.sym.y - 2 * U + b;
    const zPel = L.sym.z - 5 * U, zAb = L.zSpine(cy) + 1 * U + c, cz = zPel + (zAb - zPel) * smooth(10, 20, w);
    return { a, b, c, cy, cz, wall: (1.5 * U + Math.max(0, dfat)), w };
  }
  function makeWarp(L, o) {
    const s = o.sex === "F" ? 1 : 0, T0 = L.ys - L.yh, yw = L.yh + T0 * .42, G = (y, c, w) => Math.exp(-((y - c) ** 2) / (2 * w * w));
    const wS = s ? .965 : 1, hS = o.hS, wst = o.wasting, Ut = o.ut, asc = [0, 0, 2, 4.5][o.ascites | 0] * U;   // grau 1 só ao ultrassom [LITERATURA: International Ascites Club]
    const bandAsc = y => smooth(L.sym.y - 2 * U, L.sym.y + 6 * U, y) * (1 - smooth(L.xiph - 6 * U, L.xiph + 1 * U, y));
    const W = (x, y, z, kind, nx = 0, ny = 0, nz = 0) => {
      const isSkin = kind === "skin";
      const sx = 1 + s * (.075 * G(y, L.yh, T0 * .22) - .06 * G(y, yw, T0 * .14) - .075 * G(y, L.ys, T0 * .12));
      let X = x * sx, Y = y, Z = z * (1 + s * .02 * G(y, L.yh, T0 * .25));
      if (isSkin) {
        if (s && z > 0) { const bx = T0 * .23, sg = T0 * .16, A = T0 * .13 * (1 + .35 * smooth(8, 30, o.preg)); Z += A * (Math.exp(-(((x - bx) ** 2) + (y - L.yc) ** 2) / (2 * sg * sg)) + Math.exp(-(((x + bx) ** 2) + (y - L.yc) ** 2) / (2 * sg * sg))); }
        if (s && L.gen && x > L.gen.x0 && x < L.gen.x1 && y > L.gen.y0 && y < L.gen.y1 && z > L.gen.z0) { Z = Math.min(Z, L.sym.z + 1 * U); Y = Math.max(Y, L.sym.y - 3.5 * U); }
        const off = o.dfat - wst * 1.1 * U;                                   // tecido adiposo; caquexia retira gordura e afina o contorno [PREMISSA]
        if (off) { const w = .25 + .75 * G(y, (L.yh + L.yc) / 2, T0 * .55) + .4 * G(y, L.yh - T0 * .35, T0 * .3); X += nx * off * w; Y += ny * off * w * .4; Z += nz * off * w; }
      }
      // parede abdominal: gestação e ascite empurram pele, músculos, vasos e nervos superficiais da parede
      if (Math.abs(x) < L.hw * 1.12 && y > L.sym.y - 4 * U && y < L.xiph + 3 * U && (Ut || asc || o.waistK !== 1)) {
        const fr = L.front(x, y), side = 1 - smooth(L.hw * .95, L.hw * 1.12, Math.abs(x)), wall = (isSkin ? 1 : smooth(fr - 4 * U, fr - 1 * U, z)) * side;
        if (wall > 0) {
          if (Ut && Ut.w >= 12) { const m = 3 * U, ex = x / (Ut.a + m), ey = (y - Ut.cy) / (Ut.b + m), q = ex * ex + ey * ey;
            if (q < 1) { const uf = Ut.cz + (Ut.c + Ut.wall) * Math.sqrt(1 - q), need = Math.max(0, uf - fr); Z += need * wall; X += Math.sign(x) * need * .12 * wall; } }
          if (asc) { const bw = bandAsc(y); if (bw > 0) { let dx = isSkin ? nx : x, dz = isSkin ? nz : z - L.cz; const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n;
            const lat = .7 + .6 * Math.min(1, Math.abs(x) / L.hw), d = asc * bw * lat * wall; X += dx * d; Z += Math.max(0, dz) * d + Math.min(0, dz) * d * .2;
            if (isSkin && o.ascites >= 3) Z += 1 * U * G1(Math.hypot(x, y - L.yU), 2 * U); } }
          if (o.waistK !== 1) { const k = 1 + (o.waistK - 1) * G1(y - L.yU, 9 * U) * wall; X = X * k; Z = L.cz + (Z - L.cz) * k; }
        }
      }
      return [X * wS * Math.pow(hS, .35), L.foot + (Y - L.foot) * hS, Z * wS * Math.pow(hS, .35)];
    };
    // só estatura e arcabouço (para órgãos internos posicionados pelo próprio modelo)
    W.frame = (x, y, z) => { const sx = 1 + s * (.075 * G(y, L.yh, T0 * .22) - .06 * G(y, yw, T0 * .14) - .075 * G(y, L.ys, T0 * .12)); return [x * sx * wS * Math.pow(hS, .35), L.foot + (y - L.foot) * hS, z * (1 + s * .02 * G(y, L.yh, T0 * .25)) * wS * Math.pow(hS, .35)]; };
    return W;
  }
  let ZONE = null;                                       // marcos do tronco já deformados (alertas por região)
  function trunkZone(p) { if (!ZONE || !p) return null; const [x, y, z] = p; if (Math.abs(x) > ZONE.hw * 1.35 || y < ZONE.symY - 6 * U * ZONE.hS || y > ZONE.xiphY + 2 * U * ZONE.hS) return null;
    return z >= ZONE.cz ? (y < ZONE.symY + 7 * U * ZONE.hS ? "pelve" : "abdome") : "lombossacral"; }
  let WARP = null;                                       // deformação vigente (pontos de acupuntura, terminações e trajetos usam)
  const warpPoint = (p, n) => WARP ? WARP(p[0], p[1], p[2], n ? "skin" : "inner", n ? n[0] : 0, n ? n[1] : 0, n ? n[2] : 0) : p.slice();
  function femaleOrgans(ex, L, Ut, W, on) {
    const { S, T } = ex, G = S.layers.organs; if (!G) return; const old = G.getObjectByName("femaleOrgans"); if (old) { G.remove(old); old.traverse(o => { o.geometry && o.geometry.dispose(); }); }
    if (!on) return; const grp = new T.Group(); grp.name = "femaleOrgans";
    const put = (geo, mat, c, sc, rot) => { const m = new T.Mesh(geo, mat); const p = W.frame(c[0], c[1], c[2]); m.position.set(...p); m.scale.set(...sc); if (rot) m.rotation.set(...rot); m.userData.noPick = true; grp.add(m); return m; };
    const hs = Math.pow(PT.height / 175, .35);
    const uMat = new T.MeshStandardMaterial({ color: 0xd8848a, roughness: .55, transparent: true, opacity: Ut.w >= 12 ? .42 : .85, depthWrite: Ut.w < 12 });
    put(new T.SphereGeometry(1, 40, 28), uMat, [0, Ut.cy, Ut.cz], [Ut.a * hs, Ut.b * PT.height / 175, Ut.c * hs]);
    const oMat = new T.MeshStandardMaterial({ color: 0xe8b7a0, roughness: .6 }), oy = Ut.w >= 12 ? Ut.cy - Ut.b * .15 : L.sym.y + 6 * U;
    [-1, 1].forEach(sd => put(new T.SphereGeometry(1, 20, 14), oMat, [sd * (Ut.a + 1.6 * U), oy, Ut.cz - .5 * U], [1.5 * U, 1 * U, .75 * U]));   // ovário ≈ 3 × 2 × 1,5 cm [LITERATURA]
    if (Ut.w >= 8) {                                      // feto esquemático: só ilustra volume e apresentação
      const fMat = new T.MeshStandardMaterial({ color: 0xf0b49c, roughness: .5 }), head = Ut.w >= 32 ? -1 : 1;   // apresentação cefálica ≈ 96 % a termo [LITERATURA]
      const bx = Ut.a * .5, by = Ut.b * .5, bz = Ut.c * .5, r = Math.min(Ut.a, Ut.b) * .3;
      put(new T.SphereGeometry(1, 24, 18), fMat, [0, Ut.cy - head * by * .15, Ut.cz], [bx * .8, by * .75, bz * .8]);
      put(new T.SphereGeometry(1, 24, 18), fMat, [0, Ut.cy + head * by * .72, Ut.cz + .1 * Ut.c], [r, r, r]);
    }
    G.add(grp);
  }
  function applyPatient() {
    const ex = EXT(); if (!ex || !ex.S.meshByLayer || !ex.S.meshByLayer.skeleton) return false; const { S } = ex;
    ["skin", "skeleton", "organs", "vessels", "muscles"].forEach(k => { const m = S.meshByLayer[k]; if (m && !m.geometry.userData.p0) { m.geometry.userData.p0 = m.geometry.attributes.position.array.slice(); if (k === "skin") m.geometry.userData.n0 = m.geometry.attributes.normal.array.slice(); } });
    const L = lm(ex); if (!L) return false;
    const B = bmi(), F = PT.sex === "F", preg = F ? clamp(PT.preg || 0, 0, 42) : 0;
    const dfat = clamp((B - 23) * .0055, -.012, .1) * (F ? 1.12 : 1);   // ≈ 2,6 mm de tecido adiposo por ponto de IMC [PREMISSA]
    const wasting = clamp((18.5 - B) / 3.5, 0, 1);                      // IMC < 18,5 baixo peso; < 16 magreza grave [LITERATURA: OMS]
    const o = { sex: PT.sex, dfat, wasting, preg, ascites: PT.ascites | 0, hS: clamp(PT.height / 175, .8, 1.22), waistK: 1, ut: null };
    o.ut = F ? uterus(L, preg, dfat) : null;
    // perímetro abdominal: mede no modelo já deformado e ajusta ao alvo informado
    let W = makeWarp(L, o); const cm = ws => perim(hull(ws)) * MMU / 10;
    const meas = () => L.slice.length > 8 ? cm(L.slice.map(([x, z, nx, ny, nz]) => { const r = W(x, L.yU, z, "skin", nx, ny, nz); return [r[0], r[2]]; })) : null;
    const before = meas(); if (PT.waist && before) { o.waistK = clamp(PT.waist / before, .7, 1.8); W = makeWarp(L, o); }
    const after = meas(); WARP = W;
    { const s0 = W(0, L.sym.y, L.sym.z, "inner"), x0 = W(0, L.xiph, 0, "inner"), c0 = W(0, L.yU, L.cz, "inner"); ZONE = { symY: s0[1], xiphY: x0[1], cz: c0[2], hw: L.hw * Math.pow(o.hS, .35), hS: o.hS }; }
    const n0s = S.meshByLayer.skin.geometry.userData.n0;
    const warpMesh = (m, kind) => { const g0 = m.geometry, p0 = g0.userData.p0, a = g0.attributes.position.array, n0 = kind === "skin" ? n0s : null;
      const hide = new Uint8Array(a.length / 3), cen = {};
      if (m.userData.parts) m.userData.parts.forEach(pt => { if (F && HIDE_F.test(pt.name)) for (let j = pt.v0; j < pt.v0 + pt.nv; j++) hide[j] = 1;
        if (kind === "muscles" && wasting > 0) { let sx = 0, sz = 0; for (let j = pt.v0; j < pt.v0 + pt.nv; j++) { sx += p0[j * 3]; sz += p0[j * 3 + 2]; } cen[pt.v0] = [sx / pt.nv, sz / pt.nv, pt.nv]; } });
      const km = 1 - .28 * wasting;                                    // massa muscular reduzida na caquexia [PREMISSA]
      const owner = kind === "muscles" && wasting > 0 ? new Int32Array(a.length / 3) : null; if (owner) m.userData.parts.forEach(pt => { for (let j = pt.v0; j < pt.v0 + pt.nv; j++) owner[j] = pt.v0; });
      for (let i = 0, v = 0; i < a.length; i += 3, v++) {
        if (hide[v]) { a[i] = 0; a[i + 1] = L.sym.y; a[i + 2] = L.sym.z - 6 * U; continue; }   // órgão masculino recolhido (degenerado)
        let x = p0[i], y = p0[i + 1], z = p0[i + 2]; if (owner) { const c = cen[owner[v]]; if (c) { x = c[0] + (x - c[0]) * km; z = c[1] + (z - c[1]) * km; } }
        const r = W(x, y, z, kind, n0 ? n0[i] : 0, n0 ? n0[i + 1] : 0, n0 ? n0[i + 2] : 0); a[i] = r[0]; a[i + 1] = r[1]; a[i + 2] = r[2]; }
      g0.attributes.position.needsUpdate = true; if (kind === "skin") g0.computeVertexNormals(); g0.computeBoundingSphere(); g0.computeBoundingBox(); };
    ["skin", "skeleton", "organs", "vessels", "muscles"].forEach(k => S.meshByLayer[k] && warpMesh(S.meshByLayer[k], k));
    // nervos, pontos reflexos e etiquetas acompanham
    [...S.layers.nerves.children, ...S.layers.autonomic.children].forEach(m => { if (!m.geometry || !m.geometry.attributes.position) return; if (!m.geometry.userData.p0) m.geometry.userData.p0 = m.geometry.attributes.position.array.slice(); warpMesh(m, "nerve");
      if (m.userData.p0pos == null && m.position.lengthSq()) m.userData.p0pos = m.position.clone(); if (m.userData.p0pos) { const r = W(m.userData.p0pos.x, m.userData.p0pos.y, m.userData.p0pos.z, "nerve"); m.position.set(...r); } });
    if (S.rx) S.rx.markers.forEach(k => { const r = W(k.r.p[0], k.r.p[1], k.r.p[2], "skin", k.r.n[0], k.r.n[1], k.r.n[2]); k.grp.position.set(...r); const lb = S.labels.find(l => l.el === k.lb); if (lb) lb.pos.set(...r); });
    femaleOrgans(ex, L, o.ut || {}, W, F);
    if (S.skin && S.skin.uniforms.tone) S.skin.uniforms.tone.value.set(...FITZ[PT.fitz]);
    // coerência biofísica: hipoderme acompanha IMC e sexo; caquexia zera a gordura; idade avançada → leve desmielinização [PREMISSA]
    const A = g.AxonApp; if (A) { A.state.v.fat = +clamp((B - 22) * .06 + (F ? .15 : 0), 0, 1.2).toFixed(2) * (1 - wasting); A.state.v.fat = +A.state.v.fat.toFixed(2);
      if (PT.age > 65) A.state.v.demy = Math.max(A.state.v.demy, +((PT.age - 65) / 60).toFixed(2));
      A.state.v.preg = preg; A.state.v.ascites = o.ascites; A.state.v.wasting = +wasting.toFixed(2); A.renderRight(); A.update(); }
    PT.applied = { ...PT, preg, bmi: B, wasting, waistModel: after ? Math.round(after) : null, waistBefore: before ? Math.round(before) : null, sfh: preg ? Math.round(sfh(preg)) : 0 };
    document.dispatchEvent(new CustomEvent("axon:patient", { detail: PT.applied }));
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
    // gestação, ascite, perímetro abdominal, caquexia
    const gw = t.match(/(\d{1,2})\s*(?:semanas?|sem\.?)\s*(?:de\s*)?(?:gesta|gravidez|ig\b)/) || t.match(/(?:gesta[çc][ãa]o|gr[áa]vida|gestante|ig)\s*(?:de\s*)?(\d{1,2})\s*sem/);
    if (gw) { out.preg = Math.min(42, +gw[1]); out.sex = "F"; } else if (/gr[áa]vida|gestante|gesta[çc][ãa]o/.test(t)) { const tri = t.match(/(1|2|3|primeiro|segundo|terceiro)\s*trimestre/); out.preg = tri ? { "1": 10, primeiro: 10, "2": 22, segundo: 22, "3": 34, terceiro: 34 }[tri[1]] : 24; out.sex = "F"; }
    if (/ascite/.test(t)) { const ag = t.match(/ascite\s*(?:de\s*)?(?:grau\s*)?(1|2|3|i{1,3})\b/) || t.match(/grau\s*(1|2|3|i{1,3})\s*de\s*ascite/); out.ascites = ag ? ({ i: 1, ii: 2, iii: 3 }[ag[1]] || +ag[1]) : /volumos|tens|grande/.test(t) ? 3 : 2; }
    const wc = t.match(/(?:per[íi]metro|circunfer[êe]ncia|cintura)\s*(?:abdominal)?\s*(?:de\s*)?(\d{2,3})\s*cm/); if (wc) out.waist = +wc[1];
    if (/caquex|desnutri|magreza extrema|emagrecimento grave/.test(t) && !w && !im) out.bmi = 15;
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
    PT.preg = PT.sex === "F" ? (d.preg != null ? clamp(+d.preg, 0, 42) : 0) : 0; PT.ascites = d.ascites != null ? clamp(+d.ascites | 0, 0, 3) : 0; PT.waist = d.waist ? clamp(+d.waist, 50, 180) : 0;
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
  let liveT = 0;
  const bmiCat = B => B < 16 ? "magreza grave" : B < 17 ? "magreza moderada" : B < 18.5 ? "magreza leve" : B < 25 ? "eutrofia" : B < 30 ? "sobrepeso" : B < 35 ? "obesidade I" : B < 40 ? "obesidade II" : "obesidade III";
  const pregTxt = w => !w ? "não gestante" : `${w} sem · ${w < 14 ? "1º" : w < 28 ? "2º" : "3º"} trimestre${w >= 12 ? ` · fundo uterino ≈ ${Math.round(sfh(w))} cm` : ""}`;
  function patientWin(b) {
    const B = bmi();
    b.innerHTML = `<div class="card"><h4>Descreva o paciente e o caso</h4><textarea id="ptT" rows="4" style="width:100%" placeholder="Ex.: Mulher, 52 anos, 1,62 m, 78 kg, fototipo IV. Dor lombar irradiada para a perna esquerda há 3 meses, queimação, EVA 7, pior ao sentar."></textarea>
      <div class="row" style="gap:6px"><button class="btn" id="ptGo">Gerar paciente e caso</button><span class="note" id="ptSt"></span></div><p class="note">Use apenas casos fictícios ou anonimizados: não informe nome, documentos ou datas de nascimento.</p></div>
      <div class="card"><h4>Corpo</h4><div class="seg" id="ptSex"><button data-s="M" class="${PT.sex === "M" ? "on" : ""}" title="Corpo masculino">♂ Homem</button><button data-s="F" class="${PT.sex === "F" ? "on" : ""}" title="Corpo feminino: contorno, mamas e órgãos pélvicos femininos">♀ Mulher</button></div>
        ${[["age", "Idade", 18, 95, 1, "anos"], ["height", "Altura", 140, 205, 1, "cm"], ["weight", "Peso", 30, 180, 1, "kg"]].map(([k, l, a, z, s, u]) => `<div class="ctl"><label><span>${l}</span><output>${PT[k]} ${u}</output></label><input type="range" data-k="${k}" min="${a}" max="${z}" step="${s}" value="${PT[k]}"></div>`).join("")}
        <p class="note">IMC <b id="ptB">${B.toFixed(1)}</b> kg/m² · <b id="ptBc">${bmiCat(B)}</b> ${tag("lit")}${B < 18.5 ? ` · caquexia simulada: menos gordura e massa muscular ${tag("pre")}` : ""}</p>
        ${PT.sex === "F" ? `<div class="ctl"><label><span title="Idade gestacional; 0 = não gestante">Gestação</span><output id="ptPo">${pregTxt(PT.preg)}</output></label><input type="range" id="ptP" min="0" max="42" step="1" value="${PT.preg || 0}"></div>` : ""}
        <div class="ctl"><label><span title="Medido na altura da cicatriz umbilical. Automático = o que resulta do peso e da condição">Perímetro abdominal</span><output id="ptWo">${PT.waist ? PT.waist + " cm" : "automático"}${PT.applied && PT.applied.waistModel ? ` · modelo ${PT.applied.waistModel} cm` : ""}</output></label><input type="range" id="ptW" min="49" max="180" step="1" value="${PT.waist || 49}"></div>
        <div class="ctl"><label><span title="Classificação do International Ascites Club: 1 só ao ultrassom, 2 distensão moderada, 3 distensão grande ou tensa">Ascite</span></label><div class="seg" id="ptA">${[0, 1, 2, 3].map(k => `<button data-a="${k}" class="${(PT.ascites | 0) === k ? "on" : ""}" title="${["sem ascite", "grau 1: só detectável ao ultrassom", "grau 2: distensão abdominal moderada", "grau 3: distensão grande ou tensa"][k]}">${k ? "grau " + k : "não"}</button>`).join("")}</div></div>
        <div class="ctl"><label><span>Fototipo (Fitzpatrick)</span></label><div class="seg" id="ptF">${Object.keys(FITZ).map(k => `<button data-f="${k}" class="${PT.fitz === k ? "on" : ""}" style="background:rgb(${FITZ[k].map(v => Math.round(v * 255)).join(",")});color:${["V", "VI", "IV"].includes(k) ? "#fff" : "#222"}">${k}</button>`).join("")}</div></div>
        <button class="btn" id="ptAp">Aplicar ao modelo</button></div>
      <div class="note">${tag("pre")} Uma única malha anatômica (BodyParts3D, masculina) é deformada: contorno e órgãos pélvicos femininos, útero e feto esquemáticos, ascite e perímetro abdominal são aproximações para ensino, não reproduzem a anatomia de uma pessoa. ${tag("lit")} Altura do fundo uterino pela regra de McDonald; graus de ascite do International Ascites Club; faixas de IMC da OMS.</div>`;
    $$("#ptSex button", b).forEach(x => x.onclick = () => { PT.sex = x.dataset.s; if (PT.sex === "M") PT.preg = 0; patientWin(b); live(); });
    $$("#ptF button", b).forEach(x => x.onclick = () => { PT.fitz = x.dataset.f; patientWin(b); applyPatient(); });
    $$("#ptA button", b).forEach(x => x.onclick = () => { PT.ascites = +x.dataset.a; patientWin(b); live(); });
    $$("[data-k]", b).forEach(i => { i.oninput = () => { PT[i.dataset.k] = +i.value; i.previousElementSibling.querySelector("output").textContent = i.value + " " + { age: "anos", height: "cm", weight: "kg" }[i.dataset.k]; $("#ptB", b).textContent = bmi().toFixed(1); $("#ptBc", b).textContent = bmiCat(bmi()); }; i.onchange = () => live(); });
    const pg = $("#ptP", b); if (pg) { pg.oninput = () => { PT.preg = +pg.value; $("#ptPo", b).textContent = pregTxt(PT.preg); }; pg.onchange = () => live(); }
    const wc = $("#ptW", b); wc.oninput = () => { PT.waist = +wc.value <= 49 ? 0 : +wc.value; $("#ptWo", b).textContent = PT.waist ? PT.waist + " cm" : "automático"; }; wc.onchange = () => live();
    function live() { clearTimeout(liveT); liveT = setTimeout(() => { applyPatient(); if (b.isConnected) patientWin(b); }, 120); }
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
  g.AxonDissect = { setDepth, setOpacity, applyClip, renderImage, applyPatient, fromPrompt, parseLocal, PT, D, IMG, DEPTH, motorDrive, warpPoint, sfh, trunkZone, get bmi() { return bmi(); } };
})(window);
