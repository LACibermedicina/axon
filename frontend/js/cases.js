/* axon · cases.js — casos clínicos FICTÍCIOS e DIDÁTICOS para o Modo Simulação.
 * Nenhum caso representa paciente real; não há dados identificáveis (LGPD).
 * Esquema (axon-case/1): ver Manual Técnico §Casos clínicos e docs/caso-exemplo.json. */
(function (g) {
  "use strict";
  const CASES = [
    {
      schema: "axon-case/1", id: "lombociatalgia-l5s1", title: "Lombociatalgia radicular L5/S1",
      summary: "Dor lombar irradiada para a face posterolateral da perna e dorso do pé, com parestesia em L5.",
      patient: { ageRange: "40–49", sex: "não informado" },
      pain: { origin: "neuropática", mechanism: "Compressão radicular L5 com componente inflamatório perirradicular", baseline: 7, dermatomes: ["L5", "S1"], structures: ["Raiz L5", "Nervo ciático", "Nervo fibular comum"], descriptors: ["queimação", "choque", "parestesia"], inflammation: .45, sensitization: .35 },
      autonomic: { hr: 82, rmssd: 28 },
      conditions: [{ id: "obesidade", label: "Tecido adiposo aumentado", effect: { fat: .5 } }],
      proposals: [
        { modality: "tens", site: "dermátomo L5 (face lateral da perna)", target: "L5", params: { f: 100, I: 15, pw: 150, area: 9 }, rationale: "Recrutar Aβ do segmento doloroso (portão medular)." },
        { modality: "ea", site: "região do ponto ST36 / fibular", target: "L5", params: { f: 2, I: 1.0, pw: 200, depth: 14 }, rationale: "Baixa frequência: liberação de encefalinas/β-endorfina (pré-clínico)." }
      ],
      objectives: ["Reduzir a EVA em ≥ 30 % sem recrutar Aδ além de 5 %", "Manter Shannon k < 1,75 e ΔT ≤ 1 °C"]
    },
    {
      schema: "axon-case/1", id: "neuralgia-trigeminal-v2", title: "Neuralgia trigeminal (V2)",
      summary: "Dor paroxística em choque na região maxilar, com zona-gatilho na asa do nariz.",
      patient: { ageRange: "60–69", sex: "não informado" },
      pain: { origin: "neuropática", mechanism: "Desmielinização focal na zona de entrada da raiz trigeminal (descargas ectópicas)", baseline: 8, dermatomes: ["V2"], structures: ["Nervo maxilar (V2)", "Gânglio trigeminal"], descriptors: ["choque", "paroxística"], inflammation: .1, sensitization: .4 },
      autonomic: { hr: 78, rmssd: 30 },
      conditions: [{ id: "desmielinizacao", label: "Desmielinização segmentar", effect: { demy: .4 } }],
      proposals: [{ modality: "tens", site: "território V2 (contralateral à zona-gatilho)", target: "V2", params: { f: 80, I: 10, pw: 100, area: 4 }, rationale: "Teste didático de modulação segmentar; estimular a zona-gatilho provoca crises." }],
      objectives: ["Observar a menor eficácia do portão com desmielinização", "Evitar recrutar Aδ (gatilho de paroxismo)"]
    },
    {
      schema: "axon-case/1", id: "fibromialgia-tavns", title: "Dor nociplástica difusa (perfil fibromiálgico)",
      summary: "Dor difusa há > 3 meses, sono não reparador, baixa variabilidade da frequência cardíaca.",
      patient: { ageRange: "30–39", sex: "não informado" },
      pain: { origin: "nociplástica", mechanism: "Sensibilização central e modulação descendente reduzida", baseline: 6, dermatomes: ["C5", "T4", "L3"], structures: ["Corno dorsal (sensibilização)", "Substância cinzenta periaquedutal"], descriptors: ["difusa", "fadiga"], inflammation: .2, sensitization: .7 },
      autonomic: { hr: 86, rmssd: 19 },
      conditions: [],
      proposals: [{ modality: "tavns", site: "cymba conchae esquerda", target: "ABVN", params: { f: 25, I: 1.5, pw: 250, area: .5 }, rationale: "Aferência vagal → NTS → LC/rafe/PAG (hipótese em investigação)." }],
      objectives: ["Aumentar RMSSD sem bradicardia (queda de FC < 10 %)", "Observar a latência da modulação descendente"]
    },
    {
      schema: "axon-case/1", id: "neuropatia-diabetica", title: "Neuropatia diabética dolorosa (pés)",
      summary: "Queimação e alodinia em meia nos pés, com perda de fibras finas e redução da sensibilidade vibratória.",
      patient: { ageRange: "50–59", sex: "não informado" },
      pain: { origin: "neuropática", mechanism: "Polineuropatia comprimento-dependente: perda de fibras finas e desmielinização", baseline: 6.5, dermatomes: ["L4", "L5", "S1"], structures: ["Nervo tibial", "Nervo fibular", "Fibras C e Aδ intraepidérmicas"], descriptors: ["queimação", "alodinia"], inflammation: .2, sensitization: .45 },
      autonomic: { hr: 84, rmssd: 22 },
      conditions: [{ id: "dm", label: "Diabetes: perda de fibras finas e desmielinização", effect: { sfl: .5, demy: .3 } }],
      proposals: [{ modality: "tens", site: "dorso do pé / L5", target: "L5", params: { f: 100, I: 14, pw: 150, area: 9 }, rationale: "Portão segmentar com Aβ remanescentes." }, { modality: "acu", site: "SP6 / face medial da perna", target: "L4", params: { P: 120, area: 1 }, rationale: "Mecanotransdução Aβ; atenção à pele frágil." }],
      objectives: ["Comparar TENS e pressão com perda de fibras finas", "Respeitar limiar de dor à pressão (~300 kPa)"]
    },
    {
      schema: "axon-case/1", id: "tunel-do-carpo", title: "Síndrome do túnel do carpo (mediano)",
      summary: "Parestesia noturna nos três primeiros dedos, com dor no punho.",
      patient: { ageRange: "40–49", sex: "não informado" },
      pain: { origin: "neuropática", mechanism: "Compressão do nervo mediano no túnel do carpo (isquemia e desmielinização focal)", baseline: 5, dermatomes: ["C6", "C7"], structures: ["Nervo mediano", "Retináculo dos flexores"], descriptors: ["formigamento", "dormência"], inflammation: .3, sensitization: .2 },
      autonomic: { hr: 76, rmssd: 34 },
      conditions: [{ id: "compressao", label: "Hipertrofia perineural / fibrose", effect: { peri: .4, fib: .2 } }],
      proposals: [{ modality: "ea", site: "PC6 (antebraço, 2 cm do punho)", target: "C6", params: { f: 2, I: .8, pw: 200, depth: 10 }, rationale: "Agulha próxima ao mediano: atenção ao recrutamento motor (Aα)." }],
      objectives: ["Evitar contração tenar (Aα)", "Observar o efeito da fibrose no limiar absoluto"]
    }
  ];

  const MODS = ["tens", "scs", "ea", "acu", "tavns", "lifu", "ti", "opto"];
  const DERMS = ["V1", "V2", "V3", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12", "L1", "L2", "L3", "L4", "L5", "S1", "S2", "S3–S5", "ABVN"];
  const ORIGINS = ["nociceptiva", "neuropática", "nociplástica", "mista"];
  const FORBIDDEN = /^(nome|name|fullname|cpf|rg|cns|email|e-mail|telefone|phone|endereco|endereço|address|prontuario|prontuário|nascimento|birth|birthdate|data_nascimento|mrn)$/i;

  function validate(c) {
    const err = [];
    const walk = (o, path = "") => { if (o && typeof o === "object") Object.keys(o).forEach(k => { if (FORBIDDEN.test(k)) err.push(`Campo não permitido (LGPD): ${path}${k}`); walk(o[k], path + k + "."); }); };
    walk(c);
    if (c.schema !== "axon-case/1") err.push('schema deve ser "axon-case/1"');
    if (!c.id || !/^[a-z0-9-]{3,60}$/.test(c.id)) err.push("id: 3–60 caracteres a-z, 0-9 e hífen");
    if (!c.title) err.push("title obrigatório");
    const p = c.pain || {};
    if (!ORIGINS.includes(p.origin)) err.push("pain.origin: " + ORIGINS.join(", "));
    if (!(p.baseline >= 0 && p.baseline <= 10)) err.push("pain.baseline: 0–10 (EVA)");
    if (!Array.isArray(p.dermatomes) || !p.dermatomes.length || p.dermatomes.some(d => !DERMS.includes(d))) err.push("pain.dermatomes: lista de " + DERMS.slice(0, 6).join(", ") + "…");
    ["inflammation", "sensitization"].forEach(k => { if (p[k] !== undefined && !(p[k] >= 0 && p[k] <= 1)) err.push(`pain.${k}: 0–1`); });
    (c.proposals || []).forEach((q, i) => { if (!MODS.includes(q.modality)) err.push(`proposals[${i}].modality: ${MODS.join(", ")}`); });
    (c.conditions || []).forEach((q, i) => Object.entries(q.effect || {}).forEach(([k, v]) => { if (!["fat", "demy", "sfl", "peri", "fib"].includes(k) || !(v >= 0 && v <= 1.2)) err.push(`conditions[${i}].effect.${k} inválido`); }));
    const a = c.autonomic || {}; if (a.hr && !(a.hr > 30 && a.hr < 200)) err.push("autonomic.hr fora de 30–200");
    return err;
  }
  function importJSON(text) {
    let data; try { data = JSON.parse(text); } catch (e) { return { ok: false, errors: ["JSON inválido: " + e.message] }; }
    const list = Array.isArray(data) ? data : [data], out = [], errors = [];
    list.forEach((c, i) => { const e = validate(c); if (e.length) errors.push(...e.map(x => `[${c.id || i}] ${x}`)); else out.push(Object.assign({ imported: true }, c)); });
    out.forEach(c => { const k = CASES.findIndex(x => x.id === c.id); if (k >= 0) CASES[k] = c; else CASES.push(c); });
    try { localStorage.setItem("axon.cases", JSON.stringify(CASES.filter(c => c.imported))); } catch (e) {}
    return { ok: !errors.length, added: out.map(c => c.id), errors };
  }
  try { const saved = JSON.parse(localStorage.getItem("axon.cases") || "[]"); saved.forEach(c => { if (!validate(c).length && !CASES.some(x => x.id === c.id)) CASES.push(c); }); } catch (e) {}
  const TEMPLATE = JSON.stringify(Object.assign({}, CASES[0], { id: "meu-caso", title: "Título do caso (fictício)" }), null, 2);
  g.AxonCases = { list: CASES, validate, importJSON, TEMPLATE, DERMS, ORIGINS };
})(window);
