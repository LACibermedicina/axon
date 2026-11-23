/* axon · textures.js — texturas procedurais (sem downloads) para o realismo dos tecidos.
 * Todas são geradas em <canvas> a partir de ruído fbm determinístico (semente fixa) e convertidas
 * em mapas de cor, rugosidade e normal. Aparência inspirada em histologia; não é imagem de paciente. */
(function (g) {
  "use strict";
  // ---------- ruído de valor 2D periódico + fbm
  function makeNoise(seed = 7) {
    const p = new Uint8Array(512); let s = seed >>> 0;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const perm = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const val = new Float32Array(256).map(() => rnd());
    const fade = t => t * t * (3 - 2 * t);
    function n2(x, y, per) { // per = período inteiro (textura sem emenda)
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const X0 = ((xi % per) + per) % per, Y0 = ((yi % per) + per) % per, X1 = (X0 + 1) % per, Y1 = (Y0 + 1) % per;
      const h = (a, b) => val[p[(p[a & 255] + b) & 255]];
      const u = fade(xf), v = fade(yf);
      return (h(X0, Y0) * (1 - u) + h(X1, Y0) * u) * (1 - v) + (h(X0, Y1) * (1 - u) + h(X1, Y1) * u) * v;
    }
    function fbm(x, y, per, oct = 4) { let a = .5, f = 1, s2 = 0, n = 0; for (let o = 0; o < oct; o++) { s2 += a * n2(x * f, y * f, per * f); n += a; a *= .5; f *= 2; } return s2 / n; }
    return { n2, fbm, rnd };
  }
  const N = makeNoise(42);
  const canvas = (w, h = w) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

  // altura → normal map (diferenças centrais, com emenda)
  function heightToNormal(H, w, h, strength = 2) {
    const c = canvas(w, h), x = c.getContext("2d"), img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const L = H[j * w + (i - 1 + w) % w], R = H[j * w + (i + 1) % w], U = H[((j - 1 + h) % h) * w + i], D = H[((j + 1) % h) * w + i];
      let nx = (L - R) * strength, ny = (U - D) * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const k = (j * w + i) * 4; img.data[k] = (nx * .5 + .5) * 255; img.data[k + 1] = (ny * .5 + .5) * 255; img.data[k + 2] = (nz * .5 + .5) * 255; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0); return c;
  }
  function field(w, h, fn) { const H = new Float32Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) H[j * w + i] = fn(i / w, j / h); return H; }
  function paint(w, h, H, colorFn) {
    const c = canvas(w, h), x = c.getContext("2d"), img = x.createImageData(w, h);
    for (let k = 0; k < w * h; k++) { const [r, gg, b] = colorFn(H[k], k % w / w, Math.floor(k / w) / h); img.data[k * 4] = r; img.data[k * 4 + 1] = gg; img.data[k * 4 + 2] = b; img.data[k * 4 + 3] = 255; }
    x.putImageData(img, 0, 0); return c;
  }
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  // ---------- Voronoi periódico (lóbulos de gordura, células)
  function voronoi(n, seed) {          // Worley em grade com jitter: 9 distâncias por pixel
    const G = Math.max(2, Math.round(Math.sqrt(n))), r = makeNoise(seed).rnd, pts = new Float32Array(G * G * 2);
    for (let k = 0; k < G * G; k++) { pts[2 * k] = r(); pts[2 * k + 1] = r(); }
    return (u, v) => { const gx = u * G, gy = v * G, cx = Math.floor(gx), cy = Math.floor(gy); let d1 = 9, d2 = 9;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { const X = cx + ox, Y = cy + oy, k = (((X % G) + G) % G) + (((Y % G) + G) % G) * G;
        const d = Math.hypot(gx - (X + pts[2 * k]), gy - (Y + pts[2 * k + 1])) / G; if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      return [d1, d2]; };
  }

  const T = {};
  const cache = {};
  function tex(name, make) { if (!cache[name]) cache[name] = make(); return cache[name]; }

  // Pele: poros, sulcos finos, folículos
  T.skin = () => tex("skin", () => {
    const w = 512, V = voronoi(140, 3);
    const H = field(w, w, (u, v) => { const [a, b] = V(u, v); const ridge = Math.min(1, (b - a) * 18); return .55 * ridge + .35 * N.fbm(u * 16, v * 16, 16, 4) + (N.n2(u * 90, v * 90, 90) > .93 ? -.6 : 0); });
    return { map: paint(w, w, H, (hh, u, v) => mix([214, 160, 132], [236, 190, 160], Math.min(1, Math.max(0, hh * 1.1 + N.fbm(u * 4, v * 4, 4) * .3 - .2)))), normal: heightToNormal(H, w, w, 5) };
  });
  // Derme: colágeno denso entrelaçado, rosa
  T.dermis = () => tex("dermis", () => {
    const w = 256, H = field(w, w, (u, v) => .5 + .5 * Math.sin((u * 18 + N.fbm(u * 6, v * 6, 6) * 6) * Math.PI * 2) * N.fbm(u * 10, v * 10, 10));
    return { map: paint(w, w, H, hh => mix([200, 105, 110], [236, 160, 160], hh)), normal: heightToNormal(H, w, w, 3) };
  });
  // Hipoderme: lóbulos de adipócitos com septos conjuntivos
  T.fat = () => tex("fat", () => {
    const w = 512, Vl = voronoi(18, 11), Vc = voronoi(260, 12);
    const H = field(w, w, (u, v) => { const [a, b] = Vl(u, v), [c, d] = Vc(u, v); const septum = 1 - Math.min(1, (b - a) * 40), cell = Math.min(1, (d - c) * 60); return .6 * cell + .4 * (1 - septum) - .2 * septum; });
    return { map: paint(w, w, H, (hh, u, v) => { const s = Math.max(0, Math.min(1, hh)); return mix([214, 170, 120], [252, 226, 150], s); }), normal: heightToNormal(H, w, w, 4) };
  });
  // Músculo esquelético: fascículos com perimísio e estriação transversal
  T.muscle = () => tex("muscle", () => {
    const w = 512, V = voronoi(60, 21);
    const H = field(w, w, (u, v) => { const [a, b] = V(u * .25 % 1, v); const peri = Math.min(1, (b - a) * 25); const stri = .5 + .5 * Math.sin(u * 260 * Math.PI); return .55 * peri + .25 * stri + .2 * N.fbm(u * 3, v * 40, 3); });
    return { map: paint(w, w, H, hh => mix([110, 22, 30], [196, 62, 66], Math.max(0, Math.min(1, hh)))), normal: heightToNormal(H, w, w, 3) };
  });
  // Fáscia / epineuro: colágeno ondulado (bandas de Fontana), branco-perolado
  T.collagen = (tint = [236, 214, 196]) => tex("collagen" + tint, () => {
    const w = 512, H = field(w, w, (u, v) => .5 + .5 * Math.sin((v * 46 + Math.sin(u * Math.PI * 2 * 12) * .35 + N.fbm(u * 8, v * 8, 8) * 1.4) * Math.PI * 2));
    return { map: paint(w, w, H, hh => mix(tint.map(c => c * .78), tint, hh)), normal: heightToNormal(H, w, w, 2.2) };
  });
  // Mielina: lamelas compactas, nacaradas
  T.myelin = () => tex("myelin", () => {
    const w = 256, H = field(w, w, (u, v) => .5 + .5 * Math.sin(v * 120 * Math.PI + N.fbm(u * 4, v * 4, 4) * 3));
    return { map: paint(w, w, H, hh => mix([224, 220, 206], [252, 250, 242], hh)), normal: heightToNormal(H, w, w, 1.5) };
  });
  // Osso: cortical com canais de Havers sutis
  T.bone = () => tex("bone", () => {
    const w = 256, V = voronoi(80, 31), H = field(w, w, (u, v) => { const [a, b] = V(u, v); return .7 * Math.min(1, (b - a) * 10) + .3 * N.fbm(u * 8, v * 8, 8); });
    return { map: paint(w, w, H, hh => mix([200, 188, 160], [242, 234, 214], hh)), normal: heightToNormal(H, w, w, 2) };
  });
  // Córtex cerebral: giros e sulcos
  T.brain = () => tex("brain", () => {
    const w = 512, H = field(w, w, (u, v) => { const n = N.fbm(u * 6, v * 6, 6, 5); return Math.abs(Math.sin(n * 22)); });
    return { map: paint(w, w, H, hh => mix([170, 110, 120], [236, 186, 186], hh)), normal: heightToNormal(H, w, w, 6) };
  });
  // Vaso sanguíneo
  T.vessel = (c = [170, 30, 40]) => tex("vessel" + c, () => {
    const w = 128, H = field(w, w, (u, v) => N.fbm(u * 8, v * 2, 8));
    return { map: paint(w, w, H, hh => mix(c.map(q => q * .7), c, hh)), normal: heightToNormal(H, w, w, 2) };
  });

  // ---------- corte histológico de nervo periférico (azul de toluidina / tetróxido de ósmio)
  // fibers: [{y,z,D,isA}] em coordenadas do nervo (raio 1); fasc: [[y,z,R]]
  T.nerveSection = (fibers, fasc, size = 1024) => {
    const c = canvas(size), x = c.getContext("2d"), s = size / 2, P = (y, z) => [s + y * s * .96, s - z * s * .96], r = N.rnd;
    // epineuro: colágeno + adipócitos + vasos
    x.fillStyle = "#e9cfc4"; x.beginPath(); x.arc(s, s, s * .97, 0, 7); x.fill();
    for (let k = 0; k < 2600; k++) { const a = r() * 6.283, d = Math.sqrt(r()) * s * .96; x.strokeStyle = `rgba(${170 + r() * 50},${110 + r() * 40},${140 + r() * 40},.35)`; x.lineWidth = .8 + r(); x.beginPath(); const px = s + Math.cos(a) * d, py = s + Math.sin(a) * d; x.moveTo(px, py); x.lineTo(px + Math.cos(a + 1.5) * 10, py + Math.sin(a + 1.5) * 10); x.stroke(); }
    for (let k = 0; k < 70; k++) { const a = r() * 6.283, d = (.62 + r() * .33) * s, rr = 10 + r() * 16; x.fillStyle = "#fbf6ef"; x.strokeStyle = "#c79aa6"; x.lineWidth = 1.5; x.beginPath(); x.arc(s + Math.cos(a) * d, s + Math.sin(a) * d, rr, 0, 7); x.fill(); x.stroke(); }
    for (let k = 0; k < 12; k++) { const a = r() * 6.283, d = (.5 + r() * .45) * s, rr = 6 + r() * 12, px = s + Math.cos(a) * d, py = s + Math.sin(a) * d; x.fillStyle = "#8a1d2c"; x.beginPath(); x.arc(px, py, rr + 3, 0, 7); x.fill(); x.fillStyle = "#c8424f"; x.beginPath(); x.arc(px, py, rr * .6, 0, 7); x.fill(); }
    // fascículos: perineuro em camadas, endoneuro claro
    for (const [y, z, R] of fasc) { const [px, py] = P(y, z), Rp = R * s * .96;
      for (let L = 0; L < 5; L++) { x.strokeStyle = L % 2 ? "#a3485f" : "#c86b7f"; x.lineWidth = 2.2; x.beginPath(); x.arc(px, py, Rp + 2 + L * 2.4, 0, 7); x.stroke(); }
      x.fillStyle = "#f3e2e6"; x.beginPath(); x.arc(px, py, Rp, 0, 7); x.fill();
      for (let k = 0; k < 600; k++) { const a = r() * 6.283, d = Math.sqrt(r()) * Rp; x.fillStyle = "rgba(190,140,170,.25)"; x.fillRect(px + Math.cos(a) * d, py + Math.sin(a) * d, 1.2, 1.2); }
      // feixes de Remak (fibras C) — pontilhados finos
      for (let k = 0; k < 10; k++) { const a = r() * 6.283, d = Math.sqrt(r()) * Rp * .9, bx = px + Math.cos(a) * d, by = py + Math.sin(a) * d; x.fillStyle = "rgba(120,80,140,.5)"; x.beginPath(); x.arc(bx, by, 5, 0, 7); x.fill(); for (let q = 0; q < 7; q++) { x.fillStyle = "#e7d6ec"; x.beginPath(); x.arc(bx + (r() - .5) * 7, by + (r() - .5) * 7, 1.1, 0, 7); x.fill(); } }
    }
    // fibras mielinizadas: anel escuro (mielina corada) + axoplasma claro (g ≈ 0,7)
    for (const f of fibers) { const [px, py] = P(f.y, f.z), Ro = Math.max(1.6, f.D * .55 * s / 140), Ri = Ro * .7;
      x.fillStyle = "#2c1838"; x.beginPath(); x.arc(px, py, Ro, 0, 7); x.fill();
      x.fillStyle = f.isA ? "#dfe6f3" : "#efe2d8"; x.beginPath(); x.arc(px, py, Ri, 0, 7); x.fill();
      x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.arc(px - Ri * .3, py - Ri * .3, Ri * .35, 0, 7); x.fill(); }
    // borda externa
    x.strokeStyle = "#b9877c"; x.lineWidth = 6; x.beginPath(); x.arc(s, s, s * .97, 0, 7); x.stroke();
    return c;
  };

  function toTexture(THREE, cvs, rep = [1, 1], srgb = true) {
    const t = new THREE.CanvasTexture(cvs); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; if (srgb) t.encoding = THREE.sRGBEncoding; return t;
  }
  g.AxonTex = { T, toTexture, noise: N };
})(window);
