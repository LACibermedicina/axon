/* axon · charts.js — gráficos quantitativos reproduzíveis em Canvas 2D (sem dependências). */
(function (g) {
  "use strict";
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#9fb";
  function fit(cv) { const r = cv.getBoundingClientRect(), d = g.devicePixelRatio || 1; cv.width = Math.max(10, r.width * d); cv.height = Math.max(10, r.height * d); const x = cv.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0); return { x, W: r.width, H: r.height }; }
  const fmt = v => v === 0 ? "0" : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : Math.abs(v) >= .01 ? v.toFixed(2) : v.toExponential(0);
  const gfmt = v => (Math.abs(v) < .005 ? "0,00" : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)).replace(".", ",");

  function plot(cv, o) {
    const { x, W, H } = fit(cv), m = { l: 46, r: 12, t: o.title ? 22 : 10, b: 34 };
    const all = o.series.flatMap(s => s.x.map((xx, i) => [xx, s.y[i]])).filter(([a, b]) => isFinite(a) && isFinite(b) && (!o.xlog || a > 0) && (!o.ylog || b > 0));
    if (!all.length) return;
    const tx = o.xlog ? Math.log10 : v => v, ty = o.ylog ? Math.log10 : v => v;
    let [x0, x1] = o.xr || [Math.min(...all.map(p => p[0])), Math.max(...all.map(p => p[0]))], [y0, y1] = o.yr || [Math.min(...all.map(p => p[1])), Math.max(...all.map(p => p[1]))];
    x0 = tx(x0); x1 = tx(x1); y0 = ty(y0); y1 = ty(y1); if (y1 === y0) y1 += 1;
    const X = v => m.l + (tx(v) - x0) / (x1 - x0) * (W - m.l - m.r), Y = v => H - m.b - (ty(v) - y0) / (y1 - y0) * (H - m.t - m.b);
    x.font = "11px var(--mono, monospace)"; x.fillStyle = css("--muted"); x.strokeStyle = css("--grid"); x.lineWidth = 1;
    const ticks = (a, b, log) => { if (log) { const r = []; for (let e = Math.floor(a); e <= Math.ceil(b); e++) r.push(Math.pow(10, e)); return r.filter(v => Math.log10(v) >= a - 1e-9 && Math.log10(v) <= b + 1e-9); } const s = niceStep((b - a) / 4); const r = []; for (let v = Math.ceil(a / s) * s; v <= b + 1e-9; v += s) r.push(+v.toFixed(10)); return r; };
    ticks(x0, x1, o.xlog).forEach(v => { const px = X(v); x.beginPath(); x.moveTo(px, m.t); x.lineTo(px, H - m.b); x.stroke(); x.fillText(fmt(v), px - 10, H - m.b + 14); });
    ticks(y0, y1, o.ylog).forEach(v => { const py = Y(v); x.beginPath(); x.moveTo(m.l, py); x.lineTo(W - m.r, py); x.stroke(); x.fillText(fmt(v), 4, py + 4); });
    if (o.xlabel) x.fillText(o.xlabel, W / 2 - o.xlabel.length * 3, H - 4);
    if (o.title) { x.fillStyle = css("--ink"); x.font = "600 12px var(--sans, sans-serif)"; x.fillText(o.title, m.l, 14); }
    (o.vbands || []).forEach(b => { x.fillStyle = b.color; x.fillRect(X(b.from), m.t, X(b.to) - X(b.from), H - m.t - m.b); });
    o.series.forEach(s => {
      x.strokeStyle = s.color; x.lineWidth = s.w || 2; x.setLineDash(s.dash || []); x.beginPath(); let st = false;
      s.x.forEach((xx, i) => { const yy = s.y[i]; if (!isFinite(yy) || (o.ylog && yy <= 0) || (o.xlog && xx <= 0)) return; st ? x.lineTo(X(xx), Y(yy)) : (x.moveTo(X(xx), Y(yy)), st = true); });
      x.stroke(); x.setLineDash([]);
      if (s.dots) { x.fillStyle = s.color; s.x.forEach((xx, i) => { x.beginPath(); x.arc(X(xx), Y(s.y[i]), 2.5, 0, 7); x.fill(); }); }
    });
    (o.vlines || []).forEach(v => { x.strokeStyle = v.color; x.setLineDash([4, 3]); x.beginPath(); x.moveTo(X(v.x), m.t); x.lineTo(X(v.x), H - m.b); x.stroke(); x.setLineDash([]); if (v.label) { x.fillStyle = v.color; x.fillText(v.label, X(v.x) + 4, m.t + 12); } });
    let ly = m.t + 4; o.series.filter(s => s.label).forEach(s => { x.fillStyle = s.color; x.fillRect(W - m.r - 110, ly, 10, 3); x.fillStyle = css("--ink"); x.fillText(s.label, W - m.r - 96, ly + 5); ly += 14; });
  }
  function niceStep(r) { const p = Math.pow(10, Math.floor(Math.log10(r || 1))), f = r / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }

  function gauge(cv, v, max, label, unit, level, min = 0) {
    const { x, W, H } = fit(cv), cx = W / 2, cy = H * .62, R = Math.min(W, H) * .38, a0 = Math.PI * .8, a1 = Math.PI * 2.2;
    x.lineCap = "round"; x.lineWidth = 9; x.strokeStyle = css("--grid"); x.beginPath(); x.arc(cx, cy, R, a0, a1); x.stroke();
    const col = { ok: css("--ok"), warn: css("--warn"), risk: css("--risk") }[level] || css("--accent");
    x.strokeStyle = col; x.beginPath(); x.arc(cx, cy, R, a0, a0 + (a1 - a0) * Math.max(0, Math.min(1, (v - min) / (max - min)))); x.stroke();
    x.fillStyle = css("--ink"); x.font = "600 15px var(--mono, monospace)"; x.textAlign = "center"; x.fillText(gfmt(v) + (unit ? " " + unit : ""), cx, cy + 5);
    x.font = "11px var(--sans, sans-serif)"; x.fillStyle = css("--muted"); x.fillText(label, cx, H - 6); x.textAlign = "start";
  }

  function heatmap(cv, Z, xs, ys, o = {}) {      // Z[i][j]: i↔xs, j↔ys (log)
    const { x, W, H } = fit(cv), m = { l: 46, r: 10, t: 10, b: 30 }, nx = xs.length, ny = ys.length;
    const flat = Z.flat().map(Math.log10), lo = Math.min(...flat), hi = Math.max(...flat);
    const cw = (W - m.l - m.r) / nx, ch = (H - m.t - m.b) / ny;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const v = (Math.log10(Z[i][j]) - lo) / (hi - lo); x.fillStyle = `hsl(${200 - v * 190},80%,${30 + v * 25}%)`; x.fillRect(m.l + i * cw, H - m.b - (j + 1) * ch, cw + .5, ch + .5); }
    if (o.level) { x.strokeStyle = "#fff"; x.lineWidth = 2; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (Z[i][j] <= o.level) { x.strokeRect(m.l + i * cw + 1, H - m.b - (j + 1) * ch + 1, cw - 2, ch - 2); } }
    x.fillStyle = css("--muted"); x.font = "11px var(--mono, monospace)";
    xs.forEach((v, i) => { if (i % 3 === 0) x.fillText(v, m.l + i * cw + 2, H - m.b + 13); }); ys.forEach((v, j) => x.fillText(v, 6, H - m.b - j * ch - ch / 2 + 4));
    x.fillText(o.xlabel || "", W / 2 - 30, H - 3);
  }
  g.AxonCharts = { plot, gauge, heatmap, fit };
})(window);
