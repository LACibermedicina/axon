/* axon · acuref.js — indicações e referências bibliográficas por ponto (acupuntura e acupressão).
   Camadas, cada uma com a sua procedência:
   1. Categoria clássica do ponto (cinco shu, yuan, luo, xi, shu dorsal, mu frontal, hui, confluentes, he inferior) e
      a função que as fontes clássicas atribuem à categoria [LITERATURA: Nan Jing, Ling Shu; manual de referência].
   2. Pontos de comando clássicos (Si Zong Xue) [LITERATURA].
   3. Uso regional e segmentar derivado da anatomia calculada na malha (dermátomo, nervo, músculo) [DERIVADO].
   4. Evidência clínica: só revisões e ensaios conferidos no PubMed (PMID/DOI), com o resultado como publicado,
      inclusive quando é negativo ou inconclusivo [LITERATURA]. Estudos em animais: [HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO].
   Não há lista de indicações tradicionais escrita de memória ponto a ponto. */
(function (g) {
  "use strict";
  // ------------------------------------------------------------------ fontes
  const SRC = {
    who2008: "WHO Regional Office for the Western Pacific. WHO Standard Acupuncture Point Locations in the Western Pacific Region. Manila: WHO; 2008.",
    who1991: "World Health Organization. A proposed standard international acupuncture nomenclature: report of a WHO scientific group. Geneva: WHO; 1991.",
    nanjing: "Nan Jing (Clássico das Dificuldades), dificuldades 45 (pontos de influência) e 68 (funções dos cinco pontos shu). Texto clássico chinês, séc. I–II d.C.",
    lingshu: "Ling Shu (Eixo Espiritual), caps. 1 (pontos yuan) e 4 (pontos he inferiores dos órgãos fu). Texto clássico do Huangdi Neijing.",
    dacheng: "Yang Jizhou. Zhenjiu Dacheng (Grande Compêndio de Acupuntura e Moxabustão), 1601 — canção dos quatro pontos de comando (Si Zong Xue Ge).",
    deadman: "Deadman P, Al-Khafaji M, Baker K. A Manual of Acupuncture. 2nd ed. Hove: Journal of Chinese Medicine Publications; 2007 (categorias dos pontos).",
    whoSafety: "World Health Organization. Guidelines on basic training and safety in acupuncture. Geneva: WHO; 1999.",
    ept: "Electrophysical agents – contraindications and precautions: an evidence-based approach to clinical decision making in physical therapy. Physiother Can. 2010;62(5):1-80. doi:10.3138/ptc.62.5. PMID 21886384.",
    peuker: "Peuker ET, Filler TJ. The nerve supply of the human auricle. Clin Anat. 2002;15(1):35-7. doi:10.1002/ca.1089. PMID 11835542.",
  };
  // ------------------------------------------------------------------ evidência clínica conferida no PubMed
  const EV = {
    lee2015: { ref: "Lee A, Chan SK, Fan LT. Stimulation of the wrist acupuncture point PC6 for preventing postoperative nausea and vomiting. Cochrane Database Syst Rev. 2015;(11):CD003281.", pmid: "26522652", doi: "10.1002/14651858.CD003281.pub4", tipo: "Revisão sistemática Cochrane (59 ensaios, 7667 participantes)" },
    ezzo2006: { ref: "Ezzo JM, Richardson MA, Vickers A, et al. Acupuncture-point stimulation for chemotherapy-induced nausea or vomiting. Cochrane Database Syst Rev. 2006;(2):CD002285.", pmid: "16625560", doi: "10.1002/14651858.CD002285.pub2", tipo: "Revisão sistemática Cochrane (11 ensaios, 1247 participantes)" },
    matthews2015: { ref: "Matthews A, Haas DM, O'Mathúna DP, Dowswell T. Interventions for nausea and vomiting in early pregnancy. Cochrane Database Syst Rev. 2015;(9):CD007575.", pmid: "26348534", doi: "10.1002/14651858.CD007575.pub4", tipo: "Revisão sistemática Cochrane (41 ensaios)" },
    smith2020: { ref: "Smith CA, Collins CT, Levett KM, et al. Acupuncture or acupressure for pain management during labour. Cochrane Database Syst Rev. 2020;2(2):CD009232.", pmid: "32032444", doi: "10.1002/14651858.CD009232.pub2", tipo: "Revisão sistemática Cochrane (28 ensaios, 3960 mulheres)" },
    coyle2012: { ref: "Coyle ME, Smith CA, Peat B. Cephalic version by moxibustion for breech presentation. Cochrane Database Syst Rev. 2012;(5):CD003928.", pmid: "22592693", doi: "10.1002/14651858.CD003928.pub3", tipo: "Revisão sistemática Cochrane (8 ensaios, 1346 mulheres)" },
    smith2016: { ref: "Smith CA, Armour M, Zhu X, Li X, Lu ZY, Song J. Acupuncture for dysmenorrhoea. Cochrane Database Syst Rev. 2016;4(4):CD007854.", pmid: "27087494", doi: "10.1002/14651858.CD007854.pub3", tipo: "Revisão sistemática Cochrane (42 ensaios, 4640 mulheres)" },
    ng2013: { ref: "Ng SSM, Leung WW, Mak TWC, et al. Electroacupuncture reduces duration of postoperative ileus after laparoscopic surgery for colorectal cancer. Gastroenterology. 2013;144(2):307-313.e1.", pmid: "23142625", doi: "10.1053/j.gastro.2012.10.050", tipo: "Ensaio clínico randomizado (165 pacientes)" },
    liu2021: { ref: "Liu S, Wang Z, Su Y, et al. A neuroanatomical basis for electroacupuncture to drive the vagal-adrenal axis. Nature. 2021;598(7882):641-645.", pmid: "34646018", doi: "10.1038/s41586-021-04001-4", tipo: "Estudo experimental em camundongos", animal: true },
    gates2006: { ref: "Gates S, Smith LA, Foxcroft DR. Auricular acupuncture for cocaine dependence. Cochrane Database Syst Rev. 2006;(1):CD005192.", pmid: "16437523", doi: "10.1002/14651858.CD005192.pub2", tipo: "Revisão sistemática Cochrane (7 ensaios, 1433 participantes)" },
    vickers2018: { ref: "Vickers AJ, Vertosick EA, Lewith G, et al. Acupuncture for Chronic Pain: Update of an Individual Patient Data Meta-Analysis. J Pain. 2018;19(5):455-474.", pmid: "29198932", doi: "10.1016/j.jpain.2017.11.005", tipo: "Meta-análise de dados individuais (39 ensaios, 20 827 pacientes)" },
    linde2016: { ref: "Linde K, Allais G, Brinkhaus B, et al. Acupuncture for the prevention of episodic migraine. Cochrane Database Syst Rev. 2016;(6):CD001218.", pmid: "27351677", doi: "10.1002/14651858.CD001218.pub3", tipo: "Revisão sistemática Cochrane (22 ensaios, 4985 participantes)" },
  };
  // indicação → pontos estudados, técnica e resultado resumido como publicado
  const EVID = [
    { pts: ["PC6"], cond: "Náusea e vômito pós-operatórios (prevenção)", tec: ["acupuntura", "acupressão", "eletroestimulação"], ev: "lee2015", res: "Contra simulação: menos náusea (RR 0,68) e vômito (RR 0,60); qualidade baixa. Contra antieméticos: sem diferença (qualidade moderada).", nivel: "low" },
    { pts: ["PC6"], cond: "Náusea e vômito induzidos por quimioterapia", tec: ["acupuntura", "eletroacupuntura", "acupressão"], ev: "ezzo2006", res: "Menos vômito agudo com estimulação por agulha ou eletroacupuntura; acupressão reduziu a intensidade da náusea aguda; estimulação elétrica não invasiva sem benefício.", nivel: "low" },
    { pts: ["PC6"], cond: "Náusea e vômito no início da gestação", tec: ["acupressão", "acupuntura"], ev: "matthews2015", res: "Evidência limitada para acupressão em P6; acupuntura sem benefício significativo. Não há evidência de alta qualidade para nenhuma intervenção.", nivel: "inconcl" },
    { pts: ["LI4", "SP6"], cond: "Dor no trabalho de parto", tec: ["acupuntura", "acupressão"], ev: "smith2020", res: "Acupuntura x simulação: talvez maior satisfação e menos analgesia farmacológica; acupressão pode reduzir a intensidade da dor. Certeza baixa a muito baixa na maioria das comparações. Pontos variam entre ensaios; LI4 e SP6 estão entre os usados.", nivel: "low" },
    { pts: ["BL67"], cond: "Apresentação pélvica (versão cefálica)", tec: ["moxabustão"], ev: "coyle2012", res: "Sozinha, a moxabustão não reduziu as apresentações não cefálicas ao nascer; combinada com acupuntura ou postura, houve redução. Evidência limitada.", nivel: "inconcl" },
    { pts: ["SP6"], cond: "Dismenorreia primária", tec: ["acupuntura", "acupressão"], ev: "smith2016", res: "Evidência insuficiente para afirmar ou negar efeito; qualidade baixa ou muito baixa. Pontos variam entre ensaios.", nivel: "inconcl" },
    { pts: ["ST36", "SP6", "LI4", "TE6"], cond: "Íleo pós-operatório após cirurgia colorretal laparoscópica", tec: ["eletroacupuntura"], ev: "ng2013", res: "Tempo até a evacuação menor que com simulação (85,9 × 107,5 h) e que sem acupuntura; menos analgésico e alta mais cedo. Pontos usados no ensaio: Zusanli, Sanyinjiao, Hegu e Zhigou.", nivel: "rct" },
    { pts: ["ST36"], cond: "Modulação anti-inflamatória pelo eixo vago-adrenal (em camundongos)", tec: ["eletroacupuntura"], ev: "liu2021", res: "Eletroacupuntura de baixa intensidade em ST36, mas não em ST25, ativou o eixo vago-adrenal por neurônios sensitivos PROKR2 da fáscia profunda do membro. Estudo em animais.", nivel: "animal" },
    { pts: [], aur: ["TF4", "AH6a", "CO10", "CO12", "CO14"], cond: "Dependência de cocaína (protocolo auricular de 5 pontos)", tec: ["acupuntura auricular"], ev: "gates2006", res: "Sem evidência de efeito em relação a simulação ou a nenhum tratamento; evidência de baixa qualidade e inconclusiva.", nivel: "neg" },
  ];
  // evidências por condição, não por ponto (os pontos variam entre ensaios)
  const COND = [
    { cond: "Dor crônica (musculoesquelética, cefaleia, osteoartrite, ombro)", ev: "vickers2018", res: "Acupuntura superior à simulação (~0,2 DP) e à ausência de acupuntura (~0,5 DP); efeito persiste em 12 meses. Sem associação clara com a escolha dos pontos." },
    { cond: "Prevenção de enxaqueca episódica", ev: "linde2016", res: "Redução moderada da frequência das crises em relação a não fazer acupuntura e pequena em relação à simulação; ao menos semelhante à profilaxia medicamentosa." },
  ];
  const NIVEL = { rct: ["ensaio randomizado", "t-lit"], low: ["revisão · certeza baixa", "t-lit"], inconcl: ["inconclusivo", "t-hip"], neg: ["sem efeito demonstrado", "t-hip"], animal: ["estudo em animais", "t-hip"] };
  // ------------------------------------------------------------------ categorias clássicas
  const SHU = { // poço, nascente, riacho, rio, mar (Nan Jing 68)
    LU: ["LU11", "LU10", "LU9", "LU8", "LU5"], LI: ["LI1", "LI2", "LI3", "LI5", "LI11"], ST: ["ST45", "ST44", "ST43", "ST41", "ST36"], SP: ["SP1", "SP2", "SP3", "SP5", "SP9"],
    HT: ["HT9", "HT8", "HT7", "HT4", "HT3"], SI: ["SI1", "SI2", "SI3", "SI5", "SI8"], BL: ["BL67", "BL66", "BL65", "BL60", "BL40"], KI: ["KI1", "KI2", "KI3", "KI7", "KI10"],
    PC: ["PC9", "PC8", "PC7", "PC5", "PC3"], TE: ["TE1", "TE2", "TE3", "TE6", "TE10"], GB: ["GB44", "GB43", "GB41", "GB38", "GB34"], LR: ["LR1", "LR2", "LR3", "LR4", "LR8"] };
  const SHU_N = ["jing-poço", "ying-nascente", "shu-riacho", "jing-rio", "he-mar"];
  const SHU_F = ["plenitude abaixo do coração", "calor no corpo", "peso do corpo e dor nas articulações", "tosse, dispneia, calafrios e febre", "qi em contrafluxo e diarreia"];
  const YUAN = { LU9: "LU", LI4: "LI", ST42: "ST", SP3: "SP", HT7: "HT", SI4: "SI", BL64: "BL", KI3: "KI", PC7: "PC", TE4: "TE", GB40: "GB", LR3: "LR" };
  const LUO = { LU7: "LU", LI6: "LI", ST40: "ST", SP4: "SP", HT5: "HT", SI7: "SI", BL58: "BL", KI4: "KI", PC6: "PC", TE5: "TE", GB37: "GB", LR5: "LR", CV15: "Ren Mai", GV1: "Du Mai", SP21: "grande luo do Baço" };
  const XI = { LU6: "LU", LI7: "LI", ST34: "ST", SP8: "SP", HT6: "HT", SI6: "SI", BL63: "BL", KI5: "KI", PC4: "PC", TE7: "TE", GB36: "GB", LR6: "LR", KI9: "Yin Wei", GB35: "Yang Wei", KI8: "Yin Qiao", BL59: "Yang Qiao" };
  const BSHU = { BL13: "Pulmão", BL14: "Pericárdio", BL15: "Coração", BL18: "Fígado", BL19: "Vesícula biliar", BL20: "Baço", BL21: "Estômago", BL22: "Triplo aquecedor", BL23: "Rim", BL25: "Intestino grosso", BL27: "Intestino delgado", BL28: "Bexiga" };
  const MU = { LU1: "Pulmão", CV17: "Pericárdio", CV14: "Coração", LR14: "Fígado", GB24: "Vesícula biliar", LR13: "Baço", CV12: "Estômago", GB25: "Rim", ST25: "Intestino grosso", CV4: "Intestino delgado", CV3: "Bexiga", CV5: "Triplo aquecedor" };
  const HUI = { LR13: "órgãos zang", CV12: "órgãos fu", CV17: "qi", BL17: "sangue", GB34: "tendões", LU9: "vasos", BL11: "ossos", GB39: "medula" };
  const CONF = { SP4: "Chong Mai", PC6: "Yin Wei Mai", SI3: "Du Mai", BL62: "Yang Qiao Mai", GB41: "Dai Mai", TE5: "Yang Wei Mai", LU7: "Ren Mai", KI6: "Yin Qiao Mai" };
  const HEI = { ST36: "Estômago", ST37: "Intestino grosso", ST39: "Intestino delgado", BL40: "Bexiga", BL39: "Triplo aquecedor", GB34: "Vesícula biliar" };
  const CMD = { ST36: "abdome", BL40: "lombar e dorso", LU7: "cabeça e nuca", LI4: "face e boca", PC6: "tórax e hipocôndrios (acréscimo posterior à canção original)" };
  const MER_N = { LU: "Pulmão", LI: "Intestino grosso", ST: "Estômago", SP: "Baço", HT: "Coração", SI: "Intestino delgado", BL: "Bexiga", KI: "Rim", PC: "Pericárdio", TE: "Triplo aquecedor", GB: "Vesícula biliar", LR: "Fígado" };
  function cats(id) {
    const c = [];
    Object.entries(SHU).forEach(([m, arr]) => { const i = arr.indexOf(id); if (i >= 0) c.push({ k: "shu", t: `Ponto ${SHU_N[i]} do canal do ${MER_N[m]}`, f: `Nan Jing 68: pontos ${SHU_N[i].split("-")[0]} tratam ${SHU_F[i]}.`, src: "nanjing" }); });
    if (YUAN[id]) c.push({ k: "yuan", t: `Ponto yuan-fonte do ${MER_N[YUAN[id]]}`, f: "Pontos yuan tratam os distúrbios do órgão correspondente.", src: "lingshu" });
    if (LUO[id]) c.push({ k: "luo", t: `Ponto luo-conexão ${MER_N[LUO[id]] ? "do " + MER_N[LUO[id]] : "· " + LUO[id]}`, f: "Pontos luo ligam o canal ao seu par interior–exterior; usados quando os dois canais acoplados estão envolvidos.", src: "deadman" });
    if (XI[id]) c.push({ k: "xi", t: `Ponto xi-fenda ${MER_N[XI[id]] ? "do " + MER_N[XI[id]] : "do vaso " + XI[id]}`, f: "Pontos xi são usados em condições agudas e dolorosas; os xi dos canais yin também em sangramentos.", src: "deadman" });
    if (BSHU[id]) c.push({ k: "bshu", t: `Ponto shu dorsal do ${BSHU[id]}`, f: `Usado para distúrbios do ${BSHU[id]}.`, src: "deadman" });
    if (MU[id]) c.push({ k: "mu", t: `Ponto mu frontal do ${MU[id]}`, f: `Usado para distúrbios do ${MU[id]}, sobretudo agudos.`, src: "deadman" });
    if (HUI[id]) c.push({ k: "hui", t: `Ponto de influência (hui) dos ${HUI[id]}`, f: `Nan Jing 45: ponto de reunião dos ${HUI[id]}.`, src: "nanjing" });
    if (CONF[id]) c.push({ k: "conf", t: `Ponto confluente do ${CONF[id]}`, f: "Abre o vaso extraordinário correspondente; usado em par (SP4–PC6, SI3–BL62, GB41–TE5, LU7–KI6).", src: "deadman" });
    if (HEI[id]) c.push({ k: "hei", t: `Ponto he-mar inferior do ${HEI[id]}`, f: "Ling Shu 4: os pontos he inferiores tratam os órgãos fu.", src: "lingshu" });
    if (CMD[id]) c.push({ k: "cmd", t: `Ponto de comando: ${CMD[id]}`, f: "Canção dos quatro pontos de comando: abdome → ST36; lombar e dorso → BL40; cabeça e nuca → LU7; face e boca → LI4.", src: "dacheng" });
    return c;
  }
  // ------------------------------------------------------------------ uso regional e segmentar (anatomia calculada)
  // segmentos aproximados de inervação visceral (dor referida) [LITERATURA: fisiologia da dor visceral; aproximado]
  const VISC = [[1, 5, "coração"], [2, 5, "pulmões e brônquios"], [5, 9, "estômago e duodeno"], [6, 10, "fígado e vesícula biliar"], [9, 11, "intestino delgado"], [10, 12, "rins e ureteres"], [10, 12, "útero (corpo)"], [11, 13, "cólon e bexiga"]];
  function segOf(derm) { const m = /^([CTLS])(\d+)/.exec(derm || ""); if (!m) return null; const n = +m[2]; return m[1] === "T" ? n : m[1] === "L" ? 12 + n : m[1] === "C" ? 0 : 99; }
  function regional(p) {
    if (!p) return []; const out = [], nerve = String(p.nerve || "").replace(/ (right|left)$/, "");
    out.push(`Uso local e regional: dor ou desconforto na região do ponto${p.derm ? `, dermátomo ${p.derm}` : ""}${nerve ? `, território do ${nerve}` : ""}${p.muscle ? `, músculo ${p.muscle}` : ""}.`);
    const s = segOf(p.derm); if (s && s >= 1 && s <= 13) { const v = VISC.filter(([a, b]) => s >= a && s <= b).map(x => x[2]); if (v.length) out.push(`Mesmo segmento espinal (${p.derm}) que ${v.join(", ")}: convergência somatovisceral, base da dor referida (aproximado).`); }
    if (/^S[234]/.test(p.derm || "")) out.push(`Segmentos sacrais ${p.derm}: inervação parassimpática da bexiga, reto e órgãos pélvicos.`);
    return out;
  }
  // ------------------------------------------------------------------ acupressão
  function pressNote(id) {
    const S = g.AxonAcuData && g.AxonAcuData.SAFETY; if (!S) return { ok: true, t: "Adequado à acupressão (pressão digital firme e tolerável)." };
    if (S.noneedle.includes(id)) return { ok: false, t: "Referência topográfica: não se usa para estímulo." };
    if (id === "ST9") return { ok: false, t: "Sobre o seio carotídeo: não fazer pressão firme (pode causar bradicardia e hipotensão)." };
    if (S.eye.includes(id)) return { ok: true, t: "Só pressão suave na borda óssea da órbita; nunca sobre o globo ocular." };
    if (S.pregnancy.includes(id)) return { ok: true, t: "Na gestação, tradicionalmente evitado também à pressão (exceto em protocolos de trabalho de parto estudados)." };
    if (S.vessel.includes(id)) return { ok: true, t: "Palpar o pulso e pressionar ao lado do vaso." };
    if (S.spinal.includes(id)) return { ok: true, t: "Pressão moderada; evitar manobras bruscas da cabeça." };
    return { ok: true, t: "Adequado à acupressão (pressão digital firme e tolerável)." };
  }
  // ------------------------------------------------------------------ ficha completa
  function info(id, p) {
    const c = cats(id), ev = EVID.filter(e => e.pts.includes(id)), refs = new Set(["who2008"]);
    c.forEach(x => refs.add(x.src)); const S = g.AxonAcuData && g.AxonAcuData.SAFETY; if (S && Object.keys(S).some(k => S[k].includes(id))) refs.add("whoSafety");
    return { cats: c, reg: regional(p), ev, press: pressNote(id), src: [...refs].map(k => SRC[k]), evRefs: ev.map(e => EV[e.ev]) };
  }
  // índice de busca por indicação (texto das categorias, comandos e evidências)
  function search(q) {
    q = (q || "").toLowerCase().trim(); if (!q) return null; const hit = new Set();
    EVID.forEach(e => { if ((e.cond + " " + e.tec.join(" ")).toLowerCase().includes(q)) e.pts.forEach(x => hit.add(x)); });
    const D = g.AxonAcuData; if (D) Object.values(D.M).forEach(m => m.p.forEach(r => { const t = cats(r[0]).map(x => x.t + " " + x.f).join(" ").toLowerCase(); if (t.includes(q)) hit.add(r[0]); }));
    return hit;
  }
  const allCats = () => ({ yuan: Object.keys(YUAN), luo: Object.keys(LUO), xi: Object.keys(XI), bshu: Object.keys(BSHU), mu: Object.keys(MU), hui: Object.keys(HUI), conf: Object.keys(CONF), hei: Object.keys(HEI), cmd: Object.keys(CMD), shu: Object.values(SHU).flat(), ev: [...new Set(EVID.flatMap(e => e.pts))] });
  g.AxonAcuRef = { SRC, EV, EVID, COND, NIVEL, cats, regional, pressNote, info, search, allCats };
})(window);
