/* axon · admin.js — painel da coordenação: assistente de IA (propostas revisáveis), notícias, agenda, linha do tempo,
   mídia (envio de fotos, vídeos e documentos), podcast (roteiro → voz → liberação), newsletter e apoio.
   Autenticação: ADMIN_TOKEN do servidor, guardado só nesta aba (sessionStorage). */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const app = $("#app"); let TOKEN = sessionStorage.getItem("axon.admin") || "", D = null, tab = "ia", editing = null, proposal = null;
  const COLS = {
    news: { label: "Notícias", fields: [["title", "Título"], ["summary", "Resumo (2 frases)", "area"], ["body", "Texto (parágrafos; **negrito**; listas com - )", "big"], ["category", "Categoria", ["novidade", "atualizacao", "publicacao", "evento", "bastidores"]], ["date", "Data", "date"], ["image", "Imagem (caminho, ex.: img/app/sim-st36.jpg, ou id de mídia me-…)"], ["tags", "Tags (separadas por vírgula)", "tags"]] },
    events: { label: "Agenda", fields: [["title", "Título"], ["kind", "Tipo", ["evento", "atividade", "prazo", "reuniao", "apresentacao"]], ["start", "Início", "datetime-local"], ["end", "Fim", "datetime-local"], ["location", "Local"], ["link", "Link"], ["description", "Descrição", "area"]] },
    timeline: { label: "Linha do tempo", fields: [["title", "Título"], ["date", "Data", "date"], ["track", "Trilha", ["in-silico", "vinculado"]], ["state", "Situação", ["feito", "agora", "previsto"]], ["phase", "Fase"], ["description", "Descrição", "area"]] },
    media: { label: "Mídia", fields: [["title", "Título"], ["caption", "Legenda", "area"], ["category", "Seção", ["galeria", "registro", "imprensa"]], ["kind", "Tipo", ["foto", "video", "documento", "audio"]], ["date", "Data", "date"]] },
    episodes: { label: "Podcast", fields: [["title", "Título"], ["summary", "Resumo", "area"], ["script", "Roteiro falado", "big"], ["date", "Data de liberação", "date"]] },
  };
  const QUICK = [
    "Escreva uma notícia sobre a versão mais recente do simulador, com base nas notas de versão, e deixe em rascunho.",
    "Crie um episódio de podcast de 3 minutos resumindo o roadmap in silico e o que mudou no escopo (projeto vinculado).",
    "Adicione à agenda: apresentação na XIV Semana da Física — preencha só o que eu informar e pergunte o resto na mensagem.",
    "Publique todos os rascunhos de notícias revisados hoje.",
    "Atualize a linha do tempo marcando como feito o marco da submissão à Semana da Física.",
  ];
  const toast = m => { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, 3200); };
  async function api(path, opt = {}) {
    const r = await fetch("api/portal/admin/" + path, { ...opt, headers: { Authorization: "Bearer " + TOKEN, ...(opt.json ? { "content-type": "application/json" } : {}), ...(opt.headers || {}) }, body: opt.json ? JSON.stringify(opt.json) : opt.body });
    if (r.status === 401) { logout("Token inválido."); throw new Error("401"); }
    const ct = r.headers.get("content-type") || ""; const j = ct.includes("json") ? await r.json() : await r.text();
    if (!r.ok) throw new Error(j.detail || j || r.status); return j;
  }
  function logout(msg) { TOKEN = ""; sessionStorage.removeItem("axon.admin"); $("#logout").hidden = true; login(msg); }
  $("#logout").onclick = () => logout();

  function login(msg) {
    app.innerHTML = `<div class="card login"><h2>Área da coordenação</h2><p class="fine">Entre com o token de administrador do servidor (<code>ADMIN_TOKEN</code> no <code>.env</code> da VPS). Ele fica guardado só nesta aba.</p>
      <form id="lf"><label class="fld"><span>Token</span><input type="password" name="t" autocomplete="current-password" required></label><button class="btn pri">Entrar</button><p class="msg err">${esc(msg || "")}</p></form></div>`;
    $("#lf").onsubmit = async e => { e.preventDefault(); TOKEN = e.target.t.value.trim(); try { await load(); sessionStorage.setItem("axon.admin", TOKEN); $("#logout").hidden = false; render(); } catch (err) { if (err.message !== "401") login(err.message); } };
  }
  async function load() { D = await api("all"); }

  function render() {
    const cnt = { news: D.news.length, events: D.events.length, timeline: D.timeline.length, media: D.media.length, episodes: D.episodes.length, tickets: D.tickets.filter(t => t.state !== "fechado").length };
    const T = [["ia", "Assistente IA"], ["news", "Notícias"], ["events", "Agenda"], ["timeline", "Linha do tempo"], ["media", "Mídia"], ["episodes", "Podcast"], ["newsletter", "Newsletter"], ["tickets", "Apoio"], ["log", "Histórico"]];
    app.innerHTML = `<div class="tabs" role="tablist">${T.map(([k, l]) => `<button role="tab" class="${k === tab ? "on" : ""}" data-t="${k}">${l}${cnt[k] != null ? `<span class="n">${cnt[k]}</span>` : ""}</button>`).join("")}</div><div class="pane" id="pane"></div>`;
    $$(".tabs button").forEach(b => b.onclick = () => { tab = b.dataset.t; editing = null; render(); });
    const p = $("#pane");
    if (tab === "ia") paneAI(p); else if (COLS[tab]) paneCol(p, tab); else if (tab === "newsletter") paneNL(p); else if (tab === "tickets") paneTickets(p); else paneLog(p);
  }

  // ------------------------------------------------------------ assistente de IA
  function paneAI(p) {
    const aiOk = D.ai && D.ai.configured ? D.ai.configured.length : null;
    p.innerHTML = `<div class="card ai"><h3>Peça em linguagem natural</h3>
      <p class="fine">A IA propõe as alterações; nada muda até você revisar e clicar em <b>Aplicar</b>. Itens novos entram como rascunho. Ela não inventa resultados, datas nem nomes: o que faltar, ela pergunta.${aiOk === 0 ? " <b>Nenhuma chave de IA configurada no servidor.</b>" : ""}</p>
      <textarea id="prompt" placeholder="Ex.: Publique uma notícia sobre o novo mapa de pontos reflexos e crie um evento para a defesa do projeto no dia 12/03 às 14h, sala 5 do Ibilce."></textarea>
      <details><summary>Material de referência (opcional): cole aqui o texto que a IA deve resumir</summary><textarea id="material" placeholder="Trecho de relatório, resumo de artigo, ata de reunião…"></textarea></details>
      <div class="quick">${QUICK.map(q => `<button data-q="${esc(q)}">${esc(q.slice(0, 64))}…</button>`).join("")}</div>
      <div><button class="btn pri" id="ask">Gerar proposta</button> <span class="fine" id="aiSt"></span></div></div><div id="prop"></div>`;
    $$(".quick button").forEach(b => b.onclick = () => { $("#prompt").value = b.dataset.q; $("#prompt").focus(); });
    $("#ask").onclick = async () => {
      const prompt = $("#prompt").value.trim(); if (!prompt) return; $("#aiSt").textContent = "consultando a IA…"; $("#ask").disabled = true;
      const prog = window.AXON_PROGRAMA ? JSON.stringify({ estado: AXON_PROGRAMA.conteudo.estado, fases: Object.values(AXON_PROGRAMA.fases).map(f => ({ codigo: f.codigo, nome: f.nome, trilha: f.trilha, estado: f.estado, descricao: f.descricao })), metricas: AXON_PROGRAMA.metricas }) : "";
      try { proposal = await api("assist", { method: "POST", json: { prompt, material: ($("#material").value + "\n\n" + prog).slice(0, 12000) } }); $("#aiSt").textContent = proposal.provider ? "via " + proposal.provider : proposal.mode; showProposal(); }
      catch (e) { $("#aiSt").textContent = "erro: " + e.message; } finally { $("#ask").disabled = false; }
    };
    if (proposal) showProposal();
  }
  function showProposal() {
    const box = $("#prop"); if (!box) return; const P = proposal;
    const find = (c, id) => (D[c] || []).find(x => x.id === id);
    box.innerHTML = `<div class="card ai"><h3>Proposta</h3><p>${esc(P.message)}</p>${P.ops.length ? P.ops.map((o, i) => { const cur = o.id ? find(o.collection, o.id) : null;
      return `<label class="prop"><input type="checkbox" data-i="${i}" ${o.op === "delete" ? "" : "checked"}><div><span class="op ${o.op}">${o.op}</span> <b>${esc(COLS[o.collection].label)}</b> ${cur ? "· " + esc(cur.title) : ""}
        <dl>${Object.entries(o.data || {}).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(Array.isArray(v) ? v.join(", ") : v).slice(0, 1400)}${cur && cur[k] != null && cur[k] !== v ? `<br><small style="color:var(--mute)">antes: ${esc(String(cur[k]).slice(0, 200))}</small>` : ""}</dd>`).join("")}</dl></div></label>`; }).join("")
      + `<div><button class="btn pri" id="applyP">Aplicar selecionadas</button> <button class="btn ghost" id="dropP">Descartar</button></div>` : `<p class="fine">Nenhuma alteração proposta.</p>`}</div>`;
    const ap = $("#applyP"); if (ap) ap.onclick = async () => { const ops = $$("#prop input[data-i]:checked").map(c => P.ops[+c.dataset.i]); if (!ops.length) return;
      if (ops.some(o => o.op === "delete") && !await confirmBox("Há exclusões na seleção. Excluir é definitivo.")) return;
      const r = await api("apply", { method: "POST", json: { ops } }); proposal = null; await load(); toast(`${r.results.filter(x => x.ok).length} alteração(ões) aplicada(s).`); render(); };
    const dp = $("#dropP"); if (dp) dp.onclick = () => { proposal = null; box.innerHTML = ""; };
  }
  function confirmBox(msg) { return new Promise(res => { const d = document.createElement("div"); d.className = "modal"; d.innerHTML = `<div class="sheet" style="max-width:440px"><div class="art"><h3>Confirmar</h3><p>${esc(msg)}</p><button class="btn pri" data-y>Confirmar</button> <button class="btn ghost" data-n>Cancelar</button></div></div>`; document.body.appendChild(d);
    d.onclick = e => { if (e.target.closest("[data-y]")) { d.remove(); res(true); } else if (e.target.closest("[data-n]") || e.target === d) { d.remove(); res(false); } }; }); }

  // ------------------------------------------------------------ coleções (lista + editor)
  const dateOf = x => x.date || (x.start || "").slice(0, 16).replace("T", " ") || "";
  function paneCol(p, col) {
    const C = COLS[col], items = [...D[col]].sort((a, b) => (dateOf(b)).localeCompare(dateOf(a)));
    p.innerHTML = `${col === "media" ? `<label class="drop" id="drop" tabindex="0">Arraste fotos, vídeos (mp4/webm), áudios ou documentos (PDF, TXT, CSV) aqui, ou clique para escolher · até 80 MB<input type="file" id="file" multiple hidden accept="image/*,video/mp4,video/webm,audio/*,application/pdf,text/plain,text/markdown,text/csv"></label>
      <label class="fld" style="max-width:280px"><span>Enviar para a seção</span><select id="upCat"><option value="galeria">Galeria</option><option value="registro">Documentos de registro</option><option value="imprensa">Imprensa</option></select></label>` : ""}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${col !== "media" ? `<button class="btn pri sm" id="new">Novo item</button>` : ""}<span class="fine">Rascunhos não aparecem no site nem nos feeds.</span></div>
      <div id="editor"></div><div class="list">${items.map(x => `<div class="card row"><div><b>${esc(x.title)}</b><div class="meta"><span class="st-pill ${esc(x.status)}">${esc(x.status)}</span>${esc(dateOf(x))}${x.kind ? " · " + esc(x.kind) : ""}${x.category ? " · " + esc(x.category) : ""}${x.track ? " · " + esc(x.track) : ""}${col === "episodes" ? (x.audio ? " · áudio gerado" : " · voz do navegador") : ""}${x.source ? " · origem: " + esc(x.source) : ""}</div></div>
        <div class="acts">${col === "media" && (x.file || x.url) && (x.mime || "").startsWith("image") ? `<img class="thumb" src="${esc(x.url || "api/portal/admin/media/" + x.file)}" alt="" data-auth="${x.file ? 1 : ""}">` : ""}
        ${col === "episodes" ? `<button class="btn ghost sm" data-a="listen" data-id="${esc(x.id)}">Ouvir</button><button class="btn ghost sm" data-a="tts" data-id="${esc(x.id)}">${x.audio ? "Regerar áudio" : "Gerar áudio"}</button>` : ""}
        <button class="btn ghost sm" data-a="edit" data-id="${esc(x.id)}">Editar</button>${x.status === "publicado" ? `<button class="btn ghost sm" data-a="unpublish" data-id="${esc(x.id)}">Despublicar</button>` : `<button class="btn pri sm" data-a="publish" data-id="${esc(x.id)}">${col === "episodes" ? "Liberar na playlist" : "Publicar"}</button>`}<button class="btn ghost sm" data-a="delete" data-id="${esc(x.id)}" aria-label="Excluir">✕</button></div></div>`).join("") || `<div class="empty">Nada aqui ainda.</div>`}</div>`;
    $$("img[data-auth='1']", p).forEach(async im => { try { const r = await fetch(im.getAttribute("src"), { headers: { Authorization: "Bearer " + TOKEN } }); im.src = URL.createObjectURL(await r.blob()); } catch (e) {} });
    const nb = $("#new", p); if (nb) nb.onclick = () => { editing = { col, item: { status: "rascunho" } }; editor(); };
    $$("[data-a]", p).forEach(b => b.onclick = async () => {
      const id = b.dataset.id, it = D[col].find(x => x.id === id), a = b.dataset.a;
      if (a === "edit") { editing = { col, item: { ...it } }; editor(); $("#editor").scrollIntoView({ behavior: "smooth" }); return; }
      if (a === "listen") { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(it.script || it.summary); u.lang = "pt-BR"; speechSynthesis.speak(u); toast("Lendo o roteiro com a voz do navegador."); return; }
      if (a === "tts") { b.disabled = true; b.textContent = "gerando…"; try { const r = await api(`episodes/${id}/tts`, { method: "POST" }); toast(r.ok ? "Áudio gerado." : r.error); await load(); render(); } catch (e) { toast(e.message); } return; }
      if (a === "delete" && !await confirmBox(`Excluir "${it.title}"? Não dá para desfazer.`)) return;
      await api("apply", { method: "POST", json: { ops: [{ op: a, collection: col, id }] } }); await load(); toast("Feito."); render();
    });
    if (col === "media") {
      const dz = $("#drop"), fi = $("#file");
      dz.onclick = () => fi.click(); dz.onkeydown = e => (e.key === "Enter" || e.key === " ") && fi.click();
      dz.ondragover = e => { e.preventDefault(); dz.classList.add("over"); }; dz.ondragleave = () => dz.classList.remove("over");
      dz.ondrop = e => { e.preventDefault(); dz.classList.remove("over"); upload([...e.dataTransfer.files]); }; fi.onchange = () => upload([...fi.files]);
    }
    if (editing && editing.col === col) editor();
  }
  async function upload(files) {
    const cat = $("#upCat").value;
    for (const f of files) {
      toast(`Enviando ${f.name}…`);
      try { await api(`upload?title=${encodeURIComponent(f.name.replace(/\.[^.]+$/, ""))}&category=${cat}`, { method: "POST", body: f, headers: { "content-type": f.type || "application/octet-stream" } }); }
      catch (e) { toast(`${f.name}: ${e.message}`); }
    }
    await load(); toast("Envio concluído — os arquivos estão em rascunho."); render();
  }
  function editor() {
    const box = $("#editor"); if (!box || !editing) return; const { col, item } = editing, C = COLS[col];
    const inp = ([k, l, t]) => { const v = item[k] == null ? "" : item[k];
      if (Array.isArray(t)) return `<label class="fld"><span>${l}</span><select name="${k}">${t.map(o => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select></label>`;
      if (t === "area" || t === "big") return `<label class="fld" style="grid-column:1/-1"><span>${l}</span><textarea name="${k}" rows="${t === "big" ? 10 : 3}">${esc(v)}</textarea></label>`;
      if (t === "tags") return `<label class="fld"><span>${l}</span><input name="${k}" value="${esc((v || []).join(", "))}"></label>`;
      return `<label class="fld"><span>${l}</span><input name="${k}" type="${t || "text"}" value="${esc(t === "datetime-local" ? String(v).slice(0, 16) : v)}"></label>`; };
    box.innerHTML = `<form class="card ed" id="ef"><h3>${item.id ? "Editar" : "Novo"} · ${C.label}</h3><div class="grid">${C.fields.map(inp).join("")}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn pri">Salvar como rascunho</button><button class="btn sec" type="button" id="savePub">Salvar e publicar</button><button class="btn ghost" type="button" id="cancel">Cancelar</button></div></form>`;
    const save = async pub => { const f = $("#ef"), data = {}; C.fields.forEach(([k, , t]) => { let v = f[k].value; if (t === "tags") v = v.split(",").map(s => s.trim()).filter(Boolean); if (v !== "" && v != null) data[k] = v; });
      data.status = pub ? "publicado" : (item.status === "publicado" ? "publicado" : "rascunho");
      await api("apply", { method: "POST", json: { ops: [item.id ? { op: "update", collection: col, id: item.id, data } : { op: "create", collection: col, data }] } }); editing = null; await load(); toast("Salvo."); render(); };
    $("#ef").onsubmit = e => { e.preventDefault(); save(false); }; $("#savePub").onclick = () => save(true); $("#cancel").onclick = () => { editing = null; box.innerHTML = ""; };
  }

  // ------------------------------------------------------------ newsletter
  function paneNL(p) {
    p.innerHTML = `<div class="card ai"><h3>Boletim</h3><p><b>${D.subscribers}</b> inscrito(s). ${D.smtp ? "Envio por e-mail configurado." : "Envio por e-mail <b>não configurado</b> (SMTP_* no .env): exporte a lista ou divulgue o RSS."}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sec sm" id="csv">Exportar inscritos (CSV)</button><button class="btn sec sm" id="draft">Montar rascunho com as novidades dos últimos 30 dias</button></div>
      <label class="fld"><span>Assunto</span><input id="nlS"></label><label class="fld"><span>Conteúdo (HTML simples)</span><textarea id="nlH" rows="12"></textarea></label>
      <label class="fld" style="max-width:360px"><span>Enviar teste para</span><input id="nlT" type="email" placeholder="seu@email"></label>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" id="test" ${D.smtp ? "" : "disabled"}>Enviar teste</button><button class="btn pri" id="send" ${D.smtp ? "" : "disabled"}>Enviar a todos</button></div>
      <p class="fine">Feeds públicos: <a href="/feed.xml">RSS de novidades</a> · <a href="/podcast.xml">RSS do podcast</a> · <a href="/agenda.ics">agenda .ics</a></p></div>`;
    $("#csv").onclick = async () => { const t = await api("subscribers.csv"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], { type: "text/csv" })); a.download = "axon-inscritos.csv"; a.click(); };
    $("#draft").onclick = async () => { const d = await api("newsletter/draft"); $("#nlS").value = d.subject; $("#nlH").value = d.html; };
    const send = async test => { const to = $("#nlT").value; if (test && !to) return toast("Informe o e-mail de teste.");
      if (!test && !await confirmBox(`Enviar "${$("#nlS").value}" para ${D.subscribers} inscrito(s)?`)) return;
      const r = await api("newsletter/send", { method: "POST", json: { subject: $("#nlS").value, html: $("#nlH").value, test_to: test ? to : "" } }); toast(r.ok ? `Enviado para ${r.sent}.` : r.error); };
    $("#test").onclick = () => send(true); $("#send").onclick = () => send(false);
  }
  // ------------------------------------------------------------ apoio
  function paneTickets(p) {
    const t = [...D.tickets].sort((a, b) => b.created.localeCompare(a.created));
    p.innerHTML = t.map(x => `<div class="card ed"><div class="meta" style="display:flex;gap:8px;font-size:12.5px;color:var(--mute)"><b>${esc(x.id)}</b>${esc(x.created.replace("T", " ").slice(0, 16))} · ${esc(x.topic)} · ${esc(x.name || "sem nome")} ${x.email ? `· <a href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : ""}</div>
      <p style="white-space:pre-wrap">${esc(x.message)}</p><div class="grid"><label class="fld"><span>Situação</span><select data-id="${esc(x.id)}" class="tst">${["aberto", "em andamento", "respondido", "fechado"].map(s => `<option ${s === x.state ? "selected" : ""}>${s}</option>`).join("")}</select></label>
      <label class="fld"><span>Notas internas</span><input class="tno" data-id="${esc(x.id)}" value="${esc(x.notes || "")}"></label></div><div><button class="btn sm sec" data-save="${esc(x.id)}">Salvar</button></div></div>`).join("") || `<div class="empty">Nenhuma mensagem de apoio.</div>`;
    $$("[data-save]", p).forEach(b => b.onclick = async () => { const id = b.dataset.save; await api("tickets/" + id, { method: "POST", json: { state: $(`.tst[data-id="${id}"]`).value, notes: $(`.tno[data-id="${id}"]`).value } }); await load(); toast("Atualizado."); });
  }
  function paneLog(p) { p.innerHTML = `<div class="card ed"><h3>Histórico de alterações</h3>${(D.log || []).slice().reverse().map(l => `<div class="fine"><b>${esc(l.at.replace("T", " ").slice(0, 16))}</b> · ${esc(l.actor)} · ${l.ops.map(o => `${o.op} ${o.collection} ${o.id}`).join("; ")}</div>`).join("") || "<p class='fine'>Sem registros.</p>"}</div>`; }

  if (TOKEN) load().then(() => { $("#logout").hidden = false; render(); }).catch(e => e.message !== "401" && login(e.message)); else login();
})();
