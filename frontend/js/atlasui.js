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
  const W = { tab: "map", q: "", mer: null, sel: null, side: "D", ynsa: null, ms: null, aur: null, view: "F", tech: "acu", cat: null, z: 1, px: 0, py: 0 };
  const R = () => g.AxonAcuRef;
  const doi = d => d ? `<a href="https://doi.org/${esc(d)}" target="_blank" rel="noopener">doi:${esc(d)}</a>` : "";
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
      <div class="ibar" style="position:static;padding:6px 0">${p ? `<button class="ib" data-a="show" data-tip="Mostrar e destacar no corpo 3D">🎯</button><button class="ib" data-a="press" data-tip="Aplicar acupressão neste ponto">👆</button><button class="ib" data-a="ea" data-tip="Aplicar eletroacupuntura neste ponto">📍</button><button class="ib" data-a="apply" data-tip="Aplicar o instrumento escolhido">⚡</button>` : ""}<button class="ib" data-a="note" data-tip="Anotar este ponto nas notas">📝</button></div>
      ${refBlock(id, p)}
      <p class="note">Especificação de posicionamento: <span class="mono">${esc(row[3])}</span> ${tag("pre")}</p>`;
  }
  // indicações, evidência e referências do ponto (acuref.js)
  function refBlock(id, p) {
    if (!R()) return ""; const I = R().info(id, p), N = R().NIVEL;
    const cat = I.cats.length ? `<h5 class="ih" data-tip="Categoria clássica do ponto e a função atribuída a ela pelas fontes clássicas">🏷 Categorias clássicas</h5><ul class="lim">${I.cats.map(c => `<li><b>${esc(c.t)}</b> — ${esc(c.f)} ${tag("lit")}</li>`).join("")}</ul>` : "";
    const reg = I.reg.length ? `<h5 class="ih" data-tip="Uso derivado da anatomia calculada na malha deste paciente">🧭 Uso regional e segmentar</h5><ul class="lim">${I.reg.map(t => `<li>${esc(t)} ${tag("der")}</li>`).join("")}</ul>` : "";
    const ev = `<h5 class="ih" data-tip="Revisões sistemáticas e ensaios conferidos no PubMed; resultado como publicado">🔬 Evidência clínica</h5>${I.ev.length ? I.ev.map(e => { const E = R().EV[e.ev], nv = N[e.nivel] || ["", "t-lit"];
        return `<div class="evc"><b>${esc(e.cond)}</b> <span class="tag ${nv[1]}">${esc(nv[0])}</span><div class="evt">${e.tec.map(t => `<i>${esc(t)}</i>`).join("")}</div><p>${esc(e.res)}</p><small>${esc(E.tipo)} · ${esc(E.ref)} PMID ${esc(E.pmid)} · ${doi(E.doi)}</small></div>`; }).join("")
      : `<p class="note">Sem revisão sistemática ou ensaio específico deste ponto nesta base. As indicações acima vêm das categorias clássicas e da anatomia.</p>`}
      <details class="limd"><summary class="ih" data-tip="Evidência por condição, em que os pontos variam entre os ensaios">ⓘ Evidência por condição (pontos variam)</summary>${R().COND.map(c => { const E = R().EV[c.ev]; return `<div class="evc"><b>${esc(c.cond)}</b><p>${esc(c.res)}</p><small>${esc(E.ref)} PMID ${esc(E.pmid)} · ${doi(E.doi)}</small></div>`; }).join("")}</details>`;
    const pr = `<h5 class="ih" data-tip="Adequação do ponto à acupressão (pressão digital)">👆 Acupressão</h5><p class="${I.press.ok ? "" : "warnbox"}" style="margin:0">${esc(I.press.t)}</p>`;
    const refs = `<h5 class="ih" data-tip="Fontes usadas nesta ficha">📚 Referências deste ponto</h5><ol class="refs small">${[...I.src.map(esc), ...I.evRefs.map(E => `${esc(E.ref)} PMID ${esc(E.pmid)}. ${doi(E.doi)}`)].map(r => `<li>${r}</li>`).join("")}</ol>`;
    return `<div class="acref">${cat}${reg}${ev}${pr}${refs}</div>`;
  }
  function wireDet(b) {
    const box = $("#atDet", b); if (!box) return;
    $$("[data-sd]", box).forEach(x => x.onclick = () => { W.side = x.dataset.sd; box.innerHTML = detail(W.sel); wireDet(b); });
    $$("[data-a]", box).forEach(x => x.onclick = () => {
      const e = AC().S.byId[W.sel], sd = e && (e.sides[W.side] ? W.side : Object.keys(e.sides)[0]), p = e && e.sides[sd] && e.sides[sd][0];
      if (x.dataset.a === "show") { AC().setShow(true); AC().select(W.sel); }
      if ((x.dataset.a === "press" || x.dataset.a === "ea") && g.AxonWorkbench) g.AxonWorkbench.setInstr(x.dataset.a === "press" ? "acu" : "ea");
      if ((x.dataset.a === "apply" || x.dataset.a === "press" || x.dataset.a === "ea") && p && g.AxonInteract) g.AxonInteract.applyAt({ point: p.p.toArray(), normal: p.n ? p.n.toArray() : null, code: p.derm, name: `${W.sel} (${sd})`, source: "atlas" });
      if (x.dataset.a === "note" && g.AxonNotes) g.AxonNotes.add({ title: `${W.sel} · ${e ? e.py : ""}`, text: `${e ? e.loc : ""}${p ? ` — dermátomo ${p.derm}, ${p.muscle || ""}` : ""}`, kind: "ponto", method: "acupuntura" });
    });
  }

  // ------------------------------------------------------------------ mapa integrado (corpo do paciente projetado)
  const VW = { F: ["Frente", "🧍", (x, y, z) => [x, y, z], n => n.z], B: ["Costas", "🔙", (x, y, z) => [-x, y, -z], n => -n.z], R: ["Lateral direita", "◀", (x, y, z) => [z, y, -x], n => -n.x], L: ["Lateral esquerda", "▶", (x, y, z) => [-z, y, x], n => n.x] };
  const CATN = { yuan: "Yuan-fonte", luo: "Luo", xi: "Xi-fenda", bshu: "Shu dorsal", mu: "Mu frontal", hui: "Hui", conf: "Confluente", hei: "He inferior", cmd: "Comando", shu: "Cinco shu", ev: "Com evidência clínica" };
  const MAP = { bg: {}, hits: [], ver: -1 };
  function passes(id) {
    const D = DD(); if (W.mer) { const m = D.M[W.mer]; if (!m || !m.p.some(r => r[0] === id)) return false; }
    if (W.cat && R()) { if (!R().allCats()[W.cat].includes(id)) return false; }
    if (W.tech === "press" && R() && !R().pressNote(id).ok) return false;
    if (W.q.trim()) { const q = W.q.trim().toLowerCase(), e = AC().S.byId[id]; const t = (id + " " + (e ? e.py + " " + e.loc : "")).toLowerCase(); if (!t.includes(q) && !(MAP.qhit && MAP.qhit.has(id))) return false; }
    return true;
  }
  // corpo do paciente renderizado de verdade (malha da pele deformada), câmera ortográfica por vista, renderizador próprio
  function bodyImage(v) {
    const S = AC().S, E = g.AxonStage.ext(), sk = E.S.meshByLayer.skin, ver = (S.ver || 0) + "|" + v; if (MAP.bg[v] && MAP.bg[v].ver === ver) return MAP.bg[v];
    const T = E.T, geo = sk.geometry; if (!geo.boundingBox) geo.computeBoundingBox(); const bb = geo.boundingBox, f = VW[v][2];
    const cs = [[bb.min.x, bb.min.y, bb.min.z], [bb.max.x, bb.max.y, bb.max.z], [bb.min.x, bb.max.y, bb.max.z], [bb.max.x, bb.min.y, bb.min.z], [bb.min.x, bb.min.y, bb.max.z], [bb.max.x, bb.max.y, bb.min.z]].map(q => f(...q));
    const pad = .05, x0 = Math.min(...cs.map(q => q[0])) - pad, x1 = Math.max(...cs.map(q => q[0])) + pad, y0 = bb.min.y - pad, y1 = bb.max.y + pad, K = 420;
    const cw = Math.ceil((x1 - x0) * K), ch = Math.ceil((y1 - y0) * K);
    if (!MAP.r) { MAP.r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); MAP.r.setPixelRatio(1); if (T.sRGBEncoding) MAP.r.outputEncoding = T.sRGBEncoding; }
    const r = MAP.r; r.setSize(cw, ch, false); r.setClearColor(0x000000, 0);
    const sc = new T.Scene(), mat = new T.MeshStandardMaterial({ color: 0xd9a982, roughness: .62, metalness: 0 }), m = new T.Mesh(geo, mat); sc.add(m);
    sc.add(new T.HemisphereLight(0xfff4ea, 0x2a3a40, .75)); const key = new T.DirectionalLight(0xffffff, .95), rim = new T.DirectionalLight(0x9fe8ff, .55);
    // câmera olhando o corpo pela vista escolhida
    const dir = { F: [0, 0, 1], B: [0, 0, -1], R: [-1, 0, 0], L: [1, 0, 0] }[v], cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, cy = (y0 + y1) / 2;
    const cam = new T.OrthographicCamera(-(x1 - x0) / 2, (x1 - x0) / 2, (y1 - y0) / 2, -(y1 - y0) / 2, .01, 20);
    // centro horizontal da projeção: o mesmo usado por f() para os pontos
    const mid = (x0 + x1) / 2, c3 = { F: [mid, cy, cz + 5], B: [-mid, cy, cz - 5], R: [cx - 5, cy, mid], L: [cx + 5, cy, -mid] }[v];   // centro em que f(x,y,z)[0] = mid
    cam.position.set(...c3); cam.up.set(0, 1, 0); cam.lookAt(c3[0] - dir[0] * 5, cy, c3[2] - dir[2] * 5);
    key.position.set(c3[0] + 2, cy + 3, c3[2] + (v === "R" || v === "L" ? 2 : 0)); rim.position.set(c3[0] - dir[0] * 10 + 2, cy + 1, c3[2] - dir[2] * 10 - 1); sc.add(key, rim);
    r.render(sc, cam); const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch; cv.getContext("2d").drawImage(r.domElement, 0, 0); mat.dispose();
    return (MAP.bg[v] = { cv, x0, y1, K, ver });
  }
  function drawMap(cv) {
    if (!cv || !AC().ready) return; const v = W.view, bg = bodyImage(v), c = cv.getContext("2d"), Wd = cv.clientWidth, Hd = cv.clientHeight, dpr = devicePixelRatio || 1;
    if (cv.width !== Wd * dpr) { cv.width = Wd * dpr; cv.height = Hd * dpr; } c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, Wd, Hd);
    const fit = Math.min(Wd / bg.cv.width, Hd / bg.cv.height) * .96, s = fit * W.z, ox = Wd / 2 - bg.cv.width * s / 2 + W.px, oy = Hd / 2 - bg.cv.height * s / 2 + W.py;
    c.imageSmoothingQuality = "high"; c.drawImage(bg.cv, ox, oy, bg.cv.width * s, bg.cv.height * s);
    const toS = q => [ox + (q[0] - bg.x0) * bg.K * s, oy + (bg.y1 - q[1]) * bg.K * s], D = DD(), S = AC().S, f = VW[v][2], fc = VW[v][3];
    MAP.hits = []; const evs = R() ? new Set(R().allCats().ev) : new Set();
    Object.entries(D.M).forEach(([mk, m]) => { const seq = {};
      m.p.forEach(r => { const e = S.byId[r[0]]; if (!e) return; Object.entries(e.sides).forEach(([sd, arr]) => { const q = arr[0]; if (!q || !q.p) return; const pr = f(q.p.x, q.p.y, q.p.z), vis = fc(q.n || { x: 0, y: 0, z: 1 }) > -.12;
        const [sx, sy] = toS(pr), ok = passes(r[0]); (seq[sd] = seq[sd] || []).push(vis ? { sx, sy, ok, w: q.p } : null); if (vis) MAP.hits.push({ id: r[0], sd, sx, sy, ok, col: m.col, ev: evs.has(r[0]), d: pr[2] }); }); });
      c.strokeStyle = m.col; c.globalAlpha = W.mer && W.mer !== mk ? .08 : .45; c.lineWidth = 1.4;
      Object.values(seq).forEach(arr => { for (let i = 1; i < arr.length; i++) { const a = arr[i - 1], b = arr[i]; if (a && b && a.w.distanceTo(b.w) < .55) { c.beginPath(); c.moveTo(a.sx, a.sy); c.lineTo(b.sx, b.sy); c.stroke(); } } }); });
    c.globalAlpha = 1; MAP.hits.sort((a, b) => a.d - b.d); const r0 = Math.max(2.6, Math.min(6, 2.4 * Math.sqrt(W.z)));
    MAP.hits.forEach(h => { c.globalAlpha = h.ok ? 1 : .16; c.beginPath(); c.arc(h.sx, h.sy, r0, 0, 6.283); c.fillStyle = h.col; c.fill(); c.lineWidth = 1; c.strokeStyle = "rgba(10,20,25,.85)"; c.stroke();
      if (h.ev && h.ok) { c.beginPath(); c.arc(h.sx, h.sy, r0 + 2.6, 0, 6.283); c.strokeStyle = "#ffd166"; c.lineWidth = 1.6; c.stroke(); } });
    c.globalAlpha = 1; c.font = "600 11px Inter,system-ui,sans-serif"; c.textBaseline = "middle";
    MAP.hits.forEach(h => { const sel = h.id === W.sel, hov = MAP.hov && MAP.hov.id === h.id && MAP.hov.sd === h.sd; if (!(sel || hov || (W.z >= 3.4 && h.ok))) return;
      if (sel) { c.beginPath(); c.arc(h.sx, h.sy, r0 + 6, 0, 6.283); c.strokeStyle = "#ff7a59"; c.lineWidth = 2.4; c.stroke(); }
      const t = h.id + (sel || hov ? " · " + (S.byId[h.id] ? S.byId[h.id].py : "") : ""), w = c.measureText(t).width; c.fillStyle = "rgba(8,22,27,.85)"; c.fillRect(h.sx + r0 + 3, h.sy - 8, w + 8, 16); c.fillStyle = sel ? "#ffb59e" : "#e4f6f2"; c.fillText(t, h.sx + r0 + 7, h.sy); });
    const lg = cv.parentNode.querySelector(".am-leg"); if (lg) { const vis = MAP.hits.filter(h => h.ok).length; lg.textContent = `${VW[v][0]} · ${vis} pontos visíveis${W.mer || W.cat || W.q || W.tech === "press" ? " (filtro ativo)" : ""} · roda: zoom · arrastar: mover`; }
  }
  function mapTab(b) {
    const D = DD(), ready = AC().ready;
    MAP.qhit = W.q && R() ? R().search(W.q) : null;
    b.innerHTML = `<div class="amap"><div class="ibar am-bar" style="position:static;flex-wrap:wrap">
        ${Object.entries(VW).map(([k, [n, ic]]) => `<button class="ib ${W.view === k ? "on" : ""}" data-v="${k}" data-tip="Vista: ${n}">${ic}</button>`).join("")}<button class="ib" data-t2="scalp" data-tip="Couro cabeludo: YNSA e linhas MS">🧠</button><button class="ib" data-t2="ear" data-tip="Orelha: 91 pontos auriculares">👂</button>
        <span class="sp"></span><div class="seg mini"><button data-tc="acu" class="${W.tech === "acu" ? "on" : ""}" data-tip="Acupuntura: todos os pontos">📍 Acupuntura</button><button data-tc="press" class="${W.tech === "press" ? "on" : ""}" data-tip="Acupressão: só pontos adequados à pressão digital">👆 Acupressão</button></div>
        <input id="amQ" type="search" placeholder="ponto ou indicação: náusea, dor, PC6…" value="${esc(W.q)}" style="flex:1;min-width:180px"></div>
      <div class="am-chips">${Object.entries(CATN).map(([k, n]) => `<button class="amc ${W.cat === k ? "on" : ""}" data-c="${k}" data-tip="Filtrar: ${n}">${n}</button>`).join("")}</div>
      <div class="merchips">${Object.entries(D.M).map(([k, m]) => `<button data-m="${k}" class="${W.mer === k ? "on" : ""}" style="--c:${m.col}" data-tip="${esc(m.n)} (${m.p.length} pontos)">${k}</button>`).join("")}</div>
      <div class="am-main"><div class="am-cv">${ready ? `<canvas></canvas><div class="am-leg"></div><div class="am-zoom"><button class="ib" data-zm="1.4" data-tip="Aproximar">+</button><button class="ib" data-zm="0.7" data-tip="Afastar">−</button><button class="ib" data-zm="0" data-tip="Corpo inteiro">⤢</button></div>`
        : `<div class="empty"><div class="eic">🗺</div><p>Os ${D.count()} pontos ainda não foram posicionados no corpo deste paciente.</p><button class="btn" id="amBuild">Posicionar os pontos</button></div>`}</div>
      <div class="atdet" id="atDet">${W.sel ? detail(W.sel) : `<p class="note">Clique num ponto do mapa. Anel dourado: ponto com evidência clínica conferida. Busque por indicação (náusea, parto, íleo…) ou filtre por categoria.</p>`}</div></div>
      <p class="note">${tag("lit")} localização OMS 2008; categorias clássicas; evidência conferida no PubMed. ${tag("pre")} posição por proporção corporal sobre a malha do paciente. ${tag("der")} uso regional e segmentar pela anatomia calculada.</p></div>`;
    $$("[data-v]", b).forEach(x => x.onclick = () => { W.view = x.dataset.v; W.z = 1; W.px = W.py = 0; mapTab(b); });
    $$("[data-t2]", b).forEach(x => x.onclick = () => { W.tab = x.dataset.t2; win(b.closest(".body") || b.parentNode.parentNode); });
    $$("[data-tc]", b).forEach(x => x.onclick = () => { W.tech = x.dataset.tc; mapTab(b); });
    $$("[data-c]", b).forEach(x => x.onclick = () => { W.cat = W.cat === x.dataset.c ? null : x.dataset.c; mapTab(b); });
    $$(".merchips [data-m]", b).forEach(x => x.onclick = () => { W.mer = W.mer === x.dataset.m ? null : x.dataset.m; mapTab(b); });
    $("#amQ", b).oninput = e => { W.q = e.target.value; clearTimeout(W.t); W.t = setTimeout(() => { mapTab(b); const i = $("#amQ", b); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 220); };
    const bb = $("#amBuild", b); if (bb) bb.onclick = async () => { bb.disabled = true; bb.textContent = "Calculando…"; try { await AC().build(); AC().setShow(true); } catch (e) { bb.textContent = "Erro: " + e.message; return; } mapTab(b); };
    wireDet(b); const cv = $(".am-cv canvas", b); if (!cv) return;
    const redraw = () => drawMap(cv); requestAnimationFrame(() => { redraw(); if (W.focus && W.sel) { W.focus = false; const h = MAP.hits.find(x => x.id === W.sel && x.sd === W.side) || MAP.hits.find(x => x.id === W.sel);
      // tela: sx = cx + a·z + px  →  com z' = 2,6 e o ponto no centro: px' = −a·z'
      if (h) { const cx = cv.clientWidth / 2, cy = cv.clientHeight / 2, ax = (h.sx - cx - W.px) / W.z, ay = (h.sy - cy - W.py) / W.z; W.z = 2.6; W.px = -ax * W.z; W.py = -ay * W.z; redraw(); } } }); new ResizeObserver(redraw).observe(cv);
    $$("[data-zm]", b).forEach(x => x.onclick = () => { const k = +x.dataset.zm; if (!k) { W.z = 1; W.px = W.py = 0; } else W.z = Math.max(.6, Math.min(12, W.z * k)); redraw(); });
    cv.addEventListener("wheel", e => { e.preventDefault(); const r = cv.getBoundingClientRect(), mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2, k = e.deltaY < 0 ? 1.18 : 1 / 1.18, z2 = Math.max(.6, Math.min(12, W.z * k)), kk = z2 / W.z;
      W.px = mx - (mx - W.px) * kk; W.py = my - (my - W.py) * kk; W.z = z2; redraw(); }, { passive: false });
    let dr = null; cv.addEventListener("pointerdown", e => { dr = { x: e.clientX, y: e.clientY, px: W.px, py: W.py, m: false }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", e => { const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (dr) { const dx = e.clientX - dr.x, dy = e.clientY - dr.y; if (Math.hypot(dx, dy) > 4) dr.m = true; if (dr.m) { W.px = dr.px + dx; W.py = dr.py + dy; redraw(); return; } }
      let best = null, bd = 12; MAP.hits.forEach(h => { const d = Math.hypot(h.sx - x, h.sy - y); if (d < bd) { bd = d; best = h; } }); if ((best && best.id) !== (MAP.hov && MAP.hov.id)) { MAP.hov = best; cv.style.cursor = best ? "pointer" : "grab"; redraw(); } });
    cv.addEventListener("pointerup", e => { const moved = dr && dr.m; dr = null; if (moved || !MAP.hov) return; W.sel = MAP.hov.id; W.side = MAP.hov.sd; const box = $("#atDet", b); box.innerHTML = detail(W.sel); wireDet(b); box.scrollTop = 0; redraw(); });
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
    b.innerHTML = `<div class="seg mtabs">${[["map", "🗺 Mapa"], ["acu", "Lista (361 + extras)"], ["scalp", "Craniopuntura"], ["ear", "Aurículo"], ["refs", "Referências"]].map(([k, l]) => `<button data-t="${k}" class="${W.tab === k ? "on" : ""}">${l}</button>`).join("")}</div><div id="atBody"></div>`;
    $$(".mtabs button", b).forEach(x => x.onclick = () => { W.tab = x.dataset.t; win(b); });
    const body = $("#atBody", b);
    if (W.tab === "map") mapTab(body); else if (W.tab === "acu") acuTab(body); else if (W.tab === "scalp") scalpTab(body); else if (W.tab === "ear") earTab(body);
    else { const Rf = R(), ev = Rf ? Object.values(Rf.EV) : [], extra = Rf ? Object.values(Rf.SRC).filter(t => !REFS.some(r => r.slice(0, 40) === t.slice(0, 40))) : [];
      body.innerHTML = `<div class="card"><h4>Localização, nomenclatura e anatomia</h4><ol class="refs">${[...REFS, ...extra].map(r => `<li>${esc(r)}</li>`).join("")}</ol>
        <h4>Evidência clínica (conferida no PubMed)</h4><ol class="refs">${ev.map(E => `<li>${esc(E.ref)} PMID ${esc(E.pmid)}. ${doi(E.doi)} <small>— ${esc(E.tipo)}</small></li>`).join("")}</ol></div>`; }
  }
  function boot() { const A = g.AxonApp; if (!A || !A.registerApp || !g.AxonAcuData) return setTimeout(boot, 80);
    A.registerApp("atlas", { title: "atlas", w: 1120, h: 820, render: win, draw: b => { const cv = b.querySelector(".am-cv canvas"); if (cv) drawMap(cv); } });
    document.addEventListener("axon:acu", () => { if (A.isOpen("atlas") && W.tab === "map") { const cv = A.body("atlas").querySelector(".am-cv canvas"); if (cv) drawMap(cv); else win(A.body("atlas")); } });
    document.addEventListener("axon:acupoint", e => { W.sel = e.detail.id; if (W.tab !== "map") W.tab = "acu"; if (A.isOpen("atlas")) win(A.body("atlas")); });
  }
  boot();
  g.AxonAtlas = { W, open: (tab, sel) => { if (tab) W.tab = tab; if (sel) { W.sel = sel; W.focus = true; } const A = g.AxonApp; if (A.isOpen("atlas")) win(A.body("atlas")); else A.openApp("atlas"); } };
})(window);
