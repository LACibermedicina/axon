/* axon · stage3d.js — Palco central 3D com Motor de Zoom Semântico (5 níveis).
 * Three.js r128 (cdnjs). Geometrias esquemáticas, fora de escala salvo indicação [PREMISSA didática].
 * Eventos emitidos: axon:scale {level}, axon:select {region}. */
(function (g) {
  "use strict";
  const T = g.THREE;
  const COL = { body: 0x7fd6e0, nerve: 0xffb547, vagus: 0x4fb3ff, symp: 0x6ee7a8, abeta: 0x4fb3ff, adelta: 0xff8a3d, c: 0xc084fc,
    epi: 0xe8b48a, peri: 0xd9705f, endo: 0xf6d9c2, myelin: 0xf3efe6, node: 0x3ee6c5 };

  const S = { level: 1, groups: {}, labels: [], hot: [], anim: [], params: { D: 9, r: 1, I: 0.6, modality: "tens", pressure: 60 }, fibers: [] };
  let renderer, scene, camera, host, labelLayer, raycaster, mouse, clock;
  const cam = { theta: 0.35, phi: 1.3, dist: 6, target: new T.Vector3(0, 0.2, 0), goal: null };

  // ---------- utilidades
  const mat = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .55, metalness: .05 }, o));
  const glass = (c, op = .22) => new T.MeshPhysicalMaterial({ color: c, transparent: true, opacity: op, roughness: .2, metalness: 0, clearcoat: 1, side: T.DoubleSide, depthWrite: false });
  const glow = c => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: .95 });
  function tube(points, r, m, seg = 64) { return new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), seg, r, 8, false), m); }
  function label(group, pos, text, cls = "") { const el = document.createElement("div"); el.className = "lbl " + cls; el.textContent = text; labelLayer.appendChild(el); S.labels.push({ el, group, pos: new T.Vector3(...pos) }); return el; }
  function hotspot(group, pos, region, color = 0xffffff) {
    const m = new T.Mesh(new T.SphereGeometry(.045, 16, 16), glow(color)); m.position.set(...pos); m.userData.region = region; group.add(m); S.hot.push(m);
    const ring = new T.Mesh(new T.RingGeometry(.06, .075, 32), new T.MeshBasicMaterial({ color, transparent: true, opacity: .6, side: T.DoubleSide })); ring.position.copy(m.position); group.add(ring);
    S.anim.push(t => { const s = 1 + .35 * Math.sin(t * 3 + pos[1] * 5); ring.scale.set(s, s, s); ring.lookAt(camera.position); });
    return m;
  }
  function heatTex(fn, w = 128, h = 128) {           // textura de mapa de calor a partir de fn(u,v)∈[0,1]
    const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"), img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = Math.max(0, Math.min(1, fn(i / (w - 1), j / (h - 1)))), k = (j * w + i) * 4, [r, gg, b] = turbo(v); img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 40 + 215 * v; }
    x.putImageData(img, 0, 0); const t = new T.CanvasTexture(c); t.needsUpdate = true; return t;
  }
  function turbo(v) { const r = 34.61 + v * (1172.33 + v * (-10793.56 + v * (33300.12 + v * (-38394.49 + v * 14825.05)))), gg = 23.31 + v * (557.33 + v * (1225.33 + v * (-3574.96 + v * (1073.77 + v * 707.56)))), b = 27.2 + v * (3211.1 + v * (-15327.97 + v * (27814 + v * (-22569.18 + v * 6838.66)))); return [r, gg, b].map(q => Math.max(0, Math.min(255, q))); }

  // ---------- Nível 1: corpo inteiro
  function buildBody() {
    const G = new T.Group(); G.name = "L1";
    const skin = new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide,
      uniforms: { derm: { value: 1 }, t: { value: 0 } },
      vertexShader: "varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vec4 w=modelMatrix*vec4(position,1.); vP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }",
      fragmentShader: `uniform float derm; uniform float t; varying vec3 vN; varying vec3 vP;
        vec3 band(float y,float x){ // esquema didático de dermátomos: C cervical/braços, T tronco, L coxas anteriores, S posterior
          float ax=abs(x);
          if(y>1.05) return vec3(.95,.62,.30);                 // C2–C4 / V
          if(ax>.32 && y>.15) return mix(vec3(.30,.85,.80),vec3(.95,.55,.35),step(.55,fract((ax-.3)*3.)));  // C5–T1 braços
          if(y>.05){ float k=floor((1.05-y)*12.); return mod(k,2.)<1.? vec3(.35,.75,.95):vec3(.30,.55,.90);} // T1–T12
          if(y>-.95) return mod(floor((-y)*5.),2.)<1.? vec3(.98,.55,.40):vec3(.95,.75,.35);  // L1–L5
          return vec3(.75,.45,.95); }                          // S1–S2
        void main(){ float f=pow(1.-abs(dot(normalize(vN),vec3(0,0,1))),2.2);
          vec3 base=vec3(.45,.85,.9); vec3 c=mix(base,band(vP.y,vP.x),derm*.55);
          gl_FragColor=vec4(c*(.35+f*1.2), .14+f*.55); }`
    });
    S.skin = skin;
    const add = (geo, p, s = [1, 1, 1], r = [0, 0, 0]) => { const m = new T.Mesh(geo, skin); m.position.set(...p); m.scale.set(...s); m.rotation.set(...r); G.add(m); return m; };
    add(new T.SphereGeometry(.2, 32, 32), [0, 1.5, 0], [.85, 1.05, .9]);
    add(new T.CylinderGeometry(.08, .09, .18, 24), [0, 1.27, 0]);
    const torso = new T.LatheGeometry([[0, -.5], [.27, -.48], [.31, -.3], [.27, -.05], [.3, .25], [.37, .55], [.36, .78], [.2, .9], [0, .92]].map(([x, y]) => new T.Vector2(x, y)), 40);
    add(torso, [0, .3, 0], [1, 1, .62]);
    for (const sx of [-1, 1]) {
      add(new T.CylinderGeometry(.065, .055, .62, 20), [sx * .47, .78, 0], [1, 1, 1], [0, 0, sx * .18]);
      add(new T.CylinderGeometry(.052, .042, .58, 20), [sx * .58, .2, .03], [1, 1, 1], [0, 0, sx * .08]);
      add(new T.SphereGeometry(.06, 16, 16), [sx * .62, -.13, .05], [1, 1.4, .6]);
      add(new T.CylinderGeometry(.11, .075, .85, 22), [sx * .15, -.62, 0]);
      add(new T.CylinderGeometry(.07, .05, .85, 22), [sx * .16, -1.47, 0]);
      add(new T.BoxGeometry(.1, .05, .24), [sx * .16, -1.92, .06]);
      add(new T.SphereGeometry(.05, 16, 16), [sx * .2, 1.5, 0], [.5, 1, .8]); // orelhas
    }
    // medula + vértebras
    G.add(tube([[0, 1.32, -.06], [0, .8, -.1], [0, .2, -.08], [0, -.18, -.1]], .018, glow(0xfff2c4)));
    for (let i = 0; i < 24; i++) { const v = new T.Mesh(new T.BoxGeometry(.07, .028, .05), mat(0xe9e2d0, { transparent: true, opacity: .55 })); v.position.set(0, 1.3 - i * .062, -.11); G.add(v); }
    const N = mat(COL.nerve, { emissive: COL.nerve, emissiveIntensity: .8 });
    for (const sx of [-1, 1]) {
      G.add(tube([[sx * .03, -.1, -.08], [sx * .1, -.35, -.05], [sx * .15, -.8, -.02], [sx * .16, -1.2, -.02], [sx * .16, -1.85, .02]], .012, N)); // ciático
      G.add(tube([[sx * .05, 1.12, -.06], [sx * .3, 1.0, 0], [sx * .48, .7, .02], [sx * .58, .25, .05], [sx * .62, -.08, .07]], .009, N)); // plexo braquial→mediano
      G.add(tube([[sx * .05, 1.12, -.06], [sx * .32, .98, -.02], [sx * .5, .68, -.03], [sx * .6, .22, 0], [sx * .65, -.1, .02]], .007, N));  // ulnar
      G.add(tube([[sx * .06, 1.45, .02], [sx * .1, 1.5, .1], [sx * .07, 1.55, .15]], .006, N));  // trigêmeo
      // vago (azul) — tronco encefálico → pescoço → tórax/abdome
      G.add(tube([[sx * .03, 1.42, -.03], [sx * .06, 1.25, .02], [sx * .08, .95, .04], [sx * .1, .6, .06], [sx * .06, .25, .06]], .008, mat(COL.vagus, { emissive: COL.vagus, emissiveIntensity: .9 })));
      // cadeia simpática (verde)
      for (let i = 0; i < 14; i++) { const b = new T.Mesh(new T.SphereGeometry(.012, 8, 8), glow(COL.symp)); b.position.set(sx * .055, 1.15 - i * .085, -.07); G.add(b); }
    }
    // ramo auricular do vago (ABVN)
    G.add(tube([[.04, 1.42, -.03], [.15, 1.47, -.02], [.2, 1.5, 0]], .005, mat(COL.vagus, { emissive: COL.vagus, emissiveIntensity: 1.2 })));
    // acupontos (esquema)
    for (const [p, n] of [[[.63, -.12, .1], "LI4"], [[.55, .1, .09], "PC6"], [[.2, -1.25, .07], "ST36"], [[-.17, -1.7, .05], "SP6"]]) { const a = new T.Mesh(new T.SphereGeometry(.018, 10, 10), glow(0xff5fa2)); a.position.set(...p); a.userData.acu = n; G.add(a); }
    hotspot(G, [.12, -.2, .2], "L5S1", 0xffb547); label(G, [.12, -.2, .2], "L5/S1");
    hotspot(G, [.21, 1.5, .03], "ear", 0x4fb3ff); label(G, [.21, 1.5, .03], "taVNS · ABVN", "blue");
    hotspot(G, [.08, 1.52, .17], "trigeminal", 0xffd36b); label(G, [.08, 1.52, .17], "V · trigêmeo");
    hotspot(G, [.58, .2, .08], "median", 0x6ee7a8); label(G, [.58, .2, .08], "C6–C8 · mediano");
    hotspot(G, [-.15, .55, .2], "visceral", 0xc084fc); label(G, [-.15, .55, .2], "T4–T6 · dor referida");
    hotspot(G, [.2, -1.25, .1], "acupoint", 0xff5fa2); label(G, [.2, -1.25, .1], "ST36");
    return G;
  }

  // ---------- Nível 2: região (camadas teciduais + dispositivos)
  function buildRegion() {
    const G = new T.Group(); G.name = "L2";
    const layers = [["Epiderme/derme", .08, 0xf0c3a8], ["Subcutâneo (adiposo)", .35, 0xf7e3a3], ["Fáscia", .05, 0xe8e2d8], ["Músculo", .7, 0xc9545a]];
    let y = 0; S.layerMeshes = [];
    layers.forEach(([n, h, c], i) => { const m = new T.Mesh(new T.BoxGeometry(2.6, h, 1.4), glass(c, .45 - i * .05)); m.position.set(0, y - h / 2, 0); G.add(m); S.layerMeshes.push(m); label(G, [-1.35, y - h / 2, .7], n, "small"); y -= h; });
    const nerve = new T.Mesh(new T.CylinderGeometry(.12, .12, 2.6, 32), mat(COL.nerve, { emissive: COL.nerve, emissiveIntensity: .35 })); nerve.rotation.z = Math.PI / 2; G.add(nerve); S.regionNerve = nerve;
    const vessel = new T.Mesh(new T.CylinderGeometry(.06, .06, 2.6, 24), mat(0xd23b3b)); vessel.rotation.z = Math.PI / 2; G.add(vessel); S.regionVessel = vessel;
    label(G, [1.1, 0, .2], "Feixe neurovascular", "small");
    // plano de calor (Ve ∝ 1/distância) atrás do nervo
    const plane = new T.Mesh(new T.PlaneGeometry(2.6, 1.2), new T.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    plane.position.set(0, -.6, -.1); G.add(plane); S.heatPlane = plane;
    // dispositivos
    const dev = new T.Group(); G.add(dev); S.devices = dev;
    const needle = new T.Mesh(new T.CylinderGeometry(.012, .002, 1.3, 12), mat(0xcfd8dc, { metalness: .9, roughness: .2 })); needle.userData.kind = "ea";
    const handle = new T.Mesh(new T.CylinderGeometry(.03, .03, .3, 12), mat(0x18a999)); handle.position.y = .8; needle.add(handle);
    const probe = new T.Mesh(new T.ConeGeometry(.12, .4, 32), mat(0xe9c46a)); probe.rotation.x = Math.PI; probe.userData.kind = "acu";
    const pad = new T.Mesh(new T.BoxGeometry(.5, .04, .5), mat(0x3a4a5a)); pad.userData.kind = "tens";
    const lifu = new T.Mesh(new T.ConeGeometry(.4, .9, 40, 1, true), glass(0x9ad7ff, .35)); lifu.userData.kind = "lifu";
    const ear = new T.Mesh(new T.TorusGeometry(.12, .03, 12, 32), mat(0x4fb3ff, { emissive: 0x4fb3ff, emissiveIntensity: .5 })); ear.userData.kind = "tavns";
    [needle, probe, pad, lifu, ear].forEach(d => { d.visible = false; dev.add(d); });
    S.dev = { ea: needle, acu: probe, tens: pad, lifu, tavns: ear, scs: pad, ti: pad, opto: needle };
    return G;
  }

  // ---------- Nível 3: fascículo (Pranchas I e XI)
  function buildFascicle() {
    const G = new T.Group(); G.name = "L3";
    const epi = new T.Mesh(new T.CylinderGeometry(1, 1, 3.2, 64, 1, true, 0, Math.PI * 1.55), glass(COL.epi, .35)); epi.rotation.z = Math.PI / 2; G.add(epi);
    const cap = new T.Mesh(new T.CircleGeometry(1, 64), glass(COL.epi, .25)); cap.position.x = 1.6; cap.rotation.y = Math.PI / 2; G.add(cap);
    label(G, [0, 1.05, .2], "Epineuro"); const fasc = [[0, 0], [.48, .25], [-.45, .3], [.1, -.52], [-.4, -.35], [.5, -.3], [-.05, .55]];
    S.fiberMeshes = new T.Group(); G.add(S.fiberMeshes);
    fasc.forEach(([y, z], i) => {
      const pr = new T.Mesh(new T.CylinderGeometry(.24, .24, 3.3, 40, 1, true), glass(COL.peri, .5)); pr.rotation.z = Math.PI / 2; pr.position.set(0, y, z); G.add(pr);
      const en = new T.Mesh(new T.CylinderGeometry(.22, .22, 3.3, 32), glass(COL.endo, .18)); en.rotation.z = Math.PI / 2; en.position.set(0, y, z); G.add(en);
      if (i === 1) label(G, [1.65, y + .25, z], "Perineuro"); if (i === 3) label(G, [1.65, y - .2, z], "Endoneuro");
    });
    S.fascCenters = fasc;
    const cuff = new T.Mesh(new T.TorusGeometry(1.08, .07, 16, 64), mat(0x9fb3c8, { metalness: .6, roughness: .3 })); cuff.rotation.y = Math.PI / 2; cuff.position.x = -.6; G.add(cuff); S.cuff = cuff;
    label(G, [-.6, 1.2, 0], "Eletrodo cuff");
    const hp = new T.Mesh(new T.PlaneGeometry(3.2, 2.2), new T.MeshBasicMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide })); hp.position.z = -1.05; G.add(hp); S.fascHeat = hp;
    label(G, [0, -1.2, -1], "Δ²Vₑ ao longo do eixo", "small");
    return G;
  }
  function populateFibers() {                       // amostra do fascículo hipotético, colorida por recrutamento
    const M = g.AxonModel, grp = S.fiberMeshes; if (!grp || !S.T) return;
    while (grp.children.length) { const c = grp.children[0]; c.material.dispose(); grp.remove(c); }
    if (S.fiberGeo) S.fiberGeo.dispose();
    const rng = M.mulberry32(42), I = S.params.I; let nA = 0, nD = 0, rA = 0, rD = 0;
    const geo = S.fiberGeo = new T.CylinderGeometry(1, 1, 3.25, 6);
    S.fascCenters.forEach(([y0, z0], f) => {
      for (let k = 0; k < 26; k++) {
        const isA = rng() < .4, D = Math.min(16, Math.max(1, isA ? 9 + 1.5 * nrm(rng) : 3 + .8 * nrm(rng)));
        const a = rng() * Math.PI * 2, rad = Math.sqrt(rng()) * .19, y = y0 + rad * Math.cos(a), z = z0 + rad * Math.sin(a);
        const dist = Math.min(.15, Math.max(.03, .03 + .12 * Math.hypot(y - 0, z - 1.05) / 2)) ;   // distância ao contato do cuff (esquema)
        const th = M.interp(S.T, D, dist), rec = I >= th;
        isA ? (nA++, rA += rec) : (nD++, rD += rec);
        const m = new T.Mesh(geo, new T.MeshStandardMaterial({ color: isA ? COL.abeta : COL.adelta, emissive: rec ? (isA ? COL.abeta : COL.adelta) : 0, emissiveIntensity: rec ? 1.1 : 0, transparent: true, opacity: rec ? 1 : .45 }));
        m.scale.set(D * .0035, 1, D * .0035); m.rotation.z = Math.PI / 2; m.position.set(0, y, z); grp.add(m);
      }
    });
    S.fascStats = { nA, nD, rA, rD };
    function nrm(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  }

  // ---------- Nível 4: axônio mielinizado (Prancha II / III)
  function buildAxon() {
    const G = new T.Group(); G.name = "L4";
    const n = 9, seg = .62, gap = .06; S.nodes = []; S.fbars = [];
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * (seg + gap);
      const my = new T.Mesh(new T.CylinderGeometry(.16, .16, seg, 40), mat(COL.myelin, { roughness: .35 })); my.rotation.z = Math.PI / 2; my.position.x = x; G.add(my);
      const ax = new T.Mesh(new T.CylinderGeometry(.11, .11, seg + gap, 24), glass(0xffd89b, .5)); ax.rotation.z = Math.PI / 2; ax.position.x = x; G.add(ax);
      if (i < n - 1) { const nd = new T.Mesh(new T.CylinderGeometry(.115, .115, gap, 24), mat(COL.node, { emissive: COL.node, emissiveIntensity: .6 })); nd.rotation.z = Math.PI / 2; nd.position.x = x + (seg + gap) / 2; G.add(nd); S.nodes.push(nd);
        const bar = new T.Mesh(new T.BoxGeometry(.05, 1, .05), glow(0x3ee6c5)); bar.position.set(nd.position.x, .5, 0); G.add(bar); S.fbars.push(bar); }
    }
    const el = new T.Mesh(new T.SphereGeometry(.07, 16, 16), glow(0xffffff)); el.position.set(0, 1.25, 0); G.add(el);
    label(G, [0, 1.42, 0], "Cátodo (fonte pontual)"); label(G, [-2.6, -.35, 0], "Mielina · d = 0,7·D", "small"); label(G, [.36, -.35, 0], "Nó de Ranvier · 2,5 µm", "small");
    label(G, [2.2, -.6, 0], "L = 100·D", "small");
    S.anim.push(t => { S.nodes.forEach((nd, i) => { const ph = (t * 2 - Math.abs(i - 3.5) * .5) % 3; nd.material.emissiveIntensity = .4 + Math.max(0, 1.5 - ph * 2); }); });
    return G;
  }
  function updateAxonBars() {
    if (!S.fbars) return; const a = g.AxonModel.activation(S.params.D, S.params.r / 10, S.params.I * 1e-3);
    const mid = 20, vals = S.fbars.map((_, i) => a.f[mid - 4 + i]), mx = Math.max(...vals.map(Math.abs)) || 1;
    S.fbars.forEach((b, i) => { const v = vals[i] / mx, h = Math.max(.02, Math.abs(v) * 1.1); b.scale.y = h; b.position.y = v >= 0 ? .2 + h / 2 : .2 - h / 2 - .0; b.material.color.set(v >= 0 ? 0x3ee6c5 : 0xff5d5d); });
  }

  // ---------- Nível 5: membrana e canais (Prancha X)
  function buildMembrane() {
    const G = new T.Group(); G.name = "L5";
    const heads = new T.InstancedMesh(new T.SphereGeometry(.05, 10, 10), mat(0xf1c27d), 2 * 26 * 14), m4 = new T.Matrix4(); let k = 0;
    for (const s of [-1, 1]) for (let i = 0; i < 26; i++) for (let j = 0; j < 14; j++) { m4.makeTranslation(-1.6 + i * .128, s * .32, -.9 + j * .128); heads.setMatrixAt(k++, m4); }
    G.add(heads);
    const tails = new T.Mesh(new T.BoxGeometry(3.3, .5, 1.8), glass(0xffe6b3, .28)); G.add(tails);
    label(G, [-1.75, .55, .9], "Bicamada lipídica ≈ 5 nm", "small");
    const chan = (x, z, c, name, kind) => {
      const grp = new T.Group(); grp.position.set(x, 0, z);
      if (kind === "piezo") { for (let b = 0; b < 3; b++) { const bl = new T.Mesh(new T.BoxGeometry(.55, .06, .14), mat(c)); bl.rotation.y = b * 2.094; bl.position.y = .42; bl.rotation.z = .25; grp.add(bl); } }
      for (let s = 0; s < 4; s++) { const p = new T.Mesh(new T.CylinderGeometry(.075, .075, .95, 16), mat(c, { emissive: c, emissiveIntensity: .25 })); p.position.set(Math.cos(s * 1.571) * .12, 0, Math.sin(s * 1.571) * .12); grp.add(p); }
      G.add(grp); label(G, [x, .78, z], name); return grp;
    };
    chan(-1, .2, 0x3ec7ff, "NaV1.7 / NaV1.8"); chan(0, -.1, 0x9b8cff, "Piezo1/2", "piezo"); chan(.9, .3, 0xff6b6b, "TRPV1"); chan(.4, -.6, 0x6ee7a8, "TRAAK/TREK");
    const ions = new T.InstancedMesh(new T.SphereGeometry(.025, 8, 8), glow(0xfff36b), 40), seeds = [...Array(40)].map((_, i) => [Math.random(), i % 4]);
    G.add(ions); const xs = [-1, 0, .9, .4], zs = [.2, -.1, .3, -.6];
    S.anim.push(t => { seeds.forEach(([s, c], i) => { const y = 1.2 - ((t * .5 + s * 3) % 2.4); const off = Math.abs(y) < .5 ? 0 : (s - .5) * .6; m4.makeTranslation(xs[c] + off, y, zs[c] + off * .5); ions.setMatrixAt(i, m4); }); ions.instanceMatrix.needsUpdate = true; });
    label(G, [1.4, -.8, .9], "kBT ≈ 4,28×10⁻²¹ J (310 K)", "small");
    return G;
  }

  // ---------- campos
  function updateHeat() {
    const p = S.params, M = g.AxonModel;
    if (S.heatPlane) {
      const depth = .43 + p.r * .15, isMech = p.modality === "acu";
      if (S.heatPlane.material.map) S.heatPlane.material.map.dispose();
      S.heatPlane.material.map = heatTex((u, v) => { const x = (u - .5) * 2.6, y = -v * 1.2 + .0, d = Math.hypot(x, y + .0 - (-0)) + .05, field = isMech ? Math.exp(-((x * x) / .08 + (y * y) / .4)) : Math.min(1, .08 / d * (p.I / .6)); return field; }, 160, 80);
      S.heatPlane.material.needsUpdate = true;
      S.regionNerve.position.y = -depth; S.regionVessel.position.set(0, -depth - .05, .3); S.heatPlane.position.y = -.6;
      Object.values(S.dev).forEach(d => d.visible = false);
      const d = S.dev[p.modality] || S.dev.tens; d.visible = true;
      if (d === S.dev.ea) d.position.set(0, .3 - depth * .3, 0); else if (d === S.dev.acu) d.position.set(0, .2, 0); else if (d === S.dev.lifu) { d.position.set(0, .5, 0); } else d.position.set(0, .02, 0);
    }
    if (S.fascHeat) {
      const a = M.activation(p.D, p.r / 10, p.I * 1e-3), mx = Math.max(...a.f);
      if (S.fascHeat.material.map) S.fascHeat.material.map.dispose();
      S.fascHeat.material.map = heatTex((u, v) => { const i = Math.round(u * 40), fv = a.f[i] / mx, prof = Math.exp(-Math.pow((v - .5) * 3, 2)); return Math.max(0, fv) * prof; }, 164, 64);
      S.fascHeat.material.needsUpdate = true;
    }
    updateAxonBars(); populateFibers();
  }

  // ---------- câmera e transição de escala
  const VIEWS = { 1: { d: 4.4, t: [0, .1, 0], phi: 1.4, th: .25 }, 2: { d: 3.6, t: [0, -.4, 0], phi: 1.15, th: .6 }, 3: { d: 4.2, t: [0, 0, 0], phi: 1.25, th: .9 }, 4: { d: 5.6, t: [0, .2, 0], phi: 1.3, th: .1 }, 5: { d: 4.2, t: [0, 0, 0], phi: 1.0, th: .5 } };
  function setLevel(l, quiet) {
    l = Math.max(1, Math.min(5, l)); if (l === S.level && !quiet && S.groups["L" + l].visible) return;
    const fade = host.querySelector(".stage-fade"); fade.classList.add("on");
    setTimeout(() => {
      S.level = l; Object.entries(S.groups).forEach(([k, gg]) => gg.visible = k === "L" + l);
      const v = VIEWS[l]; cam.dist = v.d * 1.8; cam.goal = v; cam.target.set(...v.t);
      S.labels.forEach(L => L.el.style.display = L.group.visible ? "" : "none");
      fade.classList.remove("on"); if (!quiet) document.dispatchEvent(new CustomEvent("axon:scale", { detail: { level: l } }));
    }, quiet ? 0 : 260);
  }

  function init(el) {
    host = el; labelLayer = el.querySelector(".labels");
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(2, g.devicePixelRatio || 1));
    renderer.outputEncoding = T.sRGBEncoding; el.querySelector(".gl").appendChild(renderer.domElement);
    scene = new T.Scene(); camera = new T.PerspectiveCamera(38, 1, .01, 100);
    scene.add(new T.HemisphereLight(0xcff6ff, 0x0b1d24, .9)); const dl = new T.DirectionalLight(0xffffff, .9); dl.position.set(2, 3, 4); scene.add(dl);
    const rim = new T.PointLight(0x3ee6c5, .8, 20); rim.position.set(-3, 1, -2); scene.add(rim);
    S.groups = { L1: buildBody(), L2: buildRegion(), L3: buildFascicle(), L4: buildAxon(), L5: buildMembrane() };
    Object.values(S.groups).forEach(gg => scene.add(gg));
    S.T = g.AxonModel.grid();
    raycaster = new T.Raycaster(); mouse = new T.Vector2(); clock = new T.Clock();
    // interação: arrastar gira, roda aproxima (zoom semântico ao passar dos limites)
    let drag = null; const cv = renderer.domElement;
    cv.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); cam.theta -= dx * .006; cam.phi = Math.max(.25, Math.min(2.9, cam.phi - dy * .006)); drag.x = e.clientX; drag.y = e.clientY; cam.goal = null; });
    cv.addEventListener("pointerup", e => { if (drag && drag.moved < 5) pick(e); drag = null; });
    let wheelAcc = 0;
    cv.addEventListener("wheel", e => { e.preventDefault(); cam.goal = null; const v = VIEWS[S.level]; cam.dist *= Math.exp(e.deltaY * .001);
      if (cam.dist < v.d * .55) { wheelAcc++; if (wheelAcc > 3 && S.level < 5) { wheelAcc = 0; setLevel(S.level + 1); } cam.dist = v.d * .55; }
      else if (cam.dist > v.d * 2.2) { wheelAcc--; if (wheelAcc < -3 && S.level > 1) { wheelAcc = 0; setLevel(S.level - 1); } cam.dist = v.d * 2.2; } else wheelAcc = 0; }, { passive: false });
    new ResizeObserver(resize).observe(el); resize();
    setLevel(1, true); updateHeat(); loop();
  }
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect(); mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    raycaster.setFromCamera(mouse, camera); const hit = raycaster.intersectObjects(S.hot.filter(h => h.parent.visible))[0];
    if (hit) { document.dispatchEvent(new CustomEvent("axon:select", { detail: { region: hit.object.userData.region } })); setTimeout(() => setLevel(2), 350); }
  }
  function resize() { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const tmp = new T.Vector3();
  function loop() {
    requestAnimationFrame(loop); const t = clock.getElapsedTime();
    if (cam.goal) { cam.dist += (cam.goal.d - cam.dist) * .08; cam.phi += (cam.goal.phi - cam.phi) * .06; cam.theta += (cam.goal.th - cam.theta) * .06; if (Math.abs(cam.goal.d - cam.dist) < .01) cam.goal = null; }
    else if (!S.paused) cam.theta += .0008;
    camera.position.set(cam.target.x + cam.dist * Math.sin(cam.phi) * Math.sin(cam.theta), cam.target.y + cam.dist * Math.cos(cam.phi), cam.target.z + cam.dist * Math.sin(cam.phi) * Math.cos(cam.theta));
    camera.lookAt(cam.target);
    S.anim.forEach(f => f(t)); if (S.skin) S.skin.uniforms.t.value = t;
    renderer.render(scene, camera);
    const w = host.clientWidth, h = host.clientHeight;
    S.labels.forEach(L => { if (!L.group.visible) return; tmp.copy(L.pos).applyMatrix4(L.group.matrixWorld).project(camera); const vis = tmp.z < 1; L.el.style.transform = `translate(${(tmp.x * .5 + .5) * w}px, ${(-tmp.y * .5 + .5) * h}px)`; L.el.style.opacity = vis ? 1 : 0; });
  }

  g.AxonStage = {
    init, setLevel, get level() { return S.level; },
    setParams(p) { Object.assign(S.params, p); updateHeat(); return S.fascStats; },
    setLayer(name, on) { if (name === "dermatomes" && S.skin) S.skin.uniforms.derm.value = on ? 1 : 0; S.groups.L1.traverse(o => { if (name === "acupoints" && o.userData.acu) o.visible = on; }); },
    stats: () => S.fascStats, pause(v) { S.paused = v; }
  };
})(window);
