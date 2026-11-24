/* axon · device.js — reconhece o dispositivo (celular, tablet, desktop) e adapta a interface.
   Critérios: ponteiro grosso (toque), ausência de hover, largura útil da tela e identificação do navegador.
   A escolha pode ser trocada pelo usuário (Vista → Interface) e fica guardada no navegador. */
(function (g) {
  "use strict";
  const KEY = "axon.device.v1", KINDS = ["auto", "mobile", "tablet", "desktop"], NAME = { auto: "automática", mobile: "celular", tablet: "tablet", desktop: "desktop" };
  const mm = q => { try { return g.matchMedia(q).matches; } catch (e) { return false; } };
  function detect() {
    const ua = navigator.userAgent || "", coarse = mm("(pointer: coarse)"), hover = mm("(hover: hover)"), touch = (navigator.maxTouchPoints || 0) > 0;
    const short = Math.min(screen.width || innerWidth, screen.height || innerHeight), w = innerWidth;
    const ipadOS = /Macintosh/.test(ua) && touch && (navigator.maxTouchPoints || 0) > 1;
    let kind = "desktop";
    if (/iPhone|iPod|Android.+Mobile|Mobi|Windows Phone/i.test(ua) || (coarse && !hover && short < 600) || w < 600) kind = "mobile";
    else if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua) || ipadOS || (coarse && !hover) || w < 1000) kind = "tablet";
    return { kind, touch: touch || coarse, coarse, hover, w, short, ua: ua.slice(0, 120) };
  }
  let pref = "auto"; try { pref = localStorage.getItem(KEY) || "auto"; } catch (e) {}
  const q = new URLSearchParams(location.search).get("device"); if (q && KINDS.includes(q)) pref = q;
  const D = { info: null, kind: "desktop", pref };
  function apply() {
    const info = detect(), kind = pref === "auto" ? info.kind : pref, b = document.body; if (!b) return;
    const changed = kind !== D.kind; D.info = info; D.kind = kind;
    ["mobile", "tablet", "desktop"].forEach(k => b.classList.toggle("dev-" + k, k === kind)); b.classList.toggle("touch", info.touch);
    b.dataset.device = kind; mobileNav(kind === "mobile");
    if (kind === "mobile" && g.AxonNotes && g.AxonNotes.minimize && !D.notesMin) { D.notesMin = true; g.AxonNotes.minimize(true); }   // notas recolhidas no celular
    if (kind === "mobile") { const L = document.getElementById("left"), R = document.getElementById("right"); if (L && R && !L.classList.contains("collapsed") && !R.classList.contains("collapsed") && g.AxonWorkbench) g.AxonWorkbench.toggleSide("right"); }
    if (changed) document.dispatchEvent(new CustomEvent("axon:device", { detail: { kind, info } }));
    setTimeout(() => dispatchEvent(new Event("resize")), 60);
  }
  // barra inferior do celular: corpo, painéis em gaveta, instrumentos, assistente, mais apps
  function mobileNav(on) {
    let n = document.getElementById("mobNav");
    if (!on) { if (n) n.remove(); document.body.classList.remove("dock-open"); return; }
    if (n) return; n = document.createElement("nav"); n.id = "mobNav"; n.className = "mobnav notr"; n.setAttribute("aria-label", "Navegação");
    const I = k => (g.AxonIcons && g.AxonIcons[k]) || "";
    n.innerHTML = [["body", "Corpo", "Só o modelo 3D", I("hideall") || "◎"], ["left", "Anatomia", "Anatomia, sintomas e protocolo", I("panelL") || "☰"], ["right", "Propriedades", "Parâmetros e janelas incorporadas", I("panelR") || "⚙"],
      ["tray", "Instrumentos", "Bandeja de instrumentos", I("tray") || "✚"], ["more", "Mais", "Todas as janelas", "⋯"]].map(([k, l, t, ic]) => `<button data-m="${k}" title="${t}"><span class="ic">${ic}</span><span>${l}</span></button>`).join("");
    document.body.appendChild(n);
    const W = () => g.AxonWorkbench, side = id => { const s = document.getElementById(id), o = id === "left" ? "right" : "left", so = document.getElementById(o); if (so && !so.classList.contains("collapsed")) W().toggleSide(o); if (s) W().toggleSide(id); };
    n.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { const k = b.dataset.m; document.body.classList.remove("dock-open");
      if (k === "body") ["left", "right"].forEach(id => { const s = document.getElementById(id); if (s && !s.classList.contains("collapsed")) W().toggleSide(id); });
      if (k === "left" || k === "right") side(k); if (k === "tray" && g.AxonApp) g.AxonApp.openApp("tray"); if (k === "more") document.body.classList.toggle("dock-open"); sync(); });
    const sync = () => n.querySelectorAll("[data-m]").forEach(b => { const k = b.dataset.m, s = document.getElementById(k); b.classList.toggle("on", k === "more" ? document.body.classList.contains("dock-open") : !!s && !s.classList.contains("collapsed")); });
    new MutationObserver(sync).observe(document.getElementById("left") || document.body, { attributes: true, attributeFilter: ["class"] });
    new MutationObserver(sync).observe(document.getElementById("right") || document.body, { attributes: true, attributeFilter: ["class"] }); sync();
    document.addEventListener("click", e => { if (document.body.classList.contains("dock-open") && e.target.closest(".dock button")) setTimeout(() => { document.body.classList.remove("dock-open"); sync(); }, 50); });
  }
  D.set = k => { pref = KINDS.includes(k) ? k : "auto"; D.pref = pref; try { localStorage.setItem(KEY, pref); } catch (e) {} apply(); };
  D.cycle = () => D.set(KINDS[(KINDS.indexOf(pref) + 1) % KINDS.length]);
  D.label = () => `Interface ${NAME[pref]}${pref === "auto" ? " (" + NAME[D.kind] + ")" : ""}`;
  D.detect = detect; D.apply = apply;
  let rt = 0; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { const k = pref === "auto" ? detect().kind : pref; if (k !== D.kind) apply(); }, 250); });
  addEventListener("orientationchange", () => setTimeout(apply, 300));
  if (document.body) apply(); else document.addEventListener("DOMContentLoaded", apply);
  document.addEventListener("axon:ready", apply);
  g.AxonDevice = D;
})(window);
