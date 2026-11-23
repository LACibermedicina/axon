/* axon · workbench.js — bancada do simulador: ícones no menu superior, ocultar todos os painéis, início limpo
   (só o modelo no fundo), trilhos de ícones com descrição quando os painéis estão recolhidos, cartões que se
   destacam dos painéis laterais e voltam a eles, escolha clara do tipo de exploração e da técnica e um guia
   passo a passo com parâmetros sugeridos. */
(function (g) {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const A = () => g.AxonApp, I = k => (g.AxonIcons && g.AxonIcons[k]) || "";

  // ------------------------------------------------------------ menu superior
  const MENU = [
    ["panelL", "Painel de anatomia, sintomas e protocolo (esquerdo)", () => toggleSide("left")],
    ["panelR", "Painel de técnica, parâmetros e impacto (direito)", () => toggleSide("right")],
    ["hideall", "Ocultar ou mostrar todos os painéis e janelas (tecla \\)", () => zen()],
    null,
    ["tools", "Tipo de exploração e técnica: escolha o modo e o instrumento", () => A().openApp("tools")],
    ["guide", "Guia passo a passo com parâmetros sugeridos", () => A().openApp("guide")],
    ["patient", "Paciente: sexo, idade, IMC, fototipo e descrição do caso", () => A().openApp("patient")],
    ["planner", "Plano terapêutico: técnica sugerida, % de adequação, tempo e desfecho", () => A().openApp("planner")],
    null,
    ["depth", "Dissecção: profundidade, camadas e corte do modelo", () => A().openApp("depth")],
    ["imaging", "Imagens simuladas (TC, RM, RX) e EMG em paralelo", () => A().openApp("imaging")],
    ["maps", "Mapas de acupuntura, eletroacupuntura, YNSA e auriculoterapia", () => A().openApp("maps")],
    ["relations", "Modo músculo ↔ nervo e estruturas indiretamente relacionadas", () => A().openApp("relations")],
    ["cns", "Sistema nervoso central e autônomo com órgãos e fibras", () => A().openApp("cns")],
    ["morpho", "Calibre do axônio: predição por biometria e clínica, prolongamento até a placa motora", () => A().openApp("morpho")],
    ["graph", "Grafo 3D: ponto/região → nervo → fibras → segmento → vias → órgãos e sistemas", () => A().openApp("graph")],
  ];
  function buildMenu() {
    const bar = $(".menubar"); if (!bar || $(".mbicons")) return;
    const nav = document.createElement("nav"); nav.className = "mbicons"; nav.setAttribute("aria-label", "Ferramentas da bancada");
    nav.innerHTML = MENU.map(m => m ? `<button data-m="${m[0]}" title="${esc(m[1])}" aria-label="${esc(m[1])}">${I(m[0])}<span class="mtip">${esc(m[1])}</span></button>` : `<span class="msep"></span>`).join("");
    const sp = bar.querySelector(".sp"); bar.insertBefore(nav, sp);
    const chip = document.createElement("button"); chip.className = "pill modechip"; chip.id = "modeChip"; chip.title = "Tipo de exploração e técnica atuais (clique para trocar)"; chip.onclick = () => A().openApp("tools"); bar.insertBefore(chip, nav);
    $$("button[data-m]", nav).forEach(b => b.onclick = () => MENU.find(m => m && m[0] === b.dataset.m)[2]());
    updateChip();
  }
  function toggleSide(id) { const s = $("#" + id); if (!s) return; s.classList.toggle("collapsed"); const b = s.querySelector(".side-h button"); if (b) b.textContent = s.classList.contains("collapsed") ? (id === "left" ? "›" : "‹") : (id === "left" ? "‹" : "›"); setTimeout(() => dispatchEvent(new Event("resize")), 320); }
  function zen(force) { const on = force != null ? force : !document.body.classList.contains("zen"); document.body.classList.toggle("zen", on); $$(".mbicons [data-m='hideall']").forEach(b => b.classList.toggle("on", on)); setTimeout(() => dispatchEvent(new Event("resize")), 60); }
  addEventListener("keydown", e => { if (e.key === "\\" && !/input|textarea|select/i.test(e.target.tagName)) zen(); });

  // ------------------------------------------------------------ tipo de exploração e técnica
  const MODES = [
    { id: "anat", n: "Exploração anatômica", d: "Camadas, cortes, imagens e relações músculo–nervo", open: ["depth"] },
    { id: "bio", n: "Estudo biofísico", d: "Escalas do corpo à membrana, limiares e fronteiras de segurança", open: ["app3", "app4"] },
    { id: "sim", n: "Simulação de intervenção", d: "Instrumento sobre a pele, monitor do paciente e desfecho", open: [] },
    { id: "plan", n: "Planejamento clínico", d: "Caso, técnica sugerida, parâmetros, tempo e desfecho", open: ["patient", "planner"] },
  ];
  const INSTR = [
    { id: "tens", ic: "tens", n: "TENS", k: "elétrica · superfície", d: "Eletrodos na pele; portão segmentar (alta frequência) ou opioides (baixa frequência)" },
    { id: "ea", ic: "ea", n: "Eletroacupuntura", k: "elétrica · agulha", d: "Agulhas em pontos com corrente de 2, 100 ou 2/100 Hz", map: "acu" },
    { id: "acu", ic: "acu", n: "Acupressão", k: "mecânica", d: "Pressão sobre o ponto, abaixo do limiar de dor à pressão", map: "acu" },
    { id: "tavns", ic: "tavns", n: "taVNS", k: "elétrica · aurícula", d: "Estímulo na cymba conchae (ramo auricular do vago)", map: "aur" },
    { id: "aur", ic: "aur", n: "Auriculoterapia", k: "mecânica/agulha · aurícula", d: "Pontos auriculares por somatotopia", map: "aur", mod: "acu" },
    { id: "ynsa", ic: "ynsa", n: "Craniopuntura YNSA", k: "agulha · couro cabeludo", d: "Pontos básicos de Yamamoto", map: "ynsa", mod: "ea" },
    { id: "scs", ic: "app2", n: "SCS", k: "elétrica · implantada", d: "Estimulação da medula espinal (estudo biofísico)" },
    { id: "ti", ic: "app2", n: "Interferencial (TI)", k: "elétrica · superfície", d: "Batimento entre duas portadoras de kHz" },
    { id: "lifu", ic: "app5", n: "Ultrassom focado (LIFU)", k: "acústica", d: "Uso experimental; fronteiras térmicas e mecânicas" },
  ];
  const WB = { mode: null, instr: null };
  function updateChip() { const c = $("#modeChip"); if (!c) return; const m = MODES.find(x => x.id === WB.mode), i = INSTR.find(x => x.id === WB.instr) || INSTR.find(x => x.id === (A() && A().state.mod));
    c.innerHTML = `<b>${m ? esc(m.n) : "Escolha a exploração"}</b>${i ? " · " + esc(i.n) : ""}`; }
  function setMode(id) {
    WB.mode = id; const m = MODES.find(x => x.id === id); m.open.forEach(a => A().openApp(a));
    const S = g.AxonSim; if (S && S.toggle) { if (id === "sim" && !S.active) S.toggle(); if (id !== "sim" && S.active) S.toggle(); }
    if (id === "anat" && g.AxonDissect) g.AxonDissect.setDepth(1);
    updateChip(); A().botSay(`${m.n}: ${m.d}.`);
  }
  function setInstr(id) {
    const it = INSTR.find(x => x.id === id); WB.instr = id; const mod = it.mod || it.id;
    if (A().MODS.some(m => m.id === mod)) A().setMod(mod);
    if (it.map && g.AxonMaps) { A().openApp("maps"); const b = A().body("maps"); const btn = b && b.querySelector(`.mtabs [data-t="${it.map}"]`); if (btn) btn.click(); }
    updateChip();
  }
  function toolsWin(b) {
    b.innerHTML = `<div class="card"><h4>1. Tipo de exploração</h4><div class="modes">${MODES.map(m => `<button class="mode ${WB.mode === m.id ? "on" : ""}" data-mo="${m.id}"><b>${esc(m.n)}</b><span>${esc(m.d)}</span></button>`).join("")}</div></div>
      <div class="card"><h4>2. Técnica e instrumento</h4><div class="instr">${INSTR.map(i => `<button class="ins ${(WB.instr || A().state.mod) === i.id ? "on" : ""}" data-in="${i.id}" title="${esc(i.d)}"><span class="ii">${I(i.ic)}</span><b>${esc(i.n)}</b><em>${esc(i.k)}</em></button>`).join("")}</div>
      <p class="note" id="insD">${esc((INSTR.find(i => i.id === (WB.instr || A().state.mod)) || {}).d || "Escolha um instrumento para ver o que ele faz.")}</p></div>
      <div class="card"><h4>3. Próximo passo</h4><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" data-go="guide">Seguir o guia</button><button class="btn ghost" data-go="planner">Ver a técnica sugerida para o caso</button><button class="btn ghost" data-go="sim">Aplicar no paciente simulado</button></div></div>`;
    $$("[data-mo]", b).forEach(x => x.onclick = () => { setMode(x.dataset.mo); toolsWin(b); });
    $$("[data-in]", b).forEach(x => x.onclick = () => { setInstr(x.dataset.in); toolsWin(b); });
    $$("[data-go]", b).forEach(x => x.onclick = () => x.dataset.go === "sim" ? setMode("sim") : A().openApp(x.dataset.go));
  }

  // ------------------------------------------------------------ guia passo a passo
  const GUIDE = [
    { k: "mode", n: "Escolha o tipo de exploração", d: "Planejamento clínico para seguir um caso; simulação para aplicar um instrumento; anatômica ou biofísica para estudar.", act: ["tools", "Abrir"] },
    { k: "patient", n: "Defina o paciente e o caso", d: "Sexo, idade, IMC e fototipo mudam o modelo; a descrição em texto cria um caso fictício com origem da dor, EVA e segmentos.", act: ["patient", "Paciente"] },
    { k: "plan", n: "Veja a técnica sugerida", d: "O plano ordena as técnicas por adequação (%), mostra os fatores, os riscos, os benefícios e o tempo de tratamento.", act: ["planner", "Plano"] },
    { k: "target", n: "Escolha o instrumento e o ponto", d: "Ícones de instrumentos e mapas (acupontos, YNSA, aurículo); o caso destaca os pontos sugeridos.", act: ["maps", "Mapas"] },
    { k: "params", n: "Ajuste os parâmetros sugeridos", d: "No mapa interativo do plano, arraste para frequência e intensidade; 'Aplicar no simulador' leva os valores ao painel direito.", act: ["planner", "Parâmetros"] },
    { k: "apply", n: "Aplique e monitore", d: "No modo Simulação, clique na pele para posicionar o instrumento e inicie; acompanhe o monitor, o EMG e a rede fisiológica.", act: ["sim", "Simular"] },
    { k: "outcome", n: "Avalie o desfecho", d: "Objetivo (EVA, algometria, EMG, RMSSD) e subjetivo (dor no ponto e área dolorosa) para 1 e várias sessões.", act: ["planner", "Desfecho"] },
  ];
  function guideWin(b) {
    const P = g.AxonPlanner, cs = (g.AxonSim && g.AxonSim.case), rows = P && cs && A().state.mc ? P.plan(cs) : null, top = rows && rows[0];
    const done = { mode: !!WB.mode, patient: !!(g.AxonDissect && g.AxonDissect.PT.applied), plan: A().isOpen("planner"), target: !!(g.AxonSim && g.AxonSim.app), params: false, apply: !!(g.AxonSim && g.AxonSim.running), outcome: !!(g.AxonSim && g.AxonSim.outcome) };
    b.innerHTML = `${top ? `<div class="card summary"><h4>Sugestão para ${esc(cs.title)}</h4><p><b>${esc(top.t.n)}</b> · ${Math.round(top.score * 100)} % de adequação</p><p class="note">${esc(top.t.par)} · ${top.t.min} min, ${top.t.spw}×/semana por ${top.t.wk} semanas. ${A().tagHTML("hip")}</p></div>` : ""}
      <ol class="guide">${GUIDE.map((s, i) => `<li class="${done[s.k] ? "done" : ""}"><span class="gn">${done[s.k] ? "✓" : i + 1}</span><div><b>${esc(s.n)}</b><p>${esc(s.d)}</p></div><button class="btn ghost sm" data-a="${s.act[0]}">${esc(s.act[1])}</button></li>`).join("")}</ol>`;
    $$("[data-a]", b).forEach(x => x.onclick = () => { if (x.dataset.a === "sim") setMode("sim"); else A().openApp(x.dataset.a); setTimeout(() => A().isOpen("guide") && guideWin(b), 400); });
  }

  // ------------------------------------------------------------ trilhos de ícones nos painéis recolhidos
  const RAILMAP = [[/estrutura/i, "app1", "Estrutura escolhida no corpo: nome, ID FMA e camada"], [/fibras/i, "app3", "Fibras predominantes da região: calibre, velocidade e função"], [/sintomas/i, "relations", "Sintomas associados à região"], [/mecanismo/i, "app6", "Mecanismo esperado da técnica"],
    [/técnica e parâmetros|parâmetros/i, "app2", "Técnica, frequência, amplitude, largura de pulso, área e distância"], [/variações/i, "patient", "Variações anatômicas do paciente (gordura, desmielinização, fibrose)"], [/impacto/i, "app4", "Impacto previsto: seletividade, recrutamento e fronteiras de segurança"], [/biof/i, "app5", "Equações e alertas metodológicos do nível atual"], [/protocolo|execução/i, "guide", "Execução in silico passo a passo"]];
  function buildRail(side) {
    const s = $("#" + side); if (!s) return; let rail = s.querySelector(".rail"); if (!rail) { rail = document.createElement("div"); rail.className = "rail"; s.appendChild(rail); }
    const cards = $$(".side-body .card", s).filter(c => c.querySelector("h4"));
    const items = [];
    if (side === "left") [["anat", "Anatomia", "app1"], ["phys", "Biofísica", "app5"], ["proto", "Protocolo", "guide"]].forEach(([k, n, ic]) => items.push({ ic, n, d: `Aba ${n}`, go: () => { toggleSide("left"); const t = s.querySelector(`[data-tab="${k}"]`); t && t.click(); } }));
    cards.forEach(c => { const h = c.querySelector("h4").textContent.trim(), m = RAILMAP.find(([re]) => re.test(h)) || [null, side === "left" ? "app1" : "app2", ""]; items.push({ ic: m[1], n: h, d: m[2] || h, go: () => { if (s.classList.contains("collapsed")) toggleSide(side); setTimeout(() => c.scrollIntoView({ behavior: "smooth", block: "start" }), 340); } }); });
    rail.innerHTML = items.map((it, i) => `<button data-i="${i}" aria-label="${esc(it.n)}">${I(it.ic)}<span class="rtip"><b>${esc(it.n)}</b>${esc(it.d)}</span></button>`).join("");
    $$("button", rail).forEach(bt => bt.onclick = () => items[+bt.dataset.i].go());
  }

  // ------------------------------------------------------------ cartões destacáveis (agrupar / desagrupar)
  const DET = new Map();   // chave → elemento flutuante
  const keyOf = c => c.dataset.key || (c.querySelector("h4") || {}).textContent || "";
  function float(key, side) {
    let f = DET.get(key); if (f) return f;
    f = document.createElement("section"); f.className = "floatcard"; f.dataset.key = key; f.dataset.side = side;
    const n = DET.size; Object.assign(f.style, { left: (innerWidth / 2 - 160 + n * 24) + "px", top: (110 + n * 24) + "px" });
    f.innerHTML = `<div class="fh"><span>${esc(key)}</span><button title="Encaixar de volta no painel" data-a="dock">⇲</button></div><div class="fb"></div>`;
    document.body.appendChild(f); DET.set(key, f);
    const h = f.querySelector(".fh"); let d = null;
    h.addEventListener("pointerdown", e => { if (e.target.dataset.a) return; d = { x: e.clientX - f.offsetLeft, y: e.clientY - f.offsetTop }; h.setPointerCapture(e.pointerId); });
    h.addEventListener("pointermove", e => { if (d) { f.style.left = Math.max(0, e.clientX - d.x) + "px"; f.style.top = Math.max(40, e.clientY - d.y) + "px"; } });
    h.addEventListener("pointerup", () => d = null);
    f.querySelector("[data-a=dock]").onclick = () => { DET.delete(key); f.remove(); side === "left" ? A().renderLeft() : (A().renderRight(), A().update()); };
    return f;
  }
  function decorate(side) {
    const body = side === "left" ? $("#leftBody") : $("#rightBody"); if (!body) return;
    $$(":scope > .card", body).forEach(c => {
      const key = keyOf(c).trim(); if (!key) return;
      if (DET.has(key)) { const fb = DET.get(key).querySelector(".fb"); fb.innerHTML = ""; fb.appendChild(c); return; }
      if (!c.querySelector(":scope > .detach")) { const b = document.createElement("button"); b.className = "detach"; b.title = "Destacar este grupo do painel"; b.setAttribute("aria-label", "Destacar " + key); b.textContent = "⇱";
        b.onclick = () => { const f = float(key, side); f.querySelector(".fb").appendChild(c); b.remove(); }; c.prepend(b); }
    });
  }
  function observe() {
    ["left", "right"].forEach(side => { const body = side === "left" ? $("#leftBody") : $("#rightBody"); if (!body) return;
      let busy = false; new MutationObserver(() => { if (busy) return; busy = true; requestAnimationFrame(() => { decorate(side); buildRail(side); busy = false; }); }).observe(body, { childList: true });
      decorate(side); buildRail(side); });
  }

  // ------------------------------------------------------------ início
  function boot() {
    const a = A(); if (!a || !a.registerApp || !$("#leftBody") || !g.AxonIcons) return setTimeout(boot, 80);
    a.registerApp("tools", { title: "tools", w: 460, h: 600, render: toolsWin });
    a.registerApp("guide", { title: "guide", w: 420, h: 640, render: guideWin });
    buildMenu(); observe();
    // início limpo: só o modelo no fundo da bancada
    ["left", "right"].forEach(id => { const s = $("#" + id); if (s && !s.classList.contains("collapsed")) toggleSide(id); });
    document.addEventListener("axon:lang", () => { $(".mbicons") && $(".mbicons").remove(); $("#modeChip") && $("#modeChip").remove(); buildMenu(); });
    ["axon:case", "axon:patient"].forEach(ev => document.addEventListener(ev, () => a.isOpen("guide") && guideWin(a.body("guide"))));
    setInterval(updateChip, 1500);
  }
  boot();
  g.AxonWorkbench = { zen, toggleSide, setMode, setInstr, MODES, INSTR, WB };
})(window);
