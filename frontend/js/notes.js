/* axon · notes.js — notas (post-its), descrição dinâmica de parâmetros, manuscrito / diário de bordo (v0.11)
 *  • Passe o mouse sobre um parâmetro: aparece o que ele é, o que muda quando aumenta e o efeito com o valor atual.
 *  • Clique 3× num parâmetro (ou em qualquer item marcado): vira uma nota do caso clínico ativo.
 *  • Post-its: painel em primeiro plano, minimizável, agrupável por data, caso, método, instrumento, desfecho ou grupo livre;
 *    acompanham o usuário em todas as funções (armazenados no navegador, por usuário).
 *  • Manuscrito: todas as notas e sessões de testes viram um diário de bordo científico (linha do tempo, cálculos, fenômenos,
 *    práticas, desfechos, referências e capturas de tela), exportável em PDF e publicável como link só-leitura com comentários. */
(function (g) {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (x, d = 1) => x == null || !isFinite(x) ? "—" : (+x).toFixed(d).replace(".", ",");
  const A = () => g.AxonApp, KEY = "axon.notes.v1", UKEY = "axon.user.v1";
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast("Armazenamento do navegador cheio: remova capturas antigas."); } };
  const N = { list: load(KEY, []), sessions: load(KEY + ".s", []), user: load(UKEY, null), open: true, min: false, group: "caso", pubs: load(KEY + ".p", []) };
  if (!N.user) { N.user = { id: "u-" + Math.random().toString(36).slice(2, 10), name: "" }; save(UKEY, N.user); }
  const persist = () => { save(KEY, N.list); save(KEY + ".s", N.sessions); save(KEY + ".p", N.pubs); draw(); };
  function ctx() { const cs = g.AxonSim && g.AxonSim.case, W = g.AxonWorkbench && g.AxonWorkbench.WB, st = A() && A().state;
    return { caso: cs ? cs.title : "sem caso", caseId: cs ? cs.id : null, metodo: st ? st.mod : null, instrumento: W && W.instr || null, nivel: g.AxonStage ? g.AxonStage.level : 1 }; }
  function toast(t) { let el = $("#ntToast"); if (!el) { el = document.createElement("div"); el.id = "ntToast"; el.className = "nttoast notr"; document.body.appendChild(el); } el.textContent = t; el.classList.add("on"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), 2600); }
  function add(o) {
    const c = ctx(), n = Object.assign({ id: "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t: Date.now(), title: "Nota", text: "", kind: "nota", grupo: "", img: null, desfecho: "" }, c, o);
    N.list.unshift(n); persist(); toast(`Nota guardada em “${n.caso}”`); N.min = false; draw(); return n;
  }
  function fromInteraction(r) { if (!r) return;
    const cl = r.classes.map(c => `${c.cls} ${fmt(c.frac * 100, 0)} %`).join(", ");
    return add({ title: `${r.tool.toUpperCase()} em ${r.derm || r.name || "ponto"}`, kind: "experimento", metodo: r.mod, instrumento: r.tool, desfecho: r.perception,
      text: `${fmt(r.I, 2)} mA · ${r.f} Hz · ${r.pw} µs → corrente efetiva ${fmt(r.Ieff, 4)} mA a ${fmt(r.dCut, 2)} mm; D* ${isFinite(r.Dstar) ? fmt(r.Dstar, 2) + " µm" : "> 16 µm"}; recrutamento: ${cl}. Sensação prevista: ${r.perception}.`, data: r }); }
  function ingestSession(T) { if (!T || !T.entries.length) return; N.sessions.unshift(JSON.parse(JSON.stringify(T, (k, v) => k === "point" ? undefined : v))); N.sessions = N.sessions.slice(0, 40);
    add({ title: `Sessão de testes ${T.id}`, kind: "sessão", text: `${T.entries.length} interações de ${new Date(T.start).toLocaleTimeString()} a ${new Date(T.end).toLocaleTimeString()}.`, desfecho: summarize(T) }); }
  function summarize(T) { const per = {}; T.entries.forEach(e => per[e.perception] = (per[e.perception] || 0) + 1); return Object.entries(per).map(([k, v]) => `${k}: ${v}`).join(" · "); }

  // ---------------------------------------------------------------- captura de tela do palco 3D
  function capture(maxW = 960) {
    try { const E = g.AxonStage.ext(), r = E.renderer; r.render(E.scene, E.camera); const src = r.domElement, s = Math.min(1, maxW / src.width), c = document.createElement("canvas"); c.width = src.width * s; c.height = src.height * s;
      const x = c.getContext("2d"); x.fillStyle = "#0b161b"; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", .82); } catch (e) { return null; }
  }

  // ---------------------------------------------------------------- descrição dinâmica dos parâmetros
  const DESC = [
    [/intensidade|corrente|\bI\b|mA/i, "Intensidade (corrente)", "Amplitude do pulso. O limiar de cada fibra cai com o diâmetro e sobe com a distância: aumentar a corrente recruta primeiro Aβ (tato, portão), depois Aδ (picada, dor) e, no tronco, Aα (contração).", "lit"],
    [/frequ/i, "Frequência", "Pulsos por segundo. Baixa (2–10 Hz) favorece encefalinas e β-endorfina; alta (80–100 Hz) favorece dinorfina e o portão segmentar; alternar reduz a tolerância (Han 2003).", "lit"],
    [/largura|pulso|µs|pw/i, "Largura de pulso", "Duração de cada pulso. Pulsos mais largos baixam o limiar (relação intensidade–duração) e aumentam a carga por fase, que entra no limite de Shannon.", "lit"],
    [/área|eletrodo/i, "Área do eletrodo", "Área de contato. Maior área espalha a corrente: menor densidade de carga (mais seguro pelo critério de Shannon) e menor fração da corrente chegando a cada ramo cutâneo.", "lit"],
    [/dist[âa]ncia|\br\b|profund/i, "Distância eletrodo–fibra", "Separação até a fibra-alvo. O núcleo verificado vale de 0,3 a 1,5 mm; além disso a atenuação é didática. Quanto mais longe, maior o limiar, sobretudo das fibras finas.", "pre"],
    [/diâmetro|\bD\b|µm/i, "Diâmetro da fibra", "Calibre externo da fibra mielinizada. Fibras grossas têm limiar menor e conduzem mais rápido (≈4,4–6 m/s por µm).", "lit"],
    [/press[ãa]o|kPa/i, "Pressão", "Força por área da sonda. Abaixo do limiar de dor à pressão ativa mecanorreceptores; acima, nociceptores Aδ/C.", "lit"],
    [/ultrass|U\b|mW/i, "Intensidade ultrassônica", "Potência por área. Efeitos térmicos (Pennes) e mecânicos (índice mecânico); neuromodulação em investigação.", "hip"],
    [/tecido adiposo|gordura|fat/i, "Tecido adiposo", "Espessura da hipoderme: afasta o eletrodo da fibra e aumenta o limiar.", "pre"],
    [/desmielin/i, "Desmielinização", "Mielina mais fina: g-ratio maior, condução mais lenta, limiar alterado.", "pre"],
    [/duração|minutos|tempo/i, "Duração", "Tempo de exposição: entra no aquecimento (Pennes) e na dose de cada sessão.", "lit"],
    [/sess/i, "Sessões", "Número de sessões do curso: a analgesia que persiste entre sessões segue a parcela opioide (premissa calibrada).", "pre"],
  ];
  function describe(el) {
    const lab = (el.querySelector("label span, label, h4") || el).textContent.trim(), val = (el.querySelector("output") || {}).textContent || (el.querySelector("input") || {}).value || "";
    const d = DESC.find(([re]) => re.test(lab)); if (!d) return null; const r = g.AxonInteract && g.AxonInteract.result;
    const live = r && /intens|corrente|mA/i.test(lab) ? `Agora: ${fmt(r.Ieff, 4)} mA efetivos → ${r.classes.map(c => `${c.cls} ${fmt(c.frac * 100, 0)} %`).join(", ")} (${r.perception}).` : "";
    return { lab, title: d[1], txt: d[2], tag: d[3], val, live };
  }
  let tip = null, tipT = 0;
  function showTip(el, e) {
    const d = describe(el); if (!d) return; if (!tip) { tip = document.createElement("div"); tip.className = "ptip notr"; document.body.appendChild(tip); }
    tip.innerHTML = `<b>${esc(d.title)}</b>${d.val ? ` · <span class="mono">${esc(d.val)}</span>` : ""}<p>${esc(d.txt)}</p>${d.live ? `<p class="live">${esc(d.live)}</p>` : ""}<small>Clique 3× para anotar · ${d.tag === "lit" ? "LITERATURA" : d.tag === "hip" ? "HIPÓTESE" : "PREMISSA"}</small>`;
    const r = el.getBoundingClientRect(); tip.style.left = Math.min(innerWidth - 330, Math.max(8, r.left - 330)) + "px"; tip.style.top = Math.max(8, r.top) + "px"; tip.classList.add("on");
  }
  document.addEventListener("mouseover", e => { const el = e.target.closest && e.target.closest(".ctl, [data-note]"); clearTimeout(tipT); if (!el) { if (tip) tip.classList.remove("on"); return; } tipT = setTimeout(() => showTip(el, e), 260); });
  document.addEventListener("click", e => {
    if (e.detail !== 3) return; const el = e.target.closest && e.target.closest(".ctl, [data-note], .card h4"); if (!el) return;
    const d = describe(el.closest(".ctl") || el), card = el.closest(".card"), win = el.closest(".win"), wt = win ? (win.querySelector(".wt, .win-title, header") || {}).textContent : "";
    add({ title: d ? `${d.title}: ${d.val}` : (el.textContent || "item").trim().slice(0, 80), kind: "parâmetro", text: d ? `${d.txt}${d.live ? " " + d.live : ""}` : (card ? card.textContent.trim().slice(0, 400) : ""), grupo: wt ? wt.trim().slice(0, 40) : "" });
  });

  // ---------------------------------------------------------------- painel de post-its
  const GROUPS = { data: n => new Date(n.t).toLocaleDateString(), caso: n => n.caso || "sem caso", metodo: n => n.metodo || "—", instrumento: n => n.instrumento || "—", desfecho: n => n.desfecho || "sem desfecho", grupo: n => n.grupo || "sem grupo" };
  const COL = { nota: "#fff3a6", "parâmetro": "#c9f2ff", experimento: "#d8ffd1", "sessão": "#ffd9f0", ponto: "#ffe1c4" };
  function draw() {
    let el = $("#postits"); if (!el) { el = document.createElement("div"); el.id = "postits"; el.className = "postits notr"; document.body.appendChild(el); }
    el.classList.toggle("min", N.min); el.hidden = !N.open;
    if (N.min) { el.innerHTML = `<button class="pi-tab" title="Abrir notas">🗒 ${N.list.length}</button>`; el.firstChild.onclick = () => { N.min = false; draw(); }; return; }
    const by = {}; N.list.forEach(n => { const k = GROUPS[N.group](n); (by[k] = by[k] || []).push(n); });
    el.innerHTML = `<div class="pi-h"><b>Notas</b><select id="piG">${Object.keys(GROUPS).map(k => `<option ${N.group === k ? "selected" : ""} value="${k}">por ${k}</option>`).join("")}</select>
      <button title="Nova nota" data-p="new">＋</button><button title="Nova nota com captura da tela" data-p="shot">📷</button><button title="Manuscrito / diário de bordo" data-p="ms">📖</button><button title="Minimizar" data-p="min">–</button></div>
      <div class="pi-b">${N.list.length ? Object.entries(by).map(([k, ns]) => `<div class="pi-g"><div class="pi-gh">${esc(k)} <small>${ns.length}</small></div>${ns.map(n => `<div class="pi" style="--c:${COL[n.kind] || "#fff3a6"}" data-id="${n.id}">
        <div class="pi-t" contenteditable="true" data-f="title">${esc(n.title)}</div><div class="pi-x" contenteditable="true" data-f="text">${esc(n.text)}</div>${n.img ? `<img src="${n.img}" alt="captura">` : ""}
        <div class="pi-m"><span>${esc(n.kind)} · ${new Date(n.t).toLocaleString()}</span><input data-f="grupo" placeholder="grupo" value="${esc(n.grupo)}"><button data-a="img" title="Anexar captura da tela">📷</button><button data-a="del" title="Apagar">🗑</button></div></div>`).join("")}</div>`).join("")
        : `<p class="note">Clique 3× num parâmetro, use “Anotar” nas janelas ou ＋ para criar notas. Elas acompanham você em todas as funções.</p>`}</div>`;
    $("#piG", el).onchange = e => { N.group = e.target.value; draw(); };
    $$("[data-p]", el).forEach(b => b.onclick = () => { const k = b.dataset.p; if (k === "min") { N.min = true; draw(); } if (k === "new") add({ title: "Nota", text: "" }); if (k === "shot") add({ title: "Captura", text: "", img: capture() }); if (k === "ms") A().openApp("manuscript"); });
    $$(".pi", el).forEach(card => { const n = N.list.find(x => x.id === card.dataset.id);
      $$("[data-f]", card).forEach(f => { const ev = f.tagName === "INPUT" ? "change" : "blur"; f.addEventListener(ev, () => { n[f.dataset.f] = f.tagName === "INPUT" ? f.value : f.textContent; save(KEY, N.list); if (f.dataset.f === "grupo") draw(); }); });
      card.querySelector("[data-a=del]").onclick = () => { N.list = N.list.filter(x => x !== n); persist(); };
      card.querySelector("[data-a=img]").onclick = () => { n.img = capture(); persist(); }; });
  }

  // ---------------------------------------------------------------- manuscrito / diário de bordo
  const REFS = [
    "Teixeira LS. Biofísica da Neuromodulação: Resolução de Fibra Única e Limiares de Segurança Tecidual. Ibilce/UNESP; 2026 (modelo nodal verificado, Anexo G).",
    "Erlanger J, Gasser HS. Electrical Signs of Nervous Activity. 1937; Boyd IA, Kalu KU. J Physiol. 1979;289:277-97 (calibre e velocidade).",
    "Melzack R, Wall PD. Pain mechanisms: a new theory. Science. 1965;150:971-9 (portão).",
    "Han JS. Trends Neurosci. 2003;26:17-22 (frequência e peptídeos opioides).",
    "Shannon RV. A model of safe levels for electrical stimulation. IEEE Trans Biomed Eng. 1992;39:424-6.",
    "WHO. Standard Acupuncture Point Locations in the Western Pacific Region. 2008.",
  ];
  function manuscriptHTML(opts = {}) {
    const user = N.user.name || "Usuário do axon", cases = {}; N.list.forEach(n => (cases[n.caso] = cases[n.caso] || []).push(n));
    const sess = N.sessions; const all = [...N.list].sort((a, b) => a.t - b.t);
    const calc = e => `<li><b>${new Date(e.t).toLocaleTimeString()}</b> · ${esc(e.tool)} ${fmt(e.I, 2)} mA, ${e.f} Hz, ${e.pw} µs em ${esc(e.derm || e.name || "ponto")} (${esc(String(e.nerve).replace(/ right$| left$/, ""))}, ${fmt(e.mm, 0)} mm). Corrente efetiva ${fmt(e.Ieff, 4)} mA a ${fmt(e.dCut, 2)} mm; D* = ${isFinite(e.Dstar) ? fmt(e.Dstar, 2) + " µm" : "> 16 µm"}; ${e.classes.map(c => `${c.cls} ${fmt(c.frac * 100, 0)} %`).join(", ")}; sensação: ${esc(e.perception)}${e.holdS ? `; exposição ${fmt(e.holdS)} s` : ""}.</li>`;
    return `<article class="ms">
      <header><p class="kicker">axon · diário de bordo in silico</p><h1>${esc(opts.title || "Registro das experimentações")}</h1><p class="byline">${esc(user)} · ${new Date().toLocaleDateString()} · ${N.list.length} notas · ${sess.length} sessões de testes</p>
      <p class="disc">Ferramenta de pesquisa, ensino e modelagem in silico (ASME V&V 40 — verificado, não validado). Não é dispositivo médico nem protocolo clínico. Casos fictícios.</p></header>
      <section><h2>1. Resumo</h2><p>Este registro reúne as observações, os cálculos e os desfechos simulados de ${Object.keys(cases).length} caso(s) clínico(s) fictício(s). Cada aplicação de instrumento calculou, para cada classe de fibra, o menor diâmetro recrutado (D*) pelo modelo nodal verificado e a fração recrutada pela distribuição de calibres prevista para o paciente; a sensação foi inferida das frações de Aβ e Aδ.</p></section>
      <section><h2>2. Linha do tempo</h2><ol class="tl">${all.map(n => `<li><time>${new Date(n.t).toLocaleString()}</time><b>${esc(n.title)}</b> <span class="k">${esc(n.kind)} · ${esc(n.caso)}</span><p>${esc(n.text)}</p>${n.img ? `<img src="${n.img}" alt="captura do simulador">` : ""}</li>`).join("") || "<li>Sem notas.</li>"}</ol></section>
      <section><h2>3. Métodos e cálculos</h2><p>Limiar Ith(D, r) = V<sub>th</sub>/h(D, r) (modelo nodal de 41 nós, semente 42); corrente efetiva = I × transmissão × fração que alcança o ramo × atenuação; D* por bissecção em log D; fração recrutada = 1 − Φ((D* − D<sub>med</sub>)/σ). Segurança: densidade de carga pelo critério de Shannon (k &lt; 1,85).</p>
        ${sess.map(T => `<h3>Sessão ${esc(T.id)} · ${esc(T.caseTitle || "sem caso")} · ${new Date(T.start).toLocaleString()}</h3><ul>${T.entries.map(calc).join("")}</ul><p class="k">Desfechos: ${esc(summarize(T))}</p>`).join("") || "<p>Nenhuma sessão de testes registrada.</p>"}</section>
      <section><h2>4. Fenômenos e práticas por caso</h2>${Object.entries(cases).map(([c, ns]) => `<h3>${esc(c)}</h3><ul>${ns.map(n => `<li><b>${esc(n.title)}</b>${n.metodo ? ` (${esc(n.metodo)}${n.instrumento ? ", " + esc(n.instrumento) : ""})` : ""}: ${esc(n.text)}${n.desfecho ? ` — <i>${esc(n.desfecho)}</i>` : ""}</li>`).join("")}</ul>`).join("")}</section>
      <section><h2>5. Limitações</h2><ul>${[...new Set(sess.flatMap(T => T.entries.flatMap(e => e.lim || [])))].map(l => `<li>${esc(l)}</li>`).join("") || "<li>Resultados de modelo; sem validação experimental.</li>"}</ul></section>
      <section><h2>Referências</h2><ol>${REFS.map(r => `<li>${esc(r)}</li>`).join("")}</ol></section></article>`;
  }
  const MS_CSS = `.ms{font:15px/1.65 Georgia,"Times New Roman",serif;color:#1d2a30;max-width:760px;margin:0 auto;padding:28px}.ms h1{font-size:28px;margin:.2em 0}.ms h2{font-size:19px;border-bottom:1px solid #cfd8dc;padding-bottom:4px;margin-top:1.6em}.ms h3{font-size:16px}
    .ms .kicker{font:600 11px system-ui;letter-spacing:.12em;text-transform:uppercase;color:#0b7a64}.ms .byline{color:#557}.ms .disc{font:12px system-ui;background:#fff6e0;padding:8px 10px;border-radius:8px}.ms .tl{padding-left:18px}.ms .tl li{margin:.6em 0}.ms time{font:12px ui-monospace,monospace;color:#577;margin-right:6px}
    .ms .k{font:12px system-ui;color:#5a6b70}.ms img{max-width:100%;border-radius:8px;margin:6px 0}.ms .cm{border-top:1px solid #ddd;margin-top:2em;padding-top:1em}.ms .cm li{margin:.5em 0}@media print{.noprint{display:none}.ms{padding:0}}`;
  function printPDF() {
    const w = window.open("", "_blank"); if (!w) { toast("Permita janelas pop-up para exportar o PDF."); return; }
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>axon · diário de bordo</title><style>${MS_CSS}</style></head><body>${manuscriptHTML()}<p class="noprint" style="text-align:center"><button onclick="print()">Salvar como PDF</button></p><script>setTimeout(()=>print(),400)<\/script></body></html>`); w.document.close();
  }
  async function publish(title) {
    if (!confirm("Publicar cria um link só-leitura que qualquer pessoa com o endereço pode abrir. Confirme que as notas não têm dados que identifiquem pessoas reais.")) return;
    const body = { title: title || "Diário de bordo", author: N.user.name || "Usuário do axon", html: manuscriptHTML({ title }), notes: N.list.length, sessions: N.sessions.length };
    try { const r = await fetch("api/logbook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(r.status);
      const j = await r.json(); N.pubs.unshift({ id: j.id, token: j.token, t: Date.now(), title: body.title }); persist(); toast("Link público criado."); return j; }
    catch (e) { toast("Publicação indisponível sem o servidor (modo offline)."); return null; }
  }
  async function comments(id) { try { const r = await fetch(`api/logbook/${encodeURIComponent(id)}`); if (!r.ok) return []; const j = await r.json(); return j.comments || []; } catch (e) { return []; } }
  function msWin(b) {
    const base = location.origin + location.pathname.replace(/[^/]*$/, "");
    b.innerHTML = `<div class="card"><div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><label>Seu nome (opcional) <input id="msU" value="${esc(N.user.name)}" placeholder="autor"></label>
      <input id="msT" placeholder="título do diário" value="Registro das experimentações" style="flex:1;min-width:180px"><button class="btn" id="msPdf">Exportar PDF</button><button class="btn ghost" id="msPub">Publicar link público</button></div>
      ${N.pubs.length ? `<div class="pubs">${N.pubs.map(p => `<div><a href="${base}diario.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">${esc(p.title)} · ${new Date(p.t).toLocaleString()}</a> <button class="btn ghost sm" data-copy="${base}diario.html?id=${encodeURIComponent(p.id)}">copiar link</button> <button class="btn ghost sm" data-cm="${esc(p.id)}">comentários</button></div>`).join("")}</div><div id="msCm"></div>` : ""}
      <p class="note">Compartilhe o link com outros usuários ou com quem não tem conta: eles leem o diário formatado e podem comentar. Os comentários voltam para cá.</p></div>
      <div class="msview">${manuscriptHTML()}</div>`;
    $("#msU", b).onchange = e => { N.user.name = e.target.value; save(UKEY, N.user); };
    $("#msPdf", b).onclick = printPDF; $("#msPub", b).onclick = async () => { await publish($("#msT", b).value); msWin(b); };
    $$("[data-copy]", b).forEach(x => x.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(x.dataset.copy); toast("Link copiado"); });
    $$("[data-cm]", b).forEach(x => x.onclick = async () => { const cs = await comments(x.dataset.cm); $("#msCm", b).innerHTML = `<ul class="cmlist">${cs.map(c => `<li><b>${c.name}</b> · ${new Date(c.t * 1000).toLocaleString()}<br>${c.text}</li>`).join("") || "<li>Sem comentários ainda.</li>"}</ul>`;   // já escapados no servidor
      const un = s => new DOMParser().parseFromString(`<i>${s}</i>`, "text/html").body.textContent;
      cs.forEach(c => { const cid = x.dataset.cm + ":" + c.id; if (!N.list.some(n => n.cid === cid)) N.list.push({ id: "c" + Date.now().toString(36) + c.id, cid, t: c.t * 1000, title: `Comentário de ${un(c.name)}`, text: un(c.text), kind: "nota", caso: "comentários", grupo: "comentários" }); }); persist(); });
  }
  function boot() { if (!A() || !A().registerApp) return setTimeout(boot, 100); A().registerApp("manuscript", { title: "manuscript", w: 820, h: 820, render: msWin }); const st = document.createElement("style"); st.textContent = MS_CSS.replace(/\.ms/g, ".msview .ms"); document.head.appendChild(st); draw(); }
  boot();
  g.AxonNotes = { N, add, fromInteraction, ingestSession, capture, manuscriptHTML, printPDF, publish, toggle: () => { N.open = !N.open; draw(); }, minimize: m => { N.min = m; draw(); } };
})(window);
