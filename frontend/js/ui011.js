/* axon · ui011.js — integração da v0.11
 *  • barra de ferramentas única, agrupada (Teoria · Caso · Experimento · Anatomia · Vista), com submenu do caso ativo
 *  • abas verticais ("orelhas") dos capítulos dos painéis laterais, visíveis com o painel aberto ou fechado
 *  • parâmetros simples com o avançado num ícone
 *  • guia que reproduz cada passo com parâmetros demonstrativos
 *  • bandeja 3D de instrumentos animados com passo a passo e parâmetros sugeridos para o caso
 *  • cartão de identificação do paciente (fictício) com queixa e métodos indicados (% do modelo + âncora da literatura) e ícone "Novo caso"
 *  • rede fisiológica clicável ligada à anatomia · pergunta ao assistente junto ao robô */
(function (g) {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (x, d = 0) => x == null || !isFinite(x) ? "—" : (+x).toFixed(d).replace(".", ",");
  const A = () => g.AxonApp, I = k => (g.AxonIcons && g.AxonIcons[k]) || "", WB = () => g.AxonWorkbench, ST = () => g.AxonStage;
  const TG = { lit: ["LITERATURA", "t-lit"], pre: ["PREMISSA", "t-pre"], der: ["DERIVADO", "t-der"], mod: ["RESULTADO DE MODELO - SEMENTE 42", "t-mod"], hip: ["HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO", "t-hip"] };
  const tag = k => `<span class="tag ${TG[k][1]}">${TG[k][0]}</span>`;
  const cs = () => (g.AxonSim && g.AxonSim.case) || null;
  const open = id => A().openApp(id);

  // ================================================================ barra de ferramentas única
  const GROUPS = () => {
    const c = cs(), segs = c ? c.pain.dermatomes.filter(d => /^[CTLS]\d/.test(d)) : [];
    return [
      { id: "teoria", n: "Teoria", ic: "book", items: [["book", "Livro teórico", "Fundamentos que acompanham o experimento", () => open("book")], ["manuscript", "Manuscrito", "Diário de bordo: linha do tempo, cálculos e desfechos; PDF e link público", () => open("manuscript")],
        ["atlas", "Atlas de pontos", "361 acupontos + extras, craniopuntura (YNSA, MS1–MS14) e aurículo", () => open("atlas")], ["cns", "SNC e autônomo", "Encéfalo, medula, fibras aferentes/eferentes e órgãos", () => open("cns")], ["graph", "Grafo 3D", "Do ponto à fibra, segmento, vias, órgãos e sistemas", () => open("graph")]] },
      { id: "caso", n: c ? "Caso" : "Caso", ic: "card", sub: c ? c.title : "nenhum caso", items: [["card", "Cartão do paciente", "Identificação fictícia, queixa e métodos indicados", () => open("patientcard")], ["newcase", "Novo caso", "Descrever em texto ou preencher", () => { PC.mode = "new"; open("patientcard"); }],
        ["patient", "Biometria do paciente", "Sexo, idade, altura, peso, fototipo", () => open("patient")], ["planner", "Plano terapêutico", "Técnica sugerida, %, tempo e desfecho", () => open("planner")],
        ...(c ? [["maps", `Pontos sugeridos · ${c.title}`, "Acupontos, YNSA e aurículo para a região do caso", () => open("maps")], ["relations", `Segmentos do caso (${segs.join(", ") || "—"})`, "Destacar dermátomos e miótomos do caso no corpo", () => ST().highlight({ seg: segs.join(","), reveal: true })],
          ["tests", "Testes deste caso", "Abrir o registro de testes", () => open("tests")]] : [])] },
      { id: "exp", n: "Experimento", ic: "tray", items: [["tray", "Bandeja de instrumentos", "Escolha o instrumento em 3D; passo a passo e parâmetros do caso", () => open("tray")], ["tools", "Tipo de exploração", "Anatomia, biofísica, simulação ou planejamento", () => open("tools")],
        ["guide", "Guia passo a passo", "Cada passo é reproduzido com parâmetros demonstrativos", () => open("guide")], ["explain", "Assistente: o que foi calculado", "Cálculo, motivo, o que acontece e o que se busca", () => open("explain")],
        ["tests", "Iniciar / registrar testes", "Sessão de testes com registro exportável", () => { const X = g.AxonInteract; if (X && !X.IX.test.on) X.startTests(); open("tests"); }], ["reflex", "Modo Simulação", "Monitor do paciente e rede fisiológica", () => WB().setMode("sim")]] },
      { id: "anat", n: "Anatomia", ic: "depth", items: [["depth", "Profundidade e camadas", "Dissecção, opacidade, corte, pele realista", () => open("depth")], ["imaging", "Imagens e EMG", "TC, RM, RX no corte e EMG", () => open("imaging")],
        ["relations", "Músculo ↔ nervo", "Inervação e estruturas relacionadas", () => open("relations")], ["terminals", "Terminações nervosas", "Até a placa motora, por grupo anatômico; receptores da pele", () => open("terminals")],
        ["morpho", "Calibre do axônio", "Predição por biometria e clínica", () => open("morpho")], ["maps", "Mapas do caso", "Pontos sugeridos e disponíveis", () => open("maps")]] },
      { id: "vista", n: "Vista", ic: "hideall", items: [["panelL", "Painel esquerdo", "Anatomia, biofísica, protocolo", () => WB().toggleSide("left")], ["panelR", "Painel direito", "Técnica e parâmetros, impacto", () => WB().toggleSide("right")],
        ["hideall", "Ocultar tudo (\\)", "Só o modelo na tela", () => WB().zen()], ["notes", "Notas (post-its)", "Mostrar ou ocultar o painel de notas", () => g.AxonNotes && g.AxonNotes.toggle()]] },
    ];
  };
  function toolbar() {
    const old = $(".mbicons"); if (!old || old.dataset.v === "11") return; old.dataset.v = "11"; old.classList.add("tb11");
    const draw = () => { const G = GROUPS(); old.innerHTML = G.map(gr => `<div class="tbg" data-g="${gr.id}"><button class="tbb" aria-haspopup="true">${I(gr.ic)}<span>${esc(gr.n)}</span></button>
      <div class="tbm" role="menu">${gr.sub ? `<div class="tbsub">${esc(gr.sub)}</div>` : ""}${gr.items.map(([ic, n, d], i) => `<button role="menuitem" data-i="${i}">${I(ic)}<span><b>${esc(n)}</b><small>${esc(d)}</small></span></button>`).join("")}</div></div>`).join("")
      + `<button class="tbq ${g.AxonInteract && g.AxonInteract.IX.test.on ? "on" : ""}" data-ix="tests" title="Iniciar testes">${I("tests")}<span>Iniciar testes</span></button>`;
      $$(".tbg", old).forEach(el => { const gr = G.find(x => x.id === el.dataset.g); el.querySelector(".tbb").onclick = e => { e.stopPropagation(); const on = !el.classList.contains("open"); $$(".tbg.open").forEach(x => x.classList.remove("open")); el.classList.toggle("open", on); };
        $$(".tbm [data-i]", el).forEach(b => b.onclick = () => { el.classList.remove("open"); gr.items[+b.dataset.i][3](); }); });
      $(".tbq", old).onclick = () => { const X = g.AxonInteract; if (!X) return; X.IX.test.on ? X.stopTests() : X.startTests(); open("tests"); draw(); }; };
    draw(); document.addEventListener("click", () => $$(".tbg.open").forEach(x => x.classList.remove("open")));
    ["axon:case", "axon:tests", "axon:lang"].forEach(ev => document.addEventListener(ev, () => setTimeout(() => { const n = $(".mbicons"); if (n && n.dataset.v === "11") draw(); else toolbar(); }, 60)));
  }

  // ================================================================ abas verticais dos capítulos laterais
  function ears(side) {
    const s = $("#" + side); if (!s) return; let el = s.querySelector(".ears"); if (!el) { el = document.createElement("div"); el.className = "ears ears-" + side; s.appendChild(el); }
    const cards = $$(".side-body .card", s).filter(c => c.querySelector("h4")); const tabs = side === "left" ? [["anat", "Anatomia"], ["phys", "Biofísica"], ["proto", "Protocolo"]] : [];
    el.innerHTML = tabs.map(([k, n]) => `<button data-t="${k}" class="tab">${esc(n)}</button>`).join("") + cards.map((c, i) => `<button data-c="${i}">${esc(c.querySelector("h4").textContent.replace(/^⇱/, "").trim().slice(0, 28))}</button>`).join("");
    const openSide = () => { if (s.classList.contains("collapsed")) WB().toggleSide(side); };
    $$("[data-t]", el).forEach(b => b.onclick = () => { openSide(); const t = s.querySelector(`[data-tab="${b.dataset.t}"]`); if (t) t.click(); });
    $$("[data-c]", el).forEach(b => b.onclick = () => { openSide(); const c = cards[+b.dataset.c]; if (c) { c.scrollIntoView({ behavior: "smooth", block: "start" }); c.classList.add("flash"); setTimeout(() => c.classList.remove("flash"), 900); } });
  }

  // ================================================================ parâmetros: simples + avançado
  const ADV = { on: false };
  function paramsBasic() {
    const c = $('#rightBody .card[data-key="params"]'); if (!c || c.dataset.adv11) { if (c) c.classList.toggle("adv", ADV.on); return; } c.dataset.adv11 = "1";
    $$(".ctl", c).forEach(x => { const l = (x.querySelector("label") || x).textContent; if (/modalidade|intensidade|corrente|frequ|press/i.test(l)) x.classList.add("basic"); });
    const h = c.querySelector("h4"); const b = document.createElement("button"); b.className = "advbtn"; b.title = "Parâmetros avançados"; b.innerHTML = "⚙"; b.onclick = () => { ADV.on = !ADV.on; c.classList.toggle("adv", ADV.on); }; h.appendChild(b); c.classList.toggle("adv", ADV.on);
  }

  // ================================================================ guia com demonstração
  const DEMO = {
    mode: () => { WB().setMode("plan"); say("Demonstração: modo de planejamento clínico — o caso, o plano e o paciente abrem juntos."); },
    patient: () => { PC.mode = "view"; open("patientcard"); say("Este é o cartão do paciente fictício: queixa principal e métodos indicados com a porcentagem do modelo e a âncora da literatura."); },
    plan: () => { open("planner"); say("O plano ordena as técnicas por adequação; os fatores e os pesos explicam a porcentagem."); },
    target: () => { const t = topTech(); open("tray"); if (t) TRAY.sel = t.t.ic === "ynsa" || t.t.ic === "aur" ? (t.t.ic === "aur" ? "tavns" : "ea") : t.t.ic; trayRender(); say(`Na bandeja, o instrumento da técnica sugerida (${t ? t.t.n : "—"}) está selecionado. Passe o mouse para ver os outros.`); },
    params: () => { const t = topTech(); if (t && g.AxonPlanner) { try { g.AxonPlanner.applyToSim(t.id, Object.assign({}, t.t, g.AxonPlanner.PL.o[t.id] || {})); } catch (e) {} } if (WB().WB.instr == null && t) WB().setInstr(t.t.ic === "ynsa" ? "ea" : t.t.ic === "aur" ? "acu" : t.t.ic); open("explain"); say(`Parâmetros demonstrativos aplicados: ${t ? t.t.par : ""}.`); },
    apply: () => demoApply(),
    outcome: () => { open("planner"); open("manuscript"); say("O desfecho simulado e as notas vão para o manuscrito: linha do tempo, cálculos e resultados."); },
  };
  function topTech() { const c = cs(); if (!c || !g.AxonPlanner || !A().state.mc) return null; try { return g.AxonPlanner.plan(c)[0]; } catch (e) { return null; } }
  function say(t) { try { A().botSay(t); } catch (e) {} }
  async function demoApply() {
    const c = cs(), X = g.AxonInteract; if (!X) return; if (!WB().WB.instr) WB().setInstr("tens");
    let det = null; const acu = g.AxonAcu;
    const id = c && /L5|S1/.test(c.pain.dermatomes.join()) ? "ST36" : c && /C[67]/.test(c.pain.dermatomes.join()) ? "PC6" : "LI4";
    if (acu && !acu.ready) { try { await acu.build(); } catch (e) {} }
    const p = acu && acu.ready && acu.pos(id); if (p) det = { point: p.p.toArray(), normal: p.n ? p.n.toArray() : null, code: p.derm, name: id, source: "guia" };
    if (!det) { const rp = ST().reflexPoints()[0]; det = { point: rp.p, normal: rp.n, code: rp.derm, name: rp.name, source: "guia" }; }
    ST().ext().focusOn(det.point, det.normal, .4); const tl = WB().WB.instr, st = A().state;
    if (tl === "tens") { st.p.f = 100; st.p.pw = 100; } if (tl === "ea") { st.p.f = 2; st.p.pw = 200; }
    det.nn = ST().placeTool(tl, det.point, det.normal);
    // parâmetro demonstrativo: a menor corrente que recruta ~40 % de Aβ sem passar de 5 % de Aδ (busca por bissecção) [DERIVADO]
    let lo = .1, hi = 120; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2, r = X.evaluate(det, { I: m, tool: tl }), ab = (r.classes.find(c => c.cls === "Aβ") || {}).frac || 0; if (ab < .4) lo = m; else hi = m; }
    const ad = (X.evaluate(det, { I: hi, tool: tl }).classes.find(c => c.cls === "Aδ") || {}).frac || 0; st.p.I = +hi.toFixed(2); A().update && A().update();
    say(`Parâmetro demonstrativo: ${hi.toFixed(1)} mA recrutam ~40 % das Aβ${ad > .05 ? " (já com algum Aδ)" : " sem Aδ"} neste ponto.`);
    const I0 = st.p.I; let k = 0;
    say(`Demonstração em ${det.name}: a intensidade sobe em rampa e o assistente explica o que é recrutado.`);
    const step = () => { k++; const I = I0 * Math.min(1, k / 10); X.applyAt(det, { I, quiet: k < 10 }); if (k < 10) setTimeout(step, 260); else open("explain"); }; step();
  }
  function guideHook() {
    const b = A().body("guide"); if (!b || b.dataset.g11 === String(b.innerHTML.length)) return;
    $$("ol.guide li", b).forEach((li, i) => { const k = ["mode", "patient", "plan", "target", "params", "apply", "outcome"][i]; if (!k || li.querySelector(".demo")) return;
      const btn = document.createElement("button"); btn.className = "btn sm demo"; btn.textContent = "▶ reproduzir"; btn.title = "Reproduz este passo com parâmetros demonstrativos"; btn.onclick = e => { e.stopPropagation(); DEMO[k](); li.classList.add("done"); }; li.appendChild(btn); });
    b.dataset.g11 = String(b.innerHTML.length);
  }

  // ================================================================ bandeja 3D de instrumentos
  const TRAY = { sel: null, hover: null, r: null };
  const INSTR = {
    tens: { n: "Estimulador TENS", k: "elétrica · superfície", d: "Gerador de pulsos com dois eletrodos autoadesivos; a corrente passa pela pele entre os eletrodos.", tech: ["tens_conv", "tens_acu"],
      steps: ["Limpe e seque a pele; posicione os eletrodos sobre o dermátomo doloroso ou ao redor da área, a 2–4 cm um do outro.", "Escolha a frequência: 80–120 Hz (convencional, portão) ou 2–4 Hz (acupuntura-like, opioides).", "Suba a intensidade até um formigamento forte e confortável, sem contração (convencional) ou com contração visível (acupuntura-like).", "Mantenha 20–40 min; reajuste se a sensação diminuir (acomodação)."] },
    ea: { n: "Eletroacupuntura", k: "elétrica · agulha", d: "Agulhas filiformes nos acupontos ligadas em pares a um estimulador; a corrente flui entre as agulhas.", tech: ["ea", "ynsa"],
      steps: ["Insira as agulhas nos pontos escolhidos (ver Atlas) na profundidade indicada; obtenha a sensação de agulhamento.", "Ligue os pares no mesmo lado do corpo; evite cruzar a linha média do tórax.", "Use 2 Hz, 100 Hz ou 2/100 Hz alternado; suba até a sensação ou contração leve.", "Mantenha cerca de 30 min; retire as agulhas e verifique o local."] },
    acu: { n: "Sonda de pressão (acupressão)", k: "mecânica", d: "Ponta romba que aplica pressão controlada no ponto; algômetro mede o limiar de dor à pressão.", tech: ["acu", "aur"],
      steps: ["Localize o ponto (Atlas) e palpe a área.", "Aplique pressão crescente até sensação firme, abaixo do limiar de dor à pressão.", "Mantenha 1–2 min por ponto, com movimentos circulares lentos se desejado.", "Registre a sensação e a dor no ponto antes e depois."] },
    tavns: { n: "Clipe auricular (taVNS)", k: "elétrica · orelha", d: "Eletrodos na concha da orelha (cymba), território do ramo auricular do vago.", tech: ["tavns"],
      steps: ["Limpe a concha; posicione o eletrodo na cymba conchae (100 % de inervação vagal).", "Use 20–30 Hz, 200–250 µs.", "Suba até sensação clara e confortável, sem dor; controle sham no lóbulo.", "Sessões de 15–60 min; monitore frequência cardíaca."] },
    lifu: { n: "Transdutor de ultrassom (LIFU)", k: "acústica", d: "Transdutor focado de baixa intensidade; neuromodulação em investigação.", tech: [],
      steps: ["Aplique gel e acople o transdutor.", "Defina a intensidade (mW/cm²) e o ciclo de trabalho; observe o índice mecânico e o aquecimento.", "Mantenha a exposição curta e monitore a temperatura.", "Uso experimental: sem parâmetros clínicos estabelecidos."] },
  };
  function trayScene(cv) {
    const T = g.THREE; const r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setPixelRatio(Math.min(2, devicePixelRatio)); r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    const sc = new T.Scene(), cam = new T.PerspectiveCamera(32, 2, .1, 50); cam.position.set(0, 2.5, 3.5); cam.lookAt(0, 0, .15);
    { const c = document.createElement("canvas"); c.width = 128; c.height = 64; const x = c.getContext("2d"), gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, "#e7f6ff"); gr.addColorStop(.5, "#f2e5d6"); gr.addColorStop(.55, "#45555b"); gr.addColorStop(1, "#0c1416"); x.fillStyle = gr; x.fillRect(0, 0, 128, 64);
      const t = new T.CanvasTexture(c); t.mapping = T.EquirectangularReflectionMapping; t.encoding = T.sRGBEncoding; const pm = new T.PMREMGenerator(r); sc.environment = pm.fromEquirectangular(t).texture; pm.dispose(); }
    sc.add(new T.HemisphereLight(0xeaf7ff, 0x1b2427, .6)); const key = new T.DirectionalLight(0xfff2e0, 1.3); key.position.set(-2, 5, 3); sc.add(key);
    const steel = new T.MeshStandardMaterial({ color: 0xc9d3d8, metalness: .92, roughness: .28 }), dark = new T.MeshStandardMaterial({ color: 0x24323a, metalness: .3, roughness: .45 }), gel = new T.MeshPhysicalMaterial({ color: 0x8fd8ff, roughness: .15, transmission: .2, transparent: true, opacity: .9, clearcoat: 1 });
    const tray = new T.Mesh(new T.BoxGeometry(5.6, .12, 2.4), steel); tray.position.y = -.06; sc.add(tray);
    [[0, 1.2, 5.6, .08], [0, -1.2, 5.6, .08], [2.8, 0, .08, 2.4], [-2.8, 0, .08, 2.4]].forEach(([x, z, w, d]) => { const rim = new T.Mesh(new T.BoxGeometry(w, .22, d), steel); rim.position.set(x, .05, z); sc.add(rim); });
    const cable = (pts, col) => new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), 40, .025, 8, false), new T.MeshStandardMaterial({ color: col, roughness: .5 }));
    const G = {};
    { const gp = new T.Group(); const box = new T.Mesh(new T.BoxGeometry(.85, .22, .55), dark); box.position.y = .14; gp.add(box);
      const scr = new T.Mesh(new T.PlaneGeometry(.5, .2), new T.MeshBasicMaterial({ color: 0x3ee6c5 })); scr.rotation.x = -Math.PI / 2; scr.position.set(-.08, .252, -.05); gp.add(scr);
      [.26, .34].forEach(x => { const k = new T.Mesh(new T.CylinderGeometry(.045, .045, .05, 20), steel); k.position.set(x, .27, .1); gp.add(k); });
      [[-.35, .55], [.35, .62]].forEach(([x, z]) => { const pad = new T.Mesh(new T.BoxGeometry(.38, .03, .3), gel); pad.position.set(x, .03, z); gp.add(pad); gp.add(cable([[x, .05, z - .12], [x * .6, .1, .3], [0, .18, .27]], 0x3a7bd5)); });
      gp.position.set(-2.05, 0, -.15); G.tens = gp; }
    { const gp = new T.Group(); [-.18, 0, .18].forEach((x, i) => { const nd = new T.Mesh(new T.CylinderGeometry(.008, .004, 1.1, 8), steel); nd.rotation.z = Math.PI / 2; nd.position.set(x * 0 + .1, .06 + i * .0, -.25 + i * .25); gp.add(nd);
      const hd = new T.Mesh(new T.CylinderGeometry(.03, .03, .32, 14), new T.MeshStandardMaterial({ color: 0xc88a3a, metalness: .85, roughness: .3 })); hd.rotation.z = Math.PI / 2; hd.position.set(-.55, .06, -.25 + i * .25); gp.add(hd); });
      const clip = new T.Mesh(new T.BoxGeometry(.16, .06, .08), new T.MeshStandardMaterial({ color: 0xd84a4a })); clip.position.set(-.85, .06, -.25); gp.add(clip); gp.add(cable([[-.93, .06, -.25], [-.9, .1, .3], [-.6, .08, .5]], 0xd84a4a));
      gp.position.set(-.75, 0, 0); G.ea = gp; }
    { const gp = new T.Group(); const body = new T.Mesh(new T.CylinderGeometry(.07, .08, 1, 24), new T.MeshStandardMaterial({ color: 0x7b4a2c, roughness: .55 })); body.rotation.z = Math.PI / 2; body.position.y = .08; gp.add(body);
      const tip = new T.Mesh(new T.SphereGeometry(.075, 20, 16), steel); tip.position.set(.55, .08, 0); gp.add(tip); gp.position.set(.4, 0, 0); G.acu = gp; }
    { const gp = new T.Group(); const c = new T.Mesh(new T.TorusGeometry(.22, .045, 14, 40, Math.PI * 1.4), new T.MeshStandardMaterial({ color: 0xe7ecef, roughness: .35 })); c.rotation.x = Math.PI / 2; c.position.y = .06; gp.add(c);
      [[.22, 0], [-.07, .21]].forEach(([x, z]) => { const e = new T.Mesh(new T.SphereGeometry(.05, 14, 12), gel); e.position.set(x, .06, z); gp.add(e); }); gp.add(cable([[-.2, .06, -.1], [-.1, .1, .4], [.1, .06, .6]], 0x5aa86a));
      gp.position.set(1.45, 0, -.1); G.tavns = gp; }
    { const gp = new T.Group(); const b = new T.Mesh(new T.CylinderGeometry(.16, .18, .5, 32), dark); b.rotation.x = Math.PI / 2; b.position.y = .17; gp.add(b);
      const lens = new T.Mesh(new T.SphereGeometry(.16, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), gel); lens.rotation.x = Math.PI / 2; lens.position.set(0, .17, .25); gp.add(lens); gp.add(cable([[0, .17, -.25], [0, .1, -.6], [.3, .06, -.8]], 0x333a3e));
      gp.position.set(2.3, 0, .1); G.lifu = gp; }
    Object.entries(G).forEach(([k, gp]) => { gp.scale.setScalar(1.35); gp.position.x *= .95; gp.userData.k = k; gp.userData.y0 = gp.position.y; sc.add(gp); gp.traverse(o => { if (o.isMesh) { o.userData.k = k; o.material = o.material.clone(); } }); });
    return { r, sc, cam, G, T };
  }
  function trayWin(b) {
    b.innerHTML = `<div class="traywrap"><canvas id="trCv"></canvas><div class="traytip" id="trTip" hidden></div></div><div id="trDet"></div>`;
    const cv = $("#trCv", b); if (TRAY.r) { cancelAnimationFrame(TRAY.raf); TRAY.r.r.dispose(); } TRAY.r = trayScene(cv); const R = TRAY.r, ray = new R.T.Raycaster(), m = new R.T.Vector2();
    const loop = t => { TRAY.raf = requestAnimationFrame(loop); if (!cv.isConnected) { cancelAnimationFrame(TRAY.raf); return; } const w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== Math.floor(w * R.r.getPixelRatio())) { R.r.setSize(w, h, false); R.cam.aspect = w / h; R.cam.updateProjectionMatrix(); }
      Object.values(R.G).forEach((gp, i) => { const k = gp.userData.k, on = TRAY.sel === k, hv = TRAY.hover === k; gp.position.y += ((on ? .32 : hv ? .14 : 0) + Math.sin(t / 900 + i) * .015 - gp.position.y) * .12; gp.rotation.y += ((on ? Math.sin(t / 1400) * .35 : 0) - gp.rotation.y) * .06;
        gp.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(on ? 0x0c3a32 : hv ? 0x0a2228 : 0); }); });
      R.r.render(R.sc, R.cam); }; requestAnimationFrame(loop);
    const pick = e => { const rc = cv.getBoundingClientRect(); m.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1); ray.setFromCamera(m, R.cam); const h = ray.intersectObjects(R.sc.children, true).find(x => x.object.userData.k); return h ? h.object.userData.k : null; };
    cv.onpointermove = e => { const k = pick(e); TRAY.hover = k; const tip = $("#trTip", b); if (!k) { tip.hidden = true; cv.style.cursor = ""; return; } cv.style.cursor = "pointer"; const it = INSTR[k]; tip.hidden = false; tip.innerHTML = `<b>${esc(it.n)}</b><small>${esc(it.k)}</small><p>${esc(it.d)}</p>`; const rc = cv.getBoundingClientRect(); tip.style.left = Math.min(rc.width - 240, e.clientX - rc.left + 12) + "px"; tip.style.top = e.clientY - rc.top + 12 + "px"; };
    cv.onclick = e => { const k = pick(e); if (!k) return; TRAY.sel = k; trayDetail(b); };
    trayDetail(b);
  }
  function trayRender() { if (A().isOpen("tray")) trayWin(A().body("tray")); }
  function trayDetail(b) {
    const box = $("#trDet", b), k = TRAY.sel; if (!k) { box.innerHTML = `<p class="note">Passe o mouse sobre os instrumentos para ver a descrição; clique para escolher e ver o passo a passo e os parâmetros sugeridos para o caso.</p>`; return; }
    const it = INSTR[k], c = cs(); let rows = []; try { rows = c && A().state.mc && g.AxonPlanner ? g.AxonPlanner.plan(c).filter(r => it.tech.includes(r.id)) : []; } catch (e) {}
    box.innerHTML = `<div class="card"><h4>${esc(it.n)} <small>${esc(it.k)}</small></h4><p>${esc(it.d)}</p>
      <h5>Passo a passo</h5><ol class="steps">${it.steps.map(s => `<li data-note>${esc(s)}</li>`).join("")}</ol>
      ${rows.length ? `<h5>Parâmetros sugeridos${c ? ` para “${esc(c.title)}”` : ""}</h5>${rows.map(r => `<div class="sugg"><b>${esc(r.t.n)}</b> · adequação ${fmt(r.score * 100)} % ${tag("mod")}<br><span class="mono">${esc(r.t.par)}</span><br><small>${r.t.min} min · ${r.t.spw}×/semana · ${r.t.wk} semanas · resposta ≥ 30 % prevista em ${fmt((r.oc.off.pResp || 0) * 100)} % das simulações</small></div>`).join("")}`
        : `<p class="note">${c ? "Sem técnica do plano para este instrumento." : "Defina um caso para ver os parâmetros sugeridos."}</p>`}
      <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" data-a="sel">Usar este instrumento</button>${rows[0] ? `<button class="btn ghost" data-a="par">Aplicar parâmetros sugeridos</button>` : ""}<button class="btn ghost" data-a="book">Ler no livro</button><button class="btn ghost" data-a="note">Anotar</button></div>
      <p class="note">${tag("lit")} técnica descrita de forma geral para ensino; não é protocolo clínico. Os passos detalhados entram no manuscrito quando anotados.</p></div>`;
    $$("[data-a]", box).forEach(x => x.onclick = () => { const a = x.dataset.a;
      if (a === "sel") { WB().setInstr(k); say(`${it.n} selecionado. No corpo: segundo clique no mesmo ponto aplica; clique e segure aplica com rampa.`); }
      if (a === "par") { const r = rows[0]; try { g.AxonPlanner.applyToSim(r.id, Object.assign({}, r.t, g.AxonPlanner.PL.o[r.id] || {})); } catch (e) {} WB().setInstr(k); say(`Parâmetros de ${r.t.n} aplicados: ${r.t.par}.`); }
      if (a === "book") g.AxonBook && g.AxonBook.open("modal");
      if (a === "note" && g.AxonNotes) g.AxonNotes.add({ title: it.n, kind: "nota", instrumento: k, text: it.steps.map((s, i) => `${i + 1}. ${s}`).join(" ") + (rows[0] ? ` Parâmetros: ${rows[0].t.par}.` : "") }); });
  }

  // ================================================================ cartão do paciente e novo caso
  const PC = { mode: "view" };
  const LITR = {
    acu: ["Acupressão: ensaios heterogêneos; sem taxa de resposta agregada para dor crônica.", "Revisões sistemáticas de acupressão (qualidade variável).", null],
    ea: ["Acupuntura em dor crônica (meta-análise de dados individuais): resposta ≈ 50 % com acupuntura verdadeira, 42,5 % com sham e 30 % sem acupuntura. A eletroestimulação acrescenta controle de frequência.", "Vickers AJ, et al. Arch Intern Med. 2012;172(19):1444-53.", .5],
    tens: ["TENS reduz a intensidade da dor durante ou logo após a aplicação em comparação com placebo (diferença média padronizada ≈ −0,96, alta heterogeneidade); sem taxa de resposta agregada.", "Johnson MI, et al. BMJ Open. 2022;12:e051073.", null],
    tavns: ["Evidência em investigação; sem taxa de resposta agregada para dor.", "Farmer AD, et al. Front Hum Neurosci. 2021;14:568051.", null],
    aur: ["Ensaios pequenos e heterogêneos; sem taxa de resposta agregada robusta.", "Oleson T. Auriculotherapy Manual. 2003.", null],
    ynsa: ["Revisão sistemática com estudos pequenos em condições dolorosas.", "BrJP. 2018;1(2):180-3.", null],
  };
  const litOf = id => LITR[id.startsWith("tens") ? "tens" : id] || null;
  function avatar(P) { const f = P.sex === "F", tone = { I: "#f6dcc8", II: "#eccab0", III: "#d9a982", IV: "#b98058", V: "#8a5a3b", VI: "#5c3a26" }[P.fitz || "III"] || "#d9a982";
    return `<svg viewBox="0 0 80 96" class="pcav"><rect width="80" height="96" rx="12" fill="#0f2228"/><circle cx="40" cy="36" r="17" fill="${tone}"/>${f ? `<path d="M22 36q0-24 18-24t18 24q-4-12-18-12t-18 12z" fill="#3b2a20"/><path d="M22 36q-2 18 6 22M58 36q2 18-6 22" stroke="#3b2a20" stroke-width="5" fill="none"/>` : `<path d="M23 32q2-18 17-18t17 18q-6-8-17-8t-17 8z" fill="#3b2a20"/>`}<path d="M10 96q4-26 30-26t30 26z" fill="${f ? "#d36c9b" : "#3a7bd5"}"/></svg>`; }
  function cardWin(b) {
    const c = cs(), P = g.AxonDissect ? g.AxonDissect.PT : {}, bmi = P.weight / ((P.height / 100) ** 2); let rows = [];
    try { rows = c && A().state.mc && g.AxonPlanner ? g.AxonPlanner.plan(c).slice(0, 4) : []; } catch (e) {}
    const pid = "PSEUD-" + ((c && c.id) || "0000").toString().slice(-4).toUpperCase();
    b.innerHTML = `${PC.mode === "new" || !c ? `<div class="card"><h4>${I("newcase")} Novo caso clínico</h4><p class="note">Descreva o paciente e a queixa em texto livre. Use dados fictícios: sem nome, documento ou data de nascimento.</p>
        <textarea id="pcQ" rows="4" placeholder="Ex.: Homem, 61 anos, 1,78 m, 92 kg, fototipo III, diabético há 12 anos (HbA1c 8,4 %). Queimação e dormência nos pés há 2 anos, pior à noite, EVA 6."></textarea>
        <div class="row" style="gap:6px"><button class="btn" id="pcGo">Criar caso e cartão</button><button class="btn ghost" id="pcCancel">${c ? "Voltar ao cartão" : "Cancelar"}</button><span id="pcSt" class="note"></span></div></div>` : ""}
      ${c && PC.mode !== "new" ? `<div class="idcard"><div class="id-h"><span>CASO FICTÍCIO · ${pid}</span><span>${new Date().toLocaleDateString()}</span></div>
        <div class="id-b">${avatar(P)}<div class="id-f"><b>${P.sex === "F" ? "Mulher" : "Homem"}, ${P.age} anos</b><span>${P.height} cm · ${P.weight} kg · IMC ${fmt(bmi, 1)} · fototipo ${esc(P.fitz)}</span>
          <span class="cc"><b>Queixa principal:</b> ${esc(c.title)}</span><span>${esc(c.pain.mechanism || "")}</span>
          <span>Dor ${esc(c.pain.origin)} · <b>EVA ${c.pain.baseline}</b> · segmentos ${esc(c.pain.dermatomes.join(", "))}</span>${(c.conditions || []).length ? `<span>Condições: ${esc(c.conditions.map(x => x.label).join(", "))}</span>` : ""}</div></div>
        <div class="id-m"><h5>Métodos mais indicados ao quadro</h5>${rows.map(r => { const L = litOf(r.id), pr = (r.oc.off.pResp || 0) * 100;
          return `<div class="mth">${I(r.t.ic)}<div><b>${esc(r.t.n)}</b><div class="mbar"><i style="width:${fmt(r.score * 100)}%"></i></div><small>adequação ${fmt(r.score * 100)} % · resposta ≥ 30 % em ${fmt(pr)} % das simulações ${tag("mod")}</small>
            ${L ? `<small class="lit">${L[2] != null ? `<b>Literatura: ≈ ${fmt(L[2] * 100)} % de resposta.</b> ` : "<b>Literatura:</b> "}${esc(L[0])} <i>${esc(L[1])}</i> ${tag(L[2] != null ? "lit" : "hip")}</small>` : ""}</div></div>`; }).join("") || `<p class="note">Calculando o plano…</p>`}</div>
        <div class="row" style="gap:6px;flex-wrap:wrap;padding:0 14px 14px"><button class="btn ghost" data-a="plan">Plano completo</button><button class="btn ghost" data-a="tray">Escolher instrumento</button><button class="btn ghost" data-a="new">Novo caso</button><button class="btn ghost" data-a="note">Anotar cartão</button></div></div>
        <p class="note">O cartão é de um caso fictício. As porcentagens de adequação e de resposta vêm do modelo (hipóteses); as âncoras da literatura são médias de populações estudadas, não previsões para este caso.</p>` : ""}`;
    const go = $("#pcGo", b); if (go) go.onclick = async () => { const q = $("#pcQ", b).value.trim(); if (!q) return; $("#pcSt", b).textContent = "interpretando…"; try { await g.AxonDissect.fromPrompt(q); PC.mode = "view"; } catch (e) { $("#pcSt", b).textContent = "não foi possível: " + e.message; return; } setTimeout(() => cardWin(b), 300); };
    const cn = $("#pcCancel", b); if (cn) cn.onclick = () => { PC.mode = "view"; cardWin(b); };
    $$("[data-a]", b).forEach(x => x.onclick = () => { const a = x.dataset.a; if (a === "plan") open("planner"); if (a === "tray") open("tray"); if (a === "new") { PC.mode = "new"; cardWin(b); }
      if (a === "note" && g.AxonNotes) g.AxonNotes.add({ title: `Cartão · ${c.title}`, kind: "nota", text: `${P.sex} ${P.age} anos, IMC ${fmt(bmi, 1)}; EVA ${c.pain.baseline}; ${rows.map(r => `${r.t.n} ${fmt(r.score * 100)} %`).join(", ")}` }); });
  }
  function desktopIcons() {
    if ($("#dkIcons")) return; const host = $("#stage") || document.body, el = document.createElement("div"); el.id = "dkIcons"; el.className = "dkicons notr";
    el.innerHTML = `<button data-d="new" title="Incluir novo caso clínico (texto livre ou formulário)">${I("newcase")}<span>Novo caso</span></button><button data-d="card" title="Cartão do paciente do caso ativo">${I("card")}<span>Paciente</span></button><button data-d="tray" title="Bandeja de instrumentos">${I("tray")}<span>Instrumentos</span></button>`;
    host.appendChild(el); $$("[data-d]", el).forEach(b => b.onclick = () => { const d = b.dataset.d; if (d === "new") { PC.mode = "new"; open("patientcard"); } if (d === "card") { PC.mode = "view"; open("patientcard"); } if (d === "tray") open("tray"); });
  }

  // ================================================================ rede fisiológica clicável ↔ anatomia
  const PHYS = {
    field: ["Campo aplicado", "Corrente ou pressão no tecido; decai com a distância.", { tool: true }], charge: ["Densidade de carga", "Critério de Shannon para lesão eletroquímica.", { book: "seg" }], heat: ["Aquecimento", "Equação de Pennes; perfusão dissipa o calor.", { book: "seg" }],
    aalpha: ["Fibras Aα", "Motoras e aferentes Ia/Ib; contração quando recrutadas no tronco.", { win: "terminals" }], abeta: ["Fibras Aβ", "Tato; entrada do portão no corno dorsal.", { acu: ["PC6", "LI4", "ST36"], book: "fibras" }],
    adelta: ["Fibras Aδ", "Dor rápida e frio; somação temporal e retirada.", { book: "limiar" }], abvn: ["Ramo auricular do vago", "Cymba (100 %) e cavum (45 %) da concha.", { atlas: "ear", nerves: ["Ramo auricular do vago right"] }],
    gate: ["Portão medular", "Interneurônios inibitórios das lâminas I–II.", { seg: true, book: "dor" }], windup: ["Somação temporal", "Sensibilização por estímulos repetidos de fibras finas.", { book: "dor" }],
    twitch: ["Contração", "Recrutamento Aα; ver terminações até a placa motora.", { win: "terminals" }], withdraw: ["Reflexo de retirada", "Arco polissináptico por Aδ.", { seg: true }],
    enk: ["Encefalinas / β-endorfina", "Liberadas com 2–10 Hz (Han 2003); acupontos distais clássicos.", { acu: ["ST36", "SP6", "LI4"], book: "dor" }], dyn: ["Dinorfina", "Liberada com 80–100 Hz na medula.", { acu: ["ST36", "SP6"], book: "dor" }],
    nts: ["NTS → LC / rafe / PAG", "Núcleo do trato solitário recebe o vago.", { atlas: "ear", win: "cns" }], desc: ["Inibição descendente", "PAG–RVM–LC modulam o corno dorsal.", { win: "cns" }], tol: ["Tolerância", "Perda de efeito com alta frequência contínua.", { book: "modal" }],
    symp: ["Tônus simpático", "Coluna intermediolateral T1–L2.", { segs: "T1-L2", acu: ["BL15", "BL23"] }], vagal: ["Tônus vagal", "Núcleo ambíguo e motor dorsal do vago.", { nerves: ["Nervo vago right", "Nervo vago left"], acu: ["PC6"] }],
    ai: ["Via colinérgica anti-inflamatória", "Eferência vagal → baço (modelo experimental).", { nerves: ["Nervo vago left"] }], pain: ["Dor (EVA)", "Desfecho subjetivo do modelo.", { seg: true }], hr: ["Frequência cardíaca", "Simpático eleva; vago reduz.", { acu: ["PC6", "HT7"] }],
    hrv: ["VFC (RMSSD)", "Marcador de tônus vagal.", { acu: ["PC6"] }], eda: ["Condutância da pele", "Glândulas sudoríparas (simpático colinérgico).", {}],
  };
  function physHook() {
    const b = A().body("network"); if (!b) return; const svg = b.querySelector("svg"); if (!svg || svg.dataset.ph) return; svg.dataset.ph = "1";
    const P = g.AxonPhysio; if (!P) return; const gs = [...svg.querySelectorAll("g[transform]")];
    gs.forEach((gEl, i) => { const n = P.NODES[i]; if (!n) return; gEl.style.cursor = "pointer"; gEl.onclick = () => physDetail(n.id, b); });
  }
  function physDetail(id, b) {
    const info = PHYS[id], n = g.AxonPhysio.NODES.find(x => x.id === id), act = g.AxonPhysio.activity(g.AxonSim.S || g.AxonPhysio.newState(g.AxonSim.case), g.AxonSim.u || { on: false, FA: 0, FD: 0, Faa: 0, freq: 0, segMatch: 0, vagalSite: 0, pressureKPa: 0, k: -4, dT: 0, demy: 0 });
    let box = b.querySelector(".physdet"); if (!box) { box = document.createElement("div"); box.className = "card physdet"; b.appendChild(box); }
    const ed = g.AxonPhysio.EDGES.filter(e => e[0] === id || e[1] === id), nm = k => (g.AxonPhysio.NODES.find(x => x.id === k) || {}).label || k;
    box.innerHTML = `<h4>${esc(n.label)} <small>${n.tag.toUpperCase()}</small></h4><p>${esc(info ? info[1] : "")}</p><p>Atividade agora: <b>${fmt((act[id] || 0) * 100)} %</b> ${tag("mod")}</p>
      <p class="note">${ed.map(e => `${e[0] === id ? "→" : "←"} ${esc(nm(e[0] === id ? e[1] : e[0]))} (${e[2] > 0 ? "excita" : "inibe"})`).join(" · ")}</p>
      <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn ghost sm" data-x="body">Relacionar no corpo</button>${info && info[2].book ? `<button class="btn ghost sm" data-x="book">Ler no livro</button>` : ""}${info && info[2].win ? `<button class="btn ghost sm" data-x="win">Abrir ${esc(info[2].win)}</button>` : ""}<button class="btn ghost sm" data-x="note">Anotar</button></div>`;
    $$("[data-x]", box).forEach(x => x.onclick = async () => { const a = x.dataset.x, L = info ? info[2] : {};
      if (a === "body") { const c = cs(), seg = L.segs || (L.seg && c ? c.pain.dermatomes.join(",") : undefined);
        ST().highlight({ nerves: L.nerves || [], seg, reveal: true });
        if (L.acu && g.AxonAcu) { if (!g.AxonAcu.ready) { try { await g.AxonAcu.build(); } catch (e) {} } g.AxonAcu.setShow(true); g.AxonAcu.select(L.acu[0]); say(`${n.label}: pontos relacionados ${L.acu.join(", ")} destacados no corpo.`); }
        if (L.atlas && g.AxonAtlas) g.AxonAtlas.open(L.atlas); }
      if (a === "book") g.AxonBook.open(L.book); if (a === "win") open(L.win);
      if (a === "note" && g.AxonNotes) g.AxonNotes.add({ title: `Rede: ${n.label}`, kind: "nota", text: `${info ? info[1] : ""} Atividade ${fmt((act[id] || 0) * 100)} %.` }); });
  }

  // ================================================================ pergunta ao assistente junto ao robô
  function botAsk() {
    const bot = $("#bot"); if (!bot || bot.querySelector(".botask")) return; const f = document.createElement("form"); f.className = "botask notr";
    f.innerHTML = `<input placeholder="Pergunte ao assistente…" aria-label="Pergunta ao assistente" maxlength="400"><button aria-label="Enviar">➤</button>`; bot.appendChild(f);
    f.onsubmit = async e => { e.preventDefault(); const inp = f.querySelector("input"), q = inp.value.trim(); if (!q) return; inp.value = ""; say("…");
      let ans = null; const r = g.AxonInteract && g.AxonInteract.result;
      try { const res = await fetch("api/ai/bot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q, lang: g.I18N ? g.I18N.lang : "pt", context: { modality: A().state.mod, last: r ? g.AxonInteract.explainShort(r) : null, case: cs() ? cs().title : null } }) }); if (res.ok) { const j = await res.json(); ans = j.answer || j.text || null; } } catch (err) {}
      if (!ans) ans = r && /calcul|por que|porque|fibra|recrut|o que/i.test(q) ? g.AxonInteract.explainShort(r) : "Sem a IA do servidor agora. Abra o livro teórico (menu Teoria) ou o painel do assistente para a explicação do último cálculo.";
      say(ans); };
  }

  // ================================================================ início
  function boot() {
    if (!A() || !A().registerApp || !WB() || !$(".mbicons") || !g.AxonIcons) return setTimeout(boot, 120);
    A().registerApp("tray", { title: "tray", w: 640, h: 720, render: trayWin, onClose: () => cancelAnimationFrame(TRAY.raf) });
    A().registerApp("patientcard", { title: "patientcard", w: 520, h: 720, render: cardWin });
    toolbar(); desktopIcons(); botAsk(); ["left", "right"].forEach(ears);
    const obs = new MutationObserver(() => { requestAnimationFrame(() => { ["left", "right"].forEach(ears); paramsBasic(); guideHook(); physHook(); }); });
    ["#leftBody", "#rightBody"].forEach(s => $(s) && obs.observe($(s), { childList: true })); obs.observe(document.body, { childList: true, subtree: false });
    setInterval(() => { guideHook(); physHook(); paramsBasic(); botAsk(); }, 1200);
    document.addEventListener("axon:case", () => { if (A().isOpen("patientcard")) cardWin(A().body("patientcard")); });
  }
  boot();
  g.AxonUI11 = { GROUPS, DEMO, TRAY, PC, physDetail };
})(window);
