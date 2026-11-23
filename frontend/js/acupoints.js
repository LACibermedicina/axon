/* axon · acupoints.js — posicionamento dos 361 acupontos (+ extras) na malha BodyParts3D, linhas de craniopuntura MS1–MS14
 * e correlação anatômica calculada (dermátomo, nervo, músculo, osso e profundidade) para cada ponto.
 * Método [PREMISSA]: marcos ósseos extraídos da malha (epicôndilos, estiloides, maléolos, patela, espinhosos, costelas, crânio,
 * olho, orelha) → proporção em cun (antebraço 12, perna 16, abdome 8 + 5, crânio 12) → raio projetado até a pele.
 * A posição é aproximada; a referência normativa é a OMS (2008). Correlações anatômicas são [DERIVADO] da malha. */
(function (g) {
  "use strict";
  const D = () => g.AxonAcuData, ST = () => g.AxonStage;
  let E, T, V3;
  const S = { ready: false, pts: [], byId: {}, grp: null, inst: null, lines: [], msLines: null, show: false, mer: {}, sel: null, ver: 0, A: null };
  const ORD = ["first", "second", "third", "fourth", "fifth"], FING = ["thumb", "index finger", "middle finger", "ring finger", "little finger"], TOE = ["big toe", "second toe", "third toe", "fourth toe", "little toe"];
  const VERT = { C1: "atlas", C2: "axis", C3: "third cervical vertebra", C4: "fourth cervical vertebra", C5: "fifth cervical vertebra", C6: "sixth cervical vertebra", C7: "seventh cervical vertebra",
    ...Object.fromEntries(["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"].map((o, i) => ["T" + (i + 1), o + " thoracic vertebra"])),
    ...Object.fromEntries(["first", "second", "third", "fourth", "fifth"].map((o, i) => ["L" + (i + 1), o + " lumbar vertebra"])) };
  const NEXT = { C7: "T1", T12: "L1", L5: "S1" };
  const RIB = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"];

  // ---------------------------------------------------------------- utilidades de malha
  const v = (x, y, z) => new V3(x, y, z), mid = (a, b) => a.clone().add(b).multiplyScalar(.5), lerp = (a, b, t) => a.clone().lerp(b, t), nrm = a => a.clone().normalize();
  function verts(layer, test) {
    const m = E.S.meshByLayer && E.S.meshByLayer[layer]; if (!m) return [];
    const pa = m.geometry.attributes.position, out = [];
    m.userData.parts.forEach(p => { if (test(p.name)) { const v0 = p.v0 ?? p.vo; for (let j = v0; j < v0 + p.nv; j++) out.push(v(pa.getX(j), pa.getY(j), pa.getZ(j))); } });
    return out;
  }
  const B = n => verts("skeleton", x => x === n);
  function ext(P, d, f) { const dd = Array.isArray(d) ? v(...d) : d; let best = null, bv = -1e9; for (const p of P) { if (f && !f(p)) continue; const s = p.dot(dd); if (s > bv) { bv = s; best = p; } } return best ? best.clone() : null; }
  const mean = P => { const c = v(0, 0, 0); P.forEach(p => c.add(p)); return P.length ? c.multiplyScalar(1 / P.length) : c; };
  const yr = P => { let a = 1e9, b = -1e9; P.forEach(p => { if (p.y < a) a = p.y; if (p.y > b) b = p.y; }); return [a, b]; };
  // grade espacial de vértices para projeção rápida
  function grid(layer) {
    const m = E.S.meshByLayer[layer], pa = m.geometry.attributes.position, c = .02, M = new Map(), n = pa.count, pid = m.geometry.attributes.pid;
    const key = (i, j, k) => (i + 512) * 1048576 + (j + 512) * 1024 + (k + 512);
    for (let i = 0; i < n; i++) { const k = key(Math.floor(pa.getX(i) / c), Math.floor(pa.getY(i) / c), Math.floor(pa.getZ(i) / c)); let a = M.get(k); if (!a) M.set(k, a = []); a.push(i); }
    return { m, pa, c, M, key, pid, near(p, r) { const out = [], i0 = Math.floor(p.x / c), j0 = Math.floor(p.y / c), k0 = Math.floor(p.z / c), R = Math.ceil(r / c);
      for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) for (let k = -R; k <= R; k++) { const a = M.get(key(i0 + i, j0 + j, k0 + k)); if (a) out.push(...a); } return out; } };
  }
  let GS = null, GM = null, GB = null;
  function cast(b, d, maxT = .4) {
    const dir = nrm(d), seen = new Set(), cand = [];
    for (let s = 0; s <= maxT; s += .012) { const p = b.clone().addScaledVector(dir, s); GS.near(p, .02).forEach(i => { if (!seen.has(i)) { seen.add(i); cand.push(i); } }); }
    for (const R of [.007, .013, .022]) { let bi = -1, bt = 1e9; const w = v(0, 0, 0);
      for (const i of cand) { w.set(GS.pa.getX(i), GS.pa.getY(i), GS.pa.getZ(i)).sub(b); const t = w.dot(dir); if (t < .002 || t > maxT) continue; const dd = w.addScaledVector(dir, -t).length(); if (dd < R && t < bt) { bt = t; bi = i; } }
      if (bi >= 0) return { p: v(GS.pa.getX(bi), GS.pa.getY(bi), GS.pa.getZ(bi)), i: bi, n: dir.clone() }; }
    return null;
  }
  function nearestSkin(p, r = .05) { let bi = -1, bd = 1e9; GS.near(p, r).forEach(i => { const d = (GS.pa.getX(i) - p.x) ** 2 + (GS.pa.getY(i) - p.y) ** 2 + (GS.pa.getZ(i) - p.z) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi < 0 ? null : { p: v(GS.pa.getX(bi), GS.pa.getY(bi), GS.pa.getZ(bi)), i: bi, n: null }; }
  // aproxima um palpite da pele: raio a partir de um centro interno, passando pelo palpite
  const snap = (guess, center) => { const d = nrm(guess.clone().sub(center)), b = guess.clone().addScaledVector(d, -Math.min(.06, guess.distanceTo(center) * .8)); return cast(b, d, .12) || nearestSkin(guess); };

  // ---------------------------------------------------------------- marcos (lado direito: x < 0)
  function anchors() {
    const A = {};
    // membro superior
    const H = B("right humerus"), [hy0, hy1] = yr(H), Hd = H.filter(p => p.y < hy0 + .07);
    A.ELl = ext(Hd, [-1, 0, 0]); A.ELm = ext(Hd, [1, 0, 0]); A.EL = mid(A.ELl, A.ELm); A.HH = mean(H.filter(p => p.y > hy1 - .05));
    const RA = B("right radius"), UL = B("right ulna"); A.RS = ext(RA, [0, -1, 0]); A.US = ext(UL, [0, -1, 0]); A.WR = mid(A.RS, A.US); A.OL = ext(UL, [0, 1, -.7]);
    const SC = B("right scapula"), scc = mean(SC); A.ACR = ext(SC, [-1, .55, 0]); A.SCinf = ext(SC, [0, -1, 0]); A.SCsup = ext(SC.filter(p => p.x > scc.x), [0, 1, 0]);
    A.SPINE = ext(SC.filter(p => p.y > scc.y), [0, 0, -1]); A.SPINEmed = ext(SC.filter(p => Math.abs(p.y - A.SPINE.y) < .02), [1, 0, -.3]);
    const CL = B("right clavicle"); A.CLm = ext(CL, [1, 0, 0]); A.CLl = ext(CL, [-1, 0, 0]); A.CLmid = mid(A.CLm, A.CLl); A.CL = CL;
    A.arm = { ax: nrm(A.EL.clone().sub(A.WR)), cun: A.EL.distanceTo(A.WR) / 12, hw0: A.RS.distanceTo(A.US) / 2 * .9, hw1: A.ELl.distanceTo(A.ELm) / 2 * .7 };
    let r = A.RS.clone().sub(A.US); r.addScaledVector(A.arm.ax, -r.dot(A.arm.ax)).normalize(); A.arm.r = r;
    let a = v(0, 0, 1); a.addScaledVector(A.arm.ax, -a.dot(A.arm.ax)).addScaledVector(r, -a.dot(r)).normalize(); A.arm.a = a;
    A.ua = { ax: nrm(A.ACR.clone().sub(A.EL)), cun: A.ACR.distanceTo(A.EL) / 10.5 };
    let l = v(-1, 0, 0); l.addScaledVector(A.ua.ax, -l.dot(A.ua.ax)).normalize(); A.ua.l = l; A.ua.a = nrm(new V3().crossVectors(l, A.ua.ax)); if (A.ua.a.z < 0) A.ua.a.negate();
    A.MC = [1, 2, 3, 4, 5].map(k => { const P = B(`right ${ORD[k - 1]} metacarpal bone`); return P.length ? { b: ext(P, [0, 1, 0]), h: ext(P, [0, -1, 0]) } : null; });
    A.FN = FING.map(f => { const P = B(`distal phalanx of right ${f}`); return P.length ? { tip: ext(P, [0, -1, 0]), c: mean(P) } : null; });
    // membro inferior
    const F = B("right femur"), [fy0, fy1] = yr(F); A.GT = ext(F.filter(p => p.y > fy1 - .12), [-1, 0, 0]); A.LC = ext(F.filter(p => p.y < fy0 + .05), [-1, 0, 0]); A.MCo = ext(F.filter(p => p.y < fy0 + .05), [1, 0, 0]);
    A.KN = mid(A.LC, A.MCo); A.FHd = ext(F.filter(p => p.y > fy1 - .08), [1, 1, 0]);
    const P = B("right patella"); A.Pb = ext(P, [0, 1, 0]); A.Pa = ext(P, [0, -1, 0]); A.Pc = mean(P);
    const TB = B("right tibia"), [ty0, ty1] = yr(TB); A.MTC = ext(TB.filter(p => p.y > ty1 - .06), [1, 0, 0]); A.TT = ext(TB.filter(p => p.y > ty1 - .1), [0, 0, 1]); A.MM = ext(TB.filter(p => p.y < ty0 + .06), [1, 0, 0]);
    A.KJ = mean(TB.filter(p => p.y > ty1 - .015));
    const FB = B("right fibula"), [by0] = yr(FB); A.FIBh = ext(FB, [0, 1, 0]); A.LM = ext(FB.filter(p => p.y < by0 + .05), [-1, 0, 0]);
    A.ANK = mid(A.MM, A.LM); A.leg = { ax: nrm(A.KJ.clone().sub(A.ANK)), cun: A.KJ.distanceTo(A.ANK) / 16, hw0: A.MM.distanceTo(A.LM) / 2 * .85, hw1: A.LC.distanceTo(A.MCo) / 2 * .8 };
    A.lgm = { cun: A.MTC.distanceTo(A.MM) / 13 };
    const CA = B("right calcaneus"); A.HEELp = ext(CA, [0, 0, -1]); A.HEELb = ext(CA, [0, -1, 0]);
    A.MT = [1, 2, 3, 4, 5].map(k => { const Q = B(`right ${ORD[k - 1]} metatarsal bone`); return Q.length ? { b: ext(Q, [0, 0, -1]), h: ext(Q, [0, 0, 1]) } : null; });
    A.TN = TOE.map(t => { const Q = B(`distal phalanx of right ${t}`); return Q.length ? { tip: ext(Q, [0, -.2, 1]), c: mean(Q) } : null; });
    A.NAV = ext(B("navicular bone of right foot"), [1, -.3, 0]);
    // tronco
    const MAN = B("manubrium"), XI = B("xiphoid process"); A.JN = ext(MAN, [0, 1, .3]); A.XS = ext(XI, [0, 1, 0]); A.STz = ext(B("body of sternum"), [0, 0, 1]).z;
    const HP = B("right hip bone"); A.ASIS = ext(HP, [-.25, .35, 1]); A.PS = ext(HP.filter(p => p.x > -.03), [0, .4, 1]); A.PSlow = ext(HP.filter(p => p.x > -.03), [0, -1, .4]); A.CREST = ext(HP, [0, 1, 0]);
    const SA = B("sacrum"); A.SB = ext(SA, [0, 1, -.3]); A.SAp = ext(SA, [0, -1, 0]); A.SA = SA;
    A.V = {}; Object.entries(VERT).forEach(([k, n]) => { const Q = B(n); if (Q.length) A.V[k] = { tip: ext(Q, [0, 0, -1]), c: mean(Q) }; });
    A.V.S1 = { tip: A.SB.clone(), c: A.SB.clone() };
    A.UMB = v(0, (A.V.L3.c.y + A.V.L4.c.y) / 2, 0);
    A.ab = { up: (A.XS.y - A.UMB.y) / 8, dn: (A.UMB.y - A.PS.y) / 5 };
    A.cunX = Math.abs(A.CLmid.x) / 4; A.cunB = A.cunX * .95;
    A.ribs = RIB.map((o, i) => B(`right ${o} rib`).concat(i < 7 ? B(`right ${o} costal cartilage`) : []));
    A.trunkZ = y => { const ks = Object.keys(A.V).filter(k => A.V[k].c); let best = A.V.T6; ks.forEach(k => { if (Math.abs(A.V[k].c.y - y) < Math.abs(best.c.y - y)) best = A.V[k]; }); return best.c.z; };
    // cabeça
    const FR = B("frontal bone"), OC = B("occipital bone"), skull = FR.concat(OC, B("right parietal bone"), B("left parietal bone"));
    A.GLB = ext(FR.filter(p => Math.abs(p.x) < .012), [0, 0, 1]); A.IN = ext(OC.filter(p => Math.abs(p.x) < .012), [0, 0, -1]); A.VTX = ext(skull, [0, 1, 0]);
    const xs = skull.map(p => p.x), ys = skull.map(p => p.y), zs = skull.map(p => p.z); A.HC = v((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2 - .01, (Math.min(...zs) + Math.max(...zs)) / 2);
    A.HR = (Math.max(...xs) - Math.min(...xs)) / 2;
    A.thG = Math.atan2(A.GLB.y - A.HC.y, A.GLB.z - A.HC.z); A.thI = Math.atan2(A.IN.y - A.HC.y, A.IN.z - A.HC.z); if (A.thI < A.thG) A.thI += Math.PI * 2;
    A.cunH = (A.thI - A.thG) * A.GLB.distanceTo(A.HC) / 12.5;
    const EYE = verts("organs", n => n === "eyeball").filter(p => p.x < 0); A.PUP = EYE.length ? ext(EYE, [0, 0, 1]) : v(-.032, A.GLB.y - .03, A.GLB.z - .005); A.EC = EYE.length ? mean(EYE) : A.PUP.clone().add(v(0, 0, -.012));
    const NC = B("set of nasal cartilages"); A.NT = NC.length ? ext(NC, [0, 0, 1]) : A.PUP.clone().add(v(.032, -.03, .02)); A.ALA = NC.length ? ext(NC.filter(p => p.x < -.004), [-1, -1.2, 0]) : A.NT.clone().add(v(-.015, -.008, -.012));
    const MD = B("mandible"), MDr = MD.filter(p => p.x < -.005); A.CHIN = ext(MD, [0, -.35, 1]); A.MA = ext(MDr, [-.7, -.7, -.5]); A.COND = ext(MDr, [-.2, 1, -.4]);
    const ZY = B("right zygomatic bone"); A.ZYlow = ZY.length ? ext(ZY, [0, -1, 0]) : A.PUP.clone().add(v(-.01, -.03, -.01));
    const TMP = B("right temporal bone"); A.MAST = ext(TMP, [0, -1, -.6]);
    const EAR = verts("skin", n => n === "ear").filter(p => p.x < 0); A.Ec = mean(EAR); A.Etop = ext(EAR, [0, 1, 0]); A.Ebot = ext(EAR, [0, -1, 0]); A.Eback = ext(EAR, [0, 0, -1]);
    A.TRAG = ext(EAR.filter(p => p.y > A.Ec.y - .012 && p.y < A.Ec.y + .004), [0, 0, 1]);
    const TC = B("thyroid cartilage"); A.LP = TC.length ? ext(TC, [0, .3, 1]) : A.JN.clone().add(v(0, .07, -.02)); A.HY = mean(B("hyoid bone"));
    A.ribEnd = n => { const R = A.ribs[n - 1], c = A.V["T" + n] ? A.V["T" + n].c : A.V.T12.c; let b = null, bd = -1; R.forEach(p => { const d = p.distanceTo(c); if (d > bd) { bd = d; b = p; } }); return b.clone(); };
    return A;
  }
  // arco sagital mediano da pele: comprimento acumulado do glabela ao ínion; GV20 ≈ Cz (50 %) [PREMISSA calibrada pelo sistema 10–20]
  function headArc(A) {
    if (A.arc) return A.arc; const pts = [];
    for (let th = A.thG - .25; th <= A.thI + .45; th += .02) { const h = cast(A.HC, v(0, Math.sin(th), Math.cos(th)), .2); if (h) pts.push({ th, p: h.p }); }
    let L = 0; pts.forEach((q, i) => { if (i) L += q.p.distanceTo(pts[i - 1].p); q.L = L; });
    const at = th => pts.reduce((b, q) => Math.abs(q.th - th) < Math.abs(b.th - th) ? q : b, pts[0]);
    A.arc = { pts, Lg: at(A.thG).L, Li: at(A.thI).L }; return A.arc;
  }
  function headTheta(A, c) {
    const a = headArc(A), f = c <= 5 ? (c + 3) / 8 * .5 : .5 + (c - 5) / 5 * .5, Lt = a.Lg + f * (a.Li - a.Lg);
    let q0 = a.pts[0]; for (const q of a.pts) { if (q.L >= Lt) { const t = q0.L === q.L ? 0 : (Lt - q0.L) / (q.L - q0.L); return q0.th + t * (q.th - q0.th); } q0 = q; } return q0.th;
  }
  function ribY(A, n, x) {
    const R = A.ribs[n - 1]; if (!R || !R.length) return null; const sel = R.filter(p => Math.abs(p.x - x) < .012); if (!sel.length) return null;
    const zmax = Math.max(...sel.map(p => p.z)); const top = sel.filter(p => p.z > zmax - .015); return top.reduce((s, p) => s + p.y, 0) / top.length;
  }
  function ics(A, n, x) {
    if (n === 0) { const sel = A.CL.filter(p => Math.abs(p.x - x) < .015); return (sel.length ? Math.min(...sel.map(p => p.y)) : A.CLmid.y) - .012; }
    const a = ribY(A, n, x), b = ribY(A, n + 1, x); if (a == null || b == null) { const y0 = A.JN.y, y1 = A.XS.y; return y0 + (y1 - y0) * (n + .5) / 5.8; } return (a + b) / 2;
  }

  // ---------------------------------------------------------------- especificação → {b, d} (base interna e direção) ou {g, c} (palpite e centro)
  const FACE = { a: [1, 0], p: [-1, 0], r: [0, 1], u: [0, -1], ar: [1, .8], au: [1, -.8], pr: [-1, .8], pu: [-1, -.8], l: [0, 1], m: [0, -1], al: [1, .8], am: [1, -.8], pl: [-1, .8], pm: [-1, -.8],
    d: [-1, 0], v: [1, 0], dr: [-1, .8], du: [-1, -.8], vr: [1, .8], vu: [1, -.8] };
  function spec(A, s) {
    const [k, ...q] = s.trim().split(/\s+/), n = q.map(x => isNaN(+x) ? x : +x);
    const ar = A.arm, ua = A.ua, lg = A.leg;
    switch (k) {
      case "fa": { const [c, u, f] = n, t = c / 12, hw = ar.hw0 + (ar.hw1 - ar.hw0) * t, [fa, fr] = FACE[f] || [1, 0];
        return { b: lerp(A.WR, A.EL, t).addScaledVector(ar.r, u * hw * .85), d: ar.a.clone().multiplyScalar(fa).addScaledVector(ar.r, fr) }; }
      case "ua": { const [c, u, f] = n, [fa, fl] = FACE[f] || [1, 0];
        return { b: A.EL.clone().addScaledVector(ua.ax, c * ua.cun).addScaledVector(ua.l, u * .02), d: ua.a.clone().multiplyScalar(fa).addScaledVector(ua.l, fl) }; }
      case "mc": { const [kk, t, f, sh = 0] = n, M = A.MC[kk - 1]; if (!M) return null; const [fa, fr] = FACE[f] || [-1, 0];
        const ax = nrm(M.h.clone().sub(M.b)), p = M.b.clone().addScaledVector(ax, t * M.b.distanceTo(M.h)).addScaledVector(ar.r, sh * ar.cun);
        return { b: p, d: ar.a.clone().multiplyScalar(fa).addScaledVector(ar.r, fr) }; }
      case "fn": { const [kk, sd] = n, F = A.FN[kk - 1]; if (!F) return null; const p = lerp(F.tip, F.c, sd === "t" ? 0 : .55);
        if (sd === "t") return { b: F.c.clone(), d: F.tip.clone().sub(F.c) };
        return { b: p, d: ar.a.clone().multiplyScalar(-1).addScaledVector(ar.r, sd === "r" ? 1 : -1) }; }
      case "ta": { const [c, u, f] = n, y = A.Pb.y + c * (A.PS.y - A.Pb.y) / 18, t = (y - A.KN.y) / (A.FHd.y - A.KN.y), ax = lerp(A.KN, A.FHd, Math.max(0, Math.min(1, t)));
        const [fa, fl] = FACE[f] || [1, 0]; return { b: v(ax.x - u * .045, y, ax.z + .01), d: v(-fl, 0, fa) }; }
      case "tl": { const [c, u, f] = n, y = A.KN.y + (c / 19) * (A.GT.y - A.KN.y), ax = lerp(A.KN, v(A.GT.x + .03, A.GT.y, A.GT.z), c / 19);
        const [fa, fl] = FACE[f] || [-1, 0]; return { b: v(ax.x - u * .045, y, ax.z), d: v(-fl, 0, fa) }; }
      case "lg": { const [c, u, f] = n, t = c / 16, hw = lg.hw0 + (lg.hw1 - lg.hw0) * t, [fa, fl] = FACE[f] || [1, 0];
        return { b: lerp(A.ANK, A.KJ, t).add(v(-u * hw, 0, 0)), d: v(-fl, 0, fa) }; }
      case "lgm": { const [c, f] = n, p = A.MM.clone().addScaledVector(nrm(A.MTC.clone().sub(A.MM)), c * A.lgm.cun), zo = f === "m" ? 0 : f === "pm" ? -.012 : -.03;
        return { b: v(p.x - .025, p.y, p.z + zo), d: v(1, 0, f === "m" ? .25 : -.15) }; }
      case "mt": { const [kk, t, f, sh = 0] = n, M = A.MT[kk - 1]; if (!M) return null; const ax = nrm(M.h.clone().sub(M.b)), p = M.b.clone().addScaledVector(ax, t * M.b.distanceTo(M.h)).add(v(-sh * lg.cun, 0, 0));
        const d = { d: v(0, 1, 0), p: v(0, -1, 0), m: v(1, 0, 0), l: v(-1, 0, 0) }[f] || v(0, 1, 0); return { b: p, d }; }
      case "tn": { const [kk, sd] = n, F = A.TN[kk - 1]; if (!F) return null; if (sd === "t") return { b: F.c.clone(), d: F.tip.clone().sub(F.c) };
        return { b: lerp(F.tip, F.c, .5), d: v(sd === "m" ? 1 : -1, 1, 0) }; }
      case "ch": { const [i, x] = n, xo = -x * A.cunX, y = ics(A, i, xo || -.005); return { b: v(xo, y, A.trunkZ(y) + .07), d: v(0, 0, 1) }; }
      case "ab": { const [c, x] = n, y = c >= 0 ? A.UMB.y + c * A.ab.up : A.UMB.y + c * A.ab.dn, xo = -x * A.cunX; return { b: v(xo, y, A.trunkZ(y) + .06), d: v(0, 0, 1) }; }
      case "bk": { const [vk, x] = n, a = A.V[vk], b = A.V[NEXT[vk] || (vk[0] + (+vk.slice(1) + 1))]; if (!a) return null; const y = b ? (a.tip.y + b.tip.y) / 2 : a.tip.y - .012;
        return { b: v(-x * A.cunB, y, (b ? (a.tip.z + b.tip.z) / 2 : a.tip.z) + .035), d: v(0, 0, -1) }; }
      case "sf": { const [i, x] = n, y = A.SB.y + ([.16, .36, .54, .7][i - 1]) * (A.SAp.y - A.SB.y), xo = -x * A.cunB, near = A.SA.filter(p => Math.abs(p.y - y) < .012);
        const z = near.length ? Math.min(...near.map(p => p.z)) : A.SB.z; return { b: v(xo, y, z + .03), d: v(0, 0, -1) }; }
      case "hd": { const [c, x] = n, th = headTheta(A, c), d = v(0, Math.sin(th), Math.cos(th)), R = A.GLB.distanceTo(A.HC);
        d.add(v(-x * A.cunH / R, 0, 0)).normalize(); return { b: A.HC.clone(), d }; }
      case "nk": { const [vk, ang] = n, a = A.V[vk]; if (!a) return null; const r = ang * Math.PI / 180; return { b: a.c.clone().add(v(0, 0, .03)), d: v(-Math.sin(r), 0, Math.cos(r)) }; }
      case "lt": { const [i, dd] = n, y = ics(A, i, -.08), z = A.trunkZ(y) + .08 + dd * A.cunX; return { b: v(-.03, y, z), d: v(-1, 0, 0) }; }
      case "x": return special(A, q[0]);
    }
    return null;
  }
  function special(A, id) {
    const H = A.HC, hc = y => v(H.x, y, H.z), P = A.PUP, cuH = A.cunH, cuA = A.arm.cun, L = v(-1, 0, 0);
    const G = (gp, c) => ({ g: gp, c: c || hc(gp.y) });
    const st8 = () => { const s = spec(A, "hd .5 4.5"); return s.b.clone().addScaledVector(s.d, A.HR); };
    const gb7 = () => v(A.TRAG.x - .004, A.Etop.y, A.TRAG.z + .012);
    switch (id) {
      case "LI15": return { b: A.HH.clone(), d: v(-1, -.15, .55) };
      case "TE14": return { b: A.HH.clone(), d: v(-1, -.15, -.6) };
      case "LI16": return G(mid(A.CLl, A.SPINE).add(v(0, .015, 0)), mid(A.CLl, A.SPINE).add(v(0, -.04, 0)));
      case "GB21": { const m = mid(A.V.C7.tip, A.ACR); return { b: m.clone().add(v(0, -.05, .01)), d: v(0, 1, 0) }; }
      case "TE15": return { b: A.SCsup.clone().add(v(0, 0, .03)), d: v(0, .6, -1) };
      case "SI9": return { b: A.HH.clone().add(v(.01, -.075, -.01)), d: v(0, 0, -1) };
      case "SI10": return { b: v(A.HH.x + .01, A.SPINE.y - .015, A.HH.z), d: v(0, 0, -1) };
      case "SI11": return { b: lerp(A.SPINE, A.SCinf, .35).add(v(0, 0, .03)), d: v(0, 0, -1) };
      case "SI12": return { b: A.SPINE.clone().add(v(0, .025, .03)), d: v(0, .2, -1) };
      case "SI13": return { b: lerp(A.SCsup, A.SPINEmed, .5).add(v(0, 0, .03)), d: v(0, .2, -1) };
      case "TE13": return { b: A.ACR.clone().addScaledVector(A.ua.ax, -3 * A.ua.cun).add(v(.015, 0, 0)), d: v(-.4, 0, -1) };
      case "TE10": return { b: A.OL.clone().addScaledVector(A.ua.ax, cuA).add(v(0, 0, .02)), d: v(0, 0, -1) };
      case "TE11": return { b: A.OL.clone().addScaledVector(A.ua.ax, 2 * cuA).add(v(0, 0, .02)), d: v(0, 0, -1) };
      case "TE12": return { b: lerp(A.OL.clone().addScaledVector(A.ua.ax, 2 * cuA), A.ACR.clone().addScaledVector(A.ua.ax, -3 * A.ua.cun), .5).add(v(.01, 0, .02)), d: v(0, 0, -1) };
      case "SI8": return { b: mid(A.OL, A.ELm).add(v(0, 0, .02)), d: v(.4, 0, -1) };
      case "HT1": return { b: A.HH.clone().add(v(.03, -.05, .005)), d: v(.2, -1, 0) };
      case "ST35": return G(A.Pa.clone().add(v(-.018, -.006, .004)), v(A.KJ.x, A.Pa.y, A.KJ.z));
      case "NEIXIYAN": return G(A.Pa.clone().add(v(.018, -.006, .004)), v(A.KJ.x, A.Pa.y, A.KJ.z));
      case "GB34": return { b: A.FIBh.clone().add(v(.015, -.012, -.005)), d: v(-1, 0, .5) };
      case "SP5": return { b: A.MM.clone().add(v(-.02, -.008, .012)), d: v(1, 0, .4) };
      case "KI3": return { b: A.MM.clone().add(v(-.02, 0, -.02)), d: v(1, 0, -.3) };
      case "KI4": return { b: A.MM.clone().add(v(-.02, -.012, -.026)), d: v(1, 0, -.3) };
      case "KI5": return { b: A.MM.clone().add(v(-.02, -.012 - A.leg.cun, -.02)), d: v(1, 0, -.2) };
      case "KI6": return { b: A.MM.clone().add(v(-.02, -.015, 0)), d: v(1, -.2, 0) };
      case "KI2": return { b: A.NAV.clone().add(v(-.02, -.01, 0)), d: v(1, -.3, 0) };
      case "KI1": { const M = A.MT[1]; const p = lerp(M.h, A.HEELb, .3); return { b: v(p.x, A.HEELb.y + .03, p.z), d: v(0, -1, 0) }; }
      case "LR4": return { b: A.MM.clone().add(v(-.015, 0, .02)), d: v(.4, 0, 1) };
      case "GB40": return { b: A.LM.clone().add(v(.015, -.01, .015)), d: v(-1, 0, .6) };
      case "BL61": return { b: A.LM.clone().add(v(.02, -.03, -.02)), d: v(-1, 0, -.2) };
      case "BL62": return { b: A.LM.clone().add(v(.02, -.014, 0)), d: v(-1, -.3, 0) };
      case "BL63": return { b: A.LM.clone().add(v(.02, -.02, .02)), d: v(-1, -.3, 0) };
      case "LR13": { const e = A.ribEnd(11); return G(e, v(0, e.y, A.trunkZ(e.y))); }
      case "GB25": { const e = A.ribEnd(12); return G(e.clone().add(v(0, -.006, 0)), v(0, e.y, A.trunkZ(e.y))); }
      case "GB26": { const e = A.ribEnd(11); return { b: v(e.x * .5, A.UMB.y, A.trunkZ(A.UMB.y) + .04), d: v(-1, 0, 0) }; }
      case "GB27": { const y = A.UMB.y - 3 * A.ab.dn; return { b: v(A.ASIS.x + .012, y, A.trunkZ(y) + .05), d: v(0, 0, 1) }; }
      case "GB28": { const y = A.UMB.y - 3.5 * A.ab.dn; return { b: v(A.ASIS.x + .016, y, A.trunkZ(y) + .05), d: v(0, 0, 1) }; }
      case "GB29": return { b: mid(A.ASIS, A.GT).add(v(.03, 0, 0)), d: v(-1, 0, 0) };
      case "GB30": { const hi = v(0, A.SAp.y + .02, A.SAp.z); return { b: lerp(A.GT, hi, .33).add(v(.02, 0, .03)), d: v(-.4, 0, -1) }; }
      case "BL35": return { b: A.SAp.clone().add(v(-A.cunB * .5, -.005, .03)), d: v(0, -.2, -1) };
      case "GV1": return { b: A.SAp.clone().add(v(0, .01, .03)), d: v(0, -1, -.6) };
      case "GV2": return { b: A.SAp.clone().add(v(0, .03, .03)), d: v(0, 0, -1) };
      case "CV1": return { b: v(0, A.PSlow.y, (A.PSlow.z + A.SAp.z) / 2), d: v(0, -1, 0) };
      case "CV22": return G(A.JN.clone().add(v(0, .01, .005)), v(0, A.JN.y, A.JN.z - .06));
      case "CV21": return G(A.JN.clone().add(v(0, -A.cunX, .01)), v(0, A.JN.y - A.cunX, A.JN.z - .06));
      case "CV23": return G(A.HY.clone().add(v(0, .006, .015)), v(0, A.HY.y, A.HY.z - .04));
      case "CV24": return G(v(0, A.CHIN.y + .015, A.CHIN.z), hc(A.CHIN.y + .015));
      case "ST11": return G(A.CLm.clone().add(v(-.008, .012, .004)), v(0, A.CLm.y + .012, A.CLm.z - .05));
      case "ST12": return G(A.CLmid.clone().add(v(0, .014, -.008)), v(A.CLmid.x * .5, A.CLmid.y + .01, A.CLmid.z - .05));
      case "SI17": return G(A.MA.clone().add(v(0, -.006, -.012)), hc(A.MA.y));
      case "SI18": return G(v(P.x - .022, A.ZYlow.y - .004, P.z - .02), hc(A.ZYlow.y));
      case "SI19": return G(A.TRAG.clone().add(v(0, 0, .009)), hc(A.TRAG.y));
      case "TE21": return G(A.TRAG.clone().add(v(0, .011, .009)), hc(A.TRAG.y + .011));
      case "GB2": return G(A.TRAG.clone().add(v(0, -.011, .009)), hc(A.TRAG.y - .011));
      case "TE22": return G(v(A.TRAG.x, A.Etop.y - .008, A.TRAG.z + .013), hc(A.Etop.y - .008));
      case "TE20": return G(A.Etop.clone().add(v(0, .007, 0)), hc(A.Etop.y));
      case "TE17": return G(A.Ebot.clone().add(v(.004, .004, -.012)), hc(A.Ebot.y));
      case "TE18": return G(lerp(A.Ebot, A.Etop, .33).add(v(.004, 0, -.006)).setZ(A.Eback.z - .004), hc(lerp(A.Ebot, A.Etop, .33).y));
      case "TE19": return G(lerp(A.Ebot, A.Etop, .66).add(v(.004, 0, -.006)).setZ(A.Eback.z - .004), hc(lerp(A.Ebot, A.Etop, .66).y));
      case "YIMING": return G(A.Ebot.clone().add(v(.006, .004, -.03)), hc(A.Ebot.y));
      case "GB8": return G(A.Etop.clone().add(v(.004, 1.5 * cuH, 0)), hc(A.Etop.y + 1.5 * cuH));
      case "GB9": return G(A.Etop.clone().add(v(.004, 2 * cuH, -.012)), hc(A.Etop.y + 2 * cuH));
      case "GB12": return G(A.MAST.clone().add(v(0, -.004, -.01)), hc(A.MAST.y));
      case "GB10": case "GB11": { const a = A.Etop.clone().add(v(.004, 2 * cuH, -.012)), b = A.MAST.clone().add(v(0, -.004, -.01)), t = id === "GB10" ? .33 : .66, p = lerp(a, b, t); p.z -= .012; return G(p, hc(p.y)); }
      case "GB7": return G(gb7(), hc(A.Etop.y));
      case "GB3": return G(v(A.TRAG.x, A.TRAG.y + .014, A.TRAG.z + .024), hc(A.TRAG.y + .014));
      case "GB4": case "GB5": case "GB6": { const t = { GB4: .25, GB5: .5, GB6: .75 }[id], p = lerp(st8(), gb7(), t); p.x -= .01; return G(p, hc(p.y)); }
      case "ST1": return G(P.clone().add(v(0, -.016, -.004)), A.EC.clone().add(v(.01, -.01, -.03)));
      case "ST2": return G(P.clone().add(v(0, -.026, -.004)), hc(P.y - .026));
      case "ST3": return G(v(P.x, A.ALA.y, P.z - .006), hc(A.ALA.y));
      case "ST4": { const y = A.ALA.y - .024; return G(v(P.x * .62 - .004, y, A.CHIN.z - .004), hc(y)); }
      case "ST5": return G(A.MA.clone().add(v(.004, .004, .024)), hc(A.MA.y + .004));
      case "ST6": return G(A.MA.clone().add(v(.002, .014, .012)), hc(A.MA.y + .014));
      case "ST7": return G(A.COND.clone().add(v(0, -.006, .014)), hc(A.COND.y - .006));
      case "LI19": return G(A.ALA.clone().add(v(.002, -.008, .004)), hc(A.ALA.y - .008));
      case "LI20": return G(A.ALA.clone().add(v(-.006, .003, -.002)), hc(A.ALA.y + .003));
      case "BL1": return G(P.clone().add(v(.017, .004, -.004)), A.EC.clone().add(v(-.01, 0, -.02)));
      case "BL2": return G(P.clone().add(v(.015, .02, .0)), hc(P.y + .02));
      case "GB1": return G(P.clone().add(v(-.022, 0, -.01)), hc(P.y));
      case "GB14": return G(P.clone().add(v(0, .02 + cuH, .004)), hc(P.y + .02 + cuH));
      case "TE23": return G(P.clone().add(v(-.022, .018, -.008)), hc(P.y + .018));
      case "YINTANG": return G(v(0, P.y + .02, A.GLB.z), hc(P.y + .02));
      case "YUYAO": return G(P.clone().add(v(0, .02, .004)), hc(P.y + .02));
      case "TAIYANG": return G(P.clone().add(v(-.036, .008, -.026)), hc(P.y + .008));
      case "GV25": return G(A.NT.clone(), hc(A.NT.y));
      case "GV26": return G(v(0, A.ALA.y - .007, A.NT.z - .012), hc(A.ALA.y - .007));
      case "GV27": return G(v(0, A.ALA.y - .015, A.NT.z - .014), hc(A.ALA.y - .015));
      case "GV28": return G(v(0, A.ALA.y - .016, A.NT.z - .02), hc(A.ALA.y - .016));
    }
    return null;
  }
  const REACH = { fa: .07, ua: .09, mc: .04, fn: .03, ta: .12, tl: .13, lg: .085, lgm: .07, mt: .05, tn: .03, ch: .22, ab: .26, bk: .12, sf: .1, hd: .2, nk: .1, lt: .25, x: .12 };
  function placeOne(A, s, mirror) {
    const r = spec(A, s); if (!r) return null;
    const mx = p => mirror ? v(-p.x, p.y, p.z) : p, k = s.trim().split(/\s+/)[0];
    if (r.g) return snap(mx(r.g), mx(r.c));
    return cast(mx(r.b), mx(r.d), REACH[k] || .3) || cast(mx(r.b), mx(r.d), (REACH[k] || .3) * 1.6);
  }

  // ---------------------------------------------------------------- correlação anatômica
  function correlate(pt) {
    const sk = GS, i = pt.i, dermA = sk.m.geometry.attributes.derm, DERM = E.DERM, out = {};
    if (dermA && i != null) out.derm = DERM[Math.round(dermA.getX(i))] || null;
    let bm = -1, bd = 1e9; if (GM) GM.near(pt.p, .045).forEach(j => { const d = (GM.pa.getX(j) - pt.p.x) ** 2 + (GM.pa.getY(j) - pt.p.y) ** 2 + (GM.pa.getZ(j) - pt.p.z) ** 2; if (d < bd) { bd = d; bm = j; } });
    if (bm >= 0) { const k = Math.round(GM.pid.getX(bm)); out.muscle = GM.m.userData.parts[k].name; out.depthMuscle = Math.sqrt(bd) * 1000; }
    let bb = -1, bbd = 1e9; if (GB) GB.near(pt.p, .06).forEach(j => { const d = (GB.pa.getX(j) - pt.p.x) ** 2 + (GB.pa.getY(j) - pt.p.y) ** 2 + (GB.pa.getZ(j) - pt.p.z) ** 2; if (d < bbd) { bbd = d; bb = j; } });
    if (bb >= 0) { const k = Math.round(GB.pid.getX(bb)); out.bone = GB.m.userData.parts[k].name; out.depthBone = Math.sqrt(bbd) * 1000; }
    let nn = null, nd = 1e9; const a = v(0, 0, 0), b = v(0, 0, 0), ab = v(0, 0, 0), ap = v(0, 0, 0);
    (E.S.anat.nerves || []).forEach(n => { for (let j = 1; j < n.p.length; j++) { a.set(...n.p[j - 1]); b.set(...n.p[j]); ab.subVectors(b, a); ap.subVectors(pt.p, a);
      const t = Math.max(0, Math.min(1, ap.dot(ab) / Math.max(1e-9, ab.lengthSq()))), d = ap.addScaledVector(ab, -t).lengthSq(); if (d < nd) { nd = d; nn = n; } } });
    if (nn) { out.nerve = nn.name; out.nerveKind = nn.kind; out.distNerve = Math.sqrt(nd) * 1000; }
    return out;
  }

  // ---------------------------------------------------------------- construção
  async function build(onProg) {
    E = ST().ext(); T = E.T; V3 = T.Vector3; if (!E.S.anatReady || !E.S.meshByLayer || !E.S.meshByLayer.skin) throw new Error("anatomia ainda não carregada");
    const tk = g.AxonBoot && g.AxonBoot.task("acu", "Posicionando os acupontos na malha", 10, "361 pontos clássicos + extras · marcos ósseos → cun → pele");
    const step = (f, info) => { tk && tk.progress(f, info); onProg && onProg(f, info); return new Promise(r => setTimeout(r, 0)); };
    await step(.02, "indexando a pele…"); GS = grid("skin");
    await step(.08, "indexando músculos e ossos…"); GM = E.S.meshByLayer.muscles ? grid("muscles") : null; GB = grid("skeleton");
    await step(.14, "extraindo marcos ósseos…"); const A = S.A = anchors();
    const data = D().M, list = []; Object.entries(data).forEach(([mk, m]) => m.p.forEach(row => list.push([mk, ...row])));
    S.pts = []; S.byId = {}; let k = 0;
    for (const [mk, code, py, loc, sp, opt] of list) {
      const specs = [sp, ...((opt && opt.also) || [])], mid = /^(GV|CV)/.test(code) || (/^(hd|bk|ab|ch)\s/.test(sp) && /\s0$/.test(sp.trim()) && !(opt && opt.also));
      const sides = mid ? ["M"] : ["D", "E"];
      const ent = { id: code, mer: mk, py, loc, spec: sp, sides: {}, safety: Object.keys(D().SAFETY).filter(s => D().SAFETY[s].includes(code)) };
      for (const sd of sides) { const ps = specs.map(s => placeOne(A, s, sd === "E")).filter(Boolean); if (ps.length) ent.sides[sd] = ps.map(p => Object.assign(p, correlate(p))); }
      S.pts.push(ent); S.byId[code] = ent; if (++k % 25 === 0) await step(.15 + .75 * k / list.length, `${k} de ${list.length} pontos`);
    }
    await step(.92, "desenhando meridianos e linhas MS…"); draw();
    S.ready = true; S.ver++; const ok = S.pts.filter(p => Object.keys(p.sides).length).length;
    tk && tk.done(`${ok} de ${S.pts.length} pontos posicionados`); document.dispatchEvent(new CustomEvent("axon:acu", { detail: { ready: true, n: ok } }));
    return S;
  }
  function pos(id, side = "D") { const e = S.byId[id]; if (!e) return null; const s = e.sides[side] || e.sides.M || e.sides.D; return s ? s[0] : null; }

  // ---------------------------------------------------------------- desenho 3D
  function draw() {
    const G = E.S.groups.L1; if (S.grp) G.remove(S.grp); S.grp = new T.Group(); S.grp.name = "acu361"; S.grp.visible = S.show; G.add(S.grp);
    const all = []; S.pts.forEach(e => Object.entries(e.sides).forEach(([sd, arr]) => arr.forEach((p, j) => all.push({ e, sd, p, j }))));
    const geo = new T.SphereGeometry(.0048, 12, 10), mat = new T.MeshStandardMaterial({ roughness: .35, metalness: .1, emissiveIntensity: .45, depthTest: true });
    const im = new T.InstancedMesh(geo, mat, all.length), m4 = new T.Matrix4(), c = new T.Color(); im.renderOrder = 22;
    all.forEach((a, i) => { const n = a.p.n || nrm(a.p.p.clone().sub(v(0, a.p.p.y, 0))); const q = a.p.p.clone().addScaledVector(n, -.0012); m4.makeTranslation(q.x, q.y, q.z); im.setMatrixAt(i, m4); c.set(D().M[a.e.mer].col).convertSRGBToLinear(); im.setColorAt(i, c); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.userData.all = all; S.inst = im; S.grp.add(im);
    S.lines = []; Object.entries(D().M).forEach(([mk, m]) => { if (mk === "EX") return; ["D", "E", "M"].forEach(sd => {
      const pts = m.p.map(r => { const e = S.byId[r[0]]; const s = e && (e.sides[sd] || (sd !== "M" && e.sides.M)); return s ? s[0].p.clone().addScaledVector(s[0].n || v(0, 0, 0), -.0016) : null; }).filter(Boolean);
      if (pts.length < 2 || (sd === "M" && !/GV|CV/.test(mk)) || (sd !== "M" && /GV|CV/.test(mk))) return;
      const ln = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineDashedMaterial({ color: new T.Color(m.col).convertSRGBToLinear(), dashSize: .012, gapSize: .006, transparent: true, opacity: .75 }));
      ln.computeLineDistances(); ln.userData.mer = mk; ln.renderOrder = 21; S.lines.push(ln); S.grp.add(ln); }); });
    drawMS(); applyFilter();
  }
  function msPoint(id, side) { if (id === "EX-HN1a") { const e = S.byId["EX-HN1"]; return e && e.sides.M ? e.sides.M[0].p : null; } const p = pos(id, side); return p ? p.p : null; }
  function drawMS() {
    if (S.msLines) S.grp.remove(S.msLines); S.msLines = new T.Group(); S.msLines.name = "MS"; S.msLines.visible = !!S.showMS; S.grp.add(S.msLines);
    const A = S.A, cu = A.cunH, out = [];
    D().MS.forEach(([code, py, n, def]) => ["D", "E"].forEach(sd => {
      if (/MS1$|MS5$|MS12$/.test(code) && sd === "E") return;
      let pts = []; def.forEach(t => { if (t[0] !== "@") { const p = msPoint(t, sd); if (p) pts.push(p.clone()); return; }
        const [op, val] = t.slice(1).split(" "), last = pts[pts.length - 1]; if (!last) return; const d = nrm(last.clone().sub(A.HC)), lat = v(sd === "E" ? 1 : -1, 0, 0);
        if (op === "down") { const tan = nrm(v(0, -1, 0).addScaledVector(d, d.y)); pts.push(last.clone().addScaledVector(tan, +val * cu)); }
        if (op === "back") { const tan = nrm(v(0, 0, -1).addScaledVector(d, d.z)); pts.push(last.clone().addScaledVector(tan, +val * cu)); }
        if (op === "med") pts[pts.length - 1] = last.clone().addScaledVector(lat, -val * cu);
        if (op === "lat") pts = pts.map(p => p.clone().addScaledVector(lat, +val * cu)); });
      if (pts.length < 2) return;
      const curve = new T.CatmullRomCurve3(pts.map(p => { const d = nrm(p.clone().sub(A.HC)); return A.HC.clone().addScaledVector(d, p.distanceTo(A.HC) + .003); }));
      const tube = new T.Mesh(new T.TubeGeometry(curve, 20, .0022, 6, false), new T.MeshBasicMaterial({ color: 0x3ee6c5, transparent: true, opacity: .9, depthTest: false }));
      tube.userData = { ms: code, side: sd }; tube.renderOrder = 25; S.msLines.add(tube); out.push(code);
    }));
    return out;
  }
  function applyFilter() {
    if (!S.inst) return; const all = S.inst.userData.all, m4 = new T.Matrix4(), z = new T.Matrix4().makeScale(0, 0, 0);
    all.forEach((a, i) => { const on = S.mer[a.e.mer] !== false; const n = a.p.n || v(0, 0, 0), q = a.p.p.clone().addScaledVector(n, -.0012), s = S.sel === a.e.id ? 2.2 : 1;
      m4.makeScale(s, s, s).setPosition(q.x, q.y, q.z); S.inst.setMatrixAt(i, on ? m4 : z); });
    S.inst.instanceMatrix.needsUpdate = true; S.lines.forEach(l => l.visible = S.mer[l.userData.mer] !== false);
  }
  function setShow(on) { S.show = on; if (S.grp) S.grp.visible = on; }
  function setMS(on) { S.showMS = on; if (S.msLines) S.msLines.visible = on; if (on) setShow(true); }
  function select(id, focus = true) {
    S.sel = id; applyFilter(); const p = pos(id); if (!p) return null;
    if (focus && E.focusOn) E.focusOn([p.p.x, p.p.y, p.p.z], p.n ? [p.n.x, p.n.y, p.n.z] : null, .35);
    document.dispatchEvent(new CustomEvent("axon:acupoint", { detail: { id, p: p.p.toArray(), point: S.byId[id] } }));
    return S.byId[id];
  }
  function pick(ray) { if (!S.inst || !S.show) return null; const h = ray.intersectObject(S.inst)[0]; if (!h) return null; const a = S.inst.userData.all[h.instanceId]; return a ? { id: a.e.id, side: a.sd, p: a.p } : null; }

  g.AxonAcu = { S, build, pos, select, setShow, setMS, applyFilter, pick, get ready() { return S.ready; } };
})(window);
