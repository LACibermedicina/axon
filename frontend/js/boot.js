/* axon · boot.js — carregamento com porcentagem e detalhamento (v0.9.1)
 * Tela de carregamento que bloqueia a interação até tudo estar pronto: módulos, motor 3D, núcleo
 * biofísico, anatomia (pele, esqueleto, nervos, órgãos, vasos, músculos, com bytes recebidos),
 * níveis 2–5, servidor e, quando outro idioma está escolhido, a tradução da tela por IA.
 * Depois do início, a mesma tela reaparece (compacta) para cargas pedidas pelo usuário —
 * por exemplo, trocar de idioma — e libera a interação ao terminar.
 * API: AxonBoot.task(key, label, weight) → { progress(frac, info), done(info), fail(msg) }
 *      eventos "axon:load" { key, label, frac, info, done, error } também são aceitos. */
(function (g) {
  "use strict";
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const kb = b => b > 1e6 ? (b / 1e6).toFixed(1).replace(".", ",") + " MB" : Math.round(b / 1e3) + " kB";
  const T = {}; let order = [], el = null, boot = false, hideT = 0, startT = performance.now(), title = "", sub = "";
  function css() {
    if (document.getElementById("axboot-css")) return;
    const s = document.createElement("style"); s.id = "axboot-css";
    s.textContent = `.axboot{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 38%,rgba(22,49,58,.97),rgba(6,13,16,.985));color:#e7f4f6;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;transition:opacity .45s;cursor:progress}
.axboot.task{background:rgba(6,13,16,.62);backdrop-filter:blur(3px)}.axboot.out{opacity:0;pointer-events:none}
.axboot .bx{width:min(560px,92vw);padding:26px 28px;border-radius:22px;background:rgba(10,24,29,.9);border:1px solid rgba(62,230,197,.22);box-shadow:0 30px 80px rgba(0,0,0,.45)}
.axboot .hd{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.axboot h2{margin:0;font-size:18px;letter-spacing:.01em}.axboot h2 b{color:#3ee6c5}
.axboot .pc{font:700 30px ui-monospace,SFMono-Regular,Menlo,monospace;color:#3ee6c5;font-variant-numeric:tabular-nums}
.axboot .sb{opacity:.7;font-size:12.5px;margin:2px 0 14px}.axboot .bar{height:10px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
.axboot .bar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#3ee6c5,#4fb3ff,#d36cff);transition:width .25s}
.axboot ul{list-style:none;margin:16px 0 0;padding:0;max-height:46vh;overflow:auto}.axboot li{display:grid;grid-template-columns:20px 1fr auto;gap:8px;align-items:center;padding:4px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,.05)}
.axboot li .st{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.25)}.axboot li.run .st{border-color:#3ee6c5;border-right-color:transparent;animation:axspin .8s linear infinite}
.axboot li.ok .st{border-color:#3ee6c5;background:#3ee6c5}.axboot li.err .st{border-color:#ffb36b;background:#ffb36b}.axboot li.wait{opacity:.5}
.axboot li .in{font:12px ui-monospace,monospace;opacity:.75;text-align:right;white-space:nowrap}.axboot li .lb small{display:block;opacity:.6;font-size:11.5px}
.axboot li .mini{grid-column:2/4;height:3px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden}.axboot li .mini i{display:block;height:100%;background:#3ee6c5;width:0;transition:width .2s}
.axboot .ft{margin-top:14px;display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:12px;opacity:.85}.axboot .ft button{border:1px solid #3ee6c5;background:transparent;color:#3ee6c5;border-radius:99px;padding:5px 12px;cursor:pointer;font:600 12px system-ui}
@keyframes axspin{to{transform:rotate(360deg)}}`;
    document.head.appendChild(s);
  }
  function ensureEl() {
    if (el) return el; css(); el = document.createElement("div"); el.className = "axboot notr"; el.setAttribute("role", "progressbar"); el.setAttribute("aria-valuemin", "0"); el.setAttribute("aria-valuemax", "100"); el.setAttribute("aria-live", "polite");
    (document.body || document.documentElement).appendChild(el); return el;
  }
  const block = e => { if (e.target && e.target.closest && e.target.closest(".axboot [data-go]")) return; if (el && !el.classList.contains("out")) { e.stopPropagation(); e.preventDefault(); } };
  ["keydown", "wheel", "pointerdown", "click", "contextmenu"].forEach(t => g.addEventListener(t, block, { capture: true, passive: false }));
  function pct() { const ks = order.filter(k => T[k].active); let w = 0, d = 0; ks.forEach(k => { w += T[k].w; d += T[k].w * (T[k].state === "ok" || T[k].state === "err" ? 1 : T[k].frac); }); return w ? d / w * 100 : 100; }
  function render() {
    const e = ensureEl(), p = pct(), ks = order.filter(k => T[k].active);
    e.classList.toggle("task", !boot); e.classList.remove("out"); e.setAttribute("aria-valuenow", Math.floor(p));
    const errs = ks.filter(k => T[k].state === "err").length, el2 = ((performance.now() - startT) / 1000).toFixed(0);
    e.innerHTML = `<div class="bx"><div class="hd"><h2>${title}</h2><span class="pc">${Math.floor(p)}%</span></div><div class="sb">${esc(sub)}</div><div class="bar"><i style="width:${p.toFixed(1)}%"></i></div>
      <ul>${ks.map(k => { const t = T[k]; const cls = t.state === "ok" ? "ok" : t.state === "err" ? "err" : t.state === "run" ? "run" : "wait";
        return `<li class="${cls}"><span class="st"></span><span class="lb">${esc(t.label)}${t.detail ? `<small>${esc(t.detail)}</small>` : ""}</span><span class="in">${esc(t.info || (cls === "wait" ? "na fila" : cls === "ok" ? "pronto" : ""))}</span>${cls === "run" ? `<span class="mini"><i style="width:${(t.frac * 100).toFixed(0)}%"></i></span>` : ""}</li>`; }).join("")}</ul>
      <div class="ft"><span>${errs ? `${errs} etapa(s) indisponível(is): o app segue sem elas.` : "A interação fica liberada quando tudo estiver carregado."} · ${el2} s</span>${e.dataset.stuck ? `<button data-go>Continuar assim mesmo</button>` : ""}</div></div>`;
    const go = e.querySelector("[data-go]"); if (go) go.onclick = ev => { ev.stopPropagation(); finish(true); };
  }
  let raf = 0; const paint = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); check(); }); };
  function check() {
    const ks = order.filter(k => T[k].active); if (!ks.length) return;
    if (ks.every(k => T[k].state === "ok" || T[k].state === "err")) { clearTimeout(hideT); hideT = setTimeout(() => finish(false), boot ? 450 : 250); }
  }
  function finish(forced) {
    if (!el) return; el.classList.add("out"); const wasBoot = boot; boot = false;
    setTimeout(() => { if (el && el.classList.contains("out")) { el.remove(); el = null; } }, 500);
    order.forEach(k => { T[k].active = false; }); order = [];
    document.dispatchEvent(new CustomEvent(wasBoot ? "axon:ready" : "axon:taskdone", { detail: { forced, ms: Math.round(performance.now() - startT) } }));
  }
  function task(key, label, w, detail) {
    if (!T[key] || !T[key].active) { T[key] = { label: label || (T[key] && T[key].label) || key, w: w || 5, detail, frac: 0, state: "wait", info: "", active: true }; order.push(key); if (!boot && order.length === 1) { title = "Carregando o que foi pedido"; sub = label; startT = performance.now(); } }
    else { if (label) T[key].label = label; if (w) T[key].w = w; if (detail != null) T[key].detail = detail; }
    paint(); const t = T[key];
    return { progress(frac, info) { t.state = "run"; t.frac = Math.max(0, Math.min(1, frac)); if (info != null) t.info = info; paint(); },
      done(info) { t.state = "ok"; t.frac = 1; if (info != null) t.info = info; paint(); },
      fail(msg) { t.state = "err"; t.info = msg || "indisponível"; paint(); } };
  }
  // eventos genéricos de carga (stage3d e outros módulos)
  document.addEventListener("axon:load", e => { const d = e.detail || {}; if (!d.key) return; const t = task(d.key, d.label, d.w, d.detail);
    if (d.error) t.fail(d.error); else if (d.done) t.done(d.info); else t.progress(d.frac || 0, d.info); });
  // leitura com progresso real em bytes
  async function fetchProgress(url, key, label, as = "arrayBuffer", sizeHint) {
    const t = task(key, label); t.progress(0, "conectando…");
    const r = await fetch(url); if (!r.ok) { t.fail("HTTP " + r.status); throw new Error(r.status); }
    const total = +r.headers.get("content-length") || sizeHint || 0;
    if (!r.body || !r.body.getReader) { const v = await r[as](); t.progress(.9, "recebido"); return v; }
    const rd = r.body.getReader(), chunks = []; let got = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); got += value.length; t.progress(total ? Math.min(.92, got / total * .92) : Math.min(.9, got / (got + 4e6)), total ? `${kb(got)} de ${kb(total)}` : kb(got)); }
    const buf = new Uint8Array(got); let o = 0; chunks.forEach(c => { buf.set(c, o); o += c.length; });
    if (as === "text") return new TextDecoder().decode(buf); if (as === "json") return JSON.parse(new TextDecoder().decode(buf)); return buf.buffer;
  }
  function start(steps, opt) {
    boot = true; startT = performance.now(); title = (opt && opt.title) || "Preparando o <b>axon</b>"; sub = (opt && opt.sub) || "";
    steps.forEach(([k, l, w, d]) => task(k, l, w, d)); render();
    setTimeout(() => { if (el && boot) { el.dataset.stuck = "1"; paint(); } }, (opt && opt.stuckMs) || 90000);
  }
  g.AxonBoot = { start, task, fetchProgress, finish, get busy() { return !!el && !el.classList.contains("out"); }, get booting() { return boot; } };
})(window);
