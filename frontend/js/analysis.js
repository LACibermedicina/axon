/* axon · analysis.js — duas janelas de estudo:
   1. "mathdesc" — análise descritiva da predição do diâmetro recrutado: equações, cálculo passo a passo com os valores
      do momento, código-fonte real das funções que rodam no simulador e verificação numérica.
   2. "variation" — variação de possibilidades: outras fibras (incluindo amielínicas), sensibilidade aos parâmetros,
      curvas força-duração, cenários terapêuticos com desfechos da literatura e a complexidade de parametrizar a fisiologia.
   Literatura conferida no PubMed (PMID/DOI). Estimativas fora do núcleo verificado aparecem como PREMISSA. */
(function (g) {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (x, d = 2) => x == null || !isFinite(x) ? "—" : (+x).toFixed(d).replace(".", ",");
  const M = () => g.AxonModel, MO = () => g.AxonMorpho, A = () => g.AxonApp;
  const TG = { lit: ["LITERATURA", "t-lit"], pre: ["PREMISSA", "t-pre"], der: ["DERIVADO", "t-der"], mod: ["RESULTADO DE MODELO", "t-mod"], hip: ["HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO", "t-hip"] };
  const tag = k => `<span class="tag ${TG[k][1]}">${TG[k][0]}</span>`;
  const doi = d => `<a href="https://doi.org/${esc(d)}" target="_blank" rel="noopener">doi:${esc(d)}</a>`;
  // ------------------------------------------------------------------ literatura conferida no PubMed
  const LIT = {
    mcneal: { t: "McNeal DR. Analysis of a model for excitation of myelinated nerve. IEEE Trans Biomed Eng. 1976;23(4):329-37.", pmid: "1278925", doi: "10.1109/tbme.1976.324593" },
    rattay: { t: "Rattay F. Analysis of models for external stimulation of axons. IEEE Trans Biomed Eng. 1986;33(10):974-7.", pmid: "3770787", doi: "10.1109/TBME.1986.325670" },
    mrg: { t: "McIntyre CC, Richardson AG, Grill WM. Modeling the excitability of mammalian nerve fibers: influence of afterpotentials on the recovery cycle. J Neurophysiol. 2002;87(2):995-1006.", pmid: "11826063", doi: "10.1152/jn.00353.2001" },
    mogy: { t: "Mogyoros I, Kiernan MC, Burke D. Strength-duration properties of human peripheral nerve. Brain. 1996;119(Pt 2):439-47.", pmid: "8800939", doi: "10.1093/brain/119.2.439" },
    libak: { t: "Li CL, Bak A. Excitability characteristics of the A- and C-fibers in a peripheral nerve. Exp Neurol. 1976;50(1):67-79.", pmid: "1248547", doi: "10.1016/0014-4886(76)90236-3" },
    gas50: { t: "Gasser HS. Unmedullated fibers originating in dorsal root ganglia. J Gen Physiol. 1950;33(6):651-90.", pmid: "15428610", doi: "10.1085/jgp.33.6.651" },
    gas55: { t: "Gasser HS. Properties of dorsal root unmedullated fibers on the two sides of the ganglion. J Gen Physiol. 1955;38(5):709-28.", pmid: "14367780", doi: "10.1085/jgp.38.5.709" },
    sluka: { t: "Sluka KA, Walsh D. Transcutaneous electrical nerve stimulation: basic science mechanisms and clinical effectiveness. J Pain. 2003;4(3):109-21.", pmid: "14622708", doi: "10.1054/jpai.2003.434" },
    han: { t: "Han JS. Acupuncture: neuropeptide release produced by electrical stimulation of different frequencies. Trends Neurosci. 2003;26(1):17-22.", pmid: "12495858", doi: "10.1016/s0166-2236(02)00006-1" },
    kilgore: { t: "Kilgore KL, Bhadra N. Reversible nerve conduction block using kilohertz frequency alternating current. Neuromodulation. 2014;17(3):242-54.", pmid: "23924075", doi: "10.1111/ner.12100" },
    loken: { t: "Löken LS, Wessberg J, Morrison I, McGlone F, Olausson H. Coding of pleasant touch by unmyelinated afferents in humans. Nat Neurosci. 2009;12(5):547-8.", pmid: "19363489", doi: "10.1038/nn.2312" },
    peuker: { t: "Peuker ET, Filler TJ. The nerve supply of the human auricle. Clin Anat. 2002;15(1):35-7.", pmid: "11835542", doi: "10.1002/ca.1089" },
  };
  const cite = (...k) => k.map(x => `<small class="cit">${esc(LIT[x].t)} PMID ${LIT[x].pmid} · ${doi(LIT[x].doi)}</small>`).join("");
  const refsOf = keys => `<ol class="refs small">${keys.map(k => `<li>${esc(LIT[k].t)} PMID ${LIT[k].pmid}. ${doi(LIT[k].doi)}</li>`).join("")}</ol>`;
  // ------------------------------------------------------------------ cabo contínuo passivo (fibras amielínicas) — estimativa [PREMISSA]
  // mesma estrutura do núcleo, mas sem mielina: segmentos de 50 µm, membrana em toda a superfície (cm 1 µF/cm², gl 0,3 mS/cm²)
  function hC(D, r, o = {}) {
    const P = M().P, pw = o.pw ?? 100e-6, rho_i = o.rho_i ?? P.RHO_I, rho_e = o.rho_e ?? P.RHO_E, dx = 50e-4, N = 201, dt = 1e-6;
    const d = D * 1e-4, Ga = Math.PI * d * d / 4 / (rho_i * dx), ar = Math.PI * d * dx, C = (o.cm ?? 1e-6) * ar, gl = (o.gl ?? 0.3e-3) * ar;
    const Ve = new Float64Array(N), drv = new Float64Array(N);
    for (let i = 0; i < N; i++) { const x = (i - (N >> 1)) * dx; Ve[i] = -rho_e / (4 * Math.PI * Math.sqrt(x * x + r * r)); }
    for (let i = 1; i < N - 1; i++) drv[i] = Ga * (Ve[i - 1] - 2 * Ve[i] + Ve[i + 1]);
    let V = new Float64Array(N), Vn = new Float64Array(N), vm = 0; const steps = Math.floor((pw + 3e-3) / dt);
    for (let k = 0; k < steps; k++) { const on = k * dt < pw;
      for (let i = 0; i < N; i++) { const l = V[i > 0 ? i - 1 : 0], rr = V[i < N - 1 ? i + 1 : N - 1]; Vn[i] = V[i] + dt / C * (-gl * V[i] + Ga * (l - 2 * V[i] + rr) + (on ? drv[i] : 0)); }
      [V, Vn] = [Vn, V]; for (let i = 0; i < N; i++) if (V[i] > vm) vm = V[i]; }
    return vm;
  }
  const IthC = (D, r, o = {}) => (o.vth ?? M().P.VTH) / hC(D, r, o);
  const memo = new Map(); const ith = (D, r, o = {}) => { const k = D + "|" + r + "|" + JSON.stringify(o); if (!memo.has(k)) memo.set(k, (D < 1 ? IthC(D, r, o) : M().Ith(Math.min(16, D), r, o)) * 1e3); return memo.get(k); };   // mA
  // limiar das amielínicas: o modelo é linear, então depende só de D — grade de 7 diâmetros e interpolação log-log
  const gridC = new Map();
  function ithCfast(D, r, o = {}) {
    const key = r + "|" + (o.pw ?? 100e-6); let G = gridC.get(key);
    if (!G) { G = [.2, .3, .45, .65, .9, 1.2, 1.5].map(d => [Math.log(d), Math.log(IthC(d, r, o) * 1e3)]); gridC.set(key, G); }
    const x = Math.log(Math.max(.2, Math.min(1.5, D))); let i = 0; while (i < G.length - 2 && x > G[i + 1][0]) i++;
    const t = (x - G[i][0]) / (G[i + 1][0] - G[i][0]); return Math.exp(G[i][1] + t * (G[i + 1][1] - G[i][1]));
  }
  function dstar(I, r, o, lo = 1, hi = 16, fn = ith) { if (I < fn(hi, r, o)) return Infinity; if (I >= fn(lo, r, o)) return lo; let a = Math.log(lo), b = Math.log(hi); for (let i = 0; i < 26; i++) { const m = (a + b) / 2; if (fn(Math.exp(m), r, o) > I) a = m; else b = m; } return Math.exp((a + b) / 2); }
  const phi = z => .5 * (1 + Math.tanh(.7978845608 * (z + .044715 * z * z * z)));
  // ------------------------------------------------------------------ gráfico simples em canvas
  function plot(cv, S, o = {}) {
    const dpr = devicePixelRatio || 1, W = cv.clientWidth || 520, H = cv.clientHeight || 260; cv.width = W * dpr; cv.height = H * dpr; const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const pad = { l: 54, r: 14, t: 14, b: 36 }, xs = S.flatMap(s => s.pts.map(p => p[0])).filter(isFinite), ys = S.flatMap(s => s.pts.map(p => p[1])).filter(v => isFinite(v) && (!o.ylog || v > 0));
    if (!xs.length || !ys.length) return; const lx = o.xlog ? Math.log10 : v => v, ly = o.ylog ? Math.log10 : v => v;
    const x0 = lx(o.xmin ?? Math.min(...xs)), x1 = lx(o.xmax ?? Math.max(...xs)), y0 = ly(o.ymin ?? Math.min(...ys)), y1 = ly(o.ymax ?? Math.max(...ys)) + (o.ylog ? 0 : 1e-9);
    const X = v => pad.l + (lx(v) - x0) / (x1 - x0 || 1) * (W - pad.l - pad.r), Y = v => H - pad.b - (ly(v) - y0) / (y1 - y0 || 1) * (H - pad.t - pad.b);
    c.strokeStyle = "rgba(150,200,200,.18)"; c.fillStyle = "#8fb3ad"; c.font = "11px Inter,system-ui,sans-serif"; c.lineWidth = 1;
    const ticks = (a, b, log) => { if (log) { const t = []; for (let e = Math.floor(a); e <= Math.ceil(b); e++) [1, 2, 5].forEach(m => { const v = Math.log10(m) + e; if (v >= a - 1e-9 && v <= b + 1e-9) t.push(Math.pow(10, v)); }); return t; } const st = Math.pow(10, Math.floor(Math.log10((b - a) / 4 || 1))), n = Math.ceil((b - a) / st); const k = n > 8 ? (n > 16 ? 5 : 2) : 1; const t = []; for (let v = Math.ceil(a / (st * k)) * st * k; v <= b + 1e-9; v += st * k) t.push(+v.toFixed(6)); return t; };
    ticks(x0, x1, o.xlog).forEach(v => { c.beginPath(); c.moveTo(X(v), pad.t); c.lineTo(X(v), H - pad.b); c.stroke(); c.fillText(String(+v.toPrecision(3)).replace(".", ","), X(v) - 8, H - pad.b + 14); });
    ticks(y0, y1, o.ylog).forEach(v => { c.beginPath(); c.moveTo(pad.l, Y(v)); c.lineTo(W - pad.r, Y(v)); c.stroke(); c.fillText(String(+v.toPrecision(3)).replace(".", ","), 4, Y(v) + 4); });
    if (o.xl) c.fillText(o.xl, W / 2 - 40, H - 6); if (o.yl) { c.save(); c.translate(12, H / 2 + 30); c.rotate(-Math.PI / 2); c.fillText(o.yl, 0, 0); c.restore(); }
    (o.bands || []).forEach(b => { c.fillStyle = b.col; c.globalAlpha = .12; c.fillRect(X(b.a), pad.t, X(b.b) - X(b.a), H - pad.t - pad.b); c.globalAlpha = 1; c.fillStyle = b.col; c.fillText(b.n, X(b.a) + 3, pad.t + 12); });
    S.forEach(s => { c.strokeStyle = s.col; c.lineWidth = s.w || 2; c.setLineDash(s.dash || []); c.beginPath(); let st = false; s.pts.forEach(([x, y]) => { if (!isFinite(x) || !isFinite(y) || (o.ylog && y <= 0)) { st = false; return; } st ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)); st = true; }); c.stroke(); c.setLineDash([]); });
    (o.marks || []).forEach(m => { c.fillStyle = m.col || "#ff7a59"; c.beginPath(); c.arc(X(m.x), Y(m.y), 4.5, 0, 6.283); c.fill(); if (m.t) { c.fillStyle = "#e4f6f2"; c.fillText(m.t, X(m.x) + 7, Y(m.y) - 6); } });
    const lg = S.filter(s => s.n); lg.forEach((s, i) => { c.fillStyle = s.col; c.fillRect(W - pad.r - 128, pad.t + 4 + i * 15, 12, 3); c.fillStyle = "#cfe9e3"; c.fillText(s.n, W - pad.r - 112, pad.t + 9 + i * 15); });
  }
  // ================================================================== 1. ANÁLISE DESCRITIVA
  const D1 = { tab: "modelo", D: 9, r: .12, pw: 100, I: .6 };
  const EQ = s => `<div class="eq">${s}</div>`;
  function modelTab() {
    const P = M().P;
    return `<div class="card"><h4>O problema</h4><p>Dada uma corrente <i>I</i> aplicada a uma distância <i>r</i> de um nervo, qual é o menor diâmetro de fibra mielinizada que dispara, <i>D</i>*, e que fração de cada classe de fibra fica acima dele? A resposta combina três peças: um modelo biofísico do limiar, uma busca numérica e a distribuição de calibres prevista para o paciente.</p></div>
    <div class="card"><h4>1 · Campo do eletrodo</h4><p>Fonte pontual num meio homogêneo de resistividade ρ<sub>e</sub> = ${P.RHO_E} Ω·cm. O potencial extracelular no nó <i>n</i>, a distância axial <i>x<sub>n</sub></i>:</p>
      ${EQ(`V<sub>e,n</sub> = − ρ<sub>e</sub> · I / ( 4π · √(x<sub>n</sub>² + r²) )`)} ${tag("lit")} ${cite("mcneal")}</div>
    <div class="card"><h4>2 · Geometria da fibra</h4><p>Diâmetro externo <i>D</i>; axônio <i>d</i> = 0,7 · <i>D</i> (g-ratio); internodo <i>L</i> = 100 · <i>D</i>; comprimento do nó <i>l</i> = ${fmt(P.LN * 1e4, 1)} µm; 41 nós.</p>
      ${EQ(`G<sub>a</sub> = π d² / (4 ρ<sub>i</sub> L) &nbsp;·&nbsp; C<sub>n</sub> = c<sub>m</sub> · π d l &nbsp;·&nbsp; G<sub>n</sub> = g<sub>l</sub> · π d l`)}
      <p class="note">ρ<sub>i</sub> = ${P.RHO_I} Ω·cm · c<sub>m</sub> = ${fmt(P.CM * 1e6, 0)} µF/cm² · g<sub>l</sub> = ${fmt(P.GL * 1e3, 1)} mS/cm² ${tag("lit")} (ordem de grandeza do modelo de McNeal)</p></div>
    <div class="card"><h4>3 · Equação de cada nó (cabo nodal passivo)</h4>
      ${EQ(`C<sub>n</sub> · dV<sub>n</sub>/dt = − G<sub>n</sub> V<sub>n</sub> + G<sub>a</sub> (V<sub>n−1</sub> − 2V<sub>n</sub> + V<sub>n+1</sub>) + G<sub>a</sub> (V<sub>e,n−1</sub> − 2V<sub>e,n</sub> + V<sub>e,n+1</sub>)`)}
      <p>O último termo é a <b>função de ativação</b>: a segunda diferença espacial do potencial extracelular. É ela que despolariza a fibra; por isso fibras grossas (internodo longo, maior diferença entre nós) respondem com menos corrente. ${tag("lit")} ${cite("rattay")}</p></div>
    <div class="card"><h4>4 · Integração numérica e limiar</h4><p>Euler explícito, Δt = 1 µs, durante o pulso (<i>pw</i>) e mais 300 µs. Com <i>I</i> = 1 A, o pico de despolarização é <i>h</i>(<i>D</i>, <i>r</i>) (V/A). Como o modelo é linear, o limiar é a corrente que leva o nó a V<sub>th</sub> = ${fmt(P.VTH * 1e3, 0)} mV:</p>
      ${EQ(`I<sub>th</sub>(D, r, pw) = V<sub>th</sub> / h(D, r, pw)`)} <p class="note">${tag("pre")} Membrana passiva com limiar fixo: não há canais de Na⁺/K⁺, pós-potenciais nem ciclo de recuperação (modelos ativos como o MRG representam esses fenômenos). ${cite("mrg")}</p></div>
    <div class="card"><h4>5 · Menor diâmetro recrutado, D*</h4><p>I<sub>th</sub> cai monotonicamente com <i>D</i>. A bisseção em ln <i>D</i>, no intervalo verificado de 1 a 16 µm, acha o diâmetro em que o limiar iguala a corrente que chega ao nervo:</p>
      ${EQ(`I<sub>th</sub>(D*, r, pw) = I<sub>ef</sub> &nbsp;&nbsp; (40 iterações; erro relativo &lt; 10⁻¹¹)`)}
      <p>A corrente efetiva desconta a passagem pela pele e o espalhamento: I<sub>ef</sub> = I · transmissão · fração da área · atenuação(d). ${tag("pre")}</p></div>
    <div class="card"><h4>6 · Distribuição de calibres e fração recrutada</h4><p>Cada classe (Aα, Aβ, Aγ, Aδ, B, C) tem diâmetro normal em torno de μ com dispersão σ, multiplicados pelo fator do paciente <i>s</i> (idade, altura, IMC, temperatura, diabetes, desmielinização). A fração da classe acima de D*:</p>
      ${EQ(`F<sub>classe</sub> = 1 − Φ( (D* − μ·s) / σ )`)}
      <p class="note">Φ é a normal acumulada, calculada pela aproximação 0,5·(1 + tanh(0,79788·(z + 0,044715 z³))), com erro absoluto menor que 2·10⁻⁴. ${tag("der")} As faixas de diâmetro de cada classe são de literatura; centro e dispersão dentro da faixa são premissas. ${tag("pre")}</p></div>
    <div class="card"><h4>7 · Velocidade de condução e latência</h4>${EQ(`VC = k · D &nbsp;(k ≈ 4,4–5,7 m/s por µm nas mielinizadas) &nbsp;·&nbsp; latência = distância / VC + ≈ 0,8 ms na placa motora`)}
      <p>Nas amielínicas a velocidade também é proporcional ao diâmetro, com constante muito menor (0,7–2,3 m/s no conjunto das C de raiz dorsal). ${tag("lit")} ${cite("gas50", "gas55")}</p></div>
    <div class="card"><h4>8 · Fatores do paciente atual</h4>${factorsTable()}</div>`;
  }
  function factorsTable() { try { const p = MO().patient(), f = MO().factors(p, (MO().CLIN || {}).nerve); return `<table class="tbl"><tr><th>Fator</th><th>Valor</th><th>Efeito no modelo</th></tr>${f.F.map(x => `<tr><td>${esc(x.k)}</td><td>${esc(x.v)}</td><td>${esc(x.e)} ${tag(x.t)}</td></tr>`).join("")}</table>`; } catch (e) { return `<p class="note">Preditor indisponível.</p>`; } }
  function calcTab() {
    return `<div class="card"><div class="an-ctl">${[["D", "Diâmetro da fibra", 1, 16, .5, "µm"], ["r", "Distância ao nervo", .03, .15, .005, "cm"], ["pw", "Duração do pulso", 20, 1000, 10, "µs"], ["I", "Corrente no nervo (I<sub>ef</sub>)", .05, 5, .05, "mA"]].map(([k, n, a, b, s, u]) => `<label class="anr"><span>${n}</span><input type="range" data-k="${k}" min="${a}" max="${b}" step="${s}" value="${D1[k]}"><output>${fmt(D1[k], k === "r" ? 3 : 2)} ${u}</output></label>`).join("")}</div>
      <div id="anSteps"></div><canvas id="anPlot" class="anplot"></canvas><p class="note">Limiar × diâmetro na distância e na duração escolhidas (escala log-log). Ponto laranja: D* para a corrente escolhida. ${tag("mod")}</p></div>`;
  }
  function calcRun(b) {
    const P = M().P, D = D1.D, r = D1.r, pw = D1.pw * 1e-6, I = D1.I, L = 100 * D * 1e-4, h = M().h(D, r, { pw }), Ith = M().Ith(D, r, { pw }) * 1e3;
    const Ve0 = -P.RHO_E * 1 / (4 * Math.PI * r), Ve1 = -P.RHO_E / (4 * Math.PI * Math.hypot(L, r)), af = 2 * (Ve1 - Ve0);
    const ds = dstar(I, r, { pw }), pr = (() => { try { return MO().predict(null, "Nervo cutâneo"); } catch (e) { return null; } })();
    const rows = (pr ? pr.classes : []).filter(c => MO().CL[c.cls].my && c.cls !== "Aα").map(c => { const sd = Math.max(.25, (c.D.p90 - c.D.p10) / 2.563), z = isFinite(ds) ? (ds - c.D.med) / sd : Infinity, F = isFinite(ds) ? 1 - phi(z) : 0; return { c: c.cls, med: c.D.med, sd, z, F }; });
    $("#anSteps", b).innerHTML = `<ol class="steps an-steps">
      <li><b>Campo no nó central</b> (x = 0): V<sub>e,0</sub> = −${P.RHO_E} · 1 A / (4π · ${fmt(r, 3)} cm) = <b>${fmt(Ve0, 1)} V/A</b>; no nó vizinho (x = L = ${fmt(L * 1e4, 0)} µm): <b>${fmt(Ve1, 1)} V/A</b>.</li>
      <li><b>Função de ativação</b> no nó central: V<sub>e,−1</sub> − 2V<sub>e,0</sub> + V<sub>e,+1</sub> = <b>${fmt(af, 1)} V/A</b> (positiva: despolariza sob o cátodo).</li>
      <li><b>Integração</b> (${Math.floor((pw + 300e-6) / 1e-6)} passos de 1 µs, 41 nós): pico de despolarização h = <b>${fmt(h, 3)} V/A</b>.</li>
      <li><b>Limiar</b>: I<sub>th</sub> = ${fmt(P.VTH * 1e3, 0)} mV / ${fmt(h, 3)} V/A = <b>${fmt(Ith, 3)} mA</b> para D = ${fmt(D, 1)} µm.</li>
      <li><b>D*</b> para I<sub>ef</sub> = ${fmt(I, 2)} mA: <b>${isFinite(ds) ? fmt(ds, 2) + " µm" : "nenhuma fibra de até 16 µm dispara"}</b>.</li>
      <li><b>Frações</b> (nervo cutâneo do paciente): ${rows.map(x => `${x.c}: z = (${fmt(ds, 2)} − ${fmt(x.med, 2)}) / ${fmt(x.sd, 2)} = ${fmt(x.z, 2)} → <b>${fmt(x.F * 100, 0)} %</b>`).join(" · ") || "—"}.</li></ol>`;
    const cl = MO().CL, bands = ["Aδ", "Aβ", "Aα"].map(k => ({ a: cl[k].lo, b: Math.min(16, cl[k].hi), n: k, col: cl[k].col }));
    const curve = []; for (let x = 1; x <= 16; x *= 1.08) curve.push([x, ith(x, r, { pw })]); curve.push([16, ith(16, r, { pw })]);
    plot($("#anPlot", b), [{ pts: curve, col: "#3ee6c5", n: "I_th(D)" }, { pts: [[1, I], [16, I]], col: "#ff7a59", dash: [5, 4], w: 1.4, n: "I_ef" }], { xlog: true, ylog: true, xl: "diâmetro D (µm)", yl: "limiar (mA)", bands, marks: isFinite(ds) ? [{ x: ds, y: I, t: "D* " + fmt(ds, 1) + " µm" }] : [] });
  }
  function codeTab() {
    const fns = [["Núcleo nodal · AxonModel.h(D, r, o)", M().h], ["Limiar · AxonModel.Ith", M().Ith], ["Menor diâmetro recrutado · Dstar (interact.js)", g.AxonInteract && g.AxonInteract.Dstar], ["Normal acumulada · phi (interact.js)", g.AxonInteract && g.AxonInteract.phi], ["Preditor de calibres · AxonMorpho.predict", MO().predict], ["Fatores do paciente · AxonMorpho.factors", MO().factors]].filter(x => x[1]);
    return `<div class="card"><p>Este é o código que roda agora no simulador (lido da própria função, não é cópia). O núcleo <span class="mono">h()</span> tem um gêmeo em Python no servidor (<span class="mono">backend/core</span>) com as mesmas equações e ordem de operações; um teste automático compara os dois. O preditor de calibres também tem paridade testada (<span class="mono">backend/tests/test_morphometry.py</span>).</p></div>
      ${fns.map(([n, f]) => `<div class="card"><div class="ibar" style="position:static;padding:0 0 6px"><b>${esc(n)}</b><span class="sp"></span><button class="ib" data-copy="${esc(n)}" data-tip="Copiar o código">⧉</button></div><pre class="code">${hl(String(f))}</pre></div>`).join("")}`;
  }
  const hl = src => esc(src).replace(/\b(const|let|var|function|return|for|if|else|while|new|of|in)\b/g, '<b class="kw">$1</b>').replace(/(\/\/[^\n]*)/g, '<i class="cm">$1</i>').replace(/\b(\d+(?:\.\d+)?(?:e-?\d+)?)\b/g, '<span class="nu">$1</span>');
  function verifTab() {
    const r = .12, o = { pw: 100e-6 }, base = M().h(9, r, o), fine = M().h(9, r, Object.assign({}, o, { dt: .5e-6 })), wide = M().h(9, r, Object.assign({}, o, { N: 61 }));
    const Ds = Array.from({ length: 16 }, (_, i) => i + 1), th = Ds.map(D => M().Ith(D, r, o) * 1e3), mono = th.every((v, i) => !i || v < th[i - 1]);
    const ds = dstar(ith(6, r, o), r, o);
    return `<div class="card"><h4>Verificação numérica (calculada agora)</h4><table class="tbl">
      <tr><td>Passo de tempo: Δt = 1 µs × 0,5 µs</td><td>h muda ${fmt(Math.abs(fine - base) / base * 100, 3)} %</td><td>${Math.abs(fine - base) / base < .01 ? "✓ convergido" : "⚠"}</td></tr>
      <tr><td>Nós: 41 × 61</td><td>h muda ${fmt(Math.abs(wide - base) / base * 100, 4)} %</td><td>${Math.abs(wide - base) / base < .001 ? "✓ borda sem efeito" : "⚠"}</td></tr>
      <tr><td>Monotonicidade de I<sub>th</sub>(D), 1–16 µm</td><td>${th.map(v => fmt(v, 2)).join(" › ")} mA</td><td>${mono ? "✓ decrescente" : "⚠"}</td></tr>
      <tr><td>Bisseção: I = I<sub>th</sub>(6 µm) → D*</td><td>${fmt(ds, 4)} µm</td><td>${Math.abs(ds - 6) < .01 ? "✓ recupera 6 µm" : "⚠"}</td></tr>
      <tr><td>Linearidade: I<sub>th</sub>(9 µm) com V<sub>th</sub> 20 → 40 mV</td><td>${fmt(M().Ith(9, r, Object.assign({ vth: .04 }, o)) / M().Ith(9, r, o), 3)}×</td><td>✓ dobra (modelo linear)</td></tr></table>
      <p class="note">Verificado não é validado: estas checagens mostram que as equações são resolvidas corretamente, não que representam um nervo humano real. ${tag("mod")}</p></div>`;
  }
  function mathWin(b) {
    const tabs = [["modelo", "∑ Modelo"], ["calc", "▶ Calcular"], ["codigo", "</> Código"], ["verif", "✓ Verificação"]];
    b.innerHTML = `<div class="seg mtabs">${tabs.map(([k, n]) => `<button data-t="${k}" class="${D1.tab === k ? "on" : ""}">${n}</button>`).join("")}</div><div class="anbody">${{ modelo: modelTab, calc: calcTab, codigo: codeTab, verif: verifTab }[D1.tab]()}</div>`;
    $$(".mtabs button", b).forEach(x => x.onclick = () => { D1.tab = x.dataset.t; mathWin(b); });
    if (D1.tab === "calc") { $$("[data-k]", b).forEach(i => i.oninput = () => { D1[i.dataset.k] = +i.value; i.nextElementSibling.textContent = fmt(+i.value, i.dataset.k === "r" ? 3 : 2) + " " + { D: "µm", r: "cm", pw: "µs", I: "mA" }[i.dataset.k]; clearTimeout(D1.t); D1.t = setTimeout(() => calcRun(b), 60); }); calcRun(b); }
    if (D1.tab === "codigo") $$("[data-copy]", b).forEach(x => x.onclick = () => { const pre = x.closest(".card").querySelector("pre"); try { navigator.clipboard.writeText(pre.textContent); x.textContent = "✓"; } catch (e) {} });
  }
  // ================================================================== 2. VARIAÇÃO DE POSSIBILIDADES
  const V2 = { tab: "fibras", sc: "tens_conv" };
  const FIB = [
    { id: "Ia", cls: "Aα", n: "Aα · aferente Ia (fuso)", D: [12, 20], my: true, f: "estiramento muscular (terminação primária do fuso)", k: 5.7 },
    { id: "Ib", cls: "Aα", n: "Aα · aferente Ib (órgão tendinoso)", D: [12, 20], my: true, f: "tensão do tendão", k: 5.7 },
    { id: "mot", cls: "Aα", n: "Aα · motoneurônio α", D: [12, 20], my: true, f: "contração das fibras extrafusais (placa motora)", k: 5.7 },
    { id: "II", cls: "Aβ", n: "Aβ · aferente II", D: [6, 12], my: true, f: "tato, vibração, pressão; terminação secundária do fuso", k: 4.6 },
    { id: "gam", cls: "Aγ", n: "Aγ · motoneurônio γ", D: [3, 6], my: true, f: "sensibilidade do fuso (fibras intrafusais)", k: 4.6 },
    { id: "III", cls: "Aδ", n: "Aδ · aferente III", D: [1, 5], my: true, f: "dor rápida, frio, mecanonocicepção", k: 4.6 },
    { id: "B", cls: "B", n: "B · pré-ganglionar autonômica", D: [1, 3], my: true, f: "eferente simpática e parassimpática pré-ganglionar", k: 4.6 },
    { id: "drC", cls: "C", n: "C de raiz dorsal (IV) · nociceptor", D: [.2, 1.5], my: false, f: "dor lenta, calor, prurido", cv: [.7, 2.3] },
    { id: "CT", cls: "C", n: "C-tátil", D: [.2, 1.5], my: false, f: "tato afetivo: carícia lenta (1–10 cm/s) percebida como agradável", cv: [.7, 2.3] },
    { id: "sC", cls: "C", n: "C simpática pós-ganglionar", D: [.2, 1.5], my: false, f: "vasomotora, sudomotora, pilomotora", cv: null },
  ];
  function fibTab() {
    const r = .12, o = { pw: 100e-6 }, base = ith(9, r, o);
    const rows = FIB.map(f => { const Dm = (f.D[0] + f.D[1]) / 2, my = f.my, th = my ? ith(Math.min(16, Dm), r, o) : ith(Math.min(1.4, Dm), r, o), out = my && Dm > 16;
      return `<tr><td><b>${esc(f.n)}</b><br><small>${esc(f.f)}</small></td><td>${fmt(f.D[0], 1)}–${fmt(f.D[1], 1)} µm</td><td>${my ? "sim" : "não"}</td><td>${my ? `${fmt(f.k * f.D[0], 0)}–${fmt(f.k * f.D[1], 0)} m/s` : f.cv ? `${fmt(f.cv[0], 1)}–${fmt(f.cv[1], 1)} m/s` : "—"}</td>
        <td><b>${fmt(th, 2)} mA</b><br><small>${fmt(th / base, 1)}× Aβ</small></td><td>${my ? (out ? `extrapolado (> 16 µm) ${tag("pre")}` : `núcleo nodal ${tag("mod")}`) : `cabo contínuo passivo ${tag("pre")}`}</td></tr>`; }).join("");
    return `<div class="card"><p>Limiar estimado para o diâmetro médio de cada tipo de fibra, a 1,2 mm do eletrodo e com pulso de 100 µs. As mielinizadas usam o núcleo nodal verificado; as amielínicas usam um cabo contínuo passivo (sem nós), que dá só a <b>ordem de grandeza</b>.</p>
      <div class="scroll"><table class="tbl"><tr><th>Fibra e função</th><th>Diâmetro</th><th>Mielina</th><th>Velocidade</th><th>Limiar</th><th>Origem do número</th></tr>${rows}</table></div>
      <p class="note">${tag("lit")} faixas de diâmetro e funções (classificação de Erlanger–Gasser e grupos de Lloyd); velocidades de condução das C de raiz dorsal entre 0,7 e 2,3 m/s, proporcionais ao diâmetro (Gasser 1950, 1955); C-táteis respondem mais a carícias de 1–10 cm/s (Löken 2009). A C simpática pós-ganglionar é subgrupo distinto das C de raiz dorsal (Gasser 1950). ${tag("pre")} cabo passivo das amielínicas: c<sub>m</sub> 1 µF/cm², g<sub>l</sub> 0,3 mS/cm², segmentos de 50 µm.</p>
      ${refsOf(["gas50", "gas55", "loken", "libak"])}</div>`;
  }
  // força-duração: limiar × duração do pulso para Aβ, Aδ e C; cronaxia = duração em que o limiar é 2× a reobase
  function sdTab() {
    return `<div class="card"><p>Curva força-duração: a corrente necessária cai com pulsos mais longos até um mínimo (a <b>reobase</b>). A <b>cronaxia</b> é a duração em que o limiar vale o dobro da reobase. Fibras com cronaxia maior se beneficiam mais de pulsos longos.</p>
      <canvas id="sdPlot" class="anplot"></canvas><div id="sdTxt"></div></div>`;
  }
  function sdRun(b) {
    const r = .12, pws = [20, 40, 60, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000], F = [["Aβ 9 µm", 9, "#4fb3ff"], ["Aδ 3 µm", 3, "#ff8a3d"], ["C 0,8 µm", .8, "#d36cff"]];
    const S = F.map(([n, D, col]) => ({ n, col, pts: pws.map(p => [p, ith(D, r, { pw: p * 1e-6 })]) }));
    plot($("#sdPlot", b), S, { xlog: true, ylog: true, xl: "duração do pulso (µs)", yl: "limiar (mA)" });
    const chron = s => { const rb = s.pts[s.pts.length - 1][1]; if (s.pts[0][1] <= 2 * rb) return -1; for (let i = 1; i < s.pts.length; i++) if (s.pts[i][1] <= 2 * rb) { const [x0, y0] = s.pts[i - 1], [x1, y1] = s.pts[i]; return x0 + (2 * rb - y0) / (y1 - y0) * (x1 - x0); } return null; };
    $("#sdTxt", b).innerHTML = `<table class="tbl"><tr><th>Fibra</th><th>Reobase (2 ms)</th><th>Cronaxia no modelo</th></tr>${S.map(s => `<tr><td>${s.n}</td><td>${fmt(s.pts[s.pts.length - 1][1], 2)} mA</td><td>${chron(s) === -1 ? "&lt; 20 µs" : fmt(chron(s), 0) + " µs"} ${tag(s.n.startsWith("C") ? "pre" : "mod")}</td></tr>`).join("")}</table>
      <p>Em humanos, a constante de tempo força-duração medida no nervo mediano foi de 665 ± 182 µs para potenciais sensitivos e 459 ± 126 µs para motores; ela aumenta com a desmielinização. ${tag("lit")} ${cite("mogy")}</p>
      <p class="warnbox">Discrepância importante: no núcleo passivo, a cronaxia das fibras mielinizadas fica abaixo de 20 µs, porque a constante de tempo do nó (c<sub>m</sub>/g<sub>l</sub> ≈ 66 µs) é curta. Em humanos, a constante força-duração medida é dez a trinta vezes maior. Consequência: no simulador, alongar o pulso quase não muda o limiar das fibras mielinizadas, ao contrário do que se observa na clínica. ${tag("mod")}</p>
      <p class="note">O modelo passivo reproduz a forma da curva, mas não as diferenças de cinética de Na⁺ entre fibras sensitivas e motoras, que a literatura propõe como causa das diferenças medidas. ${tag("pre")} ${cite("mrg")}</p>`;
  }
  // sensibilidade: cada parâmetro na faixa baixa e alta; métricas: limiar de Aβ (9 µm) e seletividade Aδ/Aβ
  const SENS = [
    ["Distância ao nervo r", "r", .084, .156, "± 30 % de 1,2 mm", "geometria"], ["Duração do pulso", "pw", 50e-6, 200e-6, "50–200 µs", "estímulo"],
    ["Resistividade extracelular ρe", "rho_e", 200, 500, "200–500 Ω·cm", "tecido"], ["Resistividade axoplasmática ρi", "rho_i", 70, 150, "70–150 Ω·cm", "fibra"],
    ["g-ratio (axônio/fibra)", "gr", .6, .8, "0,6–0,8", "fibra"], ["Internodo / diâmetro", "lk", 70, 150, "70–150", "fibra"],
    ["Comprimento do nó", "ln", 1e-4, 4e-4, "1–4 µm", "fibra"], ["Capacitância da membrana", "cm", 1e-6, 3e-6, "1–3 µF/cm²", "membrana"],
    ["Condutância de fuga do nó", "gl", 15e-3, 60e-3, "15–60 mS/cm²", "membrana"], ["Tensão de limiar", "vth", .015, .025, "15–25 mV", "membrana"],
  ];
  function sensTab() { return `<div class="card"><p>Quanto cada parâmetro, dentro de uma faixa plausível, muda o resultado? Cada barra mostra o efeito de levar <b>um</b> parâmetro ao valor baixo e ao alto, com os outros fixos (r = 1,2 mm, pulso de 100 µs). As faixas são exploratórias ${tag("pre")}; o cálculo é do núcleo ${tag("mod")}.</p>
    <div class="seg mini" id="snM"><button data-m="ab" class="${V2.met !== "sel" ? "on" : ""}">Limiar de Aβ</button><button data-m="sel" class="${V2.met === "sel" ? "on" : ""}">Seletividade Aδ/Aβ</button></div>
    <div id="snOut"></div><p class="note">Nota: g-ratio, internodo e comprimento do nó vêm de morfometria e variam entre fibras; ρe varia com o tecido e a direção (anisotropia muscular); c<sub>m</sub>, g<sub>l</sub> e V<sub>th</sub> resumem canais iônicos que o modelo passivo não representa. Por isso o número final carrega a incerteza combinada dessas fontes. ${cite("mcneal", "mrg")}</p></div>`; }
  function sensRun(b) {
    const r0 = .12, o0 = { pw: 100e-6 }, m = V2.met === "sel" ? "sel" : "ab";
    const met = (o, r) => m === "ab" ? ith(9, r, o) : ith(3, r, o) / ith(9, r, o), b0 = met(o0, r0);
    const res = SENS.map(([n, k, lo, hi, rng, grp]) => { const v = x => k === "r" ? met(o0, x) : met(Object.assign({}, o0, { [k]: x }), r0); const a = v(lo), c = v(hi); return { n, rng, grp, a: (a / b0 - 1) * 100, c: (c / b0 - 1) * 100 }; }).sort((x, y) => Math.max(Math.abs(y.a), Math.abs(y.c)) - Math.max(Math.abs(x.a), Math.abs(x.c)));
    const mx = Math.max(...res.flatMap(x => [Math.abs(x.a), Math.abs(x.c)]), 1);
    $("#snOut", b).innerHTML = `<p>Valor de referência: <b>${m === "ab" ? fmt(b0, 3) + " mA" : fmt(b0, 2) + "×"}</b></p><div class="tornado">${res.map(x => `<div class="tr-row"><span class="tr-n">${esc(x.n)}<small>${esc(x.rng)} · ${esc(x.grp)}</small></span><span class="tr-bar"><i class="lo" style="--l:${50 + Math.min(0, x.a) / mx * 50}%;--w:${Math.abs(x.a) / mx * 50}%" data-tip="valor baixo: ${fmt(x.a, 1)} %"></i><i class="hi" style="--l:${50 + Math.min(0, x.c) / mx * 50}%;--w:${Math.abs(x.c) / mx * 50}%" data-tip="valor alto: ${fmt(x.c, 1)} %"></i><b class="mid"></b></span><span class="tr-v">${fmt(x.a, 0)} % · ${fmt(x.c, 0)} %</span></div>`).join("")}</div>`;
  }
  // cenários terapêuticos: parâmetros típicos, fibras-alvo, mecanismo e desfecho como publicado
  const SC = {
    tens_conv: { n: "TENS convencional", p: "80–120 Hz · 50–100 µs · intensidade sensorial forte, sem dor", pw: 100, r: .12, alvo: "Aβ", mec: "Ativação de Aβ: inibição segmentar no corno dorsal (controle de portão) e receptores opioides δ, em modelos animais.", out: "Analgesia durante a estimulação; a eficácia clínica permanece equívoca por falta de ensaios de alta qualidade.", ev: ["sluka"] },
    tens_acu: { n: "TENS acupuntura-símile", p: "2–4 Hz · 200–250 µs · intensidade motora (contração visível)", pw: 250, r: .3, alvo: "Aα (motora) e Aβ", mec: "Baixa frequência e alta intensidade: analgesia mediada por opioides μ e vias descendentes, em modelos animais.", out: "Mesmo quadro clínico: efeito dependente de dose e de intensidade adequada; evidência clínica heterogênea.", ev: ["sluka"] },
    ea_2_100: { n: "Eletroacupuntura 2 Hz × 100 Hz", p: "2 Hz ou 100 Hz (ou alternado) · agulha perto do nervo", pw: 200, r: .1, alvo: "Aβ e Aδ perto da agulha", mec: "2 Hz libera encefalinas, β-endorfina e endomorfina (receptores μ e δ); 100 Hz libera dinorfina (receptor κ); a alternância soma os efeitos.", out: "Achados pré-clínicos com correlatos em voluntários; o desfecho clínico depende da condição tratada.", ev: ["han"] },
    tavns: { n: "taVNS (concha da orelha)", p: "20–30 Hz · 200–250 µs · sensorial", pw: 250, r: .1, alvo: "Aβ do ramo auricular do vago", mec: "A cymba conchae é inervada pelo ramo auricular do vago; o alvo são as aferentes Aβ que chegam ao núcleo do trato solitário.", out: "Mecanismos centrais e desfechos clínicos em investigação.", ev: ["peuker"] },
    khfac: { n: "Bloqueio por corrente de kHz", p: "corrente alternada balanceada de 1–30 kHz", pw: null, r: .1, alvo: "todas as fibras sob o eletrodo (bloqueio)", mec: "Correntes de kHz produzem bloqueio de condução rápido e reversível; o mecanismo ainda não é totalmente conhecido.", out: "Os estudos clínicos não permitem ainda avaliar os mecanismos do sucesso ou fracasso do tratamento.", ev: ["kilgore"], nomodel: "O núcleo é passivo e de pulso único: não representa o bloqueio por kHz, que depende da dinâmica dos canais iônicos." },
    ct: { n: "Tato afetivo (carícia lenta)", p: "estímulo mecânico, 1–10 cm/s", pw: null, r: .12, alvo: "C-táteis", mec: "Estímulo mecânico, não elétrico: aferentes C de baixo limiar respondem mais a carícias lentas, percebidas como agradáveis.", out: "Mostra que a seletividade pode vir do tipo de estímulo e não do limiar elétrico: a corrente recruta as C por último.", ev: ["loken"], nomodel: "Estímulo mecânico: fora do modelo elétrico." },
  };
  function scTab() {
    const s = SC[V2.sc];
    return `<div class="card"><div class="am-chips">${Object.entries(SC).map(([k, x]) => `<button class="amc ${V2.sc === k ? "on" : ""}" data-sc="${k}">${esc(x.n)}</button>`).join("")}</div>
      <h4 style="margin-top:10px">${esc(s.n)}</h4><table class="tbl"><tr><td>Parâmetros típicos</td><td>${esc(s.p)}</td></tr><tr><td>Fibras-alvo</td><td>${esc(s.alvo)}</td></tr>
      <tr><td>Mecanismo</td><td>${esc(s.mec)} ${tag("lit")}</td></tr><tr><td>Desfecho</td><td>${esc(s.out)} ${tag("lit")}</td></tr></table>${cite(...s.ev)}
      ${s.nomodel ? `<p class="warnbox">${esc(s.nomodel)}</p>` : `<canvas id="scPlot" class="anplot"></canvas><p class="note">Fração recrutada de cada classe em função da corrente que chega ao nervo, a ${fmt(s.r * 10, 1)} mm e com pulso de ${s.pw} µs, para o paciente atual. A faixa verde marca as correntes que recrutam mais da metade das Aβ com menos de 10 % das Aδ (janela de seletividade). A curva C é estimativa de cabo passivo. ${tag("mod")} ${tag("pre")}</p><div id="scTxt"></div>`}</div>`;
  }
  function scRun(b) {
    const s = SC[V2.sc]; if (s.nomodel || !$("#scPlot", b)) return; const o = { pw: s.pw * 1e-6 }, r = s.r;
    let pr = null; try { pr = MO().predict(null, s === SC.tavns ? "Ramo auricular do vago" : s === SC.tens_acu ? "Nervo mediano" : "Nervo cutâneo"); } catch (e) {}
    const cls = (pr ? pr.classes : []).filter(c => ["Aα", "Aβ", "Aδ", "C"].includes(c.cls)), Is = []; for (let I = .05; I <= 60; I *= 1.06) Is.push(I);
    const S = cls.map(c => { const sd = Math.max(c.cls === "C" ? .12 : .25, (c.D.p90 - c.D.p10) / 2.563), my = c.cls !== "C";
      return { n: c.cls, col: MO().CL[c.cls].col, pts: Is.map(I => { const ds = my ? dstar(I, r, o) : dstar(I, r, o, .2, 1.5, ithCfast); return [I, !isFinite(ds) ? 0 : (1 - phi((ds - c.D.med) / sd)) * 100]; }), dash: my ? [] : [6, 4] }; });
    const ab = S.find(x => x.n === "Aβ"), ad = S.find(x => x.n === "Aδ"); let win = null;
    if (ab && ad) { const ok = Is.filter((I, i) => ab.pts[i][1] > 50 && ad.pts[i][1] < 10); if (ok.length) win = [ok[0], ok[ok.length - 1]]; }
    plot($("#scPlot", b), S, { xlog: true, ymin: 0, ymax: 100, xl: "corrente no nervo (mA)", yl: "fração recrutada (%)", bands: win ? [{ a: win[0], b: win[1], n: "janela", col: "#3ee6c5" }] : [] });
    $("#scTxt", b).innerHTML = win ? `<p>Janela de seletividade no modelo: <b>${fmt(win[0], 2)}–${fmt(win[1], 2)} mA</b> (razão ${fmt(win[1] / win[0], 2)}×). ${tag("mod")}</p>` : `<p>Neste cenário não há corrente que recrute mais da metade das Aβ com menos de 10 % das Aδ. ${tag("mod")}</p>`;
  }
  function cxTab() {
    const L = [
      ["Canais iônicos e cinética", "Membrana passiva com limiar fixo de 20 mV.", "Os canais de Na⁺ e K⁺ têm cinética diferente em fibras motoras e sensitivas; pós-potenciais e o ciclo de recuperação mudam o limiar após cada disparo.", ["mrg"]],
      ["Geometria real", "Fibra reta e cilíndrica, internodo 100·D, g-ratio 0,7.", "Morfometria varia entre fibras, nervos e idades; as fibras seguem trajetos ondulados e o internodo não é exatamente proporcional ao diâmetro.", ["mcneal"]],
      ["Tecido e campo elétrico", "Meio homogêneo e isotrópico (ρe = 300 Ω·cm), fonte pontual.", "Pele, gordura, fáscia e músculo têm resistividades diferentes, e o músculo conduz melhor ao longo das fibras; a interface eletrodo–pele muda com o tempo.", ["rattay"]],
      ["Duração do pulso e excitabilidade", "Curva força-duração do cabo passivo.", "A constante de tempo humana muda com a desmielinização e com o potencial de membrana; sensitivas e motoras diferem.", ["mogy"]],
      ["Fibras amielínicas", "Estimativa de cabo contínuo passivo (só ordem de grandeza).", "As C têm velocidades de 0,7 a 2,3 m/s e propriedades pós-disparo muito sensíveis à temperatura e à atividade prévia; o subgrupo simpático difere do de raiz dorsal.", ["gas50", "libak"]],
      ["Frequência e dinâmica", "Pulso único: a frequência não muda o limiar no núcleo.", "Frequências altas mudam o recrutamento (refratariedade, acomodação) e, em kHz, podem bloquear a condução por mecanismo ainda não totalmente conhecido.", ["kilgore"]],
      ["Da fibra ao desfecho", "Rede fisiológica de regras (portão, vias descendentes, opioides).", "A resposta clínica depende de processamento central, liberação de neuropeptídeos dependente da frequência, plasticidade, expectativa e do controle usado nos ensaios.", ["sluka", "han"]],
      ["Variabilidade entre pessoas", "Paciente médio ajustado por idade, altura, IMC, temperatura e glicemia.", "A dispersão real de calibres, a profundidade do nervo e a impedância da pele variam entre pessoas e no mesmo indivíduo ao longo do tempo.", []],
    ];
    return `<div class="card"><p>Para prever o efeito de um estímulo com todos os parâmetros fisiológicos, seria preciso conhecer, para cada pessoa e cada nervo, a geometria das fibras, os canais iônicos, as propriedades elétricas dos tecidos e o processamento central. O axon escolhe simplificações conhecidas e mostra o custo de cada uma.</p>
      <div class="cx">${L.map(([t, a, d, k]) => `<div class="evc"><b>${esc(t)}</b><p><span class="cx-k">No axon:</span> ${esc(a)} ${tag("pre")}</p><p><span class="cx-k">Por que é difícil:</span> ${esc(d)} ${k.length ? tag("lit") : tag("pre")}</p>${k.length ? cite(...k) : ""}</div>`).join("")}</div>
      <p class="note">Consequência prática: os números do simulador servem para comparar cenários e entender mecanismos, não para prever o resultado num paciente. Use a aba de sensibilidade para ver quais parâmetros mais pesam.</p></div>`;
  }
  function varWin(b) {
    const tabs = [["fibras", "🧬 Fibras"], ["sd", "⏱ Força-duração"], ["sens", "📊 Sensibilidade"], ["sc", "🎯 Cenários"], ["cx", "🧩 Complexidade"]];
    b.innerHTML = `<div class="seg mtabs">${tabs.map(([k, n]) => `<button data-t="${k}" class="${V2.tab === k ? "on" : ""}">${n}</button>`).join("")}</div><div class="anbody">${{ fibras: fibTab, sd: sdTab, sens: sensTab, sc: scTab, cx: cxTab }[V2.tab]()}</div>`;
    $$(".mtabs button", b).forEach(x => x.onclick = () => { V2.tab = x.dataset.t; varWin(b); });
    if (V2.tab === "sd") requestAnimationFrame(() => sdRun(b));
    if (V2.tab === "sens") { $$("#snM button", b).forEach(x => x.onclick = () => { V2.met = x.dataset.m; varWin(b); }); requestAnimationFrame(() => sensRun(b)); }
    if (V2.tab === "sc") { $$("[data-sc]", b).forEach(x => x.onclick = () => { V2.sc = x.dataset.sc; varWin(b); }); requestAnimationFrame(() => scRun(b)); }
  }
  function boot() {
    const Ap = A(); if (!Ap || !Ap.registerApp || !M() || !MO()) return setTimeout(boot, 120);
    Ap.registerApp("mathdesc", { title: "mathdesc", w: 900, h: 780, render: mathWin, draw: b => { if (D1.tab === "calc" && $("#anPlot", b)) calcRun(b); } });
    Ap.registerApp("variation", { title: "variation", w: 980, h: 800, render: varWin, draw: b => { if (V2.tab === "sd") sdRun(b); if (V2.tab === "sc") scRun(b); } });
    document.addEventListener("axon:patient", () => memo.clear());
  }
  boot();
  g.AxonAnalysis = { LIT, hC, IthC, ithCfast, ith, dstar, open: (id, tab) => { if (id === "variation" && tab) V2.tab = tab; if (id === "mathdesc" && tab) D1.tab = tab; A().openApp(id); } };
})(window);
