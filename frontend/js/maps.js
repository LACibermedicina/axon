/* axon · maps.js — mapas de acupuntura e eletroacupuntura (pontos 3D do simulador), craniopuntura de Yamamoto (YNSA)
   e auriculoterapia, com pontos sugeridos para o caso ativo, pontos disponíveis, abordagens e referências.
   Os esquemas 2D são simplificados: localizações aproximadas para ensino [PREMISSA]; a localização exata está nas obras citadas. */
(function (g) {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tag = (k, t) => g.AxonApp ? g.AxonApp.tagHTML(k, t) : "";

  const REF = {
    who08: "WHO Western Pacific Region. WHO Standard Acupuncture Point Locations in the Western Pacific Region. Manila: WHO; 2008.",
    han03: "Han JS. Acupuncture: neuropeptide release produced by electrical stimulation of different frequencies. Trends Neurosci. 2003;26(1):17-22.",
    zhang14: "Zhang R, Lao L, Ren K, Berman BM. Mechanisms of acupuncture–electroacupuncture on persistent pain. Anesthesiology. 2014;120(2):482-503.",
    vick18: "Vickers AJ, Vertosick EA, Lewith G, et al. Acupuncture for chronic pain: update of an individual patient data meta-analysis. J Pain. 2018;19(5):455-474.",
    yam10: "Yamamoto T, Yamamoto H, Yamamoto MM. Yamamoto New Scalp Acupuncture: YNSA. Miyazaki: Yamamoto Publishing; 2010.",
    feely: "Feely RA. Yamamoto New Scalp Acupuncture: Principles and Practice. 2nd ed. Stuttgart: Thieme; 2011.",
    brjp18: "Yamamoto new scalp acupuncture: its applications and results in painful conditions. Systematic review. BrJP. 2018;1(2):180-3.",
    jacm14: "Efficacy of Yamamoto new scalp acupuncture versus traditional Chinese acupuncture for migraine treatment (ensaio randomizado). J Altern Complement Med. 2014;20(5):371-4.",
    wise23: "Wise S, Lorenc A. Anatomical and clinical characteristics of scalp acupuncture systems: a scoping review and synthesis. J Acupunct Meridian Stud. 2023;16(5):159-75.",
    park25: "Park SY, Heo I, Hwang MS, Hwang EH, Shin BC. Effectiveness of scalp acupuncture and comparison with traditional acupuncture for stroke: an overview of systematic reviews. Syst Rev. 2025;14:108.",
    who90: "World Health Organization. Report of the Working Group on Auricular Acupuncture Nomenclature, Lyon, 28–30 Nov 1990. Geneva: WHO; 1991 (WHO/TRM/91.2).",
    gbt08: "Standardization Administration of China. GB/T 13734-2008: Nomenclature and location of auricular points. Beijing; 2008.",
    oleson: "Oleson T. Auriculotherapy Manual: Chinese and Western Systems of Ear Acupuncture. 3rd ed. Edinburgh: Churchill Livingstone/Elsevier; 2003.",
    peuker: "Peuker ET, Filler TJ. The nerve supply of the human auricle. Clin Anat. 2002;15(1):35-7.",
    nogier19: "The history of ear acupuncture and ear cartography: why precise mapping of auricular points is important. Med Acupunct. 2019;31(3):145-56.",
    farmer21: "Farmer AD, Strzelczyk A, Finisguerra A, et al. International consensus based review and recommendations for minimum reporting standards in research on transcutaneous vagus nerve stimulation (version 2020). Front Hum Neurosci. 2021;14:568051.",
  };
  const R = k => `<span class="ref" title="${esc(REF[k])}">[${esc(k)}]</span>`;

  // ------------------------------------------------------------ eletroacupuntura: frequências e pares (in silico)
  const EA_FREQ = [
    { f: "2 Hz", mech: "encefalina e β-endorfina (receptores µ/δ); início lento, efeito que se acumula", ref: "han03" },
    { f: "100 Hz", mech: "dinorfina (receptor κ) na medula; início rápido, tolerância com o uso contínuo", ref: "han03" },
    { f: "2/100 Hz alternado (denso-disperso)", mech: "libera os dois grupos de opioides e reduz a tolerância", ref: "han03" },
  ];
  const EA_PAIRS = {
    lombar: [["ST36", "GB34", "membro inferior homolateral: território L4–L5 e fibular comum"], ["BL40", "SP6", "trajeto tibial (S1) e L4"]],
    "membro inferior": [["ST36", "SP6", "par clássico de 2/100 Hz nos estudos de Han"], ["GB34", "LR3", "fibular comum e ramo profundo"]],
    "punho e mão": [["PC6", "LI4", "mediano e ramo superficial do radial"], ["PC6", "HT7", "mediano e ulnar no punho"]],
    cervical: [["LI4", "TRAP", "ponto distal e ponto-gatilho do trapézio superior"]],
    cabeça: [["LI4", "GV20", "distal e vértice"]],
    difusa: [["ST36", "SP6", "pontos sistêmicos (2/100 Hz)"], ["CYMBA", "LOBULO", "taVNS ativa e controle sham — ver aurículo"]],
    face: [["LI4", "ST36", "pontos distais (evitar a zona-gatilho)"]],
  };
  // ------------------------------------------------------------ YNSA (esquema simplificado)
  const YNSA = [
    { id: "A", x: 138, y: 89, side: "frente", n: "Ponto básico A", ind: "Cabeça e coluna cervical (subdividido A1–A7 ≈ C1–C7); cefaleia, cervicalgia, tontura", reg: ["cervical", "cabeça"] },
    { id: "B", x: 152, y: 92, side: "frente", n: "Ponto básico B", ind: "Pescoço e cintura escapular", reg: ["cervical", "ombro"] },
    { id: "C", x: 190, y: 106, side: "frente", n: "Ponto básico C", ind: "Ombro, braço, cotovelo e mão", reg: ["ombro", "punho e mão"] },
    { id: "D", x: 220, y: 168, side: "frente", n: "Ponto básico D", ind: "Coluna lombar e membros inferiores (D1–D6); lombalgia e lombociatalgia", reg: ["lombar", "membro inferior"] },
    { id: "E", x: 141, y: 122, side: "frente", n: "Ponto básico E", ind: "Coluna torácica, costelas e tórax (linha oblíqua acima da sobrancelha)", reg: ["torácica"] },
    { id: "SO", x: 136, y: 70, side: "frente", n: "Pontos sensoriais", ind: "Olho, nariz, boca e orelha; dor facial, ATM e queixas sensoriais", reg: ["face", "cabeça"] },
    { id: "CB", x: 138, y: 48, side: "frente", n: "Pontos cerebrais", ind: "Cérebro, cerebelo e núcleos da base; sequelas neurológicas centrais (evidência baixa)", reg: [] },
    { id: "Y", x: 214, y: 136, side: "frente", n: "Pontos Y (12)", ind: "Correspondência com os órgãos da MTC, escolhidos por diagnóstico abdominal ou cervical", reg: ["difusa"], hip: true },
    { id: "F", x: 196, y: 172, side: "perfil", n: "Ponto básico F", ind: "Ciático e região glútea (atrás da orelha, sobre o mastoide)", reg: ["lombar", "membro inferior"] },
    { id: "G", x: 152, y: 196, side: "perfil", n: "Pontos G (G1–G3)", ind: "Joelho (faces medial, anterior e lateral), ao redor da inserção do lóbulo", reg: ["joelho", "membro inferior"] },
    { id: "I", x: 196, y: 140, side: "perfil", n: "Ponto I", ind: "Complementar para lombar e ciático, acima do ponto F", reg: ["lombar"] },
  ];
  // ------------------------------------------------------------ aurículo (orelha direita, face lateral; esquema)
  const AUR = [
    { id: "TF4", x: 128, y: 80, n: "Shenmen", z: "fossa triangular", ind: "Analgesia e ansiedade; parte do protocolo NADA", nada: true },
    { id: "AH6a", x: 92, y: 104, n: "Simpático", z: "fim da raiz inferior do anti-hélix", ind: "Modulação autonômica e dor visceral; protocolo NADA", nada: true },
    { id: "CO10", x: 112, y: 120, n: "Rim", z: "cymba conchae", ind: "Protocolo NADA; cymba tem inervação vagal (ABVN)", nada: true, abvn: 100 },
    { id: "CO12", x: 134, y: 146, n: "Fígado", z: "cymba/cavum (borda posterior)", ind: "Protocolo NADA", nada: true, abvn: 100 },
    { id: "CO14", x: 82, y: 184, n: "Pulmão", z: "cavum conchae", ind: "Protocolo NADA; usado em dependências", nada: true, abvn: 45 },
    { id: "CO15", x: 98, y: 172, n: "Coração", z: "centro do cavum conchae", ind: "Ansiedade e queixas cardiovasculares funcionais", abvn: 45 },
    { id: "CO4", x: 112, y: 150, n: "Estômago", z: "fim da raiz do hélix", ind: "Náusea e dispepsia", abvn: 45 },
    { id: "HX1", x: 74, y: 150, n: "Centro da orelha (Ponto Zero)", z: "raiz do hélix", ind: "Ponto de equilíbrio geral (escola francesa)" },
    { id: "AT4", x: 104, y: 236, n: "Subcórtex", z: "face interna do antitrago", ind: "Dor e sono" },
    { id: "CO18", x: 70, y: 214, n: "Endócrino", z: "incisura intertrágica", ind: "Queixas endócrinas e metabólicas" },
    { id: "TG2p", x: 46, y: 198, n: "Suprarrenal", z: "trago (ápice inferior)", ind: "Inflamação e resposta ao estresse" },
    { id: "AH4", x: 140, y: 60, n: "Joelho", z: "raiz superior do anti-hélix", ind: "Dor no joelho (somatotopia do membro inferior)", reg: ["joelho", "membro inferior"] },
    { id: "AH9", x: 160, y: 136, n: "Coluna lombossacra", z: "corpo do anti-hélix", ind: "Lombalgia (somatotopia da coluna)", reg: ["lombar"] },
    { id: "AH13", x: 132, y: 214, n: "Coluna cervical", z: "anti-hélix junto ao antitrago", ind: "Cervicalgia", reg: ["cervical"] },
    { id: "SF4", x: 184, y: 150, n: "Ombro", z: "escafa", ind: "Dor no ombro (membro superior na escafa)", reg: ["ombro"] },
    { id: "SF1", x: 186, y: 74, n: "Dedos", z: "escafa superior", ind: "Mão e dedos", reg: ["punho e mão"] },
    { id: "LO5", x: 102, y: 286, n: "Olho", z: "lóbulo", ind: "Queixas oculares" },
    { id: "LO3", x: 88, y: 266, n: "Mandíbula", z: "lóbulo", ind: "ATM e dor facial", reg: ["face"] },
  ];

  // ------------------------------------------------------------ região do caso ativo → pontos sugeridos
  function caseRegion() {
    const S = g.AxonSim, c = S && S.case; const d = c ? c.pain.dermatomes : [], o = c ? c.pain.origin : "";
    if (o === "nociplástica") return "difusa";
    if (d.some(x => /^V/.test(x))) return "face";
    if (d.some(x => /^C[67]/.test(x))) return /carpo|punho|mediano/i.test(c.title + c.pain.mechanism) ? "punho e mão" : "cervical";
    if (d.some(x => /^C[45]/.test(x))) return "ombro";
    if (d.some(x => /^T/.test(x))) return "torácica";
    if (d.some(x => /^L[34]$/.test(x)) && !d.some(x => /L5|S1/.test(x))) return "joelho";
    if (d.some(x => /L5|S1/.test(x))) return /neuropatia|pé|diab/i.test(c.title) ? "membro inferior" : "lombar";
    return "lombar";
  }

  // ------------------------------------------------------------ desenhos
  function earSVG(sel, sug) {
    const zone = (d, f, l, x, y) => `<path d="${d}" fill="${f}" opacity=".55"/><text x="${x}" y="${y}" class="zl">${l}</text>`;
    return `<svg viewBox="0 0 230 320" class="map" role="img" aria-label="Orelha direita, face lateral, com pontos auriculares">
      <defs><radialGradient id="eg" cx=".45" cy=".45"><stop offset="0" stop-color="#f6d2c0"/><stop offset="1" stop-color="#e3a98f"/></radialGradient></defs>
      <path d="M70 40C110 0 192 10 202 92C212 162 188 212 162 240C150 255 150 282 135 302C114 322 78 312 76 286C74 262 70 246 60 232C48 222 38 206 40 190C42 174 52 164 58 156C60 120 54 72 70 40Z" fill="url(#eg)" stroke="#b8735a" stroke-width="2.5"/>
      ${zone("M150 70C176 110 172 172 140 206C128 220 118 228 108 232C120 214 150 172 150 120Z", "#ffe7a3", "coluna", 150, 178)}
      ${zone("M184 64C200 110 196 170 170 214L156 206C176 170 178 120 166 70Z", "#cfe8ff", "membro sup.", 166, 112)}
      ${zone("M100 52C122 46 146 56 150 70L140 104C124 98 104 98 90 104Z", "#e6dcff", "pelve", 104, 86)}
      ${zone("M90 108C110 102 134 104 140 110C146 130 140 150 126 152C110 150 94 140 76 146C80 128 84 114 90 108Z", "#c7f0e3", "cymba", 92, 128)}
      ${zone("M62 158C84 150 112 150 128 158C134 186 124 212 104 222C84 222 64 210 60 192Z", "#bfe9dc", "cavum", 70, 200)}
      ${zone("M78 248C100 240 124 246 136 260C138 290 118 306 98 302C82 296 76 270 78 248Z", "#ffd9d0", "cabeça/face", 84, 282)}
      <path d="M150 70C176 110 172 172 140 206M150 70C140 55 120 48 100 50M140 104C125 100 105 100 88 106M62 152C80 140 100 138 120 144" stroke="#a9654d" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>
      <ellipse cx="114" cy="124" rx="26" ry="14" fill="none" stroke="#1aa48a" stroke-width="2" stroke-dasharray="4 3"/><text x="140" y="124" class="zl" fill="#0b7a64">ABVN 100 %</text>
      ${AUR.map(p => `<g class="pt ${sel === p.id ? "on" : ""} ${sug.includes(p.id) ? "sug" : ""} ${p.nada ? "nada" : ""}" data-id="${p.id}" tabindex="0" role="button" aria-label="${esc(p.n)}"><circle cx="${p.x}" cy="${p.y}" r="${sug.includes(p.id) ? 7 : 5}"/><text x="${p.x + 8}" y="${p.y + 4}">${esc(p.id)}</text></g>`).join("")}
    </svg>`;
  }
  function headSVG(view, sel, sug) {
    const pts = YNSA.filter(p => p.side === view);
    const face = view === "frente"
      ? `<ellipse cx="130" cy="160" rx="100" ry="128" fill="#f2c8b4" stroke="#b8735a" stroke-width="2.5"/><path d="M34 140C40 62 96 30 130 30C164 30 220 62 226 140C206 98 170 86 130 88C90 86 54 98 34 140Z" fill="#5a3b2b"/>
         <path d="M96 150q14-8 28 0M136 150q14-8 28 0" stroke="#7a4b38" stroke-width="3" fill="none"/><ellipse cx="110" cy="166" rx="9" ry="5" fill="#fff"/><ellipse cx="150" cy="166" rx="9" ry="5" fill="#fff"/><circle cx="110" cy="166" r="3.5" fill="#3b2a20"/><circle cx="150" cy="166" r="3.5" fill="#3b2a20"/>
         <path d="M130 172v26M118 222q12 8 24 0" stroke="#a9654d" stroke-width="2.5" fill="none"/><path d="M30 160q-12 10 0 28M230 160q12 10 0 28" stroke="#b8735a" stroke-width="3" fill="none"/>
         <path d="M34 128q-4 30 6 60M226 128q4 30-6 60" stroke="#1aa48a" stroke-width="2" stroke-dasharray="3 4" fill="none"/>`
      : `<path d="M60 70C90 20 190 18 220 80C236 120 232 170 214 206C204 226 198 252 182 272C160 296 120 296 96 284C84 250 80 222 64 206C44 186 40 150 46 120C48 100 52 84 60 70Z" fill="#f2c8b4" stroke="#b8735a" stroke-width="2.5"/>
         <path d="M60 70C90 20 190 18 220 80C228 100 230 120 228 150C210 120 170 96 120 96C92 96 72 104 52 118C50 100 54 84 60 70Z" fill="#5a3b2b"/>
         <path d="M168 150c12-10 30-6 34 10c4 16-4 30-16 34c-10 4-16-2-18-10c-2-10 6-14 4-22z" fill="#e8b49f" stroke="#a9654d" stroke-width="2"/><text x="60" y="250" class="zl">face →</text>`;
    return `<svg viewBox="0 0 260 300" class="map" role="img" aria-label="Cabeça ${view} com pontos YNSA">${face}
      ${pts.map(p => { const mir = view === "frente" ? [[p.x, p.y], [260 - p.x, p.y]] : [[p.x, p.y]];
        return mir.map(([x, y], i) => `<g class="pt ynsa ${sel === p.id ? "on" : ""} ${sug.includes(p.id) ? "sug" : ""} ${p.hip ? "hip" : ""}" data-id="${p.id}" tabindex="0" role="button" aria-label="${esc(p.n)}"><circle cx="${x}" cy="${y}" r="${sug.includes(p.id) ? 7 : 5}"/>${i === 0 ? `<text x="${x + 8}" y="${y - 6}">${esc(p.id)}</text>` : ""}</g>`).join(""); }).join("")}
    </svg>`;
  }

  // ------------------------------------------------------------ janela
  let tab = "acu", sel = null, view = "frente", only = false;
  function render(b) {
    const reg = caseRegion(), cs = g.AxonSim && g.AxonSim.case;
    const pts = g.AxonStage ? g.AxonStage.reflexPoints() : [], acu = pts.filter(p => p.cat === "acu" || p.cat === "aur" || p.cat === "tp");
    const pairs = EA_PAIRS[reg] || EA_PAIRS.lombar, sugAcu = [...new Set(pairs.flat().filter(x => /^[A-Z]/.test(x) && acu.some(p => p.id === x)))];
    const sugY = YNSA.filter(p => p.reg.includes(reg)).map(p => p.id).concat(reg === "difusa" ? ["Y"] : []);
    const sugA = [...AUR.filter(p => (p.reg || []).includes(reg)).map(p => p.id), "TF4", "AH6a"].concat(reg === "difusa" ? ["CO10", "CO12", "CO14"] : []);
    b.innerHTML = `<div class="seg mtabs">${[["acu", "Acupuntura e EA"], ["ynsa", "Craniopuntura YNSA"], ["aur", "Aurículo"], ["refs", "Referências"]].map(([k, n]) => `<button data-t="${k}" class="${k === tab ? "on" : ""}">${n}</button>`).join("")}</div>
      <p class="note">${cs ? `Caso ativo: <b>${esc(cs.title)}</b> → região <b>${esc(reg)}</b>. Pontos <span class="sugdot"></span> sugeridos; os demais estão disponíveis.` : `Sem caso ativo: sugestões para a região <b>${esc(reg)}</b>. Escolha um caso no modo Simulação ou descreva um em <b>Paciente</b>.`}
      <label class="rowc"><input type="checkbox" id="onlySug" ${only ? "checked" : ""}> Mostrar só os sugeridos</label></p><div id="mBody"></div>`;
    $$(".mtabs button", b).forEach(x => x.onclick = () => { tab = x.dataset.t; sel = null; render(b); });
    $("#onlySug", b).onchange = e => { only = e.target.checked; render(b); };
    const mb = $("#mBody", b);
    if (tab === "acu") {
      const list = acu.filter(p => !only || sugAcu.includes(p.id));
      mb.innerHTML = `<div class="card"><h4>Pares de eletroacupuntura sugeridos · ${esc(reg)}</h4>${pairs.map(([a, c, w]) => `<div class="pair"><button class="chip" data-go="${a}">${a}</button>↔<button class="chip" data-go="${c}">${c}</button><span class="note">${esc(w)}</span></div>`).join("")}
        <h4 style="margin-top:10px">Frequência e mecanismo</h4>${EA_FREQ.map(f => `<div class="kv2"><b>${f.f}</b><span>${f.mech} ${R(f.ref)}</span></div>`).join("")}
        <p class="note">Parâmetros didáticos usados no simulador: 20–30 min por sessão; intensidade até formigamento forte ou contração leve, sempre abaixo da dor. Sessões semanais ou bissemanais nos estudos clínicos ${R("vick18")}. ${tag("lit")} Isto descreve a literatura e o modelo; não é prescrição.</p>
        <div class="row" style="gap:6px"><button class="btn" id="useEA">Usar EA 2/100 Hz no simulador</button></div></div>
        <div class="card"><h4>Pontos disponíveis no corpo 3D (${list.length})</h4><div class="ptlist">${list.map(p => `<button class="ptb ${sugAcu.includes(p.id) ? "sug" : ""}" data-go="${p.id}" title="${esc(p.note)}"><b>${esc(p.id)}</b><span>${esc(p.name.split("·").pop().trim())}</span><em>${esc(p.seg || p.derm || "")}</em></button>`).join("")}</div>
        <p class="note">Clique para localizar no modelo e ver nervo, músculo e dermátomo associados. Localizações ${R("who08")}.</p></div>`;
      $$("[data-go]", mb).forEach(x => x.onclick = () => { g.AxonStage.selectReflex(x.dataset.go, true); });
      $("#useEA", mb).onclick = () => { const A = g.AxonApp; A.setMod("ea"); Object.assign(A.state.p, { f: 2, pw: 200 }); A.renderRight(); A.update(); A.botSay("EA configurada: 2 Hz (alterne com 100 Hz para o padrão denso-disperso). Coloque a agulha no ponto pelo modo Simulação."); };
    } else if (tab === "ynsa") {
      const p = YNSA.find(x => x.id === sel);
      mb.innerHTML = `<div class="seg"><button data-v="frente" class="${view === "frente" ? "on" : ""}">Fronte (yin)</button><button data-v="perfil" class="${view === "perfil" ? "on" : ""}">Perfil (yang)</button></div>
        <div class="mapwrap">${headSVG(view, sel, sugY)}</div>
        <div class="card">${p ? `<h4>${esc(p.n)}</h4><p>${esc(p.ind)}</p>${p.hip ? tag("hip") + " correspondência tradicional (MTC)" : tag("pre") + " localização esquemática"}` : `<h4>Craniopuntura de Yamamoto (YNSA)</h4><p>Microssistema no couro cabeludo descrito por Toshikatsu Yamamoto a partir de 1973: pontos básicos A–I para o aparelho locomotor, pontos sensoriais, cerebrais e os 12 pontos Y. Difere da craniopuntura chinesa (Jiao Shun Fa), baseada em áreas corticais ${R("brjp18")}.</p>`}
        <h4>Evidência</h4><ul class="ev"><li>Revisão sistemática em condições dolorosas: ensaios em geral de baixa qualidade metodológica; YNSA superior a placebo e controle e semelhante à acupuntura sistêmica; pontos básicos A–I os mais usados ${R("brjp18")}.</li>
        <li>Enxaqueca: ensaio randomizado com efeito semelhante ao da acupuntura chinesa tradicional ${R("jacm14")}.</li><li>Sistemas de craniopuntura variam muito entre si, o que dificulta a síntese de evidências ${R("wise23")}; em AVC, a certeza da evidência para craniopuntura é baixa ${R("park25")}.</li></ul>
        <p class="note">Obras de referência: ${R("yam10")} ${R("feely")}. ${tag("lit")}</p></div>`;
      $$("[data-v]", mb).forEach(x => x.onclick = () => { view = x.dataset.v; render(b); });
      $$(".pt", mb).forEach(x => { const go = () => { sel = x.dataset.id; render(b); }; x.onclick = go; x.onkeydown = e => (e.key === "Enter" || e.key === " ") && go(); });
    } else if (tab === "aur") {
      const p = AUR.find(x => x.id === sel), list = AUR.filter(x => !only || sugA.includes(x.id));
      mb.innerHTML = `<div class="mapwrap">${earSVG(sel, sugA)}</div>
        <div class="card">${p ? `<h4>${esc(p.id)} · ${esc(p.n)}</h4><p><b>Zona:</b> ${esc(p.z)}</p><p>${esc(p.ind)}</p>${p.abvn != null ? `<p class="note">Inervação pelo ramo auricular do vago nessa zona: ${p.abvn} % das orelhas dissecadas ${R("peuker")} ${tag("lit")}</p>` : ""}${p.nada ? `<p class="note">Faz parte dos 5 pontos do protocolo NADA (Shenmen, Simpático, Rim, Fígado, Pulmão).</p>` : ""}
          ${["CO10", "CO12"].includes(p.id) ? `<button class="btn" id="toTavns">Simular taVNS na cymba</button>` : ""}` : `<h4>Auriculoterapia</h4><p>Somatotopia do "feto invertido" de Paul Nogier: cabeça no lóbulo, coluna no anti-hélix, membros na escafa e nas raízes do anti-hélix, vísceras na concha ${R("nogier19")}. Nomes e códigos: padrão chinês ${R("gbt08")}, após o grupo de trabalho da OMS ${R("who90")}; sistemas chinês e ocidental comparados em ${R("oleson")}.</p>`}
        <p class="note">${tag("pre")} Esquema da orelha direita, face lateral, com localizações aproximadas.</p></div>
        <div class="card"><h4>Pontos (${list.length})</h4><div class="ptlist">${list.map(x => `<button class="ptb ${sugA.includes(x.id) ? "sug" : ""}" data-id="${x.id}"><b>${esc(x.id)}</b><span>${esc(x.n)}</span><em>${esc(x.z)}</em></button>`).join("")}</div></div>`;
      $$(".pt, .ptb", mb).forEach(x => { const go = () => { sel = x.dataset.id; render(b); }; x.onclick = go; x.onkeydown = e => (e.key === "Enter" || e.key === " ") && go(); });
      const tv = $("#toTavns", mb); if (tv) tv.onclick = () => { const A = g.AxonApp; A.setMod("tavns"); g.AxonStage.selectReflex("CYMBA", true); };
    } else {
      mb.innerHTML = `<div class="card"><h4>Referências usadas nos mapas</h4><ol class="refs">${Object.entries(REF).map(([k, v]) => `<li id="ref-${k}"><b>[${k}]</b> ${esc(v)}</li>`).join("")}</ol>
        <p class="note">A força da evidência difere muito entre as técnicas: acupuntura para dor crônica tem meta-análise de dados individuais ${R("vick18")}; YNSA e auriculoterapia têm ensaios menores e heterogêneos. Correspondências da MTC aparecem como ${tag("hip")}.</p></div>`;
    }
  }
  function boot() { const A = g.AxonApp; if (!A || !A.registerApp) return setTimeout(boot, 80); A.registerApp("maps", { title: "maps", w: 460, h: 680, render });
    document.addEventListener("axon:case", () => A.isOpen("maps") && render(A.body("maps"))); }
  boot();
  g.AxonMaps = { YNSA, AUR, EA_PAIRS, EA_FREQ, REF, caseRegion };
})(window);
