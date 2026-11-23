/* axon · atlasui.js — janela "Atlas de pontos": 361 acupontos + extras (3D), craniopuntura (YNSA + linhas MS1–MS14)
 * e aurículo (GB/T 13734-2008), com ficha de cada ponto: localização, anatomia calculada na malha, segurança e literatura. */
(function (g) {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (x, d = 0) => x == null ? "—" : (+x).toFixed(d).replace(".", ",");
  const TG = { lit: ["LITERATURA", "t-lit"], pre: ["PREMISSA", "t-pre"], der: ["DERIVADO", "t-der"], hip: ["HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO", "t-hip"] };
  const tag = k => `<span class="tag ${TG[k][1]}">${TG[k][0]}</span>`;
  const DD = () => g.AxonAcuData, AC = () => g.AxonAcu;
  const W = { tab: "acu", q: "", mer: null, sel: null, side: "D", ynsa: null, ms: null, aur: null };
  const REFS = [
    "WHO Western Pacific Region. WHO Standard Acupuncture Point Locations in the Western Pacific Region. Manila: WHO; 2008.",
    "World Health Organization. A proposed standard international acupuncture nomenclature: report of a WHO scientific group. Geneva: WHO; 1991 (inclui as linhas de craniopuntura MS1–MS14).",
    "Yamamoto T, Yamamoto H, Yamamoto MM. Yamamoto New Scalp Acupuncture: YNSA. Miyazaki: Yamamoto Publishing; 2010.",
    "Feely RA. Yamamoto New Scalp Acupuncture: Principles and Practice. 2nd ed. Stuttgart: Thieme; 2011.",
    "Standardization Administration of China. GB/T 13734-2008: Nomenclature and location of auricular points. Beijing; 2008.",
    "Peuker ET, Filler TJ. The nerve supply of the human auricle. Clin Anat. 2002;15(1):35-7.",
    "Oleson T. Auriculotherapy Manual: Chinese and Western Systems of Ear Acupuncture. 3rd ed. Edinburgh: Churchill Livingstone; 2003.",
    "Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K. BodyParts3D: 3D structure database for anatomical concepts. Nucleic Acids Res. 2009;37:D782-5 (malha usada no posicionamento).",
  ];

  // ------------------------------------------------------------------ acupuntura
  function acuTab(b) {
    const D = DD(), S = AC().S, ready = AC().ready, q = W.q.trim().toLowerCase();
    const rows = []; Object.entries(D.M).forEach(([mk, m]) => { if (W.mer && W.mer !== mk) return; m.p.forEach(r => { if (q && !(r[0] + " " + r[1] + " " + r[2]).toLowerCase().includes(q)) return; rows.push([mk, ...r]); }); });
    b.innerHTML = `<div class="card"><div class="row" style="gap:6px;flex-wrap:wrap;align-items:center">
        ${ready ? `<label class="rowc"><input type="checkbox" id="atShow" ${S.show ? "checked" : ""}> pontos no corpo</label><span class="note">${S.pts.length} pontos (${D.count()} clássicos) posicionados</span>`
          : `<button class="btn" id="atBuild">Posicionar os ${D.count()} pontos no corpo</button><span class="note">calcula na malha do paciente atual (~5–30 s)</span>`}
        <input id="atQ" type="search" placeholder="buscar: código, pinyin, região…" value="${esc(W.q)}" style="flex:1;min-width:160px"></div>
        <div class="merchips">${Object.entries(D.M).map(([k, m]) => `<button data-m="${k}" class="${W.mer === k ? "on" : ""} ${S.mer[k] === false ? "off" : ""}" style="--c:${m.col}" title="${esc(m.n)} (${m.p.length}) · clique filtra a lista · duplo clique liga/desliga no corpo">${k}<small>${m.p.length}</small></button>`).join("")}</div></div>
      <div class="atgrid"><div class="atlist">${rows.slice(0, 420).map(([mk, id, py, loc]) => `<button class="atrow ${W.sel === id ? "on" : ""}" data-id="${id}"><i style="background:${D.M[mk].col}"></i><b>${id}</b> ${esc(py)}<small>${esc(loc)}</small></button>`).join("") || `<p class="note">Nenhum ponto.</p>`}</div>
      <div class="atdet" id="atDet">${W.sel ? detail(W.sel) : `<p class="note">Escolha um ponto para ver localização, anatomia calculada, segurança e literatura.</p>`}</div></div>
      <p class="note">${tag("lit")} códigos, nomes e descrições (OMS 2008, resumidas). ${tag("pre")} posição 3D por proporção (cun) a partir de marcos ósseos da malha. ${tag("der")} dermátomo, nervo, músculo, osso e profundidades calculados na malha (didáticos, não substituem palpação).</p>`;
    const bb = $("#atBuild", b); if (bb) bb.onclick = async () => { bb.disabled = true; try { await AC().build(); AC().setShow(true); } catch (e) { bb.textContent = "Erro: " + e.message; } acuTab(b); };
    const sh = $("#atShow", b); if (sh) sh.onchange = e => AC().setShow(e.target.checked);
    $("#atQ", b).oninput = e => { W.q = e.target.value; clearTimeout(W.t); W.t = setTimeout(() => { acuTab(b); const i = $("#atQ", b); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 180); };
    $$(".merchips button", b).forEach(x => { x.onclick = () => { W.mer = W.mer === x.dataset.m ? null : x.dataset.m; acuTab(b); };
      x.ondblclick = () => { const k = x.dataset.m; S.mer[k] = S.mer[k] === false; AC().applyFilter(); acuTab(b); }; });
    $$(".atrow", b).forEach(x => x.onclick = () => { W.sel = x.dataset.id; if (AC().ready) AC().select(W.sel); acuTab(b); });
    wireDet(b);
  }
  function detail(id) {
    const D = DD(), e = AC().S.byId[id]; let row, mk; Object.entries(D.M).forEach(([k, m]) => m.p.forEach(r => { if (r[0] === id) { row = r; mk = k; } }));
    if (!row) return ""; const m = D.M[mk], sides = e ? Object.keys(e.sides) : [], sd = sides.includes(W.side) ? W.side : sides[0], p = e && sd ? e.sides[sd][0] : null;
    const safe = Object.keys(D.SAFETY).filter(s => D.SAFETY[s].includes(id));
    return `<div class="atd-h"><span class="mdot" style="background:${m.col}"></span><b>${id} · ${esc(row[1])}</b><small>${esc(m.n)} (${esc(m.en)})</small></div>
      <p><b>Localização:</b> ${esc(row[2])} ${tag("lit")}</p>
      ${sides.length > 1 ? `<div class="seg mini">${sides.map(s => `<button data-sd="${s}" class="${s === sd ? "on" : ""}">${{ D: "direito", E: "esquerdo", M: "linha média" }[s]}</button>`).join("")}</div>` : ""}
      ${p ? `<table class="tbl"><tr><td>Dermátomo</td><td><b>${esc(p.derm || "—")}</b> ${tag("der")}</td></tr>
        <tr><td>Nervo modelado mais próximo</td><td>${esc(String(p.nerve || "—").replace(/ right$/, " (D)").replace(/ left$/, " (E)"))} · ${fmt(p.distNerve)} mm</td></tr>
        <tr><td>Músculo subjacente</td><td>${esc(p.muscle || "—")} · ${fmt(p.depthMuscle)} mm da superfície</td></tr>
        <tr><td>Osso mais próximo</td><td>${esc(p.bone || "—")} · ${fmt(p.depthBone)} mm</td></tr>
        <tr><td>Coordenada (malha)</td><td class="mono">${p.p.toArray().map(x => fmt(x * 1000)).join(" · ")} mm</td></tr></table>` : `<p class="note">${AC().ready ? "Sem posição calculada para este ponto." : "Posicione os pontos para ver a anatomia calculada."}</p>`}
      ${safe.length ? `<div class="warnbox">${safe.map(s => `<p>⚠ ${esc(D.SAFE_TXT[s])}</p>`).join("")}</div>` : ""}
      <div class="row" style="gap:6px;flex-wrap:wrap">${p ? `<button class="btn" data-a="show">Mostrar no corpo</button><button class="btn ghost" data-a="apply">Aplicar instrumento aqui</button>` : ""}<button class="btn ghost" data-a="note">Anotar</button></div>
      <p class="note">Especificação de posicionamento: <span class="mono">${esc(row[3])}</span> ${tag("pre")}</p>`;
  }
  function wireDet(b) {
    const box = $("#atDet", b); if (!box) return;
    $$("[data-sd]", box).forEach(x => x.onclick = () => { W.side = x.dataset.sd; box.innerHTML = detail(W.sel); wireDet(b); });
    $$("[data-a]", box).forEach(x => x.onclick = () => {
      const e = AC().S.byId[W.sel], sd = e && (e.sides[W.side] ? W.side : Object.keys(e.sides)[0]), p = e && e.sides[sd] && e.sides[sd][0];
      if (x.dataset.a === "show") { AC().setShow(true); AC().select(W.sel); }
      if (x.dataset.a === "apply" && p && g.AxonInteract) g.AxonInteract.applyAt({ point: p.p.toArray(), normal: p.n ? p.n.toArray() : null, code: p.derm, name: `${W.sel} (${sd})`, source: "atlas" });
      if (x.dataset.a === "note" && g.AxonNotes) g.AxonNotes.add({ title: `${W.sel} · ${e ? e.py : ""}`, text: `${e ? e.loc : ""}${p ? ` — dermátomo ${p.derm}, ${p.muscle || ""}` : ""}`, kind: "ponto", method: "acupuntura" });
    });
  }

  // ------------------------------------------------------------------ craniopuntura
  function headSVG(view) {
    const pts = DD().YNSA.filter(p => p.v === (view === "frente" ? "f" : "p"));
    const face = view === "frente"
      ? `<ellipse cx="130" cy="160" rx="100" ry="128" fill="#f2c8b4" stroke="#b8735a" stroke-width="2.5"/><path d="M34 140C40 62 96 30 130 30C164 30 220 62 226 140C206 98 170 86 130 88C90 86 54 98 34 140Z" fill="#5a3b2b" opacity=".85"/>
         <path d="M96 150q14-8 28 0M136 150q14-8 28 0" stroke="#7a4b38" stroke-width="3" fill="none"/><ellipse cx="110" cy="166" rx="9" ry="5" fill="#fff"/><ellipse cx="150" cy="166" rx="9" ry="5" fill="#fff"/><circle cx="110" cy="166" r="3.5" fill="#3b2a20"/><circle cx="150" cy="166" r="3.5" fill="#3b2a20"/>
         <path d="M130 172v26M118 222q12 8 24 0" stroke="#a9654d" stroke-width="2.5" fill="none"/><line x1="130" y1="30" x2="130" y2="96" stroke="#fff" stroke-dasharray="3 3" opacity=".5"/><text x="134" y="104" class="zl">linha do cabelo</text>`
      : `<path d="M60 70C90 20 190 18 220 80C236 120 232 170 214 206C204 226 198 252 182 272C160 296 120 296 96 284C84 250 80 222 64 206C44 186 40 150 46 120C48 100 52 84 60 70Z" fill="#f2c8b4" stroke="#b8735a" stroke-width="2.5"/>
         <path d="M60 70C90 20 190 18 220 80C228 100 230 120 228 150C210 120 170 96 120 96C92 96 72 104 52 118C50 100 54 84 60 70Z" fill="#5a3b2b" opacity=".85"/>
         <path d="M168 150c12-10 30-6 34 10c4 16-4 30-16 34c-10 4-16-2-18-10c-2-10 6-14 4-22z" fill="#e8b49f" stroke="#a9654d" stroke-width="2"/><text x="40" y="250" class="zl">← face</text>`;
    const col = { "básico": "#ffd166", "A1–A7": "#ffe3a3", "D1–D6": "#ffe3a3", "E1–E12": "#ffe3a3", "G1–G3": "#ffd166", "básico (adicional)": "#ffb36b", sensorial: "#7fe3ff", cerebral: "#c99bff", "pontos Y": "#9be37a" };
    return `<svg viewBox="0 0 260 300" class="map" role="img" aria-label="YNSA, vista ${view}">${face}
      ${pts.map(p => { const r = /^[A-I]$|^G\d$/.test(p.id) ? 5.5 : 3.4; return `<g class="pt ${W.ynsa === p.id ? "on" : ""} ${p.hip ? "hip" : ""}" data-y="${esc(p.id)}" tabindex="0"><circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${col[p.g] || "#fff"}" stroke="#3b2a20" stroke-width=".8"/>${r > 4 || W.ynsa === p.id ? `<text x="${p.x + 6}" y="${p.y - 4}" class="ptl">${esc(p.id)}</text>` : ""}</g>`; }).join("")}</svg>`;
  }
  function scalpTab(b) {
    const D = DD(), y = D.YNSA.find(p => p.id === W.ynsa), groups = [...new Set(D.YNSA.map(p => p.g))];
    b.innerHTML = `<div class="card"><h4>YNSA — craniopuntura de Yamamoto (${D.YNSA.length} pontos, zona yin)</h4>
      <div class="atgrid2"><div>${headSVG("frente")}<p class="note">vista frontal</p></div><div>${headSVG("perfil")}<p class="note">perfil direito</p></div></div>
      ${y ? `<div class="detail"><b>${esc(y.n)}</b> <small>${esc(y.g)}</small><br>${esc(y.d)} ${tag(y.hip ? "hip" : "lit")}</div>` : `<p class="note">Clique num ponto. A zona yang espelha os mesmos pontos na região occipital.</p>`}
      ${groups.map(gr => `<div class="grp"><b>${esc(gr)}</b> ${D.YNSA.filter(p => p.g === gr).map(p => `<button class="chip ${W.ynsa === p.id ? "on" : ""}" data-y="${esc(p.id)}">${esc(p.id)}</button>`).join("")}</div>`).join("")}
      <p class="note">${tag("lit")} Yamamoto 2010; Feely 2011. ${tag("pre")} posições no desenho aproximadas. ${tag("hip")} pontos Y, cerebrais e adicionais: evidência baixa ou em investigação.</p></div>
      <div class="card"><h4>Padrão internacional de craniopuntura (OMS): 14 linhas</h4>
      <label class="rowc"><input type="checkbox" id="msShow" ${AC().S.showMS ? "checked" : ""} ${AC().ready ? "" : "disabled"}> mostrar as linhas sobre o crânio 3D ${AC().ready ? "" : "(posicione os pontos na aba Acupuntura)"}</label>
      <table class="tbl">${D.MS.map(([c, py, n, def, use]) => `<tr data-ms="${c}" class="${W.ms === c ? "on" : ""}"><td><b>${c}</b><br><small>${esc(py)}</small></td><td>${esc(n)}<br><small>${esc(def.filter(t => t[0] !== "@").join(" → "))}${def.some(t => t[0] === "@") ? " · " + esc(def.filter(t => t[0] === "@").join(", ").replace(/@/g, "")) + " cun" : ""}</small></td><td><small>${esc(use)}</small></td></tr>`).join("")}</table>
      <p class="note">${tag("lit")} OMS 1991. As linhas são traçadas entre os acupontos posicionados na malha ${tag("pre")}.</p></div>`;
    $$("[data-y]", b).forEach(x => x.onclick = () => { W.ynsa = x.dataset.y; scalpTab(b); });
    const ms = $("#msShow", b); if (ms) ms.onchange = e => { AC().setMS(e.target.checked); if (e.target.checked) g.AxonStage.ext().focusOn([0, 1.6, 0], [0, .5, 1], .4); };
    $$("tr[data-ms]", b).forEach(x => x.onclick = () => { W.ms = x.dataset.ms; const G = AC().S.msLines; if (G) G.children.forEach(t => t.material.color.set(t.userData.ms === W.ms ? 0xffd166 : 0x3ee6c5)); scalpTab(b); });
  }

  // ------------------------------------------------------------------ aurículo
  function earSVG() {
    const D = DD(), A = D.AUR.filter(p => p.face === "lat");
    const col = id => /^HX/.test(id) ? "#ffb36b" : /^SF/.test(id) ? "#7fe3ff" : /^AH/.test(id) ? "#ffd166" : /^TF/.test(id) ? "#c99bff" : /^TG/.test(id) ? "#ff9ec4" : /^AT/.test(id) ? "#9be37a" : /^CO/.test(id) ? "#5ed6a0" : "#ffe3d6";
    return `<svg viewBox="0 0 300 420" class="map ear" role="img" aria-label="Orelha direita, face lateral, pontos GB/T 13734-2008">
      <defs><radialGradient id="eg2" cx=".45" cy=".42"><stop offset="0" stop-color="#f7d6c4"/><stop offset="1" stop-color="#e0a58b"/></radialGradient></defs>
      <path d="M104 176C94 140 104 86 140 52C170 22 220 18 250 52C276 84 274 150 266 210C260 254 250 280 238 300C226 330 214 372 180 392C150 406 120 394 112 364C106 340 110 314 104 290C100 276 82 270 66 254C56 238 58 206 66 194C78 182 92 180 104 176Z" fill="url(#eg2)" stroke="#a9654d" stroke-width="3"/>
      <path d="M118 176C114 130 132 74 170 56C204 42 240 58 250 92C258 130 252 200 240 250C232 278 222 292 212 300" fill="none" stroke="#c98a70" stroke-width="10" opacity=".55" stroke-linecap="round"/>
      <path d="M140 56C176 64 196 100 200 150C204 200 198 236 186 262" fill="none" stroke="#b9775d" stroke-width="12" opacity=".5" stroke-linecap="round"/>
      <path d="M198 92C178 98 150 110 128 120" fill="none" stroke="#b9775d" stroke-width="10" opacity=".5" stroke-linecap="round"/>
      <path d="M130 120C146 102 170 92 192 92C190 104 176 116 160 120Z" fill="#f2cbb7" opacity=".7"/>
      <path d="M116 132C140 128 170 130 186 140C192 160 184 176 176 180C150 176 126 172 104 178C106 160 110 144 116 132Z" fill="#e9b79f" opacity=".75"/>
      <path d="M100 186C130 182 162 184 182 190C190 220 184 250 170 262C146 270 120 266 104 252C96 236 96 206 100 186Z" fill="#dea48b" opacity=".75"/>
      <path d="M100 180C120 178 140 180 158 186" fill="none" stroke="#a9654d" stroke-width="7" stroke-linecap="round" opacity=".75"/>
      <path d="M66 196C78 188 92 190 96 206C98 226 94 246 84 258C74 254 64 240 64 222Z" fill="#e7b39b" stroke="#a9654d" stroke-width="2"/>
      <path d="M122 268C140 260 166 258 186 266C184 284 168 296 148 296C134 294 124 284 122 268Z" fill="#e7b39b" stroke="#a9654d" stroke-width="2"/>
      <path d="M112 300C150 300 196 300 214 304M114 328H206M116 354H196" stroke="#a9654d" stroke-width="1" opacity=".4"/><path d="M140 300V390M168 300V390" stroke="#a9654d" stroke-width="1" opacity=".4"/>
      <ellipse cx="148" cy="152" rx="40" ry="22" fill="none" stroke="#1aa48a" stroke-width="2" stroke-dasharray="4 3"/><text x="192" y="132" class="zl" fill="#0b7a64">cymba · ABVN 100 %</text><text x="146" y="250" class="zl" fill="#0b7a64">cavum · ABVN 45 %</text>
      ${A.map(p => `<g class="pt ${W.aur === p.id ? "on" : ""} ${p.nada ? "nada" : ""}" data-a="${esc(p.id)}" tabindex="0"><circle cx="${p.x}" cy="${p.y}" r="${W.aur === p.id ? 6 : 4}" fill="${col(p.id)}" stroke="#3b2a20" stroke-width=".8"/>${W.aur === p.id ? `<text x="${p.x + 7}" y="${p.y - 5}" class="ptl">${esc(p.id)} ${esc(p.n)}</text>` : ""}</g>`).join("")}
    </svg>`;
  }
  function earTab(b) {
    const D = DD(), p = D.AUR.find(x => x.id === W.aur), Z = { HX: "Hélice", SF: "Escafa", AH: "Anti-hélice", TF: "Fossa triangular", TG: "Trago", AT: "Antitrago", CO: "Concha", LO: "Lóbulo", P: "Face posterior", R: "Raiz da orelha" };
    b.innerHTML = `<div class="card"><h4>Aurículo — GB/T 13734-2008 (${D.AUR.length} pontos)</h4><div class="atgrid">
      <div>${earSVG()}</div><div>${p ? `<div class="detail"><b>${esc(p.id)} · ${esc(p.n)}</b> <small>${esc(p.py)}</small><br>Área: ${esc(p.z)}<br>
        Inervação pelo ramo auricular do vago: <b>${p.abvn ? p.abvn + " % das orelhas" : "não predominante (ramos auriculotemporal, auricular magno, occipital menor)"}</b> ${tag("lit")}${p.nada ? `<br>Faz parte do protocolo NADA (5 pontos) ${tag("lit")}` : ""}
        <div class="row" style="gap:6px;margin-top:6px"><button class="btn ghost" data-act="apply">Aplicar instrumento na orelha</button><button class="btn ghost" data-act="note">Anotar</button></div></div>` : `<p class="note">Clique num ponto do desenho ou da lista.</p>`}
      ${Object.entries(Z).map(([k, n]) => { const L2 = D.AUR.filter(x => (k === "P" ? /^P[S\d]/.test(x.id) : k === "R" ? /^R\d/.test(x.id) : x.id.startsWith(k))); return L2.length ? `<div class="grp"><b>${n}</b> ${L2.map(x => `<button class="chip ${W.aur === x.id ? "on" : ""}" data-a="${esc(x.id)}" title="${esc(x.n)}">${esc(x.id)}</button>`).join("")}</div>` : ""; }).join("")}</div></div>
      <p class="note">${tag("lit")} nomes, códigos e áreas (GB/T 13734-2008); inervação (Peuker & Filler 2002). ${tag("pre")} posições no desenho aproximadas; pontos da face posterior e da raiz listados sem desenho.</p></div>`;
    $$("[data-a]", b).forEach(x => x.onclick = () => { W.aur = x.dataset.a; earTab(b); });
    const ap = $("[data-act=apply]", b); if (ap) ap.onclick = () => { const st = g.AxonStage, rp = st.reflexPoints().find(r => r.cat === "aur"); if (rp && g.AxonInteract) g.AxonInteract.applyAt({ point: rp.p, normal: rp.n, code: "C2", name: `${p.id} ${p.n} (orelha)`, source: "atlas", ear: true }); };
    const nt = $("[data-act=note]", b); if (nt) nt.onclick = () => g.AxonNotes && g.AxonNotes.add({ title: `${p.id} · ${p.n}`, text: `${p.z}; ABVN ${p.abvn} %`, kind: "ponto", method: "aurículo" });
  }

  function win(b) {
    b.innerHTML = `<div class="seg mtabs">${[["acu", "Acupuntura (361 + extras)"], ["scalp", "Craniopuntura"], ["ear", "Aurículo"], ["refs", "Referências"]].map(([k, l]) => `<button data-t="${k}" class="${W.tab === k ? "on" : ""}">${l}</button>`).join("")}</div><div id="atBody"></div>`;
    $$(".mtabs button", b).forEach(x => x.onclick = () => { W.tab = x.dataset.t; win(b); });
    const body = $("#atBody", b);
    if (W.tab === "acu") acuTab(body); else if (W.tab === "scalp") scalpTab(body); else if (W.tab === "ear") earTab(body);
    else body.innerHTML = `<div class="card"><ol class="refs">${REFS.map(r => `<li>${esc(r)}</li>`).join("")}</ol></div>`;
  }
  function boot() { const A = g.AxonApp; if (!A || !A.registerApp || !g.AxonAcuData) return setTimeout(boot, 80);
    A.registerApp("atlas", { title: "atlas", w: 720, h: 800, render: win });
    document.addEventListener("axon:acupoint", e => { W.sel = e.detail.id; W.tab = "acu"; if (A.isOpen("atlas")) win(A.body("atlas")); });
  }
  boot();
  g.AxonAtlas = { W, open: (tab, sel) => { if (tab) W.tab = tab; if (sel) W.sel = sel; const A = g.AxonApp; if (A.isOpen("atlas")) win(A.body("atlas")); else A.openApp("atlas"); } };
})(window);
