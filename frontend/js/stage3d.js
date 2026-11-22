/* axon · stage3d.js v0.2 — Palco central 3D hiper-realista com Motor de Zoom Semântico (5 níveis).
 * Three.js r128. Materiais PBR com mapas procedurais (textures.js), iluminação por ambiente (PMREM) e
 * tone mapping ACES. Geometria anatômica esquemática em proporções humanas médias [PREMISSA didática];
 * relações do Nível 4 (d = 0,7·D, L = 100·D, nó 2,5 µm) e recrutamento do Nível 3 vêm do modelo.
 * Eventos: axon:scale {level}, axon:select {region}, axon:dermatome {code}. */
(function (g) {
  "use strict";
  const T = g.THREE, TX = g.AxonTex;
  const COL = { nerve: 0xffc65c, vagus: 0x5ab8ff, symp: 0x6ee7a8, abeta: 0x4fb3ff, adelta: 0xff8a3d, bone: 0xece3cf };
  const S = { level: 1, groups: {}, built: {}, labels: [], hot: [], anim: [], params: { D: 9, r: 1, I: 0.6, modality: "tens", pressure: 60 }, layers: {} };
  let renderer, scene, camera, host, labelLayer, raycaster, mouse, clock, envMap;
  const cam = { theta: 0.3, phi: 1.42, dist: 6, target: new T.Vector3(0, 0, 0), goal: null };
  const V3 = (x, y, z) => new T.Vector3(x, y, z);

  // ======================================================== materiais
  const texCache = {};
  function ptex(name, rep = [1, 1]) {
    const key = name + rep; if (texCache[key]) return texCache[key];
    const src = TX.T[name](); const out = { map: TX.toTexture(T, src.map, rep), normalMap: TX.toTexture(T, src.normal, rep, false) };
    return (texCache[key] = out);
  }
  function phys(color, o = {}) {
    const opt = Object.assign({ color, roughness: .55, metalness: 0, clearcoat: .15, clearcoatRoughness: .4, envMapIntensity: .9 }, o);
    const tex = opt.tex, rep = opt.rep, ns = opt.ns; delete opt.tex; delete opt.rep; delete opt.ns;
    const m = new T.MeshPhysicalMaterial(opt);
    if (tex) { const t = ptex(tex, rep); m.map = t.map; m.normalMap = t.normalMap; m.normalScale = new T.Vector2(ns || .8, ns || .8); }
    return m;
  }
  const glass = (c, op = .2, o = {}) => phys(c, Object.assign({ transparent: true, opacity: op, depthWrite: false, side: T.DoubleSide, roughness: .25, clearcoat: .6 }, o));
  const glow = (c, op = .95) => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
  const metal = (c, r = .22) => new T.MeshStandardMaterial({ color: c, metalness: 1, roughness: r, envMapIntensity: 1.2 });
  const nerveMat = (c = COL.nerve, e = .45) => phys(c, { emissive: c, emissiveIntensity: e, roughness: .4, clearcoat: .5 });

  // ======================================================== geometria utilitária
  const curve = pts => new T.CatmullRomCurve3(pts.map(p => p.isVector3 ? p : V3(...p)), false, "centripetal");
  function tube(pts, r, m, seg = 64, rs = 8) { return new T.Mesh(new T.TubeGeometry(curve(pts), seg, r, rs, false), m); }
  function interp(tab, t) { // tabela [[t,v],...] → interpolação suave (cosseno)
    for (let i = 0; i < tab.length - 1; i++) { const [a, va] = tab[i], [b, vb] = tab[i + 1]; if (t <= b) { const u = (t - a) / (b - a), s = (1 - Math.cos(Math.PI * u)) / 2; return va + (vb - va) * s; } }
    return tab[tab.length - 1][1];
  }
  /* Varredura (sweep) de seção elíptica ao longo de uma curva: base das partes do corpo.
   * rfn(t) → [rx, rz]; dermFn(t, θ, posição, normal aproximada) → índice do dermátomo. */
  function sweep(c, rfn, nU = 64, nV = 32, dermFn = null, frameUp = V3(0, 0, 1)) {
    const pos = [], uv = [], derm = [], idx = [];
    for (let i = 0; i <= nU; i++) {
      const t = i / nU, p = c.getPointAt(t), tg = c.getTangentAt(t).normalize();
      let n1 = frameUp.clone().sub(tg.clone().multiplyScalar(frameUp.dot(tg))); if (n1.lengthSq() < 1e-6) n1 = V3(1, 0, 0); n1.normalize();
      const n2 = tg.clone().cross(n1).normalize(); const [rx, rz] = rfn(t);
      for (let j = 0; j <= nV; j++) {
        const th = j / nV * Math.PI * 2, cx = Math.cos(th), sz = Math.sin(th);
        const off = n2.clone().multiplyScalar(cx * rx).add(n1.clone().multiplyScalar(sz * rz)), w = p.clone().add(off);
        pos.push(w.x, w.y, w.z); uv.push(j / nV, t);
        if (dermFn) derm.push(dermFn(t, th, w, off.normalize()));
      }
    }
    for (let i = 0; i < nU; i++) for (let j = 0; j < nV; j++) { const a = i * (nV + 1) + j, b = a + nV + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const gm = new T.BufferGeometry(); gm.setIndex(idx); gm.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); gm.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    if (dermFn) gm.setAttribute("derm", new T.Float32BufferAttribute(derm, 1));
    gm.computeVertexNormals(); return gm;
  }

  // ======================================================== dermátomos (mapa didático simplificado)
  const DERM = ["V1", "V2", "V3", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12", "L1", "L2", "L3", "L4", "L5", "S1", "S2", "S3–S5"];
  const D = c => DERM.indexOf(c);
  const PAL = DERM.map((c, i) => { const col = new T.Color();
    if (c[0] === "V") col.setHSL(.13 + i * .03, .75, .6); else if (c[0] === "C") col.setHSL(.55 + (i - 3) * .018, .7, .58);
    else if (c[0] === "T") col.setHSL(i % 2 ? .47 : .5, .65, i % 2 ? .52 : .62); else if (c[0] === "L") col.setHSL(.05 + (i - 22) * .02, .85, .6); else col.setHSL(.78 + (i - 27) * .03, .6, .62);
    return col; });
  function dermTorso(t, th, w, n) {
    const front = n.z, y = w.y + .06 * Math.max(0, front);
    if (y > 1.1) return D("C4"); if (y < -.2) return D("L1");
    const lvl = y > .82 ? 2 + (1.1 - y) / .28 * 2 : y > .28 ? 4 + (.82 - y) / .54 * 6 : 10 + (.28 - y) / .48 * 2;
    return D("T" + Math.max(2, Math.min(12, Math.round(lvl))));
  }
  const dermArm = side => (t, th, w, n) => {
    const lat = n.x * side, ant = n.z;
    if (t < .42) return lat > -.2 ? D("C5") : (t < .12 ? D("T2") : D("T1"));
    if (t < .78) return lat > .25 ? D("C6") : lat < -.25 ? D("C8") : (ant < 0 ? D("C7") : (lat > 0 ? D("C6") : D("C8")));
    return D("C7");
  };
  const dermLeg = side => (t, th, w, n) => {
    const lat = n.x * side, ant = n.z;
    if (t < .46) { if (ant < -.15) return (t < .1 && lat < 0) ? D("S3–S5") : D("S2"); return t < .14 ? D("L1") : t < .3 ? D("L2") : D("L3"); }
    if (t < .55) return ant > 0 ? (lat < 0 ? D("L4") : D("L3")) : D("S2");
    if (ant < -.3) return D("S1"); return lat < 0 ? D("L4") : D("L5");
  };
  function dermHead(t, th, w, n) {
    if (n.z < -.2 || w.y > 1.69) return D("C2");
    if (w.y < 1.37) return n.z > 0 ? D("C3") : D("C2");
    return w.y > 1.6 ? D("V1") : w.y > 1.5 ? D("V2") : D("V3");
  }
  function skinMaterial() {
    const pal = PAL.map(c => V3(c.r, c.g, c.b));
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide,
      uniforms: { pal: { value: pal }, dermOn: { value: 1 }, sel: { value: -1 }, t: { value: 0 }, nmap: { value: ptex("skin", [1, 1]).normalMap } },
      vertexShader: `attribute float derm; uniform vec3 pal[30]; uniform float sel;
        varying vec3 vN; varying vec3 vV; varying vec3 vC; varying float vS; varying vec2 vUv;
        void main(){ int k=int(derm+.5); vec3 c=vec3(0.);
          for(int i=0;i<30;i++){ if(i==k) c=pal[i]; }
          vC=c; vS=abs(derm-sel)<.5?1.:0.; vUv=uv;
          vec4 mv=modelViewMatrix*vec4(position,1.); vV=-mv.xyz; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform float dermOn; uniform float t; uniform sampler2D nmap; varying vec3 vN; varying vec3 vV; varying vec3 vC; varying float vS; varying vec2 vUv;
        void main(){ vec3 nb=texture2D(nmap,vUv*vec2(6.,14.)).xyz*2.-1.; vec3 N=normalize(vN+nb*.18); vec3 V=normalize(vV);
          float f=pow(1.-abs(dot(N,V)),2.4); vec3 skin=vec3(.86,.62,.52); vec3 c=mix(skin,vC,dermOn*.62);
          float spec=pow(max(dot(reflect(-V,N),normalize(vec3(.4,.8,.6))),0.),24.)*.35;
          c=c*(.42+.9*f)+spec; c+=vS*vec3(1.,.95,.7)*(.35+.25*sin(t*4.));
          gl_FragColor=vec4(c, .16+.6*f+vS*.25); }`
    });
  }

  // ======================================================== etiquetas e hotspots
  function label(group, pos, text, cls = "") { const el = document.createElement("div"); el.className = "lbl " + cls; el.textContent = text; labelLayer.appendChild(el); S.labels.push({ el, group, pos: pos.isVector3 ? pos : V3(...pos) }); return el; }
  function hotspot(group, pos, region, color = 0xffffff, text) {
    const m = new T.Mesh(new T.SphereGeometry(.03, 16, 16), glow(color)); m.position.set(...pos); m.userData.region = region; group.add(m); S.hot.push(m);
    const ring = new T.Mesh(new T.RingGeometry(.045, .056, 40), new T.MeshBasicMaterial({ color, transparent: true, opacity: .7, side: T.DoubleSide, depthWrite: false }));
    ring.position.copy(m.position); group.add(ring);
    S.anim.push(t => { const s = 1 + .4 * Math.sin(t * 3 + pos[1] * 5); ring.scale.set(s, s, s); ring.lookAt(camera.position); });
    if (text) label(group, pos, text, color === 0x5ab8ff ? "blue" : "");
  }

  // ======================================================== Nível 1 — corpo inteiro
  function buildBody() {
    const G = new T.Group(); G.name = "L1";
    const L = { skin: new T.Group(), skeleton: new T.Group(), organs: new T.Group(), nerves: new T.Group(), autonomic: new T.Group(), acupoints: new T.Group() };
    Object.entries(L).forEach(([k, gg]) => { gg.name = k; G.add(gg); }); S.layers = L;
    const skin = S.skin = skinMaterial(); S.skinMeshes = [];
    const addSkin = gm => { const m = new T.Mesh(gm, skin); m.renderOrder = 10; L.skin.add(m); S.skinMeshes.push(m); return m; };

    // --- pele (forma anatômica por varredura elíptica)
    addSkin(sweep(curve([[0, -.36, 0], [0, -.05, .005], [0, .3, .01], [0, .7, .0], [0, 1.08, -.01], [0, 1.2, -.02]]),
      t => [interp([[0, .2], [.08, .3], [.25, .285], [.4, .255], [.55, .27], [.72, .33], [.86, .36], [.93, .3], [1, .1]], t), interp([[0, .14], [.1, .17], [.3, .15], [.45, .14], [.6, .16], [.72, .19], [.86, .17], [1, .08]], t)], 72, 40, dermTorso));
    addSkin(sweep(curve([[0, 1.16, -.02], [0, 1.27, -.01], [0, 1.38, .0]]), t => [interp([[0, .1], [.5, .068], [1, .075]], t), interp([[0, .08], [.5, .065], [1, .07]], t)], 12, 28, (t, th, w) => w.y > 1.3 ? D("C3") : D("C4")));
    addSkin(sweep(curve([[0, 1.32, .03], [0, 1.45, .02], [0, 1.6, 0], [0, 1.74, -.01]]), t => [interp([[0, .02], [.12, .085], [.3, .125], [.55, .145], [.8, .13], [.95, .07], [1, .01]], t), interp([[0, .03], [.12, .1], [.35, .155], [.6, .165], [.85, .14], [1, .01]], t)], 40, 36, dermHead));
    for (const sd of [-1, 1]) {
      const arm = curve([[sd * .3, 1.1, -.01], [sd * .42, 1.03, -.01], [sd * .5, .78, -.02], [sd * .54, .56, -.02], [sd * .58, .32, .01], [sd * .61, .13, .03]]);
      addSkin(sweep(arm, t => { const r = interp([[0, .095], [.15, .085], [.35, .072], [.5, .055], [.6, .062], [.85, .045], [1, .035]], t); return [r, r * .9]; }, 64, 28, dermArm(sd)));
      addSkin(sweep(curve([[sd * .61, .13, .03], [sd * .625, .05, .035], [sd * .63, -.04, .035]]), t => [interp([[0, .04], [.5, .05], [1, .046]], t), .017], 10, 20, (t, th, w) => (w.x * sd) > .628 ? D("C8") : (w.x * sd) < .615 ? D("C6") : D("C7")));
      const fx = [-.03, -.012, .004, .02, .034], fl = [.07, .1, .11, .1, .08];
      fx.forEach((dx, fi) => { const x0 = sd * (.63 + (fi === 0 ? -.045 : dx)), y0 = fi === 0 ? .06 : -.04, z0 = fi === 0 ? .055 : .035;
        const fc = curve([[x0, y0, z0], [x0 - sd * (fi === 0 ? .02 : 0), y0 - fl[fi] * .5, z0 + .006], [x0 - sd * (fi === 0 ? .03 : 0), y0 - fl[fi], z0 + .012]]);
        const code = fi <= 1 ? D("C6") : fi === 2 ? D("C7") : D("C8");
        addSkin(sweep(fc, t => { const r = interp([[0, .011], [.9, .008], [1, .003]], t); return [r, r]; }, 10, 12, () => code)); });
      const leg = curve([[sd * .14, -.2, 0], [sd * .15, -.6, .01], [sd * .16, -1.02, .01], [sd * .16, -1.45, -.01], [sd * .155, -1.84, -.01]]);
      addSkin(sweep(leg, t => { const r = interp([[0, .15], [.18, .135], [.42, .09], [.5, .075], [.62, .085], [.8, .06], [1, .045]], t); return [r, r * .95]; }, 64, 30, dermLeg(sd)));
      addSkin(sweep(curve([[sd * .155, -1.88, -.05], [sd * .158, -1.92, .04], [sd * .165, -1.94, .17]]), t => [interp([[0, .045], [.5, .05], [1, .035]], t), interp([[0, .05], [.5, .03], [1, .015]], t)], 16, 18, (t, th, w, n) => n.y < -.3 || (n.x * sd) > .4 ? D("S1") : (n.x * sd) < -.3 ? D("L4") : D("L5"), V3(0, 1, 0)));
      const ear = new T.Mesh(new T.TorusGeometry(.03, .009, 10, 28, Math.PI * 1.6), phys(0xe7b39c, { transparent: true, opacity: .55, tex: "skin", rep: [2, 2] }));
      ear.position.set(sd * .158, 1.53, -.01); ear.rotation.set(0, sd * Math.PI / 2, -Math.PI * .1); L.skin.add(ear);
    }

    // --- esqueleto
    const boneM = phys(COL.bone, { tex: "bone", rep: [2, 2], roughness: .6 });
    const discM = phys(0x9fc7d6, { transparent: true, opacity: .75, roughness: .3, clearcoat: .8 });
    const B = L.skeleton;
    const skull = new T.Mesh(new T.SphereGeometry(.13, 40, 32), phys(COL.bone, { tex: "bone", rep: [2, 2], transparent: true, opacity: .35, depthWrite: false })); skull.scale.set(1, 1.12, 1.18); skull.position.set(0, 1.58, -.01); B.add(skull);
    const jaw = new T.Mesh(new T.TorusGeometry(.075, .016, 10, 30, Math.PI), boneM); jaw.position.set(0, 1.45, .03); jaw.rotation.set(Math.PI / 2 + .35, 0, Math.PI); B.add(jaw);
    const vy = []; let y = 1.37;
    for (let i = 0; i < 24; i++) { const reg = i < 7 ? 0 : i < 19 ? 1 : 2, h = [.032, .042, .05][reg], r = [.026, .033, .044][reg]; y -= h / 2; vy.push(y);
      const body = new T.Mesh(new T.CylinderGeometry(r, r * 1.05, h * .78, 20), boneM); body.position.set(0, y, -.1); B.add(body);
      const sp = new T.Mesh(new T.BoxGeometry(.012, h * .5, .06 + reg * .01), boneM); sp.position.set(0, y - .004, -.16); sp.rotation.x = reg === 1 ? .5 : .15; B.add(sp);
      for (const sd of [-1, 1]) { const tp = new T.Mesh(new T.BoxGeometry(.045, .012, .014), boneM); tp.position.set(sd * (r + .018), y, -.12); B.add(tp); }
      const disc = new T.Mesh(new T.CylinderGeometry(r * 1.02, r * 1.02, h * .2, 20), discM); disc.position.set(0, y - h * .48, -.1); B.add(disc); y -= h / 2; }
    S.vy = vy;
    const sac = new T.Mesh(new T.ConeGeometry(.07, .2, 20), boneM); sac.position.set(0, y - .09, -.12); sac.rotation.x = Math.PI + .3; B.add(sac);
    const cart = phys(0xbfdbe4, { transparent: true, opacity: .75, roughness: .3 });
    for (let i = 0; i < 12; i++) { const yy = vy[7 + i], w = interp([[0, .14], [3, .23], [7, .27], [11, .2]], i), dz = interp([[0, .1], [5, .16], [11, .12]], i), drop = .1 + i * .012, len = i < 10 ? 1 : .55;
      for (const sd of [-1, 1]) { const pts = []; for (let k = 0; k <= 12; k++) { const a = -Math.PI / 2 + k / 12 * Math.PI * len; pts.push(V3(sd * Math.cos(a) * w, yy - (k / 12) * drop * len, -.1 + Math.sin(a) * dz)); }
        B.add(tube(len < 1 ? pts : pts.slice(0, 11), .0075, boneM, 40, 6));
        if (len === 1) { const end = pts[10], st = V3(sd * .02, i < 7 ? vy[7 + i] - .12 - i * .01 : vy[13] - .2, .09); B.add(tube([end, end.clone().lerp(st, .5).add(V3(0, -.01, .01)), st], .006, cart, 16, 6)); } } }
    const stern = new T.Mesh(new T.BoxGeometry(.035, .26, .015), boneM); stern.position.set(0, .93, .095); stern.rotation.x = -.15; B.add(stern);
    for (const sd of [-1, 1]) {
      B.add(tube([[sd * .02, 1.12, .07], [sd * .15, 1.13, .05], [sd * .3, 1.12, -.02]], .009, boneM, 20, 6));
      const sc = new T.Shape(); sc.moveTo(0, 0); sc.lineTo(.11, .02); sc.lineTo(.03, -.2); sc.lineTo(0, 0);
      const scap = new T.Mesh(new T.ShapeGeometry(sc), phys(COL.bone, { tex: "bone", side: T.DoubleSide })); scap.position.set(sd * .12, 1.08, -.2); scap.scale.x = sd; scap.rotation.y = sd * .3; B.add(scap);
      const H = [[sd * .38, 1.05, -.02], [sd * .48, .8, -.02], [sd * .535, .57, -.02]];
      B.add(tube(H, .014, boneM, 24, 8)); const hh = new T.Mesh(new T.SphereGeometry(.03, 16, 16), boneM); hh.position.set(...H[0]); B.add(hh);
      B.add(tube([[sd * .535, .56, -.03], [sd * .57, .34, -.01], [sd * .6, .14, .0]], .009, boneM, 20, 6));
      B.add(tube([[sd * .54, .56, .0], [sd * .58, .34, .02], [sd * .615, .14, .04]], .008, boneM, 20, 6));
      for (let f = 0; f < 5; f++) B.add(tube([[sd * (.6 + f * .009), .1, .035], [sd * (.61 + f * .006), -.03, .04], [sd * (.6 + f * .009), -.11 + (f === 0 ? .1 : 0), .045]], .0045, boneM, 10, 5));
      const il = new T.Mesh(new T.TorusGeometry(.12, .03, 10, 24, Math.PI * .9), boneM); il.position.set(sd * .1, -.12, -.05); il.rotation.set(Math.PI / 2 - .2, sd * .5, sd > 0 ? -.3 : Math.PI + .3); B.add(il);
      const fh = new T.Mesh(new T.SphereGeometry(.032, 16, 16), boneM); fh.position.set(sd * .12, -.24, -.01); B.add(fh);
      B.add(tube([[sd * .12, -.24, -.01], [sd * .17, -.3, -.0], [sd * .16, -.65, .0], [sd * .16, -1.0, .0]], .018, boneM, 30, 8));
      const pat = new T.Mesh(new T.SphereGeometry(.025, 12, 12), boneM); pat.scale.set(1, 1.2, .5); pat.position.set(sd * .16, -1.02, .07); B.add(pat);
      B.add(tube([[sd * .155, -1.06, .01], [sd * .155, -1.45, .0], [sd * .15, -1.82, -.01]], .016, boneM, 24, 8));
      B.add(tube([[sd * .2, -1.08, -.02], [sd * .2, -1.45, -.03], [sd * .19, -1.82, -.03]], .007, boneM, 24, 6));
      B.add(tube([[sd * .155, -1.88, -.04], [sd * .16, -1.91, .05], [sd * .165, -1.93, .15]], .012, boneM, 12, 6));
    }
    const pub = new T.Mesh(new T.TorusGeometry(.07, .016, 8, 20, Math.PI), boneM); pub.position.set(0, -.27, .03); pub.rotation.x = Math.PI / 2 + .4; B.add(pub);

    // --- órgãos
    const O = L.organs;
    const brain = new T.Mesh(new T.SphereGeometry(.115, 48, 40), phys(0xe2a7ac, { tex: "brain", rep: [3, 2], ns: 1.4, roughness: .45 })); brain.scale.set(.95, .82, 1.12); brain.position.set(0, 1.61, -.01); O.add(brain);
    const cereb = new T.Mesh(new T.SphereGeometry(.05, 24, 20), phys(0xd7949b, { tex: "brain", rep: [6, 2], ns: 1.6 })); cereb.scale.set(1.4, .8, 1); cereb.position.set(0, 1.5, -.1); O.add(cereb);
    const heart = new T.Mesh(new T.SphereGeometry(.07, 32, 24), phys(0xb3263a, { tex: "vessel", rep: [2, 2], clearcoat: .9 })); heart.scale.set(.9, 1.1, .85); heart.rotation.z = .5; heart.position.set(.03, .78, .03); O.add(heart);
    for (const sd of [-1, 1]) { const lung = new T.Mesh(new T.SphereGeometry(.11, 32, 24), glass(0xf2a7b3, .22)); lung.scale.set(.9, 1.7, .9); lung.position.set(sd * .14, .84, -.02); O.add(lung);
      const kid = new T.Mesh(new T.SphereGeometry(.035, 20, 16), phys(0x8e2c35)); kid.scale.set(.8, 1.4, .7); kid.position.set(sd * .1, .3, -.11); O.add(kid); }
    const stom = new T.Mesh(new T.SphereGeometry(.07, 24, 18), glass(0xe8b58f, .3)); stom.scale.set(1.3, .9, .8); stom.position.set(-.06, .45, .05); O.add(stom);

    // --- sistema nervoso periférico e central
    const N = L.nerves, NM = nerveMat(), drg = phys(0xffe08a, { emissive: 0xffc65c, emissiveIntensity: .6 });
    N.add(tube([[0, 1.52, -.06], [0, 1.4, -.09], [0, .9, -.1], [0, .3, -.1], [0, -.05, -.11]], .012, phys(0xfff1cc, { emissive: 0xffe0a0, emissiveIntensity: .35, clearcoat: .8 }), 80, 10));
    const lvl = vy.concat([vy[23] - .05, vy[23] - .09, vy[23] - .12, vy[23] - .15, vy[23] - .18]);
    for (let i = 0; i < 29; i++) { const yy = lvl[i]; for (const sd of [-1, 1]) {
      N.add(tube([[sd * .012, yy + .005, -.1], [sd * .045, yy - .01, -.1], [sd * .07, yy - .025, -.095]], .004, NM, 8, 5));
      const gang = new T.Mesh(new T.SphereGeometry(.009, 10, 10), drg); gang.scale.set(1.4, 1, 1); gang.position.set(sd * .06, yy - .02, -.097); N.add(gang); } }
    const NV = (pts, r = .0055, m = NM) => N.add(tube(pts, r, m, 60, 6));
    for (const sd of [-1, 1]) {
      const plex = [[sd * .07, 1.12, -.09], [sd * .2, 1.06, -.04], [sd * .36, 1.0, -.02]];
      NV([...plex, [sd * .47, .78, .02], [sd * .53, .55, .03], [sd * .57, .33, .045], [sd * .6, .14, .05], [sd * .61, .02, .055]], .006);
      NV([...plex, [sd * .46, .76, -.04], [sd * .52, .56, -.045], [sd * .58, .3, .0], [sd * .62, .1, .02], [sd * .65, -.02, .03]], .005);
      NV([[sd * .36, 1.0, -.03], [sd * .44, .9, -.07], [sd * .52, .72, -.05], [sd * .55, .56, .0], [sd * .6, .3, .0], [sd * .62, .1, -.01]], .005);
      NV([[sd * .36, 1.0, -.01], [sd * .46, .82, .05], [sd * .53, .6, .05], [sd * .58, .4, .04]], .0035);
      for (let i = 0; i < 11; i++) { const yy = vy[7 + i] - .02, w = interp([[0, .13], [3, .22], [7, .26], [11, .19]], i), dz = interp([[0, .09], [5, .15], [11, .11]], i), pts = [];
        for (let k = 0; k <= 9; k++) { const a = -Math.PI / 2 + k / 9 * Math.PI * .95; pts.push(V3(sd * Math.cos(a) * w, yy - k / 9 * (.12 + i * .012), -.1 + Math.sin(a) * dz)); } N.add(tube(pts, .0025, NM, 30, 4)); }
      NV([[sd * .06, .05, -.09], [sd * .1, -.12, -.02], [sd * .13, -.3, .07], [sd * .15, -.55, .08], [sd * .15, -.85, .06]], .006);
      NV([[sd * .05, .0, -.09], [sd * .08, -.2, -.0], [sd * .11, -.4, .02], [sd * .12, -.65, .0]], .004);
      NV([[sd * .06, -.1, -.11], [sd * .11, -.25, -.12], [sd * .15, -.55, -.08], [sd * .16, -.95, -.06]], .011);
      NV([[sd * .16, -.95, -.06], [sd * .16, -1.3, -.06], [sd * .155, -1.78, -.04], [sd * .155, -1.92, .03], [sd * .16, -1.94, .12]], .007);
      NV([[sd * .16, -.95, -.06], [sd * .2, -1.1, -.03], [sd * .19, -1.4, .04], [sd * .17, -1.86, .05], [sd * .165, -1.92, .14]], .005);
      const tg = [sd * .05, 1.5, .03]; const tgg = new T.Mesh(new T.SphereGeometry(.012, 12, 12), drg); tgg.position.set(...tg); N.add(tgg);
      NV([tg, [sd * .06, 1.58, .1], [sd * .04, 1.66, .14]], .003); NV([tg, [sd * .07, 1.52, .12], [sd * .05, 1.5, .155]], .003); NV([tg, [sd * .07, 1.44, .08], [sd * .03, 1.4, .12]], .003);
      NV([[sd * .04, 1.48, -.02], [sd * .13, 1.5, .0], [sd * .12, 1.45, .08]], .0025);
    }
    const VM = nerveMat(COL.vagus, .6), A = L.autonomic;
    for (const sd of [-1, 1]) {
      A.add(tube([[sd * .02, 1.48, -.04], [sd * .05, 1.35, .01], [sd * .06, 1.1, .03], [sd * .05, .9, .03], [sd * .03, .6, .02], [sd * .02, .4, .04]], .0055, VM, 60, 6));
      A.add(tube([[sd * .05, .95, .03], [sd * .02, .82, .05]], .003, VM, 10, 4)); A.add(tube([[sd * .055, .9, .03], [sd * .12, .86, -.01]], .003, VM, 10, 4));
      A.add(tube(vy.map(yy => V3(sd * .05, yy, -.075)), .0025, nerveMat(COL.symp, .5), 60, 4));
      vy.forEach(yy => { const b = new T.Mesh(new T.SphereGeometry(.0065, 8, 8), nerveMat(COL.symp, .7)); b.position.set(sd * .05, yy, -.075); A.add(b); });
    }
    A.add(tube([[.02, 1.48, -.04], [.09, 1.52, -.03], [.15, 1.535, -.01]], .0035, nerveMat(COL.vagus, 1.1), 20, 5));
    const celiac = new T.Mesh(new T.SphereGeometry(.02, 12, 12), nerveMat(COL.symp, .7)); celiac.position.set(0, .45, .0); A.add(celiac);
    for (const [p, n] of [[[.635, -.02, .07], "LI4"], [[.575, .24, .065], "PC6"], [[.19, -1.18, .07], "ST36"], [[.14, -1.68, .03], "SP6"], [[-.635, -.02, .07], "LI4"], [[-.19, -1.18, .07], "ST36"], [[0, .28, .155], "CV12"], [[.155, 1.53, .02], "Concha"]]) {
      const a = new T.Mesh(new T.SphereGeometry(.011, 12, 12), glow(0xff5fa2)); a.position.set(...p); a.userData.acu = n; L.acupoints.add(a); }
    hotspot(G, [.12, -.18, .2], "L5S1", 0xffb547, "L5/S1 · ciático");
    hotspot(G, [.16, 1.535, .02], "ear", 0x5ab8ff, "taVNS · ABVN");
    hotspot(G, [.07, 1.53, .16], "trigeminal", 0xffd36b, "V · trigêmeo");
    hotspot(G, [.56, .3, .07], "median", 0x6ee7a8, "C6–C8 · mediano");
    hotspot(G, [-.2, .6, .17], "visceral", 0xc084fc, "T4–T6 · dor referida");
    hotspot(G, [-.19, -1.18, .09], "acupoint", 0xff5fa2, "ST36");
    return G;
  }

  // ======================================================== Nível 2 — região (tecidos estratificados)
  const LAYERS = [["Epiderme", .035], ["Derme", .12], ["Hipoderme (adiposo)", .4], ["Fáscia profunda", .03], ["Músculo", .75]];
  function buildRegion() {
    const G = new T.Group(); G.name = "L2"; const W = 2.8, Z = 1.6, rnd = TX.noise.rnd;
    S.tissue = {};
    const top = new T.PlaneGeometry(W, Z, 120, 70); top.rotateX(-Math.PI / 2);
    const epi = new T.Mesh(top, phys(0xd9a38a, { tex: "skin", rep: [5, 3], ns: 1.4, roughness: .48, clearcoat: .35, clearcoatRoughness: .5 })); epi.receiveShadow = true; G.add(epi); S.tissue.top = epi; S.tissue.top0 = top.attributes.position.array.slice();
    const mats = [phys(0xcf9a84, { tex: "skin", rep: [5, 1] }), phys(0xd88d8f, { tex: "dermis", rep: [6, 1], ns: 1 }), phys(0xf6d58b, { tex: "fat", rep: [3, 1], ns: 1.4, roughness: .35, clearcoat: .6 }), phys(0xeeeae2, { tex: "collagen", rep: [4, 1], clearcoat: .9, roughness: .25 }), phys(0xa8323a, { tex: "muscle", rep: [2, 1], ns: 1.2, roughness: .42, clearcoat: .55 })];
    let y = 0;
    LAYERS.forEach(([n, h], i) => { const m = new T.Mesh(new T.BoxGeometry(W, h, Z), mats[i]); m.position.y = y - h / 2 - (i === 0 ? .002 : 0); m.castShadow = m.receiveShadow = true; G.add(m); label(G, [-W / 2 - .02, y - h / 2, Z / 2], n, "small"); y -= h; });
    const pap = []; for (let i = 0; i <= 140; i++) { const x = -W / 2 + i / 140 * W; pap.push(V3(x, -.035 - .012 * (1 + Math.sin(i * 1.3)), Z / 2 + .002)); }
    G.add(tube(pap, .006, phys(0xb25a63), 280, 4));
    const hair = new T.InstancedMesh(new T.CylinderGeometry(.0025, .0015, .18, 4), phys(0x2b1d16, { roughness: .5 }), 160), m4 = new T.Matrix4(), q = new T.Quaternion(), one = V3(1, 1, 1);
    for (let i = 0; i < 160; i++) { q.setFromEuler(new T.Euler((rnd() - .5) * .6, 0, .5 + rnd() * .4)); m4.compose(V3((rnd() - .5) * W * .98, .05, (rnd() - .5) * Z * .98), q, one); hair.setMatrixAt(i, m4); }
    G.add(hair);
    for (let k = 0; k < 9; k++) { const x = -1.2 + k * .3; G.add(tube([[x, -.16, Z / 2 - .03], [x + .03, -.07, Z / 2 - .02], [x + .06, -.045, Z / 2 - .02], [x + .09, -.07, Z / 2 - .02], [x + .12, -.16, Z / 2 - .03]], .004, phys(0xc0303d, { emissive: 0x501010 }), 24, 4)); }
    const lob = new T.InstancedMesh(new T.SphereGeometry(.05, 14, 10), phys(0xfbe2a0, { roughness: .25, clearcoat: 1 }), 70);
    for (let i = 0; i < 70; i++) { const s2 = .6 + rnd() * .8; m4.compose(V3((rnd() - .5) * W * .96, -.18 - rnd() * .35, Z / 2), q.set(0, 0, 0, 1), V3(s2, s2 * .8, .4)); lob.setMatrixAt(i, m4); } G.add(lob);
    const NV = new T.Group(); G.add(NV); S.tissue.nv = NV;
    const nerve = new T.Mesh(new T.CylinderGeometry(.11, .11, W, 48), phys(0xf2d6a2, { tex: "collagen", rep: [1, 6], ns: 1.2, emissive: 0x3a2a08, clearcoat: .7 })); nerve.rotation.z = Math.PI / 2; NV.add(nerve);
    const cap = new T.Mesh(new T.CircleGeometry(.11, 48), new T.MeshStandardMaterial({ map: TX.toTexture(T, sectionCanvas(), [1, 1]), roughness: .5 })); cap.position.x = W / 2 + .002; cap.rotation.y = Math.PI / 2; NV.add(cap);
    const art = new T.Mesh(new T.CylinderGeometry(.06, .06, W, 32), phys(0xb5202e, { tex: "vessel", rep: [1, 6], clearcoat: .9, roughness: .3 })); art.rotation.z = Math.PI / 2; art.position.set(0, .02, .2); NV.add(art);
    for (const dz of [.32, -.14]) { const v = new T.Mesh(new T.CylinderGeometry(.045, .045, W, 24), phys(0x3c4ea8, { tex: "vessel", rep: [1, 6], clearcoat: .9, roughness: .3 })); v.rotation.z = Math.PI / 2; v.scale.z = .75; v.position.set(0, -.02, dz); NV.add(v); }
    S.tissue.branches = new T.Group(); G.add(S.tissue.branches);
    label(G, [W / 2 + .05, 0, 0], "Corte do nervo (histologia)", "small");
    S.field = new T.Group(); G.add(S.field);
    S.dev = buildDevices(); G.add(S.dev.group);
    return G;
  }
  function roundRect(w, h, rr) { const s = new T.Shape(); s.moveTo(-w / 2 + rr, -h / 2); s.lineTo(w / 2 - rr, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rr); s.lineTo(w / 2, h / 2 - rr); s.quadraticCurveTo(w / 2, h / 2, w / 2 - rr, h / 2); s.lineTo(-w / 2 + rr, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rr); s.lineTo(-w / 2, -h / 2 + rr); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rr, -h / 2); return s; }
  function buildDevices() {
    const grp = new T.Group(), d = {};
    const pad = new T.Group(), sh = roundRect(.5, .36, .05);
    const gel = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: .02, bevelEnabled: true, bevelSize: .01, bevelThickness: .01, bevelSegments: 3 }), glass(0x7fc8ff, .55, { clearcoat: 1, roughness: .1 })); gel.rotation.x = -Math.PI / 2; pad.add(gel);
    const carbon = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: .012, bevelEnabled: true, bevelSize: .008, bevelThickness: .006, bevelSegments: 2 }), phys(0x1d2327, { roughness: .7 })); carbon.rotation.x = -Math.PI / 2; carbon.position.y = .035; carbon.scale.set(.94, .94, 1); pad.add(carbon);
    const snap = new T.Mesh(new T.CylinderGeometry(.03, .03, .04, 20), metal(0xd0d6da)); snap.position.y = .07; pad.add(snap);
    pad.add(tube([[0, .09, 0], [.2, .2, -.1], [.6, .3, -.3], [1.2, .32, -.5]], .012, phys(0x202428, { roughness: .4, clearcoat: .8 }), 30, 8));
    d.pad = pad;
    const ndl = new T.Group(); const shaft = new T.Mesh(new T.CylinderGeometry(.006, .0015, 1.0, 12), metal(0xd8dee2, .12)); shaft.position.y = -.2; ndl.add(shaft);
    const helix = []; for (let k = 0; k <= 160; k++) { const a = k / 160 * Math.PI * 2 * 18; helix.push(V3(Math.cos(a) * .014, .32 + k / 160 * .26, Math.sin(a) * .014)); } ndl.add(tube(helix, .0045, metal(0xc77b3e, .3), 600, 5));
    const clip = new T.Mesh(new T.BoxGeometry(.05, .05, .03), phys(0xd9342b, { clearcoat: .8 })); clip.position.y = .45; ndl.add(clip); ndl.add(tube([[0, .47, 0], [.2, .6, 0], [.6, .66, -.2]], .008, phys(0xd9342b, { clearcoat: .8 }), 20, 6));
    d.ea = ndl;
    const pr = new T.Group(); const tip = new T.Mesh(new T.SphereGeometry(.07, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), phys(0x2c2f33, { roughness: .8 })); tip.rotation.x = Math.PI; pr.add(tip);
    const rod = new T.Mesh(new T.CylinderGeometry(.02, .02, .4, 16), metal(0xb9c2c8)); rod.position.y = .2; pr.add(rod); const body = new T.Mesh(new T.CylinderGeometry(.08, .08, .3, 32), phys(0xe9c46a, { clearcoat: .9 })); body.position.y = .55; pr.add(body);
    d.acu = pr;
    const lf = new T.Group(); const hous = new T.Mesh(new T.CylinderGeometry(.28, .3, .3, 48), phys(0x3a4a57, { metalness: .3, roughness: .35, clearcoat: .8 })); hous.position.y = .2; lf.add(hous);
    const face = new T.Mesh(new T.SphereGeometry(.3, 40, 12, 0, Math.PI * 2, Math.PI * .75, Math.PI * .25), phys(0xc9d6de, { side: T.DoubleSide })); face.position.y = .3; lf.add(face);
    const beam = new T.Mesh(new T.ConeGeometry(.28, 1, 48, 1, true), new T.MeshBasicMaterial({ color: 0x9ad7ff, transparent: true, opacity: .14, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); beam.rotation.x = Math.PI; lf.add(beam); d.beam = beam;
    d.lifu = lf;
    const scs = new T.Group(); scs.add(new T.Mesh(new T.CylinderGeometry(.025, .025, 1.6, 20), phys(0xf2f2f2, { transparent: true, opacity: .85, clearcoat: 1 }))); for (let k = 0; k < 8; k++) { const c2 = new T.Mesh(new T.CylinderGeometry(.027, .027, .07, 20), metal(0xd7dde2)); c2.position.y = -.6 + k * .17; scs.add(c2); } d.scs = scs;
    const op = new T.Group(); const fib = new T.Mesh(new T.CylinderGeometry(.02, .002, 1.1, 16), glass(0xdff7ff, .6, { clearcoat: 1 })); fib.position.y = .25; op.add(fib); const lt = new T.Mesh(new T.SphereGeometry(.03, 12, 12), glow(0x9fffe6)); lt.position.y = -.3; op.add(lt); d.opto = op;
    ["pad", "ea", "acu", "lifu", "scs", "opto"].forEach(k => { d[k].visible = false; grp.add(d[k]); });
    d.group = grp; return d;
  }
  let secCanvas = null;
  function sectionCanvas() { if (!secCanvas) { const f = fascLayout(); secCanvas = TX.T.nerveSection(f.fibers, f.fasc, 1024); } return secCanvas; }
  function updateRegion() {
    if (!S.built[2]) return;
    const p = S.params, depthTop = .155 + Math.max(.05, (p.r - .3) / 1.2 * .4), nerveY = -(depthTop + .14);
    S.tissue.nv.position.y = nerveY;
    const br = S.tissue.branches; while (br.children.length) { const c = br.children.pop(); c.geometry.dispose(); }
    for (const x of [-.8, .3, .9]) br.add(tube([[x, nerveY + .08, .05], [x + .1, nerveY * .6, .1], [x + .15, -.12, .15], [x + .22, -.05, .2]], .006, nerveMat(COL.nerve, .5), 30, 5));
    const pos = S.tissue.top.geometry.attributes.position, a0 = S.tissue.top0, isAcu = p.modality === "acu", depth = isAcu ? Math.min(.12, p.pressure / 400 * .12) : 0;
    for (let i = 0; i < pos.count; i++) { const x = a0[i * 3], z = a0[i * 3 + 2]; pos.array[i * 3 + 1] = -depth * Math.exp(-(x * x + z * z) / .03); }
    pos.needsUpdate = true; S.tissue.top.geometry.computeVertexNormals();
    const d = S.dev; ["pad", "ea", "acu", "lifu", "scs", "opto"].forEach(k => d[k].visible = false);
    const key = { tens: "pad", tavns: "pad", ti: "pad", ea: "ea", acu: "acu", lifu: "lifu", scs: "scs", opto: "opto" }[p.modality] || "pad";
    const dv = d[key]; dv.visible = true; dv.position.set(0, 0, 0); dv.rotation.set(0, 0, 0);
    let src = V3(0, 0, 0);
    if (key === "pad") dv.position.y = .012;
    if (key === "ea") { dv.position.set(0, nerveY + .62, 0); dv.rotation.z = .12; src = V3(-.06, nerveY + .14, 0); }
    if (key === "acu") { dv.position.y = .07 - depth; src = V3(0, -depth, 0); }
    if (key === "lifu") { dv.position.y = .02; d.beam.scale.set(1, -nerveY + .02, 1); d.beam.position.y = nerveY / 2 + .02; src = V3(0, nerveY, 0); }
    if (key === "scs") { dv.rotation.z = Math.PI / 2; dv.position.set(0, nerveY + .2, 0); src = V3(0, nerveY + .2, 0); }
    if (key === "opto") { dv.position.set(0, nerveY + .45, 0); src = V3(0, nerveY + .14, 0); }
    const F = S.field; while (F.children.length) { const c = F.children.pop(); c.geometry.dispose(); c.material.dispose(); }
    [1, .7, .48, .32, .2].forEach((lv, i) => { let geo, s; const col = new T.Color().setHSL((1 - lv) * .62, .95, .55);
      if (key === "acu") { geo = new T.SphereGeometry(1, 40, 24); s = [.12 + i * .1, (.15 + i * .14) * (.5 + p.pressure / 200), .12 + i * .1]; }
      else if (key === "lifu") { geo = new T.SphereGeometry(1, 40, 24); s = [.04 + i * .025, .16 + i * .09, .04 + i * .025]; }
      else { const half = key === "pad"; geo = new T.SphereGeometry(1, 40, 24, 0, Math.PI * 2, half ? Math.PI / 2 : 0, half ? Math.PI / 2 : Math.PI); const r = (.08 + i * .12) * Math.sqrt(Math.max(.05, p.I) / .6); s = [r * (half ? 1.6 : 1), r, r * (half ? 1.2 : 1)]; }
      const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .08 + lv * .14, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      m.scale.set(...s); m.position.copy(src); if (key === "acu") m.position.y -= s[1] * .5; F.add(m); });
  }

  // ======================================================== Nível 3 — fascículo (Pranchas I e XI)
  let FL = null;
  function fascLayout() {
    if (FL) return FL; const rng = g.AxonModel.mulberry32(42), nrm = () => { let u = 0; while (!u) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
    const fasc = [[0, 0, .27], [.5, .26, .21], [-.47, .3, .22], [.1, -.55, .23], [-.45, -.36, .19], [.55, -.3, .17], [-.05, .6, .18], [.25, .62, .12]], fibers = [];
    fasc.forEach(([y0, z0, R], fi) => { const n = Math.round(R * R * 900); for (let k = 0; k < n; k++) {
      const isA = rng() < .4, D2 = Math.min(16, Math.max(1, isA ? 9 + 1.5 * nrm() : 3 + .8 * nrm())); const a = rng() * 6.283, rad = Math.sqrt(rng()) * (R - .015);
      fibers.push({ y: y0 + rad * Math.cos(a), z: z0 + rad * Math.sin(a), D: D2, isA, f: fi }); } });
    return (FL = { fasc, fibers });
  }
  function buildFascicle() {
    const G = new T.Group(); G.name = "L3"; const Lx = 3.4, f = fascLayout();
    const epi = new T.Mesh(new T.CylinderGeometry(1, 1, Lx, 96, 1, true, Math.PI * .15, Math.PI * 1.45), phys(0xecd2b8, { tex: "collagen", rep: [6, 3], ns: 1.3, transparent: true, opacity: .78, side: T.DoubleSide, clearcoat: .7, depthWrite: false }));
    epi.rotation.z = Math.PI / 2; G.add(epi);
    const capR = new T.Mesh(new T.CircleGeometry(1, 96), new T.MeshStandardMaterial({ map: TX.toTexture(T, sectionCanvas(), [1, 1]), roughness: .55 })); capR.position.x = Lx / 2 + .002; capR.rotation.y = Math.PI / 2; G.add(capR);
    for (let k = 0; k < 5; k++) { const a = .6 + k * .9, pts = []; for (let i = 0; i <= 20; i++) { const x = -Lx / 2 + i / 20 * Lx, aa = a + Math.sin(i * .7 + k) * .08; pts.push(V3(x, Math.cos(aa) * 1.01, Math.sin(aa) * 1.01)); }
      G.add(tube(pts, k % 2 ? .016 : .022, phys(k % 2 ? 0x3c4ea8 : 0xb5202e, { clearcoat: .9, roughness: .3, tex: "vessel", rep: [1, 4] }), 60, 8)); }
    f.fasc.forEach(([y, z, R]) => {
      for (let lam = 0; lam < 3; lam++) { const pr = new T.Mesh(new T.CylinderGeometry(R + .012 + lam * .01, R + .012 + lam * .01, Lx * .995, 48, 1, true), glass(lam === 1 ? 0xc0566c : 0xd98a99, .28 + lam * .08, { clearcoat: .9 })); pr.rotation.z = Math.PI / 2; pr.position.set(0, y, z); G.add(pr); }
      const en = new T.Mesh(new T.CylinderGeometry(R, R, Lx * .99, 40), glass(0xf6e4e8, .12)); en.rotation.z = Math.PI / 2; en.position.set(0, y, z); G.add(en);
    });
    label(G, [0, 1.08, .3], "Epineuro · colágeno, adipócitos, vasa nervorum"); label(G, [Lx / 2, .78, .3], "Perineuro (barreira hemato-nervosa)"); label(G, [Lx / 2, -.2, -.75], "Endoneuro · fibras mielinizadas e feixes de Remak", "small");
    const n = f.fibers.length;
    S.fibMesh = new T.InstancedMesh(new T.CylinderGeometry(1, 1, Lx * .99, 8), phys(0xffffff, { roughness: .3, clearcoat: .8, tex: "myelin", rep: [1, 8] }), n);
    S.fibGlow = new T.InstancedMesh(new T.CylinderGeometry(1, 1, Lx * .99, 8), glow(0xffffff, .55), n);
    const m4 = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(0, 0, Math.PI / 2)), c = new T.Color();
    f.fibers.forEach((fb, i) => { const r = fb.D * .0016 + .002; m4.compose(V3(0, fb.y, fb.z), q, V3(r, 1, r)); S.fibMesh.setMatrixAt(i, m4); S.fibMesh.setColorAt(i, c.set(0xf4f0e6)); m4.compose(V3(0, fb.y, fb.z), q, V3(1e-5, 1, 1e-5)); S.fibGlow.setMatrixAt(i, m4); S.fibGlow.setColorAt(i, c.set(0)); });
    G.add(S.fibMesh); G.add(S.fibGlow);
    const cuff = new T.Group(); const sil = new T.Mesh(new T.CylinderGeometry(1.14, 1.14, .8, 64, 1, true, 0, Math.PI * 1.75), glass(0xeef4f6, .45, { clearcoat: 1 })); sil.rotation.z = Math.PI / 2; cuff.add(sil);
    for (const dx of [-.22, .22]) { const ring = new T.Mesh(new T.TorusGeometry(1.08, .025, 12, 80, Math.PI * 1.75), metal(0xe3e6e8, .15)); ring.rotation.y = Math.PI / 2; ring.position.x = dx; cuff.add(ring); }
    cuff.add(tube([[0, 1.15, 0], [0, 1.5, .2], [.5, 1.9, .5], [1.4, 2.1, .7]], .04, phys(0xeef4f6, { transparent: true, opacity: .85, clearcoat: 1 }), 30, 10));
    cuff.position.x = -.8; G.add(cuff); label(G, [-.8, 1.25, 0], "Eletrodo cuff (Pt + silicone)");
    const sl = new T.CylinderGeometry(1.03, 1.03, Lx, 96, 80, true); sl.rotateZ(Math.PI / 2);
    sl.setAttribute("color", new T.Float32BufferAttribute(new Float32Array(sl.attributes.position.count * 3), 3));
    S.sleeve = new T.Mesh(sl, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .4, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); G.add(S.sleeve);
    return G;
  }
  function updateFascicle() {
    if (!S.built[3]) return; const M = g.AxonModel, p = S.params, f = fascLayout(), I = p.I, Tg = S.T; let nA = 0, nD = 0, rA = 0, rD = 0;
    const c = new T.Color(), white = new T.Color(0xf4f0e6), m4 = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(0, 0, Math.PI / 2));
    f.fibers.forEach((fb, i) => {
      const dist = Math.min(.15, Math.max(.03, .03 + .12 * (Math.hypot(fb.y, fb.z - 1.1) / 2.1) + (p.r - 1) * .02));
      const rec = I >= M.interp(Tg, fb.D, dist); fb.isA ? (nA++, rA += rec) : (nD++, rD += rec);
      c.set(fb.isA ? COL.abeta : COL.adelta); if (!rec) c.lerp(white, .78); S.fibMesh.setColorAt(i, c);
      const r = fb.D * .0016 + .002, s = rec ? r * 1.7 : 1e-5; m4.compose(V3(0, fb.y, fb.z), q, V3(s, 1.001, s)); S.fibGlow.setMatrixAt(i, m4);
      S.fibGlow.setColorAt(i, c.set(rec ? (fb.isA ? 0x7fd0ff : 0xffa060) : 0));
    });
    S.fibMesh.instanceColor.needsUpdate = true; S.fibGlow.instanceMatrix.needsUpdate = true; S.fibGlow.instanceColor.needsUpdate = true;
    S.fascStats = { nA, nD, rA, rD };
    const a = M.activation(p.D, p.r / 10, I * 1e-3), mx = Math.max(...a.f), pos = S.sleeve.geometry.attributes.position, col = S.sleeve.geometry.attributes.color, cc = new T.Color();
    for (let k = 0; k < pos.count; k++) { const x = pos.getX(k), idx = Math.max(0, Math.min(40, Math.round((x + 1.7) / 3.4 * 40))), v = Math.max(0, a.f[idx] / mx);
      cc.setHSL(.62 - .62 * v, 1, .5 * v); col.setXYZ(k, cc.r, cc.g, cc.b); }
    col.needsUpdate = true;
  }

  // ======================================================== Nível 4 — axônio mielinizado e nó de Ranvier
  function buildAxon() {
    const G = new T.Group(); G.name = "L4"; const n = 5, seg = 1.5, gap = .09, R = .3, r = .21, rnd = TX.noise.rnd;
    S.nodes = []; S.fbars = [];
    const myM = phys(0xf6f1e4, { tex: "myelin", rep: [6, 1], ns: .9, roughness: .22, clearcoat: 1, clearcoatRoughness: .15, side: T.DoubleSide });
    const lamM = [0, 1, 2, 3].map(k => glass(k % 2 ? 0xf1e7cf : 0xfffaf0, .35, { clearcoat: 1 }));
    const span = n * seg + (n - 1) * gap, x0 = -span / 2;
    const ax = new T.Mesh(new T.CylinderGeometry(r, r, span + .8, 48), glass(0xffd39b, .5, { emissive: 0x4a2a00, emissiveIntensity: .3 })); ax.rotation.z = Math.PI / 2; G.add(ax);
    const m4 = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(0, 0, Math.PI / 2));
    const nf = new T.InstancedMesh(new T.CylinderGeometry(.006, .006, span + .7, 4), phys(0xd59a52, { emissive: 0x6a3a00, emissiveIntensity: .4 }), 60);
    for (let i = 0; i < 60; i++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * r * .85; m4.compose(V3(0, Math.cos(a) * d, Math.sin(a) * d), q, V3(1, 1, 1)); nf.setMatrixAt(i, m4); } G.add(nf);
    const mito = new T.InstancedMesh(new T.SphereGeometry(.04, 12, 10), phys(0xc4573a, { roughness: .4, clearcoat: .6 }), 26);
    for (let i = 0; i < 26; i++) { const a = rnd() * 6.283, d = rnd() * r * .7; m4.compose(V3(x0 + rnd() * span, Math.cos(a) * d, Math.sin(a) * d), new T.Quaternion(), V3(3 + rnd() * 2, 1, 1)); mito.setMatrixAt(i, m4); } G.add(mito);
    for (let i = 0; i < n; i++) {
      const xa = x0 + i * (seg + gap), xm = xa + seg / 2;
      const prof = []; for (let k = 0; k <= 30; k++) { const u = k / 30, taper = Math.min(1, Math.min(u, 1 - u) / .08); prof.push(new T.Vector2(r + (R - r) * Math.sqrt(Math.max(0, taper)) + .001, (u - .5) * seg)); }
      const my = new T.Mesh(new T.LatheGeometry(prof, 72, Math.PI * .35, Math.PI * 1.65), myM); my.rotation.z = -Math.PI / 2; my.position.x = xm; G.add(my);
      for (let k = 0; k < 4; k++) { const rr = r + (R - r) * (k + 1) / 5, lam = new T.Mesh(new T.CylinderGeometry(rr, rr, seg * .84, 48, 1, true, -Math.PI * .15, Math.PI * .32), lamM[k]); lam.rotation.z = Math.PI / 2; lam.position.x = xm; G.add(lam); }
      for (const sgn of [-1, 1]) for (let k = 0; k < 4; k++) { const tor = new T.Mesh(new T.TorusGeometry(r + .02 + k * .018, .012, 8, 40), phys(0xece2c8, { clearcoat: .8 })); tor.rotation.y = Math.PI / 2; tor.position.x = xm + sgn * (seg / 2 - .02 - k * .025); G.add(tor); }
      const nuc = new T.Mesh(new T.SphereGeometry(.09, 24, 16), phys(0x8a5fb8, { roughness: .35, clearcoat: .8, tex: "dermis" })); nuc.scale.set(2.4, .7, 1); nuc.position.set(xm + .2, R + .03, -.05); G.add(nuc);
      for (const dx of [-.35, .45]) { const hl = []; for (let k = 0; k <= 60; k++) { const a = k / 60 * Math.PI * 2; hl.push(V3(xm + dx + Math.sin(a) * .05, Math.cos(a) * (R + .003), Math.sin(a) * (R + .003))); } G.add(tube(hl, .004, phys(0xd9cba8), 80, 4)); }
      if (i < n - 1) { const xn = xa + seg + gap / 2;
        const nd = new T.Mesh(new T.CylinderGeometry(r + .004, r + .004, gap + .05, 48), phys(0x2fd6b5, { emissive: 0x3ee6c5, emissiveIntensity: .4, roughness: .3, clearcoat: .8 })); nd.rotation.z = Math.PI / 2; nd.position.x = xn; G.add(nd); S.nodes.push(nd);
        const nav = new T.InstancedMesh(new T.SphereGeometry(.009, 6, 6), glow(0x9ffff0, .9), 220);
        for (let k = 0; k < 220; k++) { const a = rnd() * 6.283; m4.makeTranslation(xn + (rnd() - .5) * gap, Math.cos(a) * (r + .012), Math.sin(a) * (r + .012)); nav.setMatrixAt(k, m4); } G.add(nav);
        const mv = new T.InstancedMesh(new T.CylinderGeometry(.004, .004, .09, 4), phys(0xd9cba8), 60);
        for (let k = 0; k < 60; k++) { const a = rnd() * 6.283, qq = new T.Quaternion().setFromAxisAngle(V3(1, 0, 0), a); m4.compose(V3(xn + (rnd() - .5) * gap, Math.cos(a) * (r + .06), Math.sin(a) * (r + .06)), qq, V3(1, 1, 1)); mv.setMatrixAt(k, m4); } G.add(mv);
        const bar = new T.Mesh(new T.BoxGeometry(.06, 1, .06), glow(0x3ee6c5, .9)); bar.position.set(xn, 1.0, 0); G.add(bar); S.fbars.push(bar); }
    }
    const bl = new T.Mesh(new T.CylinderGeometry(R + .05, R + .05, span, 64, 1, true), glass(0xcfe8ef, .07)); bl.rotation.z = Math.PI / 2; G.add(bl);
    const el = new T.Mesh(new T.SphereGeometry(.07, 24, 24), glow(0xffffff, 1)); el.position.set(0, 2.0, 0); G.add(el);
    for (let k = 0; k < 9; k++) { const a = (k - 4) * .28, pts = []; for (let s2 = 0; s2 <= 12; s2++) pts.push(V3(Math.sin(a) * s2 * .2, 2.0 - Math.cos(a) * s2 * .14, 0)); G.add(tube(pts, .006, glow(0x9ad7ff, .35), 24, 4)); }
    const ap = new T.Mesh(new T.SphereGeometry(.3, 24, 24), glow(0x3ee6c5, .35)); G.add(ap);
    S.anim.push(t => { if (!S.nodes.length) return; const k = Math.floor(t * 2.2) % S.nodes.length, ph = (t * 2.2) % 1; S.nodes.forEach((nd, i) => nd.material.emissiveIntensity = i === k ? 1.6 - ph : .35); ap.position.copy(S.nodes[k].position); ap.scale.setScalar(.6 + ph * .8); ap.material.opacity = .4 * (1 - ph); });
    label(G, [0, 2.2, 0], "Cátodo · fonte pontual"); label(G, [x0 + .5, -.55, 0], "Mielina compacta · d = 0,7·D", "small"); label(G, [x0 + seg + gap / 2, -.6, .2], "Nó de Ranvier · NaV agrupados · 2,5 µm", "small");
    label(G, [x0 + seg / 2 + .2, .55, -.05], "Núcleo da célula de Schwann", "small"); label(G, [x0 + seg - .05, .45, .3], "Alças paranodais", "small"); label(G, [x0 + 2.2, -.12, .1], "Neurofilamentos · mitocôndrias", "small"); label(G, [0, -.95, 0], "L = 100·D (fora de escala)", "small");
    return G;
  }
  function updateAxon() {
    if (!S.built[4]) return; const a = g.AxonModel.activation(S.params.D, S.params.r / 10, S.params.I * 1e-3), mx = Math.max(...a.f) || 1;
    S.fbars.forEach((b, i) => { const v = a.f[20 + (i - 1)] / mx, h = Math.max(.02, Math.abs(v) * 1.2); b.scale.y = h; b.position.y = v >= 0 ? .45 + h / 2 : .45 - h / 2; b.material.color.set(v >= 0 ? 0x3ee6c5 : 0xff5d5d); });
  }

  // ======================================================== Nível 5 — membrana e canais (Prancha X)
  function buildMembrane() {
    const G = new T.Group(); G.name = "L5"; const W = 5, Zd = 3, nx = 44, nz = 26, rnd = TX.noise.rnd, holes = [[-1.4, .2, .42], [0, -.1, .55], [1.35, .35, .42], [.65, -.85, .32]];
    const inHole = (x, z) => holes.some(([hx, hz, hr]) => Math.hypot(x - hx, z - hz) < hr);
    const heads = [], tails = [], chol = [];
    for (const s of [-1, 1]) for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = -W / 2 + (i + .5 + (j % 2) * .5) * W / nx, z = -Zd / 2 + (j + .5) * Zd / nz; if (inHole(x, z)) continue; if (rnd() < .08) { chol.push([x, s * .3, z]); continue; } heads.push([x, s * .48, z, rnd()]); tails.push([x - .018, s * .27, z], [x + .018, s * .27, z]); }
    const m4 = new T.Matrix4(), c = new T.Color(), q = new T.Quaternion();
    const hm = new T.InstancedMesh(new T.SphereGeometry(.055, 12, 10), phys(0xffffff, { roughness: .35, clearcoat: .8 }), heads.length);
    heads.forEach(([x, y, z, k], i) => { m4.makeTranslation(x, y, z); hm.setMatrixAt(i, m4); hm.setColorAt(i, c.setHSL(.09 + k * .06, .7, .55 + k * .1)); }); G.add(hm);
    const tm = new T.InstancedMesh(new T.CylinderGeometry(.011, .009, .38, 5), phys(0xfbe8c0, { roughness: .6 }), tails.length);
    tails.forEach(([x, y, z], i) => { q.setFromEuler(new T.Euler((rnd() - .5) * .25, 0, (rnd() - .5) * .25)); m4.compose(V3(x, y, z), q, V3(1, 1, 1)); tm.setMatrixAt(i, m4); }); G.add(tm);
    const cm = new T.InstancedMesh(new T.CylinderGeometry(.03, .03, .26, 6), phys(0xb9e27a, { roughness: .4 }), Math.max(1, chol.length)); chol.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); cm.setMatrixAt(i, m4); }); G.add(cm);
    const helix = (x, z, col, h = 1.15, rr = .05) => { const m = new T.Mesh(new T.CylinderGeometry(rr, rr, h, 14), phys(col, { roughness: .35, clearcoat: .7 })); m.position.set(x, 0, z); return m; };
    const nav = new T.Group(); nav.position.set(-1.4, 0, .2);
    for (let d2 = 0; d2 < 4; d2++) { const a0 = d2 * Math.PI / 2; for (let h = 0; h < 6; h++) { const a = a0 + (h - 2.5) * .19, rr = h >= 4 ? .14 : .3; nav.add(helix(Math.cos(a) * rr, Math.sin(a) * rr, h === 3 ? 0xffd34d : [0x2fb8e8, 0x2a9fd0, 0x3fc6f0, 0x2287c2][d2])); } }
    G.add(nav);
    const pz = new T.Group(); pz.position.set(0, 0, -.1); pz.add(helix(0, 0, 0x9b8cff, 1.3, .12));
    for (let b = 0; b < 3; b++) { const a0 = b * 2.094; for (let k = 0; k < 9; k++) { const rr = .2 + k * .11, a = a0 + k * .09; const m = helix(Math.cos(a) * rr, Math.sin(a) * rr, k % 2 ? 0x8a74f0 : 0xb3a6ff, .5, .04); m.position.y = .1 + k * k * .006; m.rotation.z = .2; pz.add(m); } }
    const cap2 = new T.Mesh(new T.SphereGeometry(.16, 20, 16), phys(0xc8bdff, { clearcoat: .8 })); cap2.scale.y = .5; cap2.position.y = .75; pz.add(cap2); G.add(pz);
    const tv = new T.Group(); tv.position.set(1.35, 0, .35);
    for (let d2 = 0; d2 < 4; d2++) { const a0 = d2 * Math.PI / 2 + .4; for (let h = 0; h < 6; h++) { const a = a0 + (h - 2.5) * .17; tv.add(helix(Math.cos(a) * .26, Math.sin(a) * .26, [0xff6b6b, 0xe85555][d2 % 2])); }
      for (let k = 0; k < 6; k++) { const m = new T.Mesh(new T.CylinderGeometry(.035, .035, .16, 10), phys(0xff9b8a)); m.rotation.z = Math.PI / 2; m.position.set(Math.cos(a0) * .42, -.7 - k * .07, Math.sin(a0) * .42); tv.add(m); } }
    G.add(tv);
    const tk = new T.Group(); tk.position.set(.65, 0, -.85); for (let d2 = 0; d2 < 2; d2++) for (let h = 0; h < 4; h++) { const a = d2 * Math.PI + (h - 1.5) * .35; tk.add(helix(Math.cos(a) * .2, Math.sin(a) * .2, 0x56d98f)); }
    const capk = new T.Mesh(new T.SphereGeometry(.18, 16, 12), phys(0x7fe8ae, { clearcoat: .8 })); capk.scale.y = .45; capk.position.y = .72; tk.add(capk); G.add(tk);
    label(G, [-1.4, 1.0, .2], "NaV1.7 / NaV1.8 · 4×6 hélices (S4 em amarelo)"); label(G, [0, 1.15, -.1], "Piezo2 · mecanotransdução"); label(G, [1.35, 1.0, .35], "TRPV1 · calor/capsaicina"); label(G, [.65, .95, -.85], "TRAAK/TREK"); label(G, [-2.4, .9, 1.4], "meio extracelular", "small"); label(G, [-2.4, -.95, 1.4], "citoplasma", "small"); label(G, [2.2, -.55, 1.5], "bicamada ≈ 5 nm · colesterol em verde", "small");
    const ions = [[0xfff36b, -1.4, .2], [0xd18cff, .65, -.85], [0xffffff, 1.35, .35], [0xfff36b, 0, -.1]].map(([col, x, z], k) => { const m = new T.InstancedMesh(new T.SphereGeometry(.04, 10, 10), glow(col, .95), 8); G.add(m); return { m, x, z, k }; });
    const m5 = new T.Matrix4();
    S.anim.push(t => ions.forEach(({ m, x, z, k }) => { for (let i = 0; i < 8; i++) { const ph = ((t * .45 + i / 8 + k * .13) % 1), yy = (k === 1 ? -1 : 1) * (1.3 - ph * 2.6), off = Math.abs(yy) < .55 ? 0 : (i % 3 - 1) * .25; m5.makeTranslation(x + off, yy, z + off * .6); m.setMatrixAt(i, m5); } m.instanceMatrix.needsUpdate = true; }));
    return G;
  }

  // ======================================================== câmera, ambiente, ciclo
  const VIEWS = { 1: { R: 2.05, t: [0, -.08, 0], phi: 1.45, th: .3 }, 2: { R: 1.75, t: [0, -.55, 0], phi: 1.12, th: .62 }, 3: { R: 1.95, t: [0, 0, 0], phi: 1.2, th: .95 }, 4: { R: 3.5, t: [0, .5, 0], phi: 1.3, th: .25 }, 5: { R: 2.7, t: [0, 0, 0], phi: 1.08, th: .45 } };
  function fitDist(R) { const v = camera.fov * Math.PI / 360, h = Math.atan(Math.tan(v) * camera.aspect); return R / Math.sin(Math.min(v, h)) * 1.02; }
  const BUILD = { 1: buildBody, 2: buildRegion, 3: buildFascicle, 4: buildAxon, 5: buildMembrane };
  function ensure(l) { if (S.built[l]) return; const gg = BUILD[l](); gg.visible = false; S.groups["L" + l] = gg; scene.add(gg); S.built[l] = true; refresh(); }
  function syncLabels() { S.labels.forEach(L => L.el.style.display = L.group.visible ? "" : "none"); }
  function setLevel(l, quiet) {
    l = Math.max(1, Math.min(5, l)); const fade = host.querySelector(".stage-fade"); if (!quiet) fade.classList.add("on");
    setTimeout(() => {
      ensure(l); S.level = l; Object.entries(S.groups).forEach(([k, gg]) => gg.visible = k === "L" + l);
      const v = VIEWS[l]; cam.target.set(...v.t); cam.goal = { d: fitDist(v.R), phi: v.phi, th: v.th }; if (quiet) { cam.dist = cam.goal.d; cam.phi = v.phi; cam.theta = v.th; }
      syncLabels(); fade.classList.remove("on"); if (!quiet) document.dispatchEvent(new CustomEvent("axon:scale", { detail: { level: l } }));
    }, quiet ? 0 : 240);
  }
  function makeEnv() {
    const es = new T.Scene();
    es.add(new T.Mesh(new T.SphereGeometry(10, 32, 16), new T.ShaderMaterial({ side: T.BackSide, vertexShader: "varying vec3 p; void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }", fragmentShader: "varying vec3 p; void main(){ float h=normalize(p).y; vec3 c=mix(vec3(.04,.09,.11),vec3(.55,.75,.8),smoothstep(-.2,1.,h)); gl_FragColor=vec4(c,1.); }" })));
    [[3, 4, 2, 6], [-4, 2, -2, 3], [0, -3, 4, 1.2]].forEach(([x, y, z, k]) => { const b = new T.Mesh(new T.PlaneGeometry(3, 3), new T.MeshBasicMaterial({ color: new T.Color(k, k, k), side: T.DoubleSide })); b.position.set(x, y, z); b.lookAt(0, 0, 0); es.add(b); });
    const pm = new T.PMREMGenerator(renderer); const rt = pm.fromScene(es, .02); pm.dispose(); return rt.texture;
  }
  function init(el) {
    host = el; labelLayer = el.querySelector(".labels");
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(2, g.devicePixelRatio || 1));
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    el.querySelector(".gl").appendChild(renderer.domElement);
    scene = new T.Scene(); camera = new T.PerspectiveCamera(34, 1, .01, 200);
    envMap = makeEnv(); scene.environment = envMap;
    scene.add(new T.HemisphereLight(0xd8f6ff, 0x0b1d24, .55));
    const key = new T.DirectionalLight(0xfff4e6, 1.25); key.position.set(3, 5, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -3, bottom: -3, right: 3, top: 3 }); key.shadow.camera.updateProjectionMatrix(); key.shadow.bias = -.0005; scene.add(key);
    const rim = new T.DirectionalLight(0x6ff0d8, .55); rim.position.set(-4, 2, -3); scene.add(rim);
    S.T = g.AxonModel.grid();
    raycaster = new T.Raycaster(); mouse = new T.Vector2(); clock = new T.Clock();
    let drag = null; const cv = renderer.domElement;
    cv.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); cam.theta -= dx * .006; cam.phi = Math.max(.2, Math.min(2.94, cam.phi - dy * .006)); drag.x = e.clientX; drag.y = e.clientY; cam.goal = null; });
    cv.addEventListener("pointerup", e => { if (drag && drag.moved < 5) pick(e); drag = null; });
    let acc = 0;
    cv.addEventListener("wheel", e => { e.preventDefault(); cam.goal = null; const base = fitDist(VIEWS[S.level].R); cam.dist *= Math.exp(e.deltaY * .001);
      if (cam.dist < base * .35) { if (++acc > 3 && S.level < 5) { acc = 0; setLevel(S.level + 1); } cam.dist = base * .35; }
      else if (cam.dist > base * 1.9) { if (--acc < -3 && S.level > 1) { acc = 0; setLevel(S.level - 1); } cam.dist = base * 1.9; } else acc = 0; }, { passive: false });
    new ResizeObserver(resize).observe(el); resize();
    setLevel(1, true); loop();
    [2, 3, 4, 5].forEach((l, i) => setTimeout(() => { ensure(l); S.groups["L" + l].visible = S.level === l; syncLabels(); }, 1500 + i * 400)); // pré-construção em segundo plano
  }
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect(); mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(S.hot.filter(h => h.parent.visible))[0];
    if (hit) { document.dispatchEvent(new CustomEvent("axon:select", { detail: { region: hit.object.userData.region } })); setTimeout(() => setLevel(2), 350); return; }
    if (S.level === 1 && S.layers.skin && S.layers.skin.visible) { const h2 = raycaster.intersectObjects(S.skinMeshes)[0];
      if (h2) { const code = Math.round(h2.object.geometry.attributes.derm.getX(h2.face.a)); S.skin.uniforms.sel.value = code; document.dispatchEvent(new CustomEvent("axon:dermatome", { detail: { code: DERM[code] } })); } }
  }
  function resize() { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); const v = VIEWS[S.level]; cam.goal = Object.assign(cam.goal || { phi: cam.phi, th: cam.theta }, { d: fitDist(v.R) }); }
  const tmp = new T.Vector3();
  function loop() {
    requestAnimationFrame(loop); const t = clock.getElapsedTime();
    if (cam.goal) { cam.dist += (cam.goal.d - cam.dist) * .09; cam.phi += (cam.goal.phi - cam.phi) * .07; cam.theta += (cam.goal.th - cam.theta) * .07; if (Math.abs(cam.goal.d - cam.dist) < .005 && Math.abs(cam.goal.th - cam.theta) < .002) cam.goal = null; }
    else if (!S.paused) cam.theta += .0006;
    camera.position.set(cam.target.x + cam.dist * Math.sin(cam.phi) * Math.sin(cam.theta), cam.target.y + cam.dist * Math.cos(cam.phi), cam.target.z + cam.dist * Math.sin(cam.phi) * Math.cos(cam.theta));
    camera.lookAt(cam.target);
    S.anim.forEach(f => f(t)); if (S.skin) S.skin.uniforms.t.value = t;
    renderer.render(scene, camera);
    const w = host.clientWidth, h = host.clientHeight;
    S.labels.forEach(L => { if (!L.group.visible) return; tmp.copy(L.pos).applyMatrix4(L.group.matrixWorld).project(camera); L.el.style.transform = `translate(${(tmp.x * .5 + .5) * w}px, ${(-tmp.y * .5 + .5) * h}px)`; L.el.style.opacity = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05 ? 1 : 0; });
  }
  function refresh() { updateRegion(); updateFascicle(); updateAxon(); }

  g.AxonStage = {
    init, setLevel, get level() { return S.level; }, DERM,
    setParams(p) { Object.assign(S.params, p); refresh(); return S.fascStats; },
    setLayer(name, on) { if (name === "dermatomes" && S.skin) S.skin.uniforms.dermOn.value = on ? 1 : 0; else if (S.layers[name]) S.layers[name].visible = on; },
    stats: () => S.fascStats, pause(v) { S.paused = v; }
  };
})(window);
