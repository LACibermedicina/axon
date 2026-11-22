/* Comportamentos comuns dos manuais: índice com scrollspy, busca por seção, copiar código, rótulos de tabelas empilhadas. */
{
  const toc = document.querySelector("nav.toc"), secs = [...document.querySelectorAll("main section[id]")];
  const links = toc ? [...toc.querySelectorAll("a")] : [];
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)); }), { rootMargin: "-30% 0px -60% 0px" });
  secs.forEach(s => io.observe(s));
  const q = document.querySelector("#q");
  if (q) q.addEventListener("input", () => { const v = q.value.trim().toLowerCase(); secs.forEach(s => s.classList.toggle("hidden", !!v && !s.textContent.toLowerCase().includes(v))); links.forEach(a => { const s = document.querySelector(a.getAttribute("href")); a.classList.toggle("hidden", !!(s && s.classList.contains("hidden"))); }); });
  document.querySelectorAll("pre").forEach(p => { const b = document.createElement("button"); b.className = "copy"; b.textContent = "Copiar"; b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(p.querySelector("code")?.innerText || p.innerText); b.textContent = "Copiado"; } catch (e) { b.textContent = "Selecione e copie"; } setTimeout(() => b.textContent = "Copiar", 1600); }); p.appendChild(b); });
  document.querySelectorAll("table.stack").forEach(t => { const h = [...t.rows[0].cells].map(c => c.textContent); [...t.rows].slice(1).forEach(r => [...r.cells].forEach((c, i) => c.dataset.l = h[i] || "")); });
}
