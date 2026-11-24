/* axon · model.js — port do núcleo verificado (Anexo G) para o navegador.
 * Idêntico numericamente ao Python em h()/Ith() (mesmas equações, mesma ordem de operações).
 * Monte Carlo usa gerador mulberry32 (semente 42): amostras diferem do PCG64 do NumPy, por isso
 * os valores canônicos exibidos vêm de reference.json (Python) e os ao vivo são rotulados como JS.
 * Ferramenta de pesquisa e ensino — não é dispositivo médico. */
(function (g) {
  "use strict";
  const P = { RHO_I: 110, RHO_E: 300, CM: 2e-6, GL: 30.3e-3, LN: 2.5e-4, VTH: 0.020 };
  const DOMAIN = { Dmin: 1, Dmax: 16, rmin: 0.03, rmax: 0.15 };

  function h(D, r, o = {}) {
    const pw = o.pw ?? 100e-6, rho_i = o.rho_i ?? P.RHO_I, N = o.N ?? 41, dt = o.dt ?? 1e-6;
    const rho_e = o.rho_e ?? P.RHO_E, ln = o.ln ?? P.LN;
    // parâmetros opcionais para a análise de sensibilidade (gr, lk, cm, gl); sem eles o cálculo é idêntico ao núcleo Python
    const Dc = D * 1e-4, d = (o.gr ?? 0.7) * Dc, L = (o.lk ?? 100) * Dc;
    const Ga = Math.PI * d * d / 4 / (rho_i * L), ar = Math.PI * d * ln, C = (o.cm ?? P.CM) * ar, gl = (o.gl ?? P.GL) * ar;
    const Ve = new Float64Array(N), drv = new Float64Array(N);
    for (let i = 0; i < N; i++) { const x = (i - (N >> 1)) * L; Ve[i] = -rho_e / (4 * Math.PI * Math.sqrt(x * x + r * r)); }
    for (let i = 1; i < N - 1; i++) drv[i] = Ga * (Ve[i - 1] - 2 * Ve[i] + Ve[i + 1]);
    let V = new Float64Array(N), Vn = new Float64Array(N), vm = 0;
    const steps = Math.floor((pw + 300e-6) / dt + 1e-9);
    for (let k = 0; k < steps; k++) {
      const on = k * dt < pw;
      for (let i = 0; i < N; i++) {
        const l = V[i > 0 ? i - 1 : 0], rr = V[i < N - 1 ? i + 1 : N - 1];
        Vn[i] = V[i] + dt / C * (-gl * V[i] + Ga * (l - 2 * V[i] + rr) + (on ? drv[i] : 0));
      }
      [V, Vn] = [Vn, V];
      for (let i = 0; i < N; i++) if (V[i] > vm) vm = V[i];
    }
    return vm;
  }
  const Ith = (D, r, o) => ((o && o.vth) ?? P.VTH) / h(D, r, o);           // A
  const inDomain = (D, r) => D >= DOMAIN.Dmin - 1e-9 && D <= DOMAIN.Dmax + 1e-9 && r >= DOMAIN.rmin - 1e-9 && r <= DOMAIN.rmax + 1e-9;

  function activation(D, r, I) {           // Ve e Δ²Ve por nó (mV) para corrente I (A)
    const N = 41, L = 100 * D * 1e-4, Ve = [], f = [], x = [];
    for (let i = 0; i < N; i++) { const xi = (i - 20) * L; x.push(xi * 10); Ve.push(-P.RHO_E * I / (4 * Math.PI * Math.hypot(xi, r)) * 1e3); }
    for (let i = 0; i < N; i++) f.push(i === 0 || i === N - 1 ? 0 : Ve[i - 1] - 2 * Ve[i] + Ve[i + 1]);
    return { x, Ve, f };
  }

  // Grade e interpolação bilinear em log–log (equivalente ao RegularGridInterpolator)
  const DS = Array.from({ length: 16 }, (_, i) => i + 1), RS = [0.03, 0.05, 0.07, 0.10, 0.15];
  function grid(o) { return DS.map(D => RS.map(r => Ith(D, r, o) * 1e3)); }
  function interp(T, D, r) {
    const lx = Math.log(D), ly = Math.log(r), X = DS.map(Math.log), Y = RS.map(Math.log);
    let i = 0; while (i < X.length - 2 && lx > X[i + 1]) i++;
    let j = 0; while (j < Y.length - 2 && ly > Y[j + 1]) j++;
    const tx = (lx - X[i]) / (X[i + 1] - X[i]), ty = (ly - Y[j]) / (Y[j + 1] - Y[j]);
    const z = (a, b) => Math.log(T[a][b]);
    return Math.exp(z(i, j) * (1 - tx) * (1 - ty) + z(i + 1, j) * tx * (1 - ty) + z(i, j + 1) * (1 - tx) * ty + z(i + 1, j + 1) * tx * ty);
  }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function normal(rng) { let u = 0, v = 0; while (!u) u = rng(); v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const median = a => { const s = Float64Array.from(a).sort(); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  function monteCarlo(T, f = {}) {
    const n = f.n ?? 20000, fa = f.fracAbeta ?? 0.4, ab = f.abeta ?? [9, 1.5], ad = f.adelta ?? [3, 0.8];
    const r0 = f.r ?? [0.03, 0.15], loss = f.smallFiberLoss ?? 0, rng = mulberry32(f.seed ?? 42);
    const A = [], Dl = [];
    for (let k = 0; k < n; k++) {
      const isA = rng() < fa, D = Math.min(16, Math.max(1, isA ? ab[0] + ab[1] * normal(rng) : ad[0] + ad[1] * normal(rng)));
      const r = r0[0] + (r0[1] - r0[0]) * rng(), I = interp(T, D, r);
      if (isA) A.push(I); else if (rng() >= loss) Dl.push(I);
    }
    const I = Array.from({ length: 200 }, (_, i) => Math.pow(10, -1.5 + 3 * i / 199));
    const sA = Float64Array.from(A).sort(), sD = Float64Array.from(Dl).sort();
    const frac = (s, x) => { let lo = 0, hi = s.length; while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] <= x) lo = m + 1; else hi = m; } return lo / s.length; };
    const FA = I.map(x => frac(sA, x)), FD = I.map(x => frac(sD, x));
    let last = -1; FA.forEach((v, i) => { if (v <= 0.10) last = i; });
    const mA = median(A), mD = median(Dl);
    return { I, FA, FD, I50A: mA, I50D: mD, ratio: mD / mA, FDat10: last >= 0 ? FD[last] : 0, nA: A.length, nD: Dl.length };
  }
  function fracAt(T, f, I_mA) { const mc = monteCarlo(T, f); let k = 0; while (k < 199 && mc.I[k + 1] <= I_mA) k++; return { FA: mc.FA[k], FD: mc.FD[k] }; }

  // ---- Fronteiras de segurança (espelho de core/safety.py)
  function shannon(I_mA, pw_us, area) {
    const Q = I_mA * 1e-3 * pw_us * 1e-6 * 1e6, D = Q / area, k = Math.log10(D) + Math.log10(Q);
    return { Q, D, k, level: k < 1.75 ? "ok" : k < 2 ? "warn" : "risk" };
  }
  function pennes0d(q, dur, wb = 0.5e-3) {
    let T = 37, max = 37, cem = 0; const dt = 0.1, rc = 3.6e6, rbcb = 4.0e6;
    for (let t = 0; t < dur; t += dt) { T += dt * (q - wb * rbcb * (T - 37)) / rc; max = Math.max(max, T); cem += dt / 60 * Math.pow(T >= 43 ? 0.5 : 0.25, 43 - T); }
    const dT = max - 37; return { dT, cem, level: dT <= 1 ? "ok" : dT <= 2 ? "warn" : "risk" };
  }
  function mechanical(p, f, ispta) { const MI = p / Math.sqrt(f); return { MI, ispta, level: MI <= 1.9 && ispta <= 720 ? "ok" : "risk" }; }
  function acupressure(kPa, p50 = 40, s = 12) { return 1 / (1 + Math.exp(-(kPa - p50) / s)); }

  // ---- Ressonância estocástica (detector de limiar, espelho de core/stochastic.py; FFT ingênua na frequência-alvo)
  function srSNR(sigma, seed = 42) {
    const rng = mulberry32(seed), dt = 1e-3, n = 4000, f = 5; let snr = 0;
    for (let rep = 0; rep < 5; rep++) {
      const sp = new Float64Array(n); let prev = 0, cnt = 0;
      for (let i = 0; i < n; i++) { const x = 0.5 * Math.sin(2 * Math.PI * f * i * dt) + sigma * normal(rng); sp[i] = (x >= 1 && prev < 1 && i > 0) ? 1 : 0; cnt += sp[i]; prev = x; }
      const mean = cnt / n, pw = fr => { let re = 0, im = 0; for (let i = 0; i < n; i++) { const y = sp[i] - mean; if (!y && !mean) continue; const a = 2 * Math.PI * fr * i * dt; re += y * Math.cos(a); im -= y * Math.sin(a); } return re * re + im * im; };
      let bg = 0, nb = 0; for (const df of [-2.5, -2.25, -2, -1.75, -1.5, 1.5, 1.75, 2, 2.25, 2.5]) { bg += pw(f + df); nb++; }
      snr += pw(f) / (bg / nb + 1e-12);
    }
    return snr / 5;
  }

  g.AxonModel = { P, DOMAIN, h, Ith, inDomain, activation, grid, interp, monteCarlo, fracAt, shannon, pennes0d, mechanical, acupressure, srSNR, mulberry32, DS, RS };
})(window);
