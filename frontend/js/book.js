/* axon · book.js — a parte teórica como um livro (v0.11)
 * Capítulos com o fundamento de cada coisa que o usuário faz na parte experimental. O livro acompanha o experimento:
 * ao aplicar um instrumento, escolher um ponto, mudar o paciente ou o caso, abre o capítulo correspondente e mostra
 * um quadro “No experimento agora” com os valores do momento. Cada parágrafo aceita clique triplo para virar nota. */
(function (g) {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (x, d = 1) => x == null || !isFinite(x) ? "—" : (+x).toFixed(d).replace(".", ",");
  const L = (t, k) => `<span class="tag ${{ lit: "t-lit", pre: "t-pre", der: "t-der", hip: "t-hip", mod: "t-mod" }[k]}">${{ lit: "LITERATURA", pre: "PREMISSA", der: "DERIVADO", hip: "HIPÓTESE", mod: "MODELO" }[k]}</span>`;
  const B = { ch: 0, follow: true, live: {} };
  const CH = [
    { id: "ler", t: "Como ler este livro", ev: [], p: [
      "O axon separa duas partes. Esta, a teórica, explica o que se sabe e como o simulador calcula. A experimental — instrumentos, parâmetros, testes — fica nas janelas e no corpo 3D.",
      "Enquanto você experimenta, o livro abre o capítulo correspondente e mostra, num quadro, os valores do momento. Passe o mouse sobre um parâmetro para ver o que ele faz; clique três vezes num parágrafo ou parâmetro para guardar uma nota.",
      "Cada afirmação traz a procedência: literatura, premissa do modelo, valor derivado, resultado de modelo ou hipótese em investigação. Nada aqui é recomendação clínica: os casos são fictícios e o modelo é verificado, não validado."] },
    { id: "fibras", t: "Fibras nervosas: classes, calibre e velocidade", ev: ["axon:morpho"], p: [
      `As fibras periféricas se dividem pelo calibre: Aα (12–20 µm; motoras e aferentes Ia/Ib), Aβ (6–12 µm; tato), Aγ (3–6 µm; fusos), Aδ (1–5 µm; dor rápida e frio), B (pré-ganglionares) e C (0,2–1,5 µm, amielínicas; dor lenta, calor e eferentes simpáticas). ${L(0, "lit")}`,
      `Nas mielinizadas, a velocidade cresce quase em proporção ao diâmetro (cerca de 4,5 a 6 m/s por µm); a razão entre o axônio e a fibra (g-ratio) fica entre 0,6 e 0,75, e o internodo cresce com o calibre. ${L(0, "lit")}`,
      `O preditor do axon ajusta esses calibres pela idade, altura (só nos membros inferiores), temperatura, glicemia e desmielinização do paciente. As direções dos efeitos vêm da literatura; as magnitudes são premissas calibradas. ${L(0, "pre")}`] },
    { id: "limiar", t: "Limiar e recrutamento", ev: ["axon:interact"], p: [
      `Uma fibra mielinizada dispara quando o campo ao longo dos nós de Ranvier ultrapassa o limiar da membrana. O modelo nodal de 41 nós calcula o limiar Ith(D, r) para cada diâmetro D e distância r. ${L(0, "lit")}`,
      `O limiar cai com o diâmetro e sobe com a distância. Por isso, para uma mesma corrente, recrutam-se primeiro as fibras grossas e próximas. O simulador procura o menor diâmetro recrutado, D*, e calcula a fração de cada classe acima dele pela distribuição de calibres do paciente. ${L(0, "der")}`,
      `Fora da faixa verificada (0,3–1,5 mm e 1–16 µm) os valores usam atenuação didática e ficam marcados como premissa. Fibras C não entram no núcleo nodal. ${L(0, "pre")}`] },
    { id: "modal", t: "Modalidades e instrumentos", ev: ["axon:instr"], p: [
      `TENS: eletrodos na pele; a alta frequência (80–120 Hz) com intensidade sensorial ativa Aβ e o portão segmentar; a baixa frequência (2–10 Hz) favorece opioides endógenos. Só uma fração da corrente chega ao ramo cutâneo. ${L(0, "lit")}`,
      `Eletroacupuntura: agulhas nos pontos, corrente entre elas; a distância da ponta ao tronco nervoso define quais classes respondem e se há contração. Frequências de 2 Hz e 100 Hz liberam peptídeos opioides diferentes (Han 2003). ${L(0, "lit")}`,
      `Acupressão: pressão abaixo do limiar de dor à pressão ativa mecanorreceptores. taVNS: estímulo na concha da orelha, território do ramo auricular do vago (cymba 100 % das orelhas). LIFU: ultrassom de baixa intensidade, mecanismo em investigação. ${L(0, "lit")}`] },
    { id: "dor", t: "Mecanismos da dor e da analgesia", ev: ["axon:physio"], p: [
      `Teoria do portão: a entrada Aβ ativa interneurônios inibitórios do corno dorsal que reduzem a transmissão de Aδ e C (Melzack e Wall 1965). ${L(0, "lit")}`,
      `Controle descendente: substância cinzenta periaquedutal, bulbo rostral ventromedial e locus coeruleus modulam a medula por opioides, serotonina e noradrenalina. ${L(0, "lit")}`,
      `Vias autonômicas: dor e Aδ elevam o tônus simpático; o vago reduz a frequência cardíaca e eleva a variabilidade. A via colinérgica anti-inflamatória foi demonstrada em modelos experimentais. ${L(0, "hip")}`,
      `A rede fisiológica do simulador liga esses nós com pesos nominais variados ±40 % (Monte Carlo, semente 42): é hipótese organizada, não medida. ${L(0, "hip")}`] },
    { id: "pontos", t: "Pontos, meridianos e mapas", ev: ["axon:acupoint"], p: [
      `Os 361 pontos clássicos seguem a padronização da OMS (2008): código do meridiano, número e localização por proporção corporal (cun). A craniopuntura tem dois sistemas no atlas: YNSA (Yamamoto) e as 14 linhas do padrão internacional. O aurículo segue a norma chinesa GB/T 13734-2008. ${L(0, "lit")}`,
      `No simulador, cada ponto é posicionado na malha a partir de marcos ósseos e proporções em cun; o dermátomo, o nervo, o músculo e o osso sob o ponto são calculados na própria malha. As posições são aproximadas e não substituem a palpação. ${L(0, "pre")}`,
      `Muitos pontos ficam sobre troncos ou ramos nervosos identificáveis (por exemplo PC6 sobre o mediano, LI4 no território do ramo superficial do radial), o que dá base anatômica a parte dos efeitos segmentares. ${L(0, "lit")}`] },
    { id: "paciente", t: "O paciente simulado", ev: ["axon:case", "axon:patient"], p: [
      `Sexo, idade, altura, peso e fototipo deformam a malha e alteram o modelo: tecido adiposo afasta o eletrodo da fibra, a idade reduz o calibre e a densidade das fibras grossas, a glicemia reduz axônios. ${L(0, "pre")}`,
      `O caso clínico (fictício) define origem da dor, EVA de base, segmentos e condições; o plano terapêutico ordena as técnicas por adequação e simula o desfecho por sessão. ${L(0, "mod")}`] },
    { id: "histo", t: "Histotripsia: ablação por cavitação", ev: ["axon:instr"], p: (g.AxonHisto ? g.AxonHisto.THEORY : []).map(([t, x, k, r]) => `<b>${t}.</b> ${x} ${L(0, k)}${r.length ? ` <small>(${r.map(id => g.AxonHisto.REF[id].t.split(".")[0]).join("; ")})</small>` : ""}`) },
    { id: "seg", t: "Segurança", ev: ["axon:interact"], p: [
      `Densidade de carga: o critério de Shannon (k < 1,85) separa combinações de carga por fase e densidade de carga sem lesão observada em estudos com eletrodos. ${L(0, "lit")}`,
      `Aquecimento: a equação biotérmica de Pennes estima o aumento de temperatura pela dissipação de energia e pela perfusão. Locais de risco (tórax para agulhas profundas, seio carotídeo, gestação) aparecem nas fichas dos pontos. ${L(0, "lit")}`] },
    { id: "lim", t: "Limitações do modelo", ev: [], p: [
      "O núcleo é verificado contra o próprio livro de referência, não validado em pessoas. A anatomia é uma malha genérica deformada; os trajetos nervosos periféricos são didáticos.",
      "As sensações previstas (formigamento, desconforto, dor) são convenções sobre frações recrutadas; as respostas autonômicas e o desfecho de dor vêm de uma rede de hipóteses com pesos nominais.",
      "Use os resultados para entender relações (calibre, distância, intensidade, frequência), não para decidir tratamentos."] },
  ];
  const MAP = {}; CH.forEach((c, i) => c.ev.forEach(e => (MAP[e] = MAP[e] || []).push(i)));
  function liveBox(c) {
    const r = g.AxonInteract && g.AxonInteract.result, st = g.AxonApp && g.AxonApp.state, cs = g.AxonSim && g.AxonSim.case, P = g.AxonMorpho && g.AxonMorpho.patient();
    const rows = [];
    if (c.id === "limiar" || c.id === "seg") { if (r) rows.push(`${esc(r.tool)} ${fmt(r.I, 2)} mA → efetiva ${fmt(r.Ieff, 4)} mA a ${fmt(r.dCut, 2)} mm; D* = ${isFinite(r.Dstar) ? fmt(r.Dstar, 2) + " µm" : "> 16 µm"}; ${r.classes.map(x => `${x.cls} ${fmt(x.frac * 100, 0)} %`).join(", ")}${c.id === "seg" && r.shannon != null ? `; Shannon k = ${fmt(r.shannon, 2)}` : ""}.`); }
    if (c.id === "modal" && st) rows.push(`Modalidade ${esc(st.mod)} · ${st.p.f} Hz · ${st.p.pw} µs · ${fmt(st.p.I, 2)} mA · área ${st.p.area} cm²${g.AxonWorkbench && g.AxonWorkbench.WB.instr ? " · instrumento " + esc(g.AxonWorkbench.WB.instr) : ""}.`);
    if (c.id === "fibras" && g.AxonMorpho) { const p = g.AxonMorpho.predict(); rows.push(`${esc(p.nerve)}: ${p.classes.map(x => `${x.cls} ${fmt(x.D.med)} µm (${fmt(x.cv, 0)} m/s)`).join(", ")}.`); }
    if (c.id === "pontos" && B.live.acu) rows.push(`Ponto ${esc(B.live.acu.id)} (${esc(B.live.acu.py || "")}): ${esc(B.live.acu.loc || "")}.`);
    if (c.id === "paciente" && P) rows.push(`${P.sex === "F" ? "Mulher" : "Homem"}, ${P.age} anos, ${P.height} cm, IMC ${fmt(P.bmi)}${cs ? ` · caso “${esc(cs.title)}”, EVA ${cs.pain.baseline}, ${esc(cs.pain.origin)}` : ""}.`);
    if (c.id === "dor" && r) rows.push(`Sensação prevista agora: ${esc(r.perception)}.`);
    return rows.length ? `<aside class="bk-live"><b>No experimento agora</b>${rows.map(x => `<p>${x}</p>`).join("")}</aside>` : "";
  }
  function win(b) {
    const c = CH[B.ch];
    b.innerHTML = `<div class="book"><nav class="bk-ears">${CH.map((x, i) => `<button data-c="${i}" class="${i === B.ch ? "on" : ""}" title="${esc(x.t)}">${i + 1}</button>`).join("")}</nav>
      <div class="bk-page"><div class="bk-h"><span>Capítulo ${B.ch + 1}</span><label class="rowc"><input type="checkbox" id="bkF" ${B.follow ? "checked" : ""}> acompanhar o experimento</label></div>
      <h2>${esc(c.t)}</h2>${liveBox(c)}${c.p.map(p => `<p data-note>${p}</p>`).join("")}
      <div class="bk-nav"><button class="btn ghost sm" data-d="-1" ${B.ch ? "" : "disabled"}>‹ anterior</button><span>${B.ch + 1} / ${CH.length}</span><button class="btn ghost sm" data-d="1" ${B.ch < CH.length - 1 ? "" : "disabled"}>próximo ›</button></div></div></div>`;
    $$("[data-c]", b).forEach(x => x.onclick = () => { B.ch = +x.dataset.c; win(b); });
    $$("[data-d]", b).forEach(x => x.onclick = () => { B.ch = Math.max(0, Math.min(CH.length - 1, B.ch + +x.dataset.d)); win(b); });
    $("#bkF", b).onchange = e => { B.follow = e.target.checked; };
  }
  function follow(ev) { const A = g.AxonApp; if (!A || !A.isOpen("book")) return; if (B.follow && MAP[ev]) B.ch = MAP[ev][0]; win(A.body("book")); }
  function boot() { const A = g.AxonApp; if (!A || !A.registerApp) return setTimeout(boot, 100); A.registerApp("book", { title: "book", w: 560, h: 720, render: win });
    Object.keys(MAP).concat(["axon:case"]).forEach(ev => document.addEventListener(ev, e => { if (ev === "axon:acupoint") B.live.acu = e.detail.point; follow(ev); })); }
  boot();
  g.AxonBook = { CH, B, open: id => { const i = CH.findIndex(c => c.id === id); if (i >= 0) B.ch = i; g.AxonApp.openApp("book"); } };
})(window);
