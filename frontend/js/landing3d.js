/* axon · landing3d.js — diorama voxel da página inicial.
   Bloco de pele em corte (epiderme, derme com vasos, hipoderme, músculo) atravessado por um fascículo
   com fibras Aβ (grossas) e Aδ (finas), eletrodo de superfície e condução saltatória de nó em nó.
   Limiares relativos das fibras: ilustrativos, escalados pela razão Aδ/Aβ = 3,21 do modelo nodal. */
(function (g) {
  "use strict";
  const T = g.THREE;
  const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
  const noise = (x, y, z) => { // ruído de valor suave (para cor "orgânica")
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const sm = t => t * t * (3 - 2 * t), u = sm(xf), v = sm(yf), w = sm(zf), L = (a, b, t) => a + (b - a) * t;
    const h = (a, b, c) => hash(xi + a, yi + b, zi + c);
    return L(L(L(h(0,0,0), h(1,0,0), u), L(h(0,1,0), h(1,1,0), u), v), L(L(h(0,0,1), h(1,0,1), u), L(h(0,1,1), h(1,1,1), u), v), w);
  };

  function roundedBox(r = .16, seg = 3) { // cubo com bisel arredondado (estética voxel "Pixar")
    const gm = new T.BoxGeometry(1, 1, 1, seg * 2, seg * 2, seg * 2), p = gm.attributes.position, n = gm.attributes.normal;
    const v = new T.Vector3(), q = new T.Vector3(), h = .5 - r;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      q.set(Math.max(-h, Math.min(h, v.x)), Math.max(-h, Math.min(h, v.y)), Math.max(-h, Math.min(h, v.z)));
      const d = v.clone().sub(q);
      if (d.lengthSq() > 1e-10) { d.normalize(); v.copy(q).addScaledVector(d, r); n.setXYZ(i, d.x, d.y, d.z); }
      p.setXYZ(i, v.x, v.y, v.z);
    }
    return gm;
  }
  function glowTex(rgb) {
    const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.18, `rgba(${rgb},.95)`); gr.addColorStop(.5, `rgba(${rgb},.28)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  }
  const lin = h => new T.Color(h).convertSRGBToLinear();

  function create(canvas, opts = {}) {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 800 ? 1.5 : 2));
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.physicallyCorrectLights = false;
    const light = opts.theme === "light";
    const scene = new T.Scene(); scene.fog = new T.Fog(light ? 0xeef6f4 : 0x0b1d22, light ? 110 : 70, light ? 220 : 150);
    const camera = new T.PerspectiveCamera(34, 1, .5, 400);

    // ---- luz de estúdio: chave quente, contra-luz fria, céu/solo, preenchimento
    scene.add(new T.HemisphereLight(0xe6f6ff, light ? 0xc9b8a8 : 0x3a2418, light ? .95 : .62));
    const key = new T.DirectionalLight(0xffe2c4, 1.35); key.position.set(-26, 44, 30); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -34, right: 34, top: 30, bottom: -30, near: 1, far: 120 }); key.shadow.bias = -.0006; key.shadow.normalBias = .03;
    key.shadow.camera.updateProjectionMatrix(); scene.add(key);
    const rim = new T.DirectionalLight(0x6fe7ff, .75); rim.position.set(30, 18, -34); scene.add(rim);
    const fill = new T.PointLight(0xff9a6a, .5, 90); fill.position.set(18, 6, 26); scene.add(fill);
    // ambiente para reflexos (gradiente equiretangular → PMREM)
    { const c = document.createElement("canvas"); c.width = 256; c.height = 128; const x = c.getContext("2d"); const gr = x.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, "#bfe9ff"); gr.addColorStop(.48, "#f6d9c4"); gr.addColorStop(.52, "#5a4034"); gr.addColorStop(1, "#16110e"); x.fillStyle = gr; x.fillRect(0, 0, 256, 128);
      x.fillStyle = "rgba(255,255,255,.9)"; x.beginPath(); x.ellipse(70, 30, 26, 12, 0, 0, 7); x.fill();
      const t = new T.CanvasTexture(c); t.mapping = T.EquirectangularReflectionMapping; t.encoding = T.sRGBEncoding;
      const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose(); }

    const root = new T.Group(); scene.add(root);
    const ground = new T.Mesh(new T.CircleGeometry(60, 64), new T.ShadowMaterial({ opacity: light ? .16 : .38 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -7.6; ground.receiveShadow = true; root.add(ground);

    const BOX = roundedBox(.17, 2), SPH = new T.SphereGeometry(.5, 12, 9);
    const MAT = {
      skin: new T.MeshPhysicalMaterial({ roughness: .58, sheen: new T.Color(0x7a5048), clearcoat: .15, clearcoatRoughness: .5 }),
      derm: new T.MeshPhysicalMaterial({ roughness: .62, sheen: new T.Color(0x5a3530) }),
      fat: new T.MeshPhysicalMaterial({ roughness: .3, clearcoat: .6, clearcoatRoughness: .25, sheen: new T.Color(0x5a5030) }),
      muscle: new T.MeshPhysicalMaterial({ roughness: .48, clearcoat: .35, clearcoatRoughness: .35 }),
      vessel: new T.MeshPhysicalMaterial({ roughness: .3, clearcoat: .8 }),
      myelin: new T.MeshPhysicalMaterial({ roughness: .22, clearcoat: 1, clearcoatRoughness: .12, sheen: new T.Color(0x404850) }),
      hair: new T.MeshStandardMaterial({ roughness: .5, color: 0x3b2618 }),
      pad: new T.MeshPhysicalMaterial({ roughness: .35, clearcoat: .9, color: 0x2b3a44 }),
      metal: new T.MeshStandardMaterial({ roughness: .2, metalness: 1, color: 0xd9e2e6 }),
      cable: new T.MeshPhysicalMaterial({ roughness: .4, clearcoat: .6, color: 0x1f2a30 }),
    };
    for (const m of Object.values(MAT)) m.envMapIntensity = .9;
    const bins = {}; // agrupa voxels por material → um InstancedMesh por material
    const put = (mat, x, y, z, s, col, geo = BOX, sy) => { (bins[mat + (geo === SPH ? "#s" : "")] = bins[mat + (geo === SPH ? "#s" : "")] || { mat, geo, list: [] }).list.push([x, y, z, s, col, sy || s]); };

    // ---- bloco de tecido em corte: X 26 × Z 16; camadas de baixo para cima
    const NX = 26, NZ = 16, X0 = -NX / 2 + .5, Z0 = -NZ / 2 + .5;
    const L = [["muscle", 4], ["fat", 3], ["derm", 3], ["skin", 1]];
    const FAS = { y: -4.2, z: 0, r: 3.1 }; // túnel do fascículo (corre ao longo de x)
    let y = -7; const layerTop = {};
    const VES = [{ x: -5, y: -1.6, r: .9, col: "#c22a36" }, { x: -2.6, y: -1.8, r: .75, col: "#3a4fb8" }, { x: 7, y: -1.5, r: .6, col: "#c22a36" }];
    for (const [k, h] of L) {
      for (let j = 0; j < h; j++, y++) {
        for (let i = 0; i < NX; i++) for (let kz = 0; kz < NZ; kz++) {
          const x = X0 + i, z = Z0 + kz, yy = y + .5;
          if (Math.hypot(yy - FAS.y, z - FAS.z) < FAS.r) continue; // passagem do nervo
          if (k === "derm" && VES.some(v => Math.hypot(x - v.x, yy - v.y) < v.r + .45)) continue; // vasos atravessam em z
          const inner = i > 0 && i < NX - 1 && kz > 0 && kz < NZ - 1 && j < h - 1 && j > 0 && k !== "skin";
          if (inner && Math.hypot(yy - FAS.y, z - FAS.z) > FAS.r + 1.5 && kz < NZ - 2) continue; // oco por dentro (só a casca é vista)
          const n = noise(x * .35, yy * .5, z * .35), n2 = hash(x, yy, z);
          let col;
          if (k === "skin") col = new T.Color().setHSL(.05 + n * .012, .55 + n2 * .1, .7 + n * .05 - n2 * .04);
          else if (k === "derm") col = new T.Color().setHSL(.0 + n * .02, .58, .62 + n * .07 - n2 * .05);
          else if (k === "fat") col = new T.Color().setHSL(.115 + n * .025, .85, .64 + n * .07);
          else col = new T.Color().setHSL(.99 + n * .012, .62, (.4 + n * .07) * ((Math.round(z * 2) % 2) ? 1 : .88) - n2 * .03); // estrias
          col.convertSRGBToLinear();
          if (k === "fat" && n2 > .35) put("fat", x, yy, z, .94 + n * .1, col, SPH); // lóbulos de gordura arredondados
          else put(k, x, yy, z, k === "skin" ? .99 : .97, col);
        }
        layerTop[k] = y + 1;
      }
    }
    // vasos (cilindros de voxels ao longo de z, saindo do corte)
    VES.forEach(v => { for (let z = Z0 - 1; z <= Z0 + NZ; z++) for (let a = 0; a < 10; a++) { const t = a / 10 * Math.PI * 2; put("vessel", v.x + Math.cos(t) * v.r, v.y + Math.sin(t) * v.r, z, .5, lin(v.col)); } });
    // pelos (charme do diorama)
    for (let h = 0; h < 22; h++) { const x = X0 + 2 + hash(h, 1, 2) * (NX - 4), z = Z0 + 2 + hash(h, 3, 4) * (NZ - 4); if (Math.abs(x + 4) < 3.5 && Math.abs(z) < 3.5) continue;
      for (let s = 0; s < 3; s++) put("hair", x + s * .12, 4.6 + s * .45, z + s * .08, .2, null, BOX, .5); }

    // ---- fascículo: fibras Aβ (grossas, rápidas) e Aδ (finas, lentas)
    const fibers = [], XA = -NX / 2 - 3.5, XB = NX / 2 + 9;
    const mk = (type, i, n) => {
      const ang = i / n * Math.PI * 2 + (type === "Ad" ? .35 : 0), rr = type === "Ab" ? 1.75 : (i % 2 ? 2.45 : 1.05);
      const D = type === "Ab" ? 8 + hash(i, 9, 1) * 4 : 1.5 + hash(i, 7, 3) * 3; // µm (Aβ 6–12, Aδ 1–5)
      const thr = Math.pow(10 / D, 1.1266) * (type === "Ab" ? 1 : 1) * (.92 + hash(i, 5, 5) * .16); // lei de escala do modelo
      return { type, D, thr, s: type === "Ab" ? .78 : .42, inter: type === "Ab" ? 4 : 2, y: FAS.y + Math.sin(ang) * rr, z: FAS.z + Math.cos(ang) * rr, nodes: [], pulses: [], fired: false };
    };
    for (let i = 0; i < 7; i++) fibers.push(mk("Ab", i, 7));
    for (let i = 0; i < 9; i++) fibers.push(mk("Ad", i, 9));
    // normaliza: mediana Aβ = 1 → Aδ ≈ 3,2 (razão do modelo)
    const med = a => { const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; };
    const mAb = med(fibers.filter(f => f.type === "Ab").map(f => f.thr)), mAd = med(fibers.filter(f => f.type === "Ad").map(f => f.thr));
    fibers.forEach(f => { f.thr = f.type === "Ab" ? f.thr / mAb : f.thr / mAd * 3.21; });
    const fiberOf = []; // instância de mielina → fibra
    const nodeList = [];
    fibers.forEach((f, fi) => {
      const step = f.s * 1.02, colM = lin(f.type === "Ab" ? "#bfe6ee" : "#f3d4bc");
      let k = 0;
      for (let x = XA; x <= XB; x += step, k++) {
        const bend = x > NX / 2 ? Math.pow(x - NX / 2, 2) * .012 : 0, fan = x > NX / 2 ? (x - NX / 2) * .07 : 0; // fibras se abrem ao sair do corte
        const yy = f.y + bend * 1.4 + (f.y - FAS.y) * fan, zz = f.z + (f.z - FAS.z) * fan;
        if (k % (f.inter + 1) === f.inter) { f.nodes.push(new T.Vector3(x, yy, zz)); nodeList.push({ f: fi, i: f.nodes.length - 1 }); continue; }
        put("myelin", x, yy, zz, f.s, colM.clone().offsetHSL(0, 0, (hash(x, fi, 2) - .5) * .06));
        fiberOf.push(fi);
      }
    });
    // perineuro translúcido + epineuro
    const sheath = new T.Mesh(new T.CylinderGeometry(FAS.r - .05, FAS.r - .05, NX + 3, 40, 1, true), new T.MeshPhysicalMaterial({ color: 0xf5efe0, roughness: .25, transparent: true, opacity: .2, side: T.DoubleSide, depthWrite: false, clearcoat: 1 }));
    sheath.rotation.z = Math.PI / 2; sheath.position.set(-1.5, FAS.y, FAS.z); root.add(sheath);

    // ---- eletrodo de superfície (TENS) e cabo
    const PAD = new T.Vector3(-4, layerTop.skin + .25, 0);
    const pad = new T.Mesh(roundedBox(.25, 3), MAT.pad); pad.scale.set(5.2, .5, 4); pad.position.copy(PAD); pad.castShadow = true; root.add(pad);
    const gel = new T.Mesh(roundedBox(.2, 2), new T.MeshPhysicalMaterial({ color: 0x8fd8ff, roughness: .08, clearcoat: 1, transparent: true, opacity: .55 })); gel.scale.set(4.8, .22, 3.6); gel.position.copy(PAD).add(new T.Vector3(0, -.3, 0)); root.add(gel);
    const snap = new T.Mesh(new T.CylinderGeometry(.55, .6, .5, 24), MAT.metal); snap.position.copy(PAD).add(new T.Vector3(0, .45, 0)); snap.castShadow = true; root.add(snap);
    const cab = new T.CatmullRomCurve3([PAD.clone().add(new T.Vector3(0, .6, 0)), new T.Vector3(-4, 9, 0), new T.Vector3(-10, 14, -6), new T.Vector3(-22, 15, -14), new T.Vector3(-38, 13, -20)]);
    const cable = new T.Mesh(new T.TubeGeometry(cab, 80, .32, 12), MAT.cable); cable.castShadow = true; root.add(cable);

    // ---- instancia todos os voxels
    const meshes = {};
    Object.entries(bins).forEach(([key, b]) => {
      const m = new T.InstancedMesh(b.geo, MAT[b.mat], b.list.length), o = new T.Object3D();
      b.list.forEach((e, i) => { o.position.set(e[0], e[1], e[2]); o.scale.set(e[3], e[5], e[3]); o.rotation.set(0, 0, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); if (e[4]) m.setColorAt(i, e[4]); });
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.castShadow = b.mat !== "hair" ; m.receiveShadow = true; root.add(m); meshes[key] = m;
    });
    // nós de Ranvier: brilham quando o potencial passa
    const NODE = new T.InstancedMesh(new T.SphereGeometry(.5, 12, 10), new T.MeshBasicMaterial({ toneMapped: false }), nodeList.length);
    { const o = new T.Object3D(); nodeList.forEach((nd, i) => { const f = fibers[nd.f], p = f.nodes[nd.i]; o.position.copy(p); o.scale.setScalar(f.s * .55); o.updateMatrix(); NODE.setMatrixAt(i, o.matrix); NODE.setColorAt(i, lin(f.type === "Ab" ? "#2f8fa5" : "#a5602f")); f.nodes[nd.i].inst = i; }); NODE.instanceColor.needsUpdate = true; root.add(NODE); }
    const nodeHeat = new Float32Array(nodeList.length);
    const baseNode = nodeList.map(nd => lin(fibers[nd.f].type === "Ab" ? "#2f8fa5" : "#a5602f")), hotAb = lin("#9ff6ff"), hotAd = lin("#ffd08a");

    // ---- íons flutuando (Na⁺ âmbar, K⁺ violeta)
    const ION_N = 90, ions = new T.InstancedMesh(roundedBox(.3, 2), new T.MeshPhysicalMaterial({ roughness: .2, clearcoat: 1, transparent: true, opacity: .9 }), ION_N), ionD = [];
    for (let i = 0; i < ION_N; i++) { ionD.push({ x: (hash(i, 1, 1) - .5) * 70, y: (hash(i, 2, 2) - .2) * 30, z: (hash(i, 3, 3) - .5) * 50, s: .25 + hash(i, 4, 4) * .35, v: .2 + hash(i, 5, 5) * .6, ph: hash(i, 6, 6) * 6 }); ions.setColorAt(i, lin(i % 3 ? "#ffcf5a" : "#b48cff")); }
    ions.instanceColor.needsUpdate = true; root.add(ions);

    // ---- pulsos de estímulo (cascas de campo) e potenciais de ação (brilhos)
    const TEX_AB = glowTex("120,240,255"), TEX_AD = glowTex("255,170,80"), TEX_F = glowTex("140,220,255");
    const sprites = []; const spr = (tex, sc) => { const s = new T.Sprite(new T.SpriteMaterial({ map: tex, blending: T.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.setScalar(sc); s.visible = false; root.add(s); sprites.push(s); return s; };
    fibers.forEach(f => { f.spr = spr(f.type === "Ab" ? TEX_AB : TEX_AD, f.type === "Ab" ? 2.6 : 1.8); f.trail = spr(f.type === "Ab" ? TEX_AB : TEX_AD, f.type === "Ab" ? 1.6 : 1.1); });
    const shells = [0, 1, 2].map(() => { const m = new T.Mesh(new T.SphereGeometry(1, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new T.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); m.position.copy(PAD).add(new T.Vector3(0, -.5, 0)); root.add(m); return { m, t: 9 }; });
    const padGlow = spr(TEX_F, 7); padGlow.position.copy(PAD).add(new T.Vector3(0, -.6, 0)); padGlow.visible = true; padGlow.material.opacity = 0;

    // ---- estado do estímulo
    const S = { I: opts.intensity ?? 1.6, period: .9, clock: 0, lastPulse: -9, onChange: opts.onChange || (() => {}) };
    const recruited = () => ({ ab: fibers.filter(f => f.type === "Ab" && S.I >= f.thr).length, ad: fibers.filter(f => f.type === "Ad" && S.I >= f.thr).length, nab: 7, nad: 9 });
    function fire() {
      shells.forEach((s, i) => { if (s.t > 1.2) { s.t = -i * .12; } });
      padGlow.material.opacity = .9;
      fibers.forEach(f => {
        if (S.I < f.thr) return;
        // nó mais próximo abaixo do eletrodo inicia o potencial; conduz para a direita (ortodrômico, em direção à medula)
        let k0 = 0, best = 1e9; f.nodes.forEach((p, k) => { const d = Math.abs(p.x - PAD.x); if (d < best) { best = d; k0 = k; } });
        f.pulses.push({ k: k0, t: 0 });
      });
    }

    // ---- câmera: órbita suave, paralaxe do mouse e quadros-chave por seção
    const FIT = opts.fit || 1;
    const VIEWS = { // off: deslocamento horizontal do quadro (fração da largura) para abrir espaço ao cartão de texto
      hero: { tgt: [5, -2.5, 0], az: .78, el: .32, d: 72, off: -.2 },
      problema: { tgt: [12, -3.6, 0], az: .92, el: .16, d: 50, off: .2 },
      proposta: { tgt: [-4, 1, 0], az: -.15, el: .95, d: 46, off: -.2 },
      resultados: { tgt: [4, -4, 0], az: 1.45, el: .08, d: 52, off: 0 },
      roadmap: { tgt: [0, -2, 0], az: -1.9, el: .42, d: 80, off: 0 },
      estado: { tgt: [0, -2, 0], az: 2.6, el: .45, d: 66, off: .2 },
      docs: { tgt: [5, -2.5, 0], az: .6, el: .3, d: 76, off: 0 },
    };
    if (opts.hero) Object.assign(VIEWS.hero, opts.hero);
    const cam = { tgt: new T.Vector3(...VIEWS.hero.tgt), az: VIEWS.hero.az, el: VIEWS.hero.el, d: VIEWS.hero.d, off: VIEWS.hero.off, goal: VIEWS.hero };
    const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
    addEventListener("pointermove", e => { if (opts.contained) { const r = canvas.getBoundingClientRect(); mouse.x = (e.clientX - r.left) / r.width - .5; mouse.y = (e.clientY - r.top) / r.height - .5; return; } mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; }, { passive: true });

    // ---- dica ao passar o mouse sobre uma fibra
    const ray = new T.Raycaster(), ptr = new T.Vector2(); let hoverCb = opts.onHover || null;
    canvas.addEventListener("pointermove", e => {
      if (!hoverCb || !meshes.myelin) return; const r = canvas.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(ptr, camera); const h = ray.intersectObject(meshes.myelin)[0];
      hoverCb(h ? { f: fibers[fiberOf[h.instanceId]], x: e.clientX, y: e.clientY } : null);
    });

    function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    addEventListener("resize", resize); if (g.ResizeObserver) new ResizeObserver(resize).observe(canvas); resize();

    const tmpC = new T.Color(), O = new T.Object3D(); let last = performance.now(), running = true, ionT = 0;
    function frame(now) {
      if (!running) return; requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - last) / 1000); last = now; S.clock += dt;
      // câmera
      const G = cam.goal, k = 1 - Math.pow(.0015, dt);
      cam.tgt.lerp(new T.Vector3(...G.tgt), k); cam.az += (G.az + (reduce ? 0 : Math.sin(S.clock * .07) * .22) - cam.az) * k; cam.el += (G.el - cam.el) * k; cam.d += (G.d * FIT * (innerWidth < 700 ? 1.35 : 1) - cam.d) * k;
      mouse.sx += (mouse.x - mouse.sx) * .05; mouse.sy += (mouse.y - mouse.sy) * .05;
      const az = cam.az + mouse.sx * .25, el = Math.max(.02, cam.el - mouse.sy * .12);
      camera.position.set(cam.tgt.x + cam.d * Math.cos(el) * Math.sin(az), cam.tgt.y + cam.d * Math.sin(el), cam.tgt.z + cam.d * Math.cos(el) * Math.cos(az)); camera.lookAt(cam.tgt);
      cam.off += ((innerWidth > 900 && !opts.noOffset ? G.off : 0) - cam.off) * k; { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; camera.setViewOffset(w, h, cam.off * w, innerWidth <= 600 && !opts.noOffset ? h * .24 : 0, w, h); }
      // estímulo periódico
      if (S.clock - S.lastPulse > S.period) { S.lastPulse = S.clock; fire(); }
      shells.forEach(s => { s.t += dt; const u = Math.max(0, s.t); s.m.visible = u < 1.2 && s.t >= 0; const R = 1 + u * 9; s.m.scale.set(R * 1.15, R * .9, R); s.m.material.opacity = .32 * (1 - u / 1.2) * Math.min(1, S.I / 2); });
      padGlow.material.opacity *= Math.pow(.02, dt);
      // condução saltatória: o pulso salta de nó em nó; Aβ mais rápida (∝ D)
      for (let i = 0; i < nodeHeat.length; i++) nodeHeat[i] *= Math.pow(.004, dt);
      fibers.forEach(f => {
        const hopDt = 0.55 / (f.D * 1.4); let vis = null;
        f.pulses = f.pulses.filter(p => { p.t += dt; while (p.t > hopDt) { p.t -= hopDt; p.k++; } if (p.k >= f.nodes.length) return false; nodeHeat[f.nodes[p.k].inst] = 1; vis = p; return true; });
        if (vis) { const a = f.nodes[vis.k], b = f.nodes[Math.min(vis.k + 1, f.nodes.length - 1)], u = vis.t / hopDt, e = u * u * (3 - 2 * u);
          f.spr.visible = f.trail.visible = true; f.spr.position.copy(a).lerp(b, e); f.trail.position.copy(a); f.trail.material.opacity = .55 * (1 - u); f.spr.material.opacity = 1; }
        else { f.spr.visible = f.trail.visible = false; }
      });
      for (let i = 0; i < nodeHeat.length; i++) { const f = fibers[nodeList[i].f]; tmpC.copy(baseNode[i]).lerp(f.type === "Ab" ? hotAb : hotAd, Math.min(1, nodeHeat[i])); NODE.setColorAt(i, tmpC); }
      NODE.instanceColor.needsUpdate = true;
      // íons
      if (!reduce) { ionT += dt; ionD.forEach((d, i) => { O.position.set(d.x + Math.sin(ionT * d.v + d.ph) * 1.6, d.y + Math.sin(ionT * d.v * .7 + d.ph * 2) * 1.2, d.z + Math.cos(ionT * d.v * .5 + d.ph) * 1.4); O.rotation.set(ionT * d.v, ionT * d.v * .6, 0); O.scale.setScalar(d.s); O.updateMatrix(); ions.setMatrixAt(i, O.matrix); }); ions.instanceMatrix.needsUpdate = true; }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", () => { const r = !document.hidden; if (r && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); } else running = r; });

    g.__axonVoxelInfo = () => ({ instances: Object.fromEntries(Object.entries(meshes).map(([k, m]) => [k, m.count])), verts: BOX.attributes.position.count, calls: renderer.info.render.calls, tris: renderer.info.render.triangles });
    return {
      setIntensity(v) { S.I = v; S.onChange(recruited()); }, recruited, fibers,
      view(name) { if (VIEWS[name]) cam.goal = VIEWS[name]; },
      setHover(cb) { hoverCb = cb; }, renderer, scene, camera,
      pause(v) { if (v) running = false; else if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } },
      snapTo(name) { const G = VIEWS[name]; cam.goal = G; cam.tgt.set(...G.tgt); cam.az = G.az; cam.el = G.el; cam.d = G.d * (innerWidth < 700 ? 1.35 : 1); cam.off = innerWidth > 900 ? G.off : 0; },
    };
  }
  g.AxonVoxel = { create };
})(window);
