/* axon · app.js — desktop "app-dentro-do-app": painéis, janelas, Dock, 8 mini-apps e sincronização com o palco. */
(function (g) {
  "use strict";
  const { TAG, REF, MODS, REGIONS, FIBERS, MECH, PHYS, PROTO, INSILICO, SCHEDULE, FAQ } = g.AxonData;
  const M = g.AxonModel, C = g.AxonCharts, t = k => g.I18N.t(k), $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const REFDATA = g.AXON_REFERENCE;
  const REL = g.AXON_RELEASE || { version: "dev", releases: [] };
  const VERSION = REL.version;

  // ---------------------------------------------------------------- estado
  const st = {
    region: "L5S1", level: 1, mod: "tens", api: false,
    p: { f: 100, I: 0.6, pw: 100, area: 4, r: 1.0, D: 9, P: 60, U: 500, sigma: .6, dur: 60 },
    v: { fat: 0, demy: 0, sfl: 0, peri: 0, fib: 0 },
    T: null, Tbase: M.grid(), mc: null
  };
  const tagHTML = (k, ref) => `<span class="tag ${k}" title="${ref ? REF[ref] : ""}">${TAG[k]}</span>`;
  const fmt = (v, d = 2) => (v == null || !isFinite(v)) ? "—" : Number(v).toFixed(d).replace(".", ",");

  // ---------------------------------------------------------------- modelo derivado do estado
  function compute() {
    const v = st.v, rEff = st.p.r + v.fat, trans = 1 / (1 + .8 * v.peri + .5 * v.fib), ln = M.P.LN * (1 + 4 * v.demy);
    st.T = (v.demy > 0) ? M.grid({ ln }) : st.Tbase;
    const inDom = M.inDomain(9, rEff / 10) && M.inDomain(3, rEff / 10);
    const mod = MODS.find(m => m.id === st.mod), elec = mod.kind === "elec";
    const pwS = elec ? st.p.pw * 1e-6 : 100e-6;
    let ab = null, ad = null;
    if (inDom) { ab = M.Ith(9, rEff / 10, { pw: pwS, ln }) * 1e3 / trans; ad = M.Ith(3, rEff / 10, { pw: pwS, ln }) * 1e3 / trans; }
    const fasc = { r: [.03 + v.fat / 10, .15 + v.fat / 10].map(x => Math.min(.15, x)), smallFiberLoss: v.sfl };
    st.mc = M.monteCarlo(st.T, fasc);
    const Ieff = st.p.I * trans; let k = 0; while (k < 199 && st.mc.I[k + 1] <= Ieff) k++;
    const out = { rEff, inDom, ab, ad, ratio: ab && ad ? ad / ab : null, FA: elec ? st.mc.FA[k] : null, FD: elec ? st.mc.FD[k] : null, trans, elec, mod };
    if (st.mod === "acu") { out.FA = M.acupressure(st.p.P); out.FD = 0; }
    out.sh = elec ? M.shannon(st.p.I, st.p.pw, st.p.area) : null;
    // térmica (0D, duração limitada): Joule para elétrica; absorção para acústica
    let q = 0;
    if (elec) { const J = st.p.I * 1e-3 / (st.p.area * 1e-4), duty = Math.min(1, st.p.f * st.p.pw * 1e-6); q = J * J * 3 * duty; }
    if (mod.kind === "acou") q = 2 * 5.76 * st.p.f * st.p.U * 10;           // 2·α·f·I ; I em W/m² (mW/cm² × 10)
    out.th = M.pennes0d(q, st.p.dur); out.q = q;
    if (mod.kind === "acou") { const p = Math.sqrt(2 * 1.5e6 * 2 * st.p.U * 10) / 1e6; out.mech = M.mechanical(p, st.p.f, st.p.U); }
    else if (st.mod === "acu") out.mech = { MI: 0, pk: st.p.P, level: st.p.P < 200 ? "ok" : st.p.P < 300 ? "warn" : "risk" };
    else out.mech = { MI: 0, ispta: 0, level: "ok" };
    out.Z = 1 + 2 * v.fib;
    st.out = out; return out;
  }

  // ---------------------------------------------------------------- painel esquerdo
  let leftTab = "anat";
  function renderLeft() {
    const R = REGIONS[st.region], body = $("#leftBody");
    $$("#leftTabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === leftTab));
    if (leftTab === "anat") {
      body.innerHTML = `<div class="card" id="structCard">${st.structure ? `<h4>Estrutura selecionada</h4><p><b>${esc(st.structure.name)}</b></p><p class="note">${st.structure.fma ? "FMA " + esc(st.structure.fma) + " · " : ""}camada: ${esc(st.structure.layer)}</p>` : `<h4>Estrutura selecionada</h4><p class="note">Clique em um osso, órgão, músculo, vaso ou nervo no Nível 1.</p>`}</div><div class="card"><h4>${R.name}</h4><p class="note">${t("scale" + st.level)} · ${MODS.find(m => m.id === st.mod).name}</p>
        <ul>${R.structures.map(s => `<li>${s}</li>`).join("")}</ul>${tagHTML("lit", "teixeira")}</div>
        <div class="card"><h4>${t("fibers")}</h4>${R.fibers.map(f => `<div style="margin:4px 0"><span class="fib"><i style="background:${FIBERS[f].c}"></i>${FIBERS[f].n}</span><span class="note">${FIBERS[f].d} · ${FIBERS[f].v} — ${FIBERS[f].f}</span></div>`).join("")}${tagHTML("lit", "teixeira")}</div>
        <div class="card"><h4>${t("symptoms")}</h4><ul>${R.symptoms.map(s => `<li>${s}</li>`).join("")}</ul></div>
        <div class="card"><h4>${t("mechanism")}</h4><ul>${(MECH[st.mod] || []).map(([s, k, r]) => `<li>${s} ${tagHTML(k, r)}</li>`).join("")}</ul></div>
        ${R.fibers.includes("c") ? `<div class="warnbox">Fibras C estão fora do modelo nodal mielinizado: biofísica de condução contínua em feixes de Remak (ver Manual, §Fibras C).</div>` : ""}`;
    } else if (leftTab === "phys") {
      body.innerHTML = (PHYS[st.level] || []).map(([h, eq, txt, k, r]) => `<div class="card"><h4>${h}</h4><div class="eq">${eq}</div><p>${txt}</p>${tagHTML(k, r)}</div>`).join("")
        + `<div class="card"><h4>Alertas metodológicos (Anexo F)</h4><ul><li>Membrana passiva; meio homogêneo; eletrodo pontual.</li><li>Valores absolutos em mA são ordem de grandeza; razões são o resultado interpretável.</li><li>Domínio verificado: 1–16 µm; 0,3–1,5 mm.</li></ul>${tagHTML("lit", "teixeira")}</div>`;
    } else {
      body.innerHTML = `<div class="card"><h4>Execução in silico · passo a passo</h4><ol class="steps">${INSILICO.map((s, i) => `<li class="${i < st.level ? "done" : ""}"><b>${t("step")} ${i + 1}.</b> ${s}</li>`).join("")}</ol></div>
        <div class="card"><h4>Escada de evidência (Diagrama 2)</h4><ol class="steps">${PROTO.map(([h, d]) => `<li><b>${h}</b><br>${d}</li>`).join("")}</ol>${tagHTML("lit", "teixeira")}</div>`;
    }
  }

  // ---------------------------------------------------------------- painel direito
  function slider(id, label, min, max, step, val, unit) {
    return `<div class="ctl"><label for="${id}"><span>${label}</span><output id="${id}o">${val} ${unit}</output></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
  }
  function renderRight() {
    const mod = MODS.find(m => m.id === st.mod), p = st.p;
    let ctl = "";
    if (mod.kind === "elec") ctl = slider("sF", t("freq"), 1, mod.id === "scs" ? 10000 : mod.id === "ti" ? 4000 : 200, 1, p.f, "Hz") + slider("sI", t("amp"), .05, ({ tens: 50, ti: 50, scs: 10 })[mod.id] || 5, .05, p.I, "mA") + slider("sPw", t("pw"), 20, 500, 10, p.pw, "µs") + slider("sA", t("area"), .005, 10, .005, p.area, "cm²");
    if (mod.kind === "mech") ctl = slider("sP", t("pressure"), 0, 400, 5, p.P, "kPa") + slider("sA", t("area"), .1, 4, .1, p.area, "cm²");
    if (mod.kind === "acou") ctl = slider("sF", t("freq"), .2, 10, .1, p.f, "MHz") + slider("sU", "I_SPTA", 0, 2000, 10, p.U, "mW/cm²");
    ctl += slider("sR", t("dist"), .3, 3, .05, p.r, "mm") + slider("sD", t("fiber"), 1, 16, .5, p.D, "µm");
    $("#rightBody").innerHTML = `
      <div class="ctl"><label><span>${t("modality")}</span></label><div class="seg">${MODS.map(m => `<button data-mod="${m.id}" class="${m.id === st.mod ? "on" : ""}" title="${m.name}">${m.short || m.name}</button>`).join("")}</div><p class="note">${mod.desc}</p></div>
      ${ctl}
      <div class="card" style="margin-top:10px"><h4>${t("variations")}</h4>
        ${slider("vFat", t("fat"), 0, 1.2, .05, st.v.fat, "mm")}${slider("vDemy", t("demy"), 0, 1, .05, st.v.demy, "")}${slider("vSfl", t("sfl"), 0, .9, .05, st.v.sfl, "")}${slider("vPeri", t("peri"), 0, 1, .05, st.v.peri, "")}${slider("vFib", t("fib"), 0, 1, .05, st.v.fib, "")}
        <div class="note">${tagHTML("hip")} Motor de regras v0.1 · IA preditiva ainda não treinada.</div></div>
      <div class="card"><h4>${t("impact")}</h4><div id="impact"></div></div>`;
    $$("#rightBody .seg button").forEach(b => b.onclick = () => setMod(b.dataset.mod));
    const bind = (id, key, obj = st.p) => { const el = $("#" + id); if (!el) return; el.oninput = () => { obj[key] = +el.value; $("#" + id + "o").textContent = el.value + " " + (el.closest(".ctl").querySelector("output").textContent.split(" ").slice(1).join(" ")); update(); }; };
    [["sF", "f"], ["sI", "I"], ["sPw", "pw"], ["sA", "area"], ["sP", "P"], ["sU", "U"], ["sR", "r"], ["sD", "D"]].forEach(([i, k]) => bind(i, k));
    [["vFat", "fat"], ["vDemy", "demy"], ["vSfl", "sfl"], ["vPeri", "peri"], ["vFib", "fib"]].forEach(([i, k]) => bind(i, k, st.v));
  }
  function renderImpact(o) {
    const el = $("#impact"); if (!el) return;
    const meter = (lab, val, pct, cls, tag) => `<div class="meter"><div class="lab"><span>${lab}</span><b>${val}</b></div><div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>${tag || ""}</div>`;
    let h = "";
    if (!o.inDom && o.mod.kind === "elec") h += `<div class="warnbox">${t("outside")} r_ef = ${fmt(o.rEff)} mm</div>`;
    if (o.ratio) h += meter(t("selectivity"), fmt(o.ratio) + "×", o.ratio / 5 * 100, "", tagHTML("mod"));
    if (o.ab) h += `<p class="note">I_lim Aβ(9 µm) = ${fmt(o.ab, 3)} mA · Aδ(3 µm) = ${fmt(o.ad, 3)} mA ${tagHTML("mod")}</p>`;
    if (o.FA != null) h += meter(t("fAbeta"), fmt(o.FA * 100, 1) + " %", o.FA * 100, "blue") + meter(t("fAdelta"), fmt(o.FD * 100, 1) + " %", o.FD * 100, "orange", st.mod === "acu" ? tagHTML("hip") : tagHTML("mod"));
    if (o.sh) h += meter(t("shannonMargin"), "k = " + fmt(o.sh.k), Math.max(0, (1.75 - o.sh.k) / 1.75 * 100 + 50), o.sh.level === "ok" ? "" : "amber", tagHTML("der", "shannon"));
    h += `<div class="meter"><div class="lab"><span>${t("efficacy")}</span><b style="color:var(--risk)">${t("notEstimable")}</b></div>${tagHTML("hip")}</div>`;
    el.innerHTML = h;
  }

  // ---------------------------------------------------------------- gerenciador de janelas
  const WM = { wins: {}, z: 40 };
  const APPS = {};
  function openApp(id) {
    const A = APPS[id]; if (!A) return;
    if (WM.wins[id]) { WM.wins[id].classList.remove("min"); focus(WM.wins[id]); return; }
    if (innerWidth <= 900) Object.keys(WM.wins).forEach(closeApp);
    const w = document.createElement("section"); w.className = "win"; w.dataset.app = id; w.setAttribute("role", "dialog"); w.setAttribute("aria-label", t(A.title));
    const desk = $("#stage").getBoundingClientRect();
    const W = Math.min(A.w, innerWidth - 20), H = Math.min(A.h, innerHeight - 150);
    const pos = A.pos ? A.pos(desk, W, H) : { x: desk.left + 40 + Object.keys(WM.wins).length * 26, y: 90 + Object.keys(WM.wins).length * 22 };
    Object.assign(w.style, { width: W + "px", height: H + "px", left: pos.x + "px", top: pos.y + "px" });
    w.innerHTML = `<div class="tb"><div class="lights"><i title="Fechar" data-a="close"></i><i title="Minimizar" data-a="min"></i><i title="Maximizar" data-a="max"></i></div><div class="t" data-i18n="${A.title}">${t(A.title)}</div></div><div class="body"></div>`;
    document.body.appendChild(w); WM.wins[id] = w;
    w.querySelector('[data-a="close"]').onclick = () => closeApp(id);
    w.querySelector('[data-a="min"]').onclick = () => { w.classList.add("min"); dockState(); };
    w.querySelector('[data-a="max"]').onclick = () => { const big = w.dataset.big === "1"; w.dataset.big = big ? "0" : "1"; Object.assign(w.style, big ? { width: W + "px", height: H + "px", left: pos.x + "px", top: pos.y + "px" } : { width: (innerWidth - 40) + "px", height: (innerHeight - 170) + "px", left: "20px", top: "64px" }); A.draw && A.draw(w.querySelector(".body")); };
    const tb = w.querySelector(".tb"); let d = null;
    tb.addEventListener("pointerdown", e => { if (e.target.dataset.a) return; d = { x: e.clientX - w.offsetLeft, y: e.clientY - w.offsetTop }; tb.setPointerCapture(e.pointerId); focus(w); });
    tb.addEventListener("pointermove", e => { if (!d) return; w.style.left = Math.max(-W + 80, Math.min(innerWidth - 80, e.clientX - d.x)) + "px"; w.style.top = Math.max(36, Math.min(innerHeight - 60, e.clientY - d.y)) + "px"; });
    tb.addEventListener("pointerup", () => d = null);
    w.addEventListener("pointerdown", () => focus(w));
    new ResizeObserver(() => A.draw && A.draw(w.querySelector(".body"))).observe(w);
    A.render(w.querySelector(".body")); focus(w); dockState();
  }
  function closeApp(id) { const w = WM.wins[id]; if (!w) return; w.remove(); delete WM.wins[id]; dockState(); }
  function focus(w) { $$(".win").forEach(x => x.classList.remove("focus")); w.classList.add("focus"); w.style.zIndex = ++WM.z; }
  function dockState() { $$(".dock button[data-app]").forEach(b => b.classList.toggle("open", !!WM.wins[b.dataset.app])); }
  // fechamento por duplo clique fora da janela (fecha a janela em foco)
  document.addEventListener("dblclick", e => {
    if (e.target.closest(".win,.dock,.side,.menubar,.bot,.scalebar")) return;
    const f = $(".win.focus:not(.min)"); if (f) closeApp(f.dataset.app);
  });
  const redrawAll = () => Object.entries(WM.wins).forEach(([id, w]) => APPS[id].draw && !w.classList.contains("min") && APPS[id].draw(w.querySelector(".body")));

  // ---------------------------------------------------------------- mini-apps
  APPS.app1 = { title: "app1", w: 360, h: 420, render(b) {
    b.innerHTML = `<div class="card"><h4>${t("layers")}</h4>${["skin", "dermatomes", "skeleton", "organs", "muscles", "vessels", "nerves", "autonomic", "acupoints"].map(k => `<label style="display:flex;gap:8px;align-items:center;margin:5px 0"><input type="checkbox" data-layer="${k}" ${["muscles", "vessels"].includes(k) ? "" : "checked"}> ${t(k)}</label>`).join("")}<p class="note">${g.AxonStage.anatomy ? "Malhas reais: BodyParts3D (930 estruturas, CC BY-SA 2.1 JP)." : "Modelo procedural (pacote anatômico não carregado)."} Clique numa estrutura para ver o nome e o ID FMA.</p><button class="btn sm" id="rxOpen">${t("reflex")}: cores, associações e visibilidade…</button></div>
      <div class="card"><h4>Escalas</h4>${[1, 2, 3, 4, 5].map(l => `<button class="btn ghost" style="width:100%;margin:3px 0;text-align:left" data-l="${l}">${l} · ${t("scale" + l)}</button>`).join("")}</div>
      <div class="card"><h4>Regiões</h4>${Object.entries(REGIONS).map(([k, R]) => `<button class="btn ghost" style="width:100%;margin:3px 0;text-align:left" data-r="${k}">${R.name}</button>`).join("")}</div>`;
    $$("[data-layer]", b).forEach(c => c.onchange = () => g.AxonStage.setLayer(c.dataset.layer, c.checked));
    $("#rxOpen", b).onclick = () => openApp("reflex");
    $("#brTog", b).onchange = e => { g.AxonStage.setBranching(e.target.checked); if (e.target.checked) g.AxonStage.setLevel(3); };
    const bc = g.AxonStage.branchComp(); $("#brComp", b).textContent = bc ? `Ramo colateral: ${bc.nA} Aβ + ${bc.nD} Aδ vindos dos fascículos ${bc.from.join(", ")} (amostra do modelo, semente 42).` : "Abra o Nível 3 para gerar o feixe.";
    $$("[data-l]", b).forEach(x => x.onclick = () => g.AxonStage.setLevel(+x.dataset.l));
    $$("[data-r]", b).forEach(x => x.onclick = () => selectRegion(x.dataset.r));
  } };

  APPS.app2 = { title: "app2", w: 440, h: 470, render(b) { this.b = b; this.draw(b); }, draw(b) {
    const o = st.out, mod = o.mod; if (!b.isConnected) return;
    let extra = "";
    if (st.mod === "ea") { const band = st.p.f <= 10 ? "baixa (2–10 Hz): encefalinas/β-endorfina" : st.p.f >= 80 ? "alta (80–100 Hz): dinorfina + portão medular" : "intermediária: mistura de vias"; extra = `<div class="card"><h4>Banda de frequência</h4><p>${band} ${tagHTML(st.p.f > 10 && st.p.f < 80 ? "hip" : "lit", "han")}</p><p class="note">Área ativa da agulha = ${fmt(st.p.area, 4)} cm² — densidade de carga ${fmt(o.sh.D, 1)} µC/cm²/fase.</p></div>`; }
    if (st.mod === "tavns") extra = `<div class="card"><h4>Mapa ABVN (% de espécimes)</h4><table class="mini">${[["Cymba conchae", 100], ["Antélice", 73], ["Cavum conchae", 45], ["Trago", 45], ["Crus da hélice", 20], ["Lóbulo (sham)", 0]].map(([n, v]) => `<tr><td>${n}</td><td class="n">${v} %</td><td style="width:40%"><div class="bar blue"><i style="width:${v}%"></i></div></td></tr>`).join("")}</table>${tagHTML("lit", "peuker")}<div class="warnbox">Monitorar frequência cardíaca (risco teórico de bradicardia).</div></div>`;
    if (st.mod === "acu") extra = `<div class="card"><h4>Mecanotransdução</h4><p>F_Aβ(mec) = ${fmt(o.FA * 100, 1)} % a ${st.p.P} kPa · força ≈ ${fmt(st.p.P * st.p.area * .1, 1)} N</p>${tagHTML("hip")} <p class="note">Sem corrente injetada: fronteira eletroquímica não se aplica.</p></div>`;
    if (mod.kind === "acou") { const lam = 1500 / (st.p.f * 1e6) * 1e6; extra = `<div class="card"><h4>Difração × atenuação</h4><p>λ = ${fmt(lam, 0)} µm a ${st.p.f} MHz · atenuação ${fmt(.5 * st.p.f, 2)} dB/cm</p><p class="note">Foco de 10 µm exigiria 150 MHz e 75 dB/cm.</p>${tagHTML("der")}</div>`; }
    b.innerHTML = `<div class="row"><div class="card"><h4>${mod.name}</h4><p>${mod.desc}</p></div></div>${extra}
      <div class="card"><h4>Função de ativação ao longo da fibra (D = ${st.p.D} µm, r = ${fmt(st.p.r)} mm)</h4><canvas class="cv" id="c2"></canvas>${tagHTML("mod")}</div>`;
    const a = M.activation(st.p.D, st.p.r / 10, (st.p.I || .5) * 1e-3);
    C.plot($("#c2", b), { series: [{ x: a.x, y: a.f, color: "#3ee6c5", label: "Δ²Vₑ (mV)", dots: true }, { x: a.x, y: a.Ve.map(v => v / 10), color: "#4fb3ff", label: "Vₑ/10 (mV)", dash: [4, 3] }], xlabel: "x (mm)" });
  } };

  let a3tab = "rec";
  APPS.app3 = { title: "app3", w: 470, h: 320, pos: (d, W, H) => ({ x: d.left + 14, y: d.bottom - H - 12 }), render(b) { this.draw(b); }, draw(b) {
    const tabs = [["rec", t("recruitment")], ["law", t("scaling")], ["win", t("window")], ["map", t("map")], ["bench", "Benchmarks"]];
    b.innerHTML = `<div class="wtabs">${tabs.map(([k, l]) => `<button data-k="${k}" class="${k === a3tab ? "on" : ""}">${l}</button>`).join("")}</div><canvas class="cv" id="c3" style="height:calc(100% - 64px);min-height:170px"></canvas><div id="c3n" class="note"></div>`;
    $$(".wtabs button", b).forEach(x => x.onclick = () => { a3tab = x.dataset.k; this.draw(b); });
    const cv = $("#c3", b), note = $("#c3n", b), mc = st.mc;
    if (a3tab === "rec") {
      const R = REFDATA.recruitment;
      C.plot(cv, { xlog: true, xr: [.03, 30], yr: [0, 1], xlabel: "I (mA)", series: [
        { x: R.I_mA, y: R.F_Abeta, color: "#4fb3ff", label: "Aβ ref. (Python)" }, { x: R.I_mA, y: R.F_Adelta, color: "#ff8a3d", label: "Aδ ref. (Python)" },
        { x: mc.I, y: mc.FA, color: "#9ad7ff", dash: [5, 4], w: 1.5, label: "Aβ ao vivo" }, { x: mc.I, y: mc.FD, color: "#ffb27f", dash: [5, 4], w: 1.5, label: "Aδ ao vivo" }],
        vlines: st.out.elec ? [{ x: st.p.I * st.out.trans, color: "#3ee6c5", label: "I atual" }] : [] });
      note.innerHTML = `${tagHTML("mod")} Ref.: semente 42 (PCG64). Ao vivo: mulberry32, perfil anatômico aplicado. v${VERSION}`;
    } else if (a3tab === "law") {
      const G = REFDATA.grid, cols = ["#3ee6c5", "#4fb3ff", "#ffb547", "#ff8a3d", "#c084fc"];
      C.plot(cv, { xlog: true, ylog: true, xlabel: "D (µm)", series: G.r_mm.map((r, j) => ({ x: G.D_um, y: G.Ith_mA.map(row => row[j]), color: cols[j], label: `r = ${r} mm`, dots: j === 3 })) });
      note.innerHTML = `I_lim ∝ D^−${fmt(REFDATA.alpha_r1mm, 4)} a 1 mm ${tagHTML("mod")}`;
    } else if (a3tab === "win") {
      const R = REFDATA.recruitment; const ratio = R.F_Abeta.map((a, i) => a > .001 ? R.F_Adelta[i] / a : NaN);
      C.plot(cv, { xlog: true, xr: [.05, 30], yr: [0, 1.05], xlabel: "I (mA)", series: [{ x: R.I_mA, y: ratio, color: "#ff5d5d", label: "F_Aδ / F_Aβ" }, { x: R.I_mA, y: R.F_Abeta, color: "#4fb3ff", label: "F_Aβ", w: 1 }], vbands: [{ from: .05, to: R.I_mA[R.F_Abeta.findIndex(v => v > .1)] || .3, color: "rgba(62,230,197,.10)" }] });
      note.innerHTML = `Com F_Aβ ≤ 10 %: F_Aδ = ${fmt(REFDATA.Adelta_frac_when_Abeta_le10pct * 100)} % (ref.) · ${fmt(mc.FDat10 * 100)} % (ao vivo). Janela útil de seletividade invertida: inexistente neste modelo. ${tagHTML("mod")}`;
    } else if (a3tab === "map") {
      const G = REFDATA.grid; C.heatmap(cv, G.Ith_mA, G.D_um, G.r_mm, { level: st.p.I, xlabel: "D (µm) × r (mm)" });
      note.innerHTML = `Células contornadas: recrutadas a I = ${fmt(st.p.I)} mA — sempre um semiplano superior (fibras grossas e próximas). ${tagHTML("mod")}`;
    } else {
      cv.style.display = "none";
      const rows = [["α (lei de escala, 1 mm)", REFDATA.alpha_r1mm, "1,1266 ± 1e-4", 4], ["Aδ(3)/Aβ(9) a 1 mm", REFDATA.ratio_3_9_r1mm, "3,2077 ± 1e-4", 4], ["… a 0,5 mm", REFDATA.ratio_3_9_r05mm, "2,17", 2], ["… a 1,5 mm", REFDATA.ratio_3_9_r15mm, "4,07", 2], ["Razão de medianas", REFDATA.ratio_I50, "3,10", 2], ["IC 95 % inferior", REFDATA.ratio_CI95[0], "2,98", 2], ["IC 95 % superior", REFDATA.ratio_CI95[1], "3,22", 2], ["F_Aδ com F_Aβ ≤ 10 % (%)", REFDATA.Adelta_frac_when_Abeta_le10pct * 100, "0,38", 2], ["ρᵢ = 70 Ω·cm", REFDATA.ratio_3_9_rho_i70, "2,85", 2], ["ρᵢ = 150 Ω·cm", REFDATA.ratio_3_9_rho_i150, "3,48", 2]];
      b.querySelector("#c3n").innerHTML = `<table class="mini"><tr><th>Grandeza</th><th>axon</th><th>Livro</th></tr>${rows.map(([n, v, ref, d]) => `<tr><td>${n}</td><td class="n">${fmt(v, d)}</td><td class="n">${ref}</td></tr>`).join("")}</table><p>${tagHTML("mod")} Python 3.11 · NumPy PCG64 · semente 42 · v${VERSION}</p>`;
    }
  } };

  APPS.app4 = { title: "app4", w: 450, h: 236, pos: (d, W, H) => ({ x: d.right - W - 14, y: d.bottom - H - 12 }), render(b) { b.innerHTML = `<div class="gauges"><canvas id="g1"></canvas><canvas id="g2"></canvas><canvas id="g3"></canvas><canvas id="g4"></canvas></div><div class="note" id="g5"></div>`; this.draw(b); }, draw(b) {
    const o = st.out; if (!$("#g1", b)) return;
    C.gauge($("#g1", b), o.th.dT, 4, t("temperature") + " ΔT", "°C", o.th.level);
    C.gauge($("#g2", b), o.sh ? o.sh.k : -4, 3, "Shannon k", "", o.sh ? o.sh.level : "ok", -4);
    if (st.mod === "acu") C.gauge($("#g3", b), o.mech.pk, 400, t("pressure"), "kPa", o.mech.level); else C.gauge($("#g3", b), o.mech.MI || 0, 2.5, t("mi") + " MI", "", o.mech.level);
    C.gauge($("#g4", b), o.Z, 3, t("chronic") + " Z/Z₀", "×", o.Z < 1.5 ? "ok" : o.Z < 3 ? "warn" : "risk");
    $("#g5", b).innerHTML = `Shannon k < 1,75 ${tagHTML("lit", "shannon")} · ΔT ≤ 2 °C / CEM43 ${tagHTML("lit")} · MI ≤ 1,9 · I_SPTA.3 ≤ 720 mW/cm² ${tagHTML("lit")} · crônica ${tagHTML("hip")}<br>Pennes 0D por ${st.p.dur} s (sem condução: limite superior). CEM43 = ${fmt(o.th.cem, 4)} min.`;
  } };

  APPS.app5 = { title: "app5", w: 480, h: 430, render(b) {
    b.innerHTML = `${slider("srS", t("noise"), 0, 2, .05, st.p.sigma, "")}<canvas class="cv" id="c5a" style="height:130px"></canvas><canvas class="cv" id="c5b" style="height:170px"></canvas><p class="note">Detector de limiar adimensional (A = 0,5; θ = 1; 5 Hz). Livro: σ_ótimo ≈ 0,61 ${tagHTML("mod")} · k_B·T ≈ 4,28×10⁻²¹ J ${tagHTML("lit")}</p>`;
    $("#srS", b).oninput = e => { st.p.sigma = +e.target.value; $("#srSo", b).textContent = e.target.value; this.draw(b); };
    this.curve = null; this.draw(b);
  }, draw(b) {
    if (!$("#c5a", b)) return; const rng = M.mulberry32(7), n = 600, xs = [], sig = [], th = [], sp = [];
    for (let i = 0; i < n; i++) { const tt = i / 600; xs.push(tt); const v = .5 * Math.sin(2 * Math.PI * 5 * tt) + st.p.sigma * Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(6.283 * rng()); sig.push(v); th.push(1); sp.push(v >= 1 ? 1.4 : NaN); }
    C.plot($("#c5a", b), { yr: [-2, 2], xlabel: "t (s)", series: [{ x: xs, y: sig, color: "#4fb3ff", w: 1 }, { x: xs, y: th, color: "#ff5d5d", dash: [4, 3], label: "limiar θ" }, { x: xs, y: sp, color: "#ffd36b", dots: true, w: 0, label: "disparos" }] });
    if (!this.curve) { const s = []; for (let v = .05; v <= 2; v += .075) s.push(+v.toFixed(3)); this.curve = { s, y: s.map(v => M.srSNR(v)) }; }
    const c = this.curve, i = c.y.indexOf(Math.max(...c.y));
    C.plot($("#c5b", b), { xlabel: "σ", series: [{ x: c.s, y: c.y, color: "#c084fc", dots: true, label: "SNR (u.a.)" }], vlines: [{ x: c.s[i], color: "#3ee6c5", label: "ótimo " + fmt(c.s[i]) }, { x: st.p.sigma, color: "#ffb547", label: "σ" }] });
  } };

  APPS.app6 = { title: "app6", w: 620, h: 420, render(b) {
    const R = REGIONS[st.region], mod = MODS.find(m => m.id === st.mod), o = st.out;
    this.nodes = [{ id: "a", x: 20, y: 120, t: "Dermátomo/Sintoma", s: R.name.slice(0, 26), c: "#ffb547" }, { id: "b", x: 170, y: 40, t: "Via nervosa", s: R.structures[0].slice(0, 24), c: "#4fb3ff" },
      { id: "c", x: 320, y: 120, t: "Intervenção", s: mod.name, c: "#3ee6c5" }, { id: "d", x: 170, y: 210, t: "Modelo/Segurança", s: o.sh ? "k = " + fmt(o.sh.k) : "sem corrente", c: "#c084fc" }, { id: "e", x: 440, y: 210, t: "Efeito esperado", s: "[HIPÓTESE]", c: "#ff7aa8" }];
    this.edges = [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["c", "e"]]; this.sel = null;
    b.innerHTML = `<div class="row" style="margin-bottom:6px"><button class="btn" id="g6add">+ nó</button><button class="btn ghost" id="g6clr">Limpar arestas</button><span class="note">Arraste os nós; clique em dois nós para ligar.</span></div><svg class="graph" id="g6"></svg>`;
    $("#g6add", b).onclick = () => { this.nodes.push({ id: "n" + Date.now(), x: 60 + Math.random() * 300, y: 60 + Math.random() * 160, t: "Nota", s: "editar", c: "#e6f4f5" }); this.draw(b); };
    $("#g6clr", b).onclick = () => { this.edges = []; this.draw(b); };
    this.draw(b);
  }, draw(b) {
    const svg = $("#g6", b); if (!svg) return; const N = Object.fromEntries(this.nodes.map(n => [n.id, n]));
    svg.innerHTML = this.edges.map(([a, c]) => { const p = N[a], q = N[c]; if (!p || !q) return ""; const x1 = p.x + 140, y1 = p.y + 22, x2 = q.x, y2 = q.y + 22; return `<path d="M${x1} ${y1} C${x1 + 40} ${y1} ${x2 - 40} ${y2} ${x2} ${y2}" stroke="${p.c}" opacity=".7"/>`; }).join("")
      + this.nodes.map(n => `<g class="n" data-id="${n.id}" transform="translate(${n.x},${n.y})"><rect width="140" height="44" fill="rgba(10,30,36,.9)" stroke="${this.sel === n.id ? "#fff" : n.c}"/><text x="10" y="18" style="fill:${n.c}">${n.t}</text><text x="10" y="34" style="font-weight:500">${n.s}</text></g>`).join("");
    $$(".n", svg).forEach(gEl => { let d = null; const n = N[gEl.dataset.id];
      gEl.addEventListener("pointerdown", e => { d = { x: e.clientX, y: e.clientY, ox: n.x, oy: n.y, m: 0 }; gEl.setPointerCapture(e.pointerId); });
      gEl.addEventListener("pointermove", e => { if (!d) return; const s = svg.getBoundingClientRect().width / (svg.viewBox.baseVal.width || svg.getBoundingClientRect().width); n.x = d.ox + (e.clientX - d.x) / s; n.y = d.oy + (e.clientY - d.y) / s; d.m += 1; gEl.setAttribute("transform", `translate(${n.x},${n.y})`); });
      gEl.addEventListener("pointerup", () => { if (d && d.m < 3) { if (this.sel && this.sel !== n.id) { this.edges.push([this.sel, n.id]); this.sel = null; } else this.sel = n.id; } d = null; this.draw(b); }); });
  } };

  APPS.app7 = { title: "app7", w: 400, h: 330, render(b) {
    b.innerHTML = `<div class="flags" style="justify-content:center;font-size:26px;margin-bottom:10px">${g.I18N.langs.map(l => `<button data-l="${l}" class="${l === g.I18N.lang ? "on" : ""}" style="font-size:26px">${g.I18N.FLAGS[l]}</button>`).join("")}</div>
      <p class="note">Interface: dicionários estáticos (offline). Fichas técnicas livres: IA do servidor (${st.api ? t("online") : t("offline")}). Símbolos, unidades e etiquetas de procedência não são traduzidos.</p>
      <textarea id="t7" style="width:100%;height:80px;background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:8px;font-size:14px">Função de ativação positiva sob o cátodo [LITERATURA]</textarea>
      <div class="row" style="margin-top:6px"><button class="btn" id="t7b">Traduzir ficha</button></div><div id="t7o" class="card" style="margin-top:8px"></div>`;
    $$("[data-l]", b).forEach(x => x.onclick = () => { g.I18N.set(x.dataset.l); this.render(b); });
    $("#t7b", b).onclick = async () => { const o = $("#t7o", b); if (!st.api) { o.innerHTML = `<p>${t("offline")}: a tradução livre requer a API em axon.m3d.pro (chaves de IA via SERVIDOR_ENV).</p>`; return; }
      o.textContent = "…"; try { const r = await fetch("/api/ai/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texts: [$("#t7", b).value], target: g.I18N.lang }) }).then(r => r.json()); o.textContent = r.texts[0] + "  (" + r.mode + ")"; } catch (e) { o.textContent = t("offline"); } };
  } };

  let a8tab = "chat";
  APPS.app8 = { title: "app8", w: 470, h: 470, render(b) { this.draw(b); }, draw(b) {
    if (b.dataset.tab === a8tab && b.innerHTML) return; b.dataset.tab = a8tab;
    const tabs = [["chat", "Axon Bot"], ["agenda", t("schedule")], ["rooms", t("rooms")]];
    let h = `<div class="wtabs">${tabs.map(([k, l]) => `<button data-k="${k}" class="${k === a8tab ? "on" : ""}">${l}</button>`).join("")}</div>`;
    if (a8tab === "chat") h += `<div class="chat" id="chat"><div class="m a">Olá! Sou o Axon Bot. Pergunte sobre seletividade, Shannon, taVNS, acupressão, fibras C, ruído ou validação. Nunca invento números: cito o modelo com etiqueta.</div></div><div class="inrow"><input id="q8" data-i18n-ph="ask" placeholder="${t("ask")}"><button class="btn" id="s8">${t("send")}</button></div><p class="note">${st.api ? t("online") : t("offline") + " — respostas da base do livro"}</p>`;
    if (a8tab === "agenda") h += `<div class="gantt">${SCHEDULE.map(([n, a, z, c]) => `<div>${n}</div><div class="tr"><i style="left:${a / 48 * 100}%;width:${(z - a) / 48 * 100}%;background:${c}"></i></div>`).join("")}<div></div><div class="note" style="display:flex;justify-content:space-between"><span>0</span><span>12</span><span>24</span><span>36</span><span>48 meses</span></div></div><p class="note">Diagrama 3 do livro. As dependências reais estão nos critérios de passagem, não nas datas. ${tagHTML("lit", "teixeira")}</p>`;
    if (a8tab === "rooms") h += `<div class="card"><h4>Salas de estudo (WebRTC)</h4><p>Sinalização em <code>wss://axon.m3d.pro/ws/rooms</code> (perfil <code>collab</code>). Sem persistência; apelidos efêmeros (LGPD).</p><div class="inrow"><input id="room" value="biofisica-ibilce"><button class="btn" id="join">Entrar</button></div><div id="roomo" class="note"></div></div>`;
    b.innerHTML = h;
    $$(".wtabs button", b).forEach(x => x.onclick = () => { a8tab = x.dataset.k; this.draw(b); });
    if (a8tab === "chat") { const send = () => ask($("#q8", b).value, b); $("#s8", b).onclick = send; $("#q8", b).onkeydown = e => e.key === "Enter" && send(); }
    if (a8tab === "rooms") $("#join", b).onclick = () => { const o = $("#roomo", b); try { const ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws/rooms?room=" + encodeURIComponent($("#room", b).value)); ws.onopen = () => o.textContent = "Conectado."; ws.onmessage = e => { const m = JSON.parse(e.data); o.textContent = m.type === "welcome" ? `Você: ${m.id} · pares: ${m.peers.length}` : `${m.type} ${m.id || ""}`; }; ws.onerror = () => o.textContent = "Servidor de salas indisponível neste ambiente."; } catch (e) { o.textContent = "Servidor de salas indisponível neste ambiente."; } };
  } };
  async function ask(q, b) {
    if (!q || !q.trim()) return; const chat = $("#chat", b); chat.insertAdjacentHTML("beforeend", `<div class="m u"></div>`); chat.lastChild.textContent = q; $("#q8", b).value = "";
    let ans = null, tag = "pre";
    if (st.api) { try { const r = await fetch("/api/ai/bot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q, lang: g.I18N.lang, context: { ratio_1mm: REFDATA.ratio_3_9_r1mm, modality: st.mod, region: st.region } }) }).then(r => r.json()); ans = r.text; tag = r.mode === "ia" ? "hip" : "lit"; } catch (e) {} }
    if (!ans) { const hit = FAQ.find(([re]) => re.test(q)); ans = hit ? hit[1] : "Não encontrei isso na base offline. Consulte o Manual do Usuário ou o Anexo F do livro."; tag = hit ? hit[2] : "pre"; }
    chat.insertAdjacentHTML("beforeend", `<div class="m a"></div>`); chat.lastChild.textContent = ans; chat.lastChild.insertAdjacentHTML("beforeend", " " + tagHTML(tag)); chat.scrollTop = 1e6; botSay(ans.slice(0, 120) + (ans.length > 120 ? "…" : ""));
  }

  // ---------------------------------------------------------------- Atualizações (versão + registro de alterações)
  const esc = x => String(x).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function relHTML(R, cur) {
    return (R.releases || []).map(r => `<div class="rel ${r.version === cur ? "cur" : ""}"><h4>v${esc(r.version)} <small>${esc(r.date)}</small>${r.version === cur ? ' <span class="badge">no ar</span>' : ""}</h4>${r.summary ? `<p class="sum">${esc(r.summary)}</p>` : ""}${Object.entries(r.sections || {}).map(([k, v]) => `<h5>${esc(k)}</h5><ul>${v.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`).join("")}</div>`).join("");
  }
  APPS.updates = { title: "updates", w: 520, h: 520, render(b) {
    b.innerHTML = `<div class="card"><h4>axon v${esc(REL.version)}</h4><p class="note">commit ${esc(REL.sha || "—")} · build ${esc((REL.built_at || "").replace("T", " ").replace("Z", " UTC"))}</p>
      <p class="note">Cada atualização aprovada nos testes é publicada automaticamente em axon.m3d.pro: tag de versão, GitHub Release com estas notas e deploy na VPS (com rollback se a verificação de saúde falhar).</p></div>${relHTML(REL, REL.version)}`;
  } };
  let toastShown = "";
  async function checkUpdate() {
    try {
      const r = await fetch("release.json?ts=" + Date.now(), { cache: "no-store" }); if (!r.ok) return; const j = await r.json();
      if (j.version && j.version !== REL.version && j.version !== toastShown) {
        toastShown = j.version; const top = (j.releases || [])[0] || {}, n = Object.values(top.sections || {}).flat().length;
        const el = $("#toast"); el.hidden = false;
        el.innerHTML = `<span>${esc(t("newVersion"))}: <b>v${esc(j.version)}</b> · ${n} alteração(ões)</span><button class="btn" id="tReload">${esc(t("reload"))}</button><button class="btn ghost" id="tSee">Ver notas</button><button class="btn ghost" id="tX" aria-label="Fechar">✕</button>`;
        $("#tReload").onclick = () => location.reload(); $("#tX").onclick = () => el.hidden = true;
        $("#tSee").onclick = () => { openApp("updates"); const w = WM.wins.updates; if (w) w.querySelector(".body").innerHTML = relHTML(j, j.version); };
      }
    } catch (e) { /* offline ou artefato estático: sem verificação */ }
  }

  // ---------------------------------------------------------------- Axon Bot (mascote)
  let muted = false, botTimer;
  function botSay(s) { if (muted) return; const b = $("#bot"); b.querySelector(".bubble").textContent = s; b.classList.add("talk"); clearTimeout(botTimer); botTimer = setTimeout(() => b.classList.remove("talk"), 5200); }

  // ---------------------------------------------------------------- ações
  function setMod(id) {
    const m = MODS.find(x => x.id === id); st.mod = id;
    Object.assign(st.p, { f: m.f, pw: m.pw || st.p.pw, area: m.area, r: m.r }); if (m.I) st.p.I = m.I; if (m.P) st.p.P = m.P; if (m.U) st.p.U = m.U;
    renderRight(); update(); renderLeft();
    botSay(`${m.name}: ${m.desc}`);
  }
  function selectRegion(k) { st.region = k; const R = REGIONS[k]; leftTab = "anat"; setMod(R.mod); renderLeft(); botSay(`${R.name}. Fibras: ${R.fibers.map(f => FIBERS[f].n).join(", ")}.`); if (WM.wins.app6) APPS.app6.render(WM.wins.app6.querySelector(".body")); }
  // dermátomo clicado na pele → região correspondente (mapa didático)
  const DERM_REGION = c => /^V/.test(c) ? "trigeminal" : /^C[678]$/.test(c) ? "median" : /^T[4-6]$/.test(c) ? "visceral" : /^(L[45]|S1)$/.test(c) ? "L5S1" : null;
  function selectDermatome(code) {
    const reg = DERM_REGION(code);
    if (reg) selectRegion(reg);
    else { REGIONS["derm"] = { name: "Dermátomo " + code, structures: [`Raiz dorsal ${code}`, `Gânglio da raiz dorsal ${code}`, "Corno dorsal do segmento correspondente", "Território cutâneo com sobreposição dos vizinhos"], fibers: ["abeta", "adelta", "c"], symptoms: ["parestesia ou dor no território", "alodinia segmentar"], mod: "tens" }; st.region = "derm"; leftTab = "anat"; renderLeft(); }
    botSay(`Dermátomo ${code}${reg ? " → " + REGIONS[reg].name : ""}. Mapa didático: há sobreposição e variação individual.`);
  }
  let raf;
  function update() {
    cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
      const o = compute(); renderImpact(o);
      g.AxonStage.setParams({ D: st.p.D, r: Math.min(1.5, Math.max(.3, o.rEff)), I: st.out.elec ? st.p.I * o.trans : .6, modality: st.mod, pressure: st.p.P });
      const fs = g.AxonStage.stats(); if (fs) $("#fstat").textContent = `Fascículo: Aβ ${fs.rA}/${fs.nA} · Aδ ${fs.rD}/${fs.nD} recrutadas`;
      redrawAll();
    });
  }

  // ---------------------------------------------------------------- dicas detalhadas da barra de escala (hover)
  const SCALE_TIPS = {
    pt: { out: "Afastar", in: "Aproximar", k: ["Escala", "O que se vê", "Modelo / dados", "Interação"], lv: [
      ["Organismo inteiro", "≈ 1,7 m (10⁰ m)", "Pele com mapa de dermátomos (V1–S5), esqueleto, órgãos, vasos, músculos, nervos periféricos, cadeias autonômicas e pontos reflexos coloridos por categoria.", "Malhas BodyParts3D (930 estruturas, FMA) [LITERATURA]; dermátomos por vértice e trajetos nervosos ancorados em marcos ósseos [PREMISSA].", "Clique na pele → dermátomo; numa estrutura → nome + ID FMA; num ponto reflexo → associações em camadas. Arraste para girar, role para aproximar.", "Rolar para dentro leva ao nível 2."],
      ["Tecido e nervo periférico", "≈ 1–5 cm (10⁻² m)", "Bloco de tecido estratificado: epiderme, derme, hipoderme, fáscia e músculo, com o tronco nervoso misto e o dispositivo (TENS, EA, LIFU…) sobre a pele.", "Espessuras de camada [LITERATURA]; campo extracelular de fonte pontual em meio homogêneo ρe = 300 Ω·cm [PREMISSA].", "Mude modalidade, corrente e profundidade no painel direito; o mapa de calor de ativação acompanha.", "Nível 3 abre o feixe."],
      ["Feixe de fibras nervosas", "≈ 0,3–1 mm (10⁻⁴ m)", "Corte transversal com perineuro, endoneuro e fibras Aα, Aβ, Aδ e C; fibras ativadas acendem; ramificações axonais dentro do feixe.", "Limiar Ith(D, r) do modelo nodal de 41 nós, interpolado em grade; distribuição de diâmetros [RESULTADO DE MODELO · SEMENTE 42].", "Ative 'Ramificações no feixe' no app Anatomia; altere distância eletrodo-fibra.", "Nível 4 isola um axônio."],
      ["Fibra nervosa isolada", "≈ 1–20 µm (10⁻⁵ m)", "Axônio mielinizado com internós (L = 100·D) e nós de Ranvier (2,5 µm); potencial de ação saltatório propagando; colateral no nó 2.", "Cabo passivo McNeal (N = 41, Euler explícito dt = 1 µs, Cm 2 µF/cm², gL 30,3 mS/cm²); função de ativação de Rattay [DERIVADO].", "A cor dos nós mostra a função de ativação; ajuste diâmetro e pulso.", "Nível 5 mostra a membrana."],
      ["Escala molecular", "≈ 5–10 nm (10⁻⁸ m)", "Bicamada lipídica com canais Nav (nó), Kv (justaparanodal) e bomba Na⁺/K⁺; íons atravessando durante o disparo.", "Representação ilustrativa; o modelo usado nos cálculos é passivo com limiar Vth = 20 mV [PREMISSA] — não há cinética de canais simulada.", "Observe a abertura sincronizada com o estímulo; use o app Ruído (ressonância estocástica).", "Rolar para fora volta ao nível 4."]] },
    en: { out: "Zoom out", in: "Zoom in", k: ["Scale", "What you see", "Model / data", "Interaction"], lv: [
      ["Whole organism", "≈ 1.7 m (10⁰ m)", "Skin with dermatome map (V1–S5), skeleton, organs, vessels, muscles, peripheral nerves, autonomic chains and color-coded reflex points.", "BodyParts3D meshes (930 structures, FMA) [LITERATURE]; per-vertex dermatomes and bone-anchored nerve paths [PREMISE].", "Click skin → dermatome; a structure → name + FMA ID; a reflex point → layered associations. Drag to rotate, scroll to zoom.", "Scroll in for level 2."],
      ["Tissue and peripheral nerve", "≈ 1–5 cm (10⁻² m)", "Layered tissue block: epidermis, dermis, hypodermis, fascia and muscle, with the mixed nerve trunk and the device on the skin.", "Layer thicknesses [LITERATURE]; point-source extracellular field, homogeneous ρe = 300 Ω·cm [PREMISE].", "Change modality, current and depth in the right panel; the activation heat map follows.", "Level 3 opens the bundle."],
      ["Nerve fiber bundle", "≈ 0.3–1 mm (10⁻⁴ m)", "Cross-section with perineurium, endoneurium and Aα, Aβ, Aδ, C fibers; activated fibers light up; axon branching inside the bundle.", "Threshold Ith(D, r) from the 41-node model on a grid; diameter distribution [MODEL RESULT · SEED 42].", "Enable 'Branching in bundle' in the Anatomy app; change electrode–fiber distance.", "Level 4 isolates one axon."],
      ["Single nerve fiber", "≈ 1–20 µm (10⁻⁵ m)", "Myelinated axon with internodes (L = 100·D) and nodes (2.5 µm); saltatory action potential; collateral at node 2.", "Passive McNeal cable (N = 41, explicit Euler dt = 1 µs); Rattay activation function [DERIVED].", "Node color shows the activation function; adjust diameter and pulse.", "Level 5 shows the membrane."],
      ["Molecular scale", "≈ 5–10 nm (10⁻⁸ m)", "Lipid bilayer with Nav (node), Kv (juxtaparanode) channels and Na⁺/K⁺ pump; ions crossing during firing.", "Illustrative; the computational model is passive with threshold Vth = 20 mV [PREMISE] — no channel kinetics simulated.", "Watch opening synchronized with the stimulus; see the Noise app (stochastic resonance).", "Scroll out to return to level 4."]] }
  };

  // ---------------------------------------------------------------- inicialização
  function init() {
    // Dock
    const order = ["app1", "app2", "app3", "app4", "app5", "app6", "app7", "app8", "reflex", "sim"];
    $("#dock").innerHTML = order.map(id => `<button data-app="${id}" aria-label="${t(id)}">${g.AxonIcons[id]}<span class="tip" data-i18n="${id}">${t(id)}</span></button>`).join("")
      + `<button data-app="updates" aria-label="${t("updates")}">${g.AxonIcons.updates}<span class="tip" data-i18n="updates">${t("updates")}</span></button><span class="sep"></span><a href="docs/manual-usuario.html" target="_blank" rel="noopener"><button aria-label="Manuais">${g.AxonIcons.docs}<span class="tip">Manuais</span></button></a>`;
    $$("#dock button[data-app]").forEach(b => b.onclick = () => b.dataset.app === "sim" ? g.AxonSim && g.AxonSim.toggle() : openApp(b.dataset.app));
    $("#bot .art").innerHTML = g.AxonIcons.bot;
    $("#bot").onclick = () => openApp("app8");
    $("#botMute").onclick = e => { e.stopPropagation(); muted = !muted; $("#bot").classList.toggle("muted", muted); $("#botMute").textContent = muted ? "🔇" : "🔊"; };
    // idiomas
    $("#flags").innerHTML = g.I18N.langs.map(l => `<button data-l="${l}" title="${l}">${g.I18N.FLAGS[l]}</button>`).join("");
    $$("#flags button").forEach(b => b.onclick = () => g.I18N.set(b.dataset.l));
    document.addEventListener("axon:lang", () => { $$("#flags button").forEach(b => b.classList.toggle("on", b.dataset.l === g.I18N.lang)); renderLeft(); renderRight(); update(); Object.entries(WM.wins).forEach(([id, w]) => { w.querySelector(".body").innerHTML = ""; w.querySelector(".body").dataset.tab = ""; APPS[id].render(w.querySelector(".body")); }); });
    $$("#flags button").forEach(b => b.classList.toggle("on", b.dataset.l === g.I18N.lang));
    // painéis retráteis
    $$(".side-h button").forEach(b => b.onclick = () => { const s = b.closest(".side"); s.classList.toggle("collapsed"); b.textContent = s.classList.contains("collapsed") ? (s.id === "left" ? "›" : "‹") : (s.id === "left" ? "‹" : "›"); setTimeout(() => window.dispatchEvent(new Event("resize")), 320); });
    $$("#leftTabs button").forEach(b => b.onclick = () => { leftTab = b.dataset.tab; renderLeft(); });
    // escala
    const drawScale = () => {
      const L = SCALE_TIPS[g.I18N.lang] || SCALE_TIPS.en;
      $("#scalebar").innerHTML = `<button class="z" data-z="-1" aria-label="${L.out}">−</button>` + [1, 2, 3, 4, 5].map(l => { const d = L.lv[l - 1];
        return `<button data-l="${l}" class="${st.level === l ? "on" : ""}" aria-describedby="sct${l}"><span class="ic">${g.AxonIcons["scale" + l]}</span><span class="n">${l}</span> <span class="lab" data-i18n="scale${l}">${t("scale" + l)}</span>
          <span class="sctip" role="tooltip" id="sct${l}"><span class="sch"><span class="ic big">${g.AxonIcons["scale" + l]}</span><span><b>${l} · ${t("scale" + l)}</b><em>${d[0]}</em></span></span>
          ${[[L.k[0], d[1]], [L.k[1], d[2]], [L.k[2], d[3]], [L.k[3], d[4]]].map(([k, v]) => `<span class="scr"><i>${k}</i><span>${v}</span></span>`).join("")}<span class="scf">${d[5]}</span></span></button>`; }).join("") + `<button class="z" data-z="1" aria-label="${L.in}">+</button>`;
      $$("#scalebar [data-l]").forEach(b => b.onclick = () => g.AxonStage.setLevel(+b.dataset.l));
      $$("#scalebar [data-z]").forEach(b => b.onclick = () => g.AxonStage.setLevel(g.AxonStage.level + +b.dataset.z));
    };
    drawScale(); document.addEventListener("axon:lang", drawScale);
    document.addEventListener("axon:scale", e => { st.level = e.detail.level; $$("#scalebar [data-l]").forEach(b => b.classList.toggle("on", +b.dataset.l === st.level)); renderLeft(); });
    document.addEventListener("axon:select", e => selectRegion(e.detail.region));
    document.addEventListener("axon:dermatome", e => { if (!g.AxonSim || !g.AxonSim.active) selectDermatome(e.detail.code); });
    document.addEventListener("axon:structure", e => { const d = e.detail; st.structure = d;
      botSay(`${d.name}${d.fma ? " · " + d.fma : ""}${d.note ? " (" + d.note + ")" : ""}`);
      const el = $("#structCard"); if (el) el.innerHTML = `<h4>Estrutura selecionada</h4><p><b>${esc(d.name)}</b>${d.en && d.en !== d.name ? ` <span class="note">(${esc(d.en)})</span>` : ""}</p><p class="note">${d.fma ? "Foundational Model of Anatomy: " + esc(d.fma) + " · " : ""}camada: ${esc(d.layer)}${d.note ? " · " + esc(d.note) : ""}</p>`; });
    g.AxonStage.init($("#stage"));
    $$("#scalebar [data-l]").forEach(b => b.classList.toggle("on", +b.dataset.l === 1));
    renderRight(); renderLeft(); update(); g.I18N.apply();
    if (innerWidth > 900) setTimeout(() => { openApp("app3"); openApp("app4"); }, 300);
    setTimeout(() => botSay("Clique num ponto pulsante do corpo ou use a roda do mouse para descer de escala."), 1200);
    // versão e atualizações
    $("#verPill").textContent = "v" + VERSION; $("#verPill").onclick = () => openApp("updates");
    setTimeout(checkUpdate, 4000); setInterval(checkUpdate, 180000);
    // API
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 2500);
    fetch("api/health", { signal: ctl.signal }).then(r => r.ok ? r.json() : null).then(j => { if (j && j.project === "axon") { st.api = true; $("#apiPill").textContent = "API " + j.version; $("#apiPill").classList.add("on"); } }).catch(() => {});
  }
  g.AxonApp = { init, openApp, closeApp, state: st, compute, update, tagHTML, esc: x => String(x).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]), botSay: (s2) => botSay(s2),
    registerApp(id, def) { APPS[id] = def; }, isOpen: id => !!WM.wins[id], body: id => WM.wins[id] && WM.wins[id].querySelector(".body"), setMod, slider, MODS, FIBERS, renderRight, renderLeft };
})(window);
