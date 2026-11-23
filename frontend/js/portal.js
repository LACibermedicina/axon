/* axon · portal.js — página inicial: diorama 3D, notícias, linha do tempo, agenda, podcast, galeria, programa,
   newsletter e apoio. Conteúdo vem de /api/portal/public (administrado no painel com apoio de IA);
   sem servidor, usa data/portal-seed.json e desativa os formulários. */
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const P = window.AXON_PROGRAMA || {}; let R = window.AXON_RELEASE || { version: "—", releases: [] };
  const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const fmtD = d => { if (!d) return ""; const [y, m, dd] = d.slice(0, 10).split("-"); return `${dd}/${m}/${y}`; };
  const CATN = { novidade: "Novidade", atualizacao: "Atualização", publicacao: "Publicação", evento: "Evento", bastidores: "Bastidores" };
  const KINDN = { evento: "Evento", atividade: "Atividade", prazo: "Prazo", reuniao: "Reunião", apresentacao: "Apresentação" };
  const mediaURL = m => m.url || (m.file ? "api/portal/media/" + encodeURIComponent(m.file) : "");
  const md = s => esc(s).split(/\n{2,}/).map(b => /^- /m.test(b) ? "<ul>" + b.split("\n").map(l => l.replace(/^- /, "")).filter(Boolean).map(l => `<li>${l}</li>`).join("") + "</ul>" : `<p>${b.replace(/\n/g, "<br>")}</p>`).join("").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  let D = { news: [], events: [], timeline: [], media: [], episodes: [] }, ONLINE = false;

  // ------------------------------------------------------------ diorama 3D
  const tip = $("#tip");
  function onRec(r) {
    $("#bAb").style.width = (r.ab / r.nab * 100) + "%"; $("#bAd").style.width = (r.ad / r.nad * 100) + "%"; $("#nAb").textContent = `${r.ab}/${r.nab}`; $("#nAd").textContent = `${r.ad}/${r.nad}`;
    $("#verdict").innerHTML = r.ab === 0 ? `<span style="color:var(--mute)">Abaixo do limiar: nenhuma fibra dispara.</span>` : r.ad === 0 ? `<span style="color:var(--ab)">Só tato: as fibras grossas disparam, as finas não.</span>` : r.ad < r.nad ? `<span style="color:var(--ad)">A dor começa: as Aδ entram só muito acima do limiar das Aβ.</span>` : `<span style="color:var(--red)">Todas recrutadas — a seletividade se perdeu.</span>`;
  }
  try {
    if (!window.THREE) throw 0;
    const host = $(".hero-3d");
    const V = window.__axonV = AxonVoxel.create($("#gl"), { theme: "light", contained: true, noOffset: true, fit: .95, hero: { tgt: [9, -8, 0], az: .62, el: .3 }, intensity: 1.6, onChange: onRec,
      onHover: h => { if (!h) { tip.style.display = "none"; return; } const r = host.getBoundingClientRect(); tip.style.display = "block"; tip.style.left = (h.x - r.left + 12) + "px"; tip.style.top = (h.y - r.top + 12) + "px";
        tip.innerHTML = `<b style="color:${h.f.type === "Ab" ? "var(--ab)" : "var(--ad)"}">${h.f.type === "Ab" ? "Aβ" : "Aδ"}</b> · ${h.f.D.toFixed(1).replace(".", ",")} µm · limiar ${h.f.thr.toFixed(2).replace(".", ",")}×`; } });
    const rg = $("#iRange"), set = () => { const v = +rg.value; $("#iVal").textContent = v.toFixed(1).replace(".", ",") + "×"; V.setIntensity(v); };
    rg.addEventListener("input", set); set();
  } catch (e) { $("#gl").replaceWith(Object.assign(document.createElement("img"), { src: "img/app/sim-regiao.jpg", alt: "Bloco de tecido do simulador", style: "width:100%;height:100%;object-fit:cover" })); }

  // ------------------------------------------------------------ níveis (capturas reais do simulador)
  const LV = [["sim-corpo", "Nível 1", "Corpo inteiro", "Anatomia real, dermátomos e pontos reflexos", 100], ["sim-st36", "Desafio", "ST36 em camadas", "Músculo, nervo e dermátomo associados", 80],
    ["sim-regiao", "Nível 2", "Região e tronco", "Pele, gordura, músculo e o eletrodo", 60], ["sim-fasciculo", "Nível 3", "Fascículo", "Fibras Aβ, Aδ e C e as ramificações", 45], ["sim-monitor", "Modo", "Simulação", "Instrumento, monitor e desfecho", 30]];
  $("#levels").innerHTML = LV.map(([f, b, t, s, x]) => `<a class="lvl" href="simulador.html"><img src="img/app/${f}.jpg" alt="${esc(t)} no simulador" loading="lazy"><span class="badge">${b}</span><span class="t"><b>${t}</b><span>${s}</span><span class="xp"><i style="width:${x}%"></i></span></span></a>`).join("");

  // ------------------------------------------------------------ notícias
  let cat = "todas", shown = 7;
  function renderNews() {
    const cats = ["todas", ...new Set(D.news.map(n => n.category).filter(Boolean))];
    $("#newsFilters").innerHTML = cats.map(c => `<button role="tab" aria-selected="${c === cat}" class="${c === cat ? "on" : ""}" data-c="${c}">${c === "todas" ? "Todas" : CATN[c] || c}</button>`).join("");
    $$("#newsFilters button").forEach(b => b.onclick = () => { cat = b.dataset.c; shown = 7; renderNews(); });
    const list = D.news.filter(n => cat === "todas" || n.category === cat);
    $("#news").innerHTML = list.slice(0, shown).map((n, i) => `<button class="card nw ${i === 0 && cat === "todas" ? "feat" : ""}" id="n-${esc(n.id)}" data-id="${esc(n.id)}">
      <span class="im">${n.image ? `<img src="${esc(n.image.startsWith("me-") ? mediaURL(D.media.find(m => m.id === n.image) || {}) : n.image)}" alt="" loading="lazy">` : `<span class="ph">${esc((n.title.match(/v\d+\.\d+/) || ["axon"])[0])}</span>`}</span>
      <span class="bd"><span class="meta"><span class="cat ${esc(n.category)}">${esc(CATN[n.category] || n.category)}</span>${fmtD(n.date)}</span><h3>${esc(n.title)}</h3><p>${esc(n.summary)}</p></span></button>`).join("") || `<div class="empty">Nenhuma notícia nesta categoria.</div>`;
    $("#newsMore").hidden = list.length <= shown; $("#newsMore").onclick = () => { shown += 6; renderNews(); };
    $$("#news .nw").forEach(b => b.onclick = () => openNews(b.dataset.id));
  }
  function openNews(id) {
    const n = D.news.find(x => x.id === id); if (!n) return;
    const im = n.image ? (n.image.startsWith("me-") ? mediaURL(D.media.find(m => m.id === n.image) || {}) : n.image) : "";
    modal(`${im ? `<img class="hero-im" src="${esc(im)}" alt="">` : ""}<article class="art"><div class="meta" style="display:flex;gap:8px;align-items:center;color:var(--mute);font-size:13px"><span class="cat ${esc(n.category)}">${esc(CATN[n.category] || n.category)}</span>${fmtD(n.date)}</div><h2>${esc(n.title)}</h2><p><b>${esc(n.summary)}</b></p>${md(n.body || "")}</article>`);
    history.replaceState(null, "", "#n-" + id);
  }

  // ------------------------------------------------------------ roadmap e linha do tempo
  function renderRoadmap() {
    const E = (P.conteudo || {}).estado || {}; $("#scopeNote").textContent = E.escopo || "";
    const F = Object.values(P.fases || {}).sort((a, b) => a.ordem - b.ordem), ins = F.filter(f => f.trilha !== "vinculado"), vin = F.filter(f => f.trilha === "vinculado");
    const card = f => `<div class="card ph ${f.trilha === "vinculado" ? "vin" : ""}"><span class="c">${esc(f.codigo)} · ${esc(f.periodo)}</span><b>${esc(f.nome)}</b>
      <span class="st ${f.estado === "andamento" ? "andamento" : f.trilha === "vinculado" ? "fora" : "planejada"}">${f.estado === "andamento" ? "em andamento" : esc(f.estado)}</span>
      ${f.progresso ? `<div class="prog" title="${f.progresso}%"><i style="width:${f.progresso}%"></i></div>` : ""}<p>${esc(f.descricao)}</p>
      <details><summary>Critério e entregáveis</summary><p><b>Critério:</b> ${esc(f.criterio)}</p><ul>${(f.entregaveis || "").split("\n").map(e => `<li>${esc(e)}</li>`).join("")}</ul></details></div>`;
    $("#phases").innerHTML = ins.map(card).join("") + (vin.length ? `<div class="vin-h">Projeto vinculado · fora do escopo desta campanha · depende de aprovação das entidades responsáveis</div>` + vin.map(card).join("") : "");
    const items = [...D.timeline].sort((a, b) => (a.date || "") < (b.date || "") ? -1 : 1);
    $("#timeline").innerHTML = items.map(t => `<div class="it ${esc(t.track)} ${esc(t.state)}"><span class="dt">${fmtD(t.date)}</span><div class="pt"></div><b>${esc(t.title)}</b><p>${esc((t.description || "").slice(0, 110))}${(t.description || "").length > 110 ? "…" : ""}</p></div>`).join("") || `<div class="empty">Sem marcos publicados.</div>`;
    const now = $("#timeline .agora") || $("#timeline .previsto"); if (now) $(".tl-wrap").scrollLeft = Math.max(0, now.offsetLeft - 220);
    // estado atual
    const k = Object.entries(P.metricas || {}).sort((a, b) => a[1].ordem - b[1].ordem), TAG = { k4: ["t-der", "DERIVADO"] };
    $("#kpis").innerHTML = k.map(([id, m]) => `<div class="card kpi"><div class="v">${esc(m.valor)}</div><div class="l">${esc(m.rotulo)}</div><div class="n">${esc(m.nota)}</div><span class="tag ${(TAG[id] || ["t-mod"])[0]}">${(TAG[id] || [0, "MODELO · SEMENTE 42"])[1]}</span></div>`).join("");
    if (E.fase_atual) $("#estado").innerHTML = `<div class="ring" style="--p:${E.progresso}"><b>${E.progresso}%</b></div><div><b style="font:700 18px Sora;color:var(--deep)">${esc(E.fase_atual)}</b><p style="margin:4px 0 0;color:#3b5a5e">${esc(E.resumo)}</p>
      <div class="trio"><div><b>Agora</b>${esc(E.agora)}</div><div><b>Próxima</b>${esc(E.proxima)}</div><div><b style="color:var(--ad)">Bloqueio</b>${esc(E.bloqueio)}</div></div><p class="fine">Atualizado em ${fmtD(E.atualizado_em)}</p></div>`;
  }

  // ------------------------------------------------------------ agenda
  let calY, calM;
  function renderAgenda() {
    const today = new Date(); if (calY == null) { calY = today.getFullYear(); calM = today.getMonth(); }
    const evs = D.events, byDay = {}; evs.forEach(e => { const d = (e.start || "").slice(0, 10); (byDay[d] = byDay[d] || []).push(e); });
    $("#calTitle").textContent = `${MES[calM]} ${calY}`;
    const first = new Date(calY, calM, 1), start = (first.getDay() + 6) % 7, days = new Date(calY, calM + 1, 0).getDate(), prevDays = new Date(calY, calM, 0).getDate();
    let h = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map(w => `<span class="wd">${w}</span>`).join("");
    for (let i = 0; i < 42; i++) {
      const dn = i - start + 1, inM = dn >= 1 && dn <= days, dd = inM ? dn : dn < 1 ? prevDays + dn : dn - days;
      const iso = inM ? `${calY}-${String(calM + 1).padStart(2, "0")}-${String(dn).padStart(2, "0")}` : "", ev = byDay[iso] || [];
      const isT = inM && dn === today.getDate() && calM === today.getMonth() && calY === today.getFullYear();
      h += `<span class="d ${inM ? "" : "o"} ${isT ? "today" : ""} ${ev.length ? "has " + esc(ev[0].kind) : ""}" ${ev.length ? `data-d="${iso}" tabindex="0" role="button" aria-label="${dn}: ${esc(ev.map(e => e.title).join("; "))}"` : ""}>${dd}</span>`;
    }
    $("#calGrid").innerHTML = h;
    $$("#calGrid .has").forEach(c => { const go = () => openDay(c.dataset.d, byDay[c.dataset.d]); c.onclick = go; c.onkeydown = e => (e.key === "Enter" || e.key === " ") && go(); });
    $("#calPrev").onclick = () => { calM--; if (calM < 0) { calM = 11; calY--; } renderAgenda(); }; $("#calNext").onclick = () => { calM++; if (calM > 11) { calM = 0; calY++; } renderAgenda(); };
    const iso = today.toISOString().slice(0, 10), up = evs.filter(e => (e.end || e.start || "").slice(0, 10) >= iso).slice(0, 5);
    $("#upcoming").innerHTML = up.map(evCard).join("") || `<div class="empty">Nenhuma data futura publicada. A coordenação anuncia aqui os próximos eventos e atividades.</div>`;
  }
  const evCard = e => { const d = new Date((e.start || "").slice(0, 10) + "T12:00"); const hr = (e.start || "").length > 10 ? (e.start || "").slice(11, 16) : "";
    return `<div class="card ev"><div class="day">${d.getDate() || "?"}<small>${MES[d.getMonth()] ? MES[d.getMonth()].slice(0, 3) : ""}</small></div><div><span class="k">${esc(KINDN[e.kind] || e.kind)}</span><b>${esc(e.title)}</b><p>${[hr, e.location].filter(Boolean).map(esc).join(" · ")}</p>${e.description ? `<p>${esc(e.description)}</p>` : ""}${e.link ? `<p><a href="${esc(e.link)}" rel="noopener">Mais informações</a></p>` : ""}</div></div>`; };
  const openDay = (d, evs) => modal(`<div class="art"><h2>${fmtD(d)}</h2>${evs.map(evCard).join("")}</div>`);

  // ------------------------------------------------------------ podcast
  const audio = $("#pAudio"); let cur = null, speaking = false, utt = null, spStart = 0, spDur = 0, spTimer = 0;
  const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  function renderPodcast() {
    const eps = D.episodes;
    $("#playlist").innerHTML = eps.map((e, i) => `<li class="${cur && cur.id === e.id ? "on" : ""}"><button data-id="${esc(e.id)}"><span class="n">${String(eps.length - i).padStart(2, "0")}</span><span><b>${esc(e.title)}</b><span>${esc(e.summary)}</span></span><span class="du">${e.audio && e.duration ? fmtT(e.duration) : e.audio ? "áudio" : "voz"}</span></button></li>`).join("")
      || `<li class="empty">A playlist está aguardando a liberação dos primeiros episódios pela coordenação. Inscreva-se no boletim para saber quando sair.</li>`;
    $$("#playlist button").forEach(b => b.onclick = () => load(eps.find(e => e.id === b.dataset.id), true));
    if (!cur && eps[0]) load(eps[0], false);
  }
  function stopAll() { audio.pause(); if (speaking) { speechSynthesis.cancel(); speaking = false; } clearInterval(spTimer); $("#player").classList.remove("playing"); $("#pPlay").textContent = "▶"; }
  function load(e, play) {
    stopAll(); cur = e; $("#pTitle").textContent = e.title; $("#pSum").textContent = e.summary || ""; $("#pBar").style.width = "0"; $("#pTime").textContent = "0:00";
    $$("#playlist li").forEach(li => li.classList.toggle("on", li.querySelector("button")?.dataset.id === e.id));
    if (e.audio) { audio.src = "api/portal/media/" + encodeURIComponent(e.audio); $("#pNote").textContent = "Áudio do episódio."; }
    else { audio.removeAttribute("src"); $("#pNote").textContent = "Este episódio é lido pela voz sintetizada do seu navegador, a partir do roteiro aprovado."; }
    if (play) toggle();
  }
  function toggle() {
    if (!cur) return;
    if (cur.audio) { if (audio.paused) { audio.play().catch(() => {}); } else audio.pause(); return; }
    if (!("speechSynthesis" in window)) { $("#pNote").textContent = "Seu navegador não tem voz sintetizada. Leia o roteiro abaixo."; modal(`<div class="art"><h2>${esc(cur.title)}</h2>${md(cur.script || "")}</div>`); return; }
    if (speaking) { stopAll(); return; }
    utt = new SpeechSynthesisUtterance(cur.script || cur.summary); utt.lang = "pt-BR"; utt.rate = 1.02;
    const v = speechSynthesis.getVoices().find(v => /pt(-|_)BR/i.test(v.lang)); if (v) utt.voice = v;
    spDur = Math.max(20, (cur.script || "").split(/\s+/).length / 2.6); spStart = performance.now();
    utt.onend = () => { stopAll(); $("#pBar").style.width = "100%"; };
    speechSynthesis.speak(utt); speaking = true; $("#player").classList.add("playing"); $("#pPlay").textContent = "❚❚";
    spTimer = setInterval(() => { const t = (performance.now() - spStart) / 1000; $("#pBar").style.width = Math.min(100, t / spDur * 100) + "%"; $("#pTime").textContent = fmtT(t); }, 400);
  }
  $("#pPlay").onclick = toggle;
  audio.onplay = () => { $("#player").classList.add("playing"); $("#pPlay").textContent = "❚❚"; }; audio.onpause = () => { $("#player").classList.remove("playing"); $("#pPlay").textContent = "▶"; };
  audio.ontimeupdate = () => { if (audio.duration) { $("#pBar").style.width = (audio.currentTime / audio.duration * 100) + "%"; $("#pTime").textContent = fmtT(audio.currentTime); } };
  $(".pctl .prog").onclick = e => { if (cur && cur.audio && audio.duration) { const r = e.currentTarget.getBoundingClientRect(); audio.currentTime = (e.clientX - r.left) / r.width * audio.duration; } };

  // ------------------------------------------------------------ galeria e documentos
  let gcat = "todas";
  function renderGallery() {
    const vis = D.media.filter(m => m.kind === "foto" || m.kind === "video"), docs = D.media.filter(m => m.kind === "documento" || m.kind === "audio" || m.category === "registro" && m.kind !== "foto" && m.kind !== "video");
    const cats = ["todas", "foto", "video"].filter(c => c === "todas" || vis.some(m => m.kind === c));
    $("#galFilters").innerHTML = cats.length > 2 ? cats.map(c => `<button class="${c === gcat ? "on" : ""}" data-c="${c}">${{ todas: "Tudo", foto: "Fotos e pranchas", video: "Vídeos" }[c]}</button>`).join("") : "";
    $$("#galFilters button").forEach(b => b.onclick = () => { gcat = b.dataset.c; renderGallery(); });
    $("#gallery").innerHTML = vis.filter(m => gcat === "todas" || m.kind === gcat).map(m => `<button class="gi" data-id="${esc(m.id)}">${m.kind === "video" ? `<video src="${esc(mediaURL(m))}" muted preload="metadata"></video><span class="vbadge">▶ vídeo</span>` : `<img src="${esc(mediaURL(m))}" alt="${esc(m.title)}" loading="lazy">`}<span class="cap">${esc(m.title)}</span></button>`).join("") || `<div class="empty">Sem imagens publicadas.</div>`;
    $$("#gallery .gi").forEach(b => b.onclick = () => { const m = D.media.find(x => x.id === b.dataset.id); modal(m.kind === "video" ? `<video src="${esc(mediaURL(m))}" controls autoplay></video><div class="art"><b>${esc(m.title)}</b><p>${esc(m.caption || "")}</p></div>` : `<img class="zoom" src="${esc(mediaURL(m))}" alt="${esc(m.title)}"><div class="art"><b>${esc(m.title)}</b><p>${esc(m.caption || "")}</p></div>`); });
    const fixed = [{ title: "Manual do usuário", caption: "Telas, fluxos, níveis de escala e pontos reflexos", url: "docs/manual-usuario.html", mime: "html" }, { title: "Manual técnico", caption: "Arquitetura, modelo, pipeline e implantação", url: "docs/manual-tecnico.html", mime: "html" }];
    $("#docs").innerHTML = [...fixed, ...docs].map(m => `<a class="card doc" href="${esc(mediaURL(m))}" ${m.mime === "html" ? "" : 'rel="noopener"'}><span class="ext">${esc((m.mime || "").split("/").pop().toUpperCase().slice(0, 4))}</span><span><b>${esc(m.title)}</b><span>${esc(m.caption || "")}${m.date ? " · " + fmtD(m.date) : ""}</span></span></a>`).join("");
  }

  // ------------------------------------------------------------ newsletter e apoio
  function wireForms() {
    const post = async (url, body) => { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.detail || "Não foi possível enviar agora."); return j; };
    $("#subForm").onsubmit = async e => { e.preventDefault(); const f = e.target, m = $("#subMsg"); m.className = "msg";
      if (!ONLINE) { m.className = "msg err"; m.textContent = "Inscrições funcionam no site axon.m3d.pro."; return; }
      if (!f.consent.checked) { m.className = "msg err"; m.textContent = "Marque a autorização de uso do e-mail."; return; }
      try { await post("api/portal/subscribe", { email: f.email.value, topics: [...f.querySelectorAll("[name=t]:checked")].map(x => x.value), consent: true }); m.className = "msg ok"; m.textContent = "Inscrição feita. Obrigado por acompanhar!"; f.reset(); }
      catch (err) { m.className = "msg err"; m.textContent = err.message; } };
    $("#supForm").onsubmit = async e => { e.preventDefault(); const f = e.target, m = $("#supMsg"); m.className = "msg";
      if (!ONLINE) { m.className = "msg err"; m.textContent = "O apoio funciona no site axon.m3d.pro."; return; }
      try { const r = await post("api/portal/support", { name: f.name.value, email: f.email.value, topic: f.topic.value, message: f.message.value }); m.className = "msg ok"; m.textContent = `Mensagem recebida (protocolo ${r.id}).`; f.reset(); }
      catch (err) { m.className = "msg err"; m.textContent = err.message; } };
  }

  // ------------------------------------------------------------ modal, menu ativo, estatísticas
  function modal(html) { $("#modalBody").innerHTML = html; $("#modal").hidden = false; $("#modal [data-close]").focus(); }
  const closeModal = () => { $("#modal").hidden = true; $("#modalBody").innerHTML = ""; if (/^#n-/.test(location.hash)) history.replaceState(null, "", "#novidades"); };
  $("#modal").addEventListener("click", e => { if (e.target.id === "modal" || e.target.closest("[data-close]")) closeModal(); });
  addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
  document.addEventListener("click", e => { const im = e.target.closest("img[data-zoom]"); if (im) modal(`<img class="zoom" src="${im.src}" alt="${esc(im.alt)}">`); });
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) $$(".menu a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + en.target.id)); }), { rootMargin: "-40% 0px -55% 0px" });
  $$("main section[id]").forEach(s => io.observe(s));
  function stats() {
    const iso = new Date().toISOString().slice(0, 10), nextEv = D.events.filter(e => (e.start || "") >= iso).length;
    $("#verPill span").textContent = `Simulador v${R.version} · novidades`;
    $("#stats").innerHTML = [[`v${R.version.replace("-alpha", "")}`, "versão do simulador"], [D.news.length, "notícias"], [nextEv || D.episodes.length, nextEv ? "datas na agenda" : "episódios"]].map(([b, s]) => `<div class="stat"><b>${esc(b)}</b><span>${s}</span></div>`).join("");
  }

  // ------------------------------------------------------------ dados
  async function boot() {
    // versão sempre a do servidor (release.json não vai para o cache), mesmo que o navegador guarde um release.js antigo
    try { const r = await fetch("release.json?ts=" + Date.now(), { cache: "no-store" }); if (r.ok) { const j = await r.json(); if (j && j.version) R = j; } } catch (e) {}
    try { const r = await fetch("api/portal/public", { cache: "no-store" }); if (!r.ok) throw 0; D = await r.json(); ONLINE = true; }
    catch (e) { try { D = await (await fetch("data/portal-seed.json")).json(); } catch (e2) {} ONLINE = false; $$("a[href='/feed.xml'],a[href='/podcast.xml'],a[href='/agenda.ics']").forEach(a => a.href = "https://axon.m3d.pro" + a.getAttribute("href")); }
    const byD = (a, b) => (b.date || "").localeCompare(a.date || ""); D.news.sort(byD); D.media.sort(byD); D.episodes.sort(byD); D.events.sort((a, b) => (a.start || "").localeCompare(b.start || ""));
    renderNews(); renderRoadmap(); renderAgenda(); renderPodcast(); renderGallery(); wireForms(); stats();
    if (/^#n-/.test(location.hash)) openNews(location.hash.slice(3));
  }
  boot();
})();
