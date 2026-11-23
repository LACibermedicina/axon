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

  // ---- indicador ao lado das bandeiras
  const pill = document.createElement("span"); pill.className = "trpill notr"; pill.hidden = true; pill.setAttribute("role", "status");
  function showStat() {
    const host = document.getElementById("flags"); if (host && !pill.isConnected) host.after(pill);
    if (lang === SRC) { pill.hidden = true; return; }
    pill.hidden = false;
    if (apiOK === false) { pill.className = "trpill notr off"; pill.textContent = "IA indisponível · só rótulos fixos"; return; }
    if (stat.done < stat.total) { pill.className = "trpill notr busy"; pill.innerHTML = `<i></i>IA traduzindo a tela · ${stat.done}/${stat.total}`; }
    else { pill.className = "trpill notr ok"; pill.textContent = "Tela traduzida por IA"; clearTimeout(pill._t); pill._t = setTimeout(() => { if (stat.done >= stat.total) pill.hidden = true; }, 2600); }
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
    lang = l; mem = load(l); pend.clear(); stat = { total: 0, done: 0 }; apiOK = null; showStat();
    if (l !== SRC) setTimeout(() => collect(document.body), 30); // depois que app.js redesenha os painéis no novo idioma
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
  function boot() {
    if (!g.I18N) return setTimeout(boot, 50);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.addEventListener("axon:lang", e => setLang(e.detail));
    if (g.I18N.lang !== SRC) setTimeout(() => setLang(g.I18N.lang), 400);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  g.AxonAutoTrans = { get lang() { return lang; }, stats: () => ({ ...stat, nodes: nodes.size, cached: Object.keys(mem).length, apiOK }), retranslate: () => setLang(lang) };
})(window);
