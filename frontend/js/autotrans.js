/* axon · autotrans.js — tradução contextual da tela inteira por IA ao clicar numa bandeira.
   Fonte: português (pt-BR). Os dicionários estáticos de i18n.js continuam valendo para os rótulos fixos;
   todo o restante do texto visível (painéis, janelas, fichas, legendas, balão do bot, dicas) é coletado,
   agrupado e traduzido pelo endpoint /api/ai/translate, com cache no servidor e neste navegador.
   Números viram marcadores ⟦n⟧ antes do envio, para que valores que mudam ao vivo reutilizem a mesma tradução.
   Etiquetas de procedência, código, siglas e unidades não são traduzidos. Voltar ao 🇧🇷 restaura o original. */
(function (g) {
  "use strict";
  const SRC = "pt", API = "/api/ai/translate";
  const SKIP = "script,style,noscript,code,pre,textarea,svg title,.tag,.notr,[data-notr],[data-i18n],#flags,.flags,.chat .m.u,.lbl.rx,.mono,kbd,input,select option[value='']";
  const ATTRS = ["title", "placeholder", "aria-label"];
  const nodes = new Map();   // nó de texto → { src, lead, trail }
  const attrs = new Map();   // elemento → { attr: src }
  let lang = SRC, mem = {}, pend = new Map(), timer = 0, inflight = 0, applying = false, stat = { total: 0, done: 0, mode: "" }, apiOK = null;

  const hasWords = s => /[A-Za-zÀ-ÖØ-öø-ÿ]{2,}/.test(s) && !/^[A-Z0-9αβγδµ·\/\-–+.,:;%()°×≈=<>|#*_\s]+$/.test(s);
  const tmpl = s => { const nums = []; const t = s.replace(/[-+]?\d+(?:[.,]\d+)*(?:e[-+]?\d+)?/gi, m => { nums.push(m); return `⟦${nums.length - 1}⟧`; }); return { t, nums }; };
  const fill = (t, nums) => t.replace(/⟦(\d+)⟧/g, (_, i) => nums[+i] ?? "");
  const store = () => { try { localStorage.setItem("axon.tr." + lang, JSON.stringify(mem)); } catch (e) {} };
  const load = l => { try { return JSON.parse(localStorage.getItem("axon.tr." + l) || "{}"); } catch (e) { return {}; } };
  function skip(el) { return !el || !!el.closest(SKIP) || el.closest("[contenteditable]"); }

  (function css() { const st = document.createElement("style"); st.textContent = `.flags button{position:relative}
.flags button.trbusy::after{content:"";position:absolute;inset:-2px;border-radius:14px;padding:2px;background:conic-gradient(#3ee6c5 var(--p,0%),rgba(255,255,255,.12) 0);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.flags button.troff::after{content:"";position:absolute;right:1px;top:1px;width:6px;height:6px;border-radius:50%;background:#ffb36b}
.trflags{position:fixed;right:14px;bottom:14px;z-index:9999;display:flex;gap:2px;padding:3px;border-radius:20px;background:rgba(10,24,29,.82);backdrop-filter:blur(6px);box-shadow:0 6px 20px rgba(0,0,0,.25)}
.trflags button{border:0;background:none;border-radius:14px;padding:3px 7px;font-size:16px;line-height:1.2;cursor:pointer}.trflags button.on{background:rgba(62,230,197,.3)}`; (document.head || document.documentElement).appendChild(st); })();
  // ---- progresso no anel da bandeira ativa (sem painel) e, na troca de idioma, na tela de carregamento
  const NAMES = { pt: "Português", en: "English", es: "Español", zh: "中文", hi: "हिन्दी" };
  let task = null;
  function showStat() {
    const host = document.getElementById("flags"), btn = host && host.querySelector(`button[data-l="${lang}"]`);
    if (host) host.querySelectorAll("button").forEach(x => { x.classList.remove("trbusy", "troff"); x.style.removeProperty("--p"); });
    const p = stat.total ? stat.done / stat.total : 1;
    if (btn && lang !== SRC) { if (apiOK === false) { btn.classList.add("troff"); btn.title = "IA indisponível: só os rótulos fixos foram traduzidos"; }
      else if (stat.done < stat.total) { btn.classList.add("trbusy"); btn.style.setProperty("--p", (p * 100).toFixed(0) + "%"); btn.title = `IA traduzindo a tela: ${stat.done} de ${stat.total} textos`; }
      else btn.title = `${NAMES[lang] || lang} · tela traduzida por IA`; }
    if (task) { if (apiOK === false) { task.fail("IA indisponível: só os rótulos fixos"); task = null; }
      else if (stat.total && stat.done >= stat.total && !pend.size && !inflight) { task.done(`${stat.total} textos traduzidos`); task = null; }
      else task.progress(stat.total ? p * .98 : .02, stat.total ? `${stat.done} de ${stat.total} textos` : "coletando o texto da tela…"); }
  }

  // ---- coleta
  function collect(root) {
    if (lang === SRC || !root) return;
    if (root.nodeType === 3) { visit(root); return; }
    if (root.nodeType !== 1 || skip(root)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) visit(n);
    [root, ...root.querySelectorAll("[title],[placeholder],[aria-label]")].forEach(visitAttrs);
  }
  // cada registro guarda o texto original (src) e o último texto que nós mesmos escrevemos (cur),
  // para distinguir as nossas mutações das feitas pelo app
  function visit(n) {
    const p = n.parentElement; if (!p || skip(p)) return;
    let rec = nodes.get(n);
    if (rec && n.nodeValue !== rec.cur && n.nodeValue.trim() !== rec.src) { nodes.delete(n); rec = null; } // o app trocou o texto
    if (!rec) { const m = n.nodeValue.match(/^(\s*)([\s\S]*?)(\s*)$/); if (!hasWords(m[2])) return; rec = { src: m[2], lead: m[1], trail: m[3], cur: null }; nodes.set(n, rec); }
    want(rec.src, txt => { if (!n.isConnected) return; const v = rec.lead + txt + rec.trail; rec.cur = v; if (n.nodeValue !== v) n.nodeValue = v; });
  }
  function visitAttrs(el) {
    if (!el.getAttribute || el.closest(SKIP)) return;
    ATTRS.forEach(a => { const v = el.getAttribute(a); if (!v) return; let rec = attrs.get(el); if (!rec) attrs.set(el, rec = { src: {}, cur: {} });
      if (v === rec.cur[a]) return; if (!hasWords(v)) return; rec.src[a] = v;
      want(v, txt => { rec.cur[a] = txt; if (el.getAttribute(a) !== txt) el.setAttribute(a, txt); }); });
  }
  function want(src, apply) {
    const { t, nums } = tmpl(src);
    if (mem[t] != null) { apply(fill(mem[t], nums)); return; }
    let q = pend.get(t); if (!q) { pend.set(t, q = []); stat.total++; } q.push(txt => apply(fill(txt, nums)));
    clearTimeout(timer); timer = setTimeout(flush, 180);
  }
  function context() {
    const ttl = [...document.querySelectorAll(".win .tb .t")].map(x => x.textContent).slice(0, 4).join(", ");
    return `simulador axon; janelas abertas: ${ttl || "nenhuma"}; nível de escala ${g.AxonApp && g.AxonApp.state ? g.AxonApp.state.level || "" : ""}`;
  }
  async function flush() {
    if (lang === SRC || !pend.size) { showStat(); return; }
    const batch = [...pend.keys()].slice(0, 120), target = lang; showStat();
    inflight++;
    try {
      const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texts: batch, target, context: context() }) });
      if (!r.ok) throw new Error(r.status); const j = await r.json(); apiOK = j.mode !== "offline";
      if (target !== lang) return;
      batch.forEach((k, i) => { const cbs = pend.get(k); pend.delete(k); stat.done++; const out = j.texts[i];
        if (j.mode === "offline" || out == null) return; mem[k] = out; (cbs || []).forEach(cb => cb(out)); });
      store();
    } catch (e) { apiOK = false; batch.forEach(k => { pend.delete(k); stat.done++; }); }
    finally { inflight--; showStat(); if (pend.size && apiOK !== false) setTimeout(flush, 60); }
  }

  // ---- restaurar o original (pt) e trocar de idioma
  function restore() {
    applying = true;
    nodes.forEach((r, n) => { if (n.isConnected) { r.cur = r.lead + r.src + r.trail; n.nodeValue = r.cur; } });
    attrs.forEach((r, el) => { if (el.isConnected) Object.entries(r.src).forEach(([a, v]) => { r.cur[a] = v; el.setAttribute(a, v); }); });
    applying = false;
  }
  function setLang(l) {
    restore(); nodes.forEach((r, n) => { if (!n.isConnected) nodes.delete(n); }); attrs.forEach((r, el) => { if (!el.isConnected) attrs.delete(el); });
    lang = l; mem = load(l); pend.clear(); stat = { total: 0, done: 0 }; apiOK = null;
    document.documentElement.lang = l === "pt" ? "pt-BR" : l;
    task = l !== SRC && g.AxonBoot ? g.AxonBoot.task("tr", `Tradução da tela por IA · ${NAMES[l] || l}`, 8, "contextual, com cache no servidor e no navegador") : null;
    showStat();
    if (l !== SRC) setTimeout(() => { collect(document.body); if (!pend.size && task) { task.done(stat.total ? "em cache" : "nada a traduzir"); task = null; } showStat(); }, 30); // depois que app.js redesenha os painéis no novo idioma
  }

  // ---- observa a tela: janelas que abrem, painéis redesenhados, valores ao vivo, balão do bot
  const mo = new MutationObserver(list => {
    if (lang === SRC) return;
    for (const m of list) {
      if (m.type === "characterData") { const n = m.target, rec = nodes.get(n); if (rec && n.nodeValue === rec.cur) continue; visit(n); }
      else if (m.type === "attributes") visitAttrs(m.target);
      else m.addedNodes.forEach(n => collect(n));
    }
  });
  // páginas sem i18n.js (portal, manuais): bandeiras próprias, mesmo armazenamento de idioma
  function shim() {
    const FL = { pt: "🇧🇷", en: "🇬🇧", es: "🇪🇸", zh: "🇨🇳", hi: "🇮🇳" }; let cur = "pt"; try { const s0 = localStorage.getItem("axon.lang"); if (s0 && FL[s0]) cur = s0; } catch (e) {}
    g.I18N = { FLAGS: FL, langs: Object.keys(FL), get lang() { return cur; }, set(l) { cur = l; try { localStorage.setItem("axon.lang", l); } catch (e) {} draw(); document.dispatchEvent(new CustomEvent("axon:lang", { detail: l })); }, t: k => k, apply() {}, shim: true };
    let host = document.getElementById("flags"); if (!host) { host = document.createElement("div"); host.id = "flags"; host.className = "flags trflags"; host.setAttribute("role", "group"); host.setAttribute("aria-label", "Idioma"); document.body.appendChild(host); }
    function draw() { host.innerHTML = Object.entries(FL).map(([l, f]) => `<button data-l="${l}" class="${l === cur ? "on" : ""}" title="${NAMES[l]}">${f}</button>`).join(""); host.querySelectorAll("button").forEach(b2 => b2.onclick = () => g.I18N.set(b2.dataset.l)); }
    draw();
  }
  function boot() {
    if (!g.I18N) { if (document.querySelector('script[src*="i18n.js"]')) return setTimeout(boot, 50); shim(); }
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.addEventListener("axon:lang", e => setLang(e.detail));
    if (g.I18N.lang !== SRC) setTimeout(() => setLang(g.I18N.lang), 400);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  g.AxonAutoTrans = { get lang() { return lang; }, stats: () => ({ ...stat, nodes: nodes.size, cached: Object.keys(mem).length, apiOK }), retranslate: () => setLang(lang) };
})(window);
