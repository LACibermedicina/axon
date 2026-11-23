/* axon · data.js — base anatomoclínica e biofísica exibida nos painéis.
 * Toda afirmação carrega etiqueta: lit (LITERATURA), pre (PREMISSA), der (DERIVADO), mod (RESULTADO DE MODELO), hip (HIPÓTESE). */
(function (g) {
  const TAG = { lit: "LITERATURA", pre: "PREMISSA", der: "DERIVADO", mod: "RESULTADO DE MODELO · SEMENTE 42", hip: "HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO" };
  const REF = {
    teixeira: "Teixeira LS. Biofísica da Neuromodulação: resolução de fibra única e limiares de segurança tecidual. Ibilce/UNESP; 2026.",
    melzack: "Melzack R, Wall PD. Pain mechanisms: a new theory. Science. 1965;150(3699):971-9.",
    han: "Han JS. Acupuncture: neuropeptide release produced by electrical stimulation of different frequencies. Trends Neurosci. 2003;26(1):17-22.",
    peuker: "Peuker ET, Filler TJ. The nerve supply of the human auricle. Clin Anat. 2002;15(1):35-7.",
    farmer: "Farmer AD, et al. International consensus based review and recommendations for minimum reporting standards in research on transcutaneous vagus nerve stimulation. Front Hum Neurosci. 2021;14:568051.",
    shannon: "Shannon RV. A model of safe levels for electrical stimulation. IEEE Trans Biomed Eng. 1992;39(4):424-6.",
    rattay: "Rattay F. Analysis of models for external stimulation of axons. IEEE Trans Biomed Eng. 1986;33(10):974-7.",
    coste: "Coste B, et al. Piezo1 and Piezo2 are essential components of distinct mechanically activated cation channels. Science. 2010;330(6000):55-60."
  };
  const MODS = [
    { id: "tens", name: "TENS", kind: "elec", f: 100, I: 0.6, pw: 100, area: 4, r: 1.0, desc: "Eletrodo de superfície; recruta Aβ antes de Aδ (recrutamento inverso)." },
    { id: "scs", name: "SCS / HF10", short: "SCS", kind: "elec", f: 10000, I: 0.6, pw: 30, area: 0.1, r: 1.0, desc: "Medula espinhal; HF10 = 10 kHz, com aquecimento mensurável." },
    { id: "ea", name: "Eletroacupuntura", short: "EA", kind: "elec", f: 2, I: 0.5, pw: 200, area: 0.0157, r: 0.6, desc: "Agulha percutânea: reduz r e a impedância cutânea; área ativa pequena ⇒ alta densidade de carga." },
    { id: "acu", name: "Acupressão", short: "Pressão", kind: "mech", f: 0, P: 60, pw: 0, area: 1, r: 1.0, desc: "Pressão focal: Piezo/TRAAK em Aβ ⇒ inibição segmentar (portão). Sem corrente." },
    { id: "tavns", name: "taVNS", kind: "elec", f: 25, I: 0.5, pw: 250, area: 0.5, r: 0.8, desc: "Concha auricular (ABVN) → NTS. 20–30 Hz; 200–250 µs." },
    { id: "lifu", name: "LIFU", kind: "acou", f: 0.5, U: 500, pw: 0, area: 1, r: 1.0, desc: "Ultrassom focalizado: compromisso difração × atenuação." },
    { id: "ti", name: "Interferência temporal", short: "TI", kind: "elec", f: 2000, I: 0.6, pw: 100, area: 4, r: 1.0, desc: "Batimento de duas portadoras kHz; resolução centimétrica." },
    { id: "opto", name: "Optoacústica", short: "Opto", kind: "acou", f: 6.6, U: 200, pw: 0, area: .0003, r: 0.3, desc: "Fibra afilada 20 µm, 6,6 MHz, precisão ≈ 39,6 µm (campo próximo)." }
  ];
  const REGIONS = {
    L5S1: { name: "Dor lombar irradiada L5/S1", structures: ["Raízes L5/S1", "Gânglio da raiz dorsal (DRG)", "Nervo ciático", "Corno dorsal (lâminas I, II, V)"],
      fibers: ["abeta", "adelta", "c"], symptoms: ["dor irradiada (ciatalgia)", "parestesia em dermátomo L5/S1", "alodinia", "hiperalgesia"], mod: "tens" },
    ear: { name: "Concha auricular · taVNS", structures: ["Ramo auricular do vago (ABVN, nervo de Arnold)", "Cymba conchae (100%)", "Cavum conchae (45%)", "Trago: n. auriculotemporal (V3)", "Lóbulo: n. auricular magno (C2–C3)", "NTS no tronco encefálico"],
      fibers: ["abeta"], symptoms: ["dor nociplástica/inflamatória (alvo de pesquisa)", "modulação da VFC"], mod: "tavns" },
    trigeminal: { name: "Neuralgia trigeminal", structures: ["Divisões V1/V2/V3", "Gânglio trigeminal", "Núcleo espinal do trigêmeo"],
      fibers: ["adelta", "c", "abeta"], symptoms: ["dor paroxística em choque", "zonas-gatilho", "alodinia mecânica"], mod: "tens" },
    median: { name: "Território C6–C8 · mediano/ulnar", structures: ["Plexo braquial", "Nervo mediano", "Nervo ulnar", "Túnel do carpo"],
      fibers: ["aalpha", "abeta", "adelta"], symptoms: ["parestesia", "dor neuropática", "fraqueza (Aα)"], mod: "ea" },
    visceral: { name: "Dor visceral referida T4–T6", structures: ["Aferentes viscerais (cadeia simpática)", "Convergência viscerossomática no corno dorsal", "Dermátomos T4–T6"],
      fibers: ["adelta", "c"], symptoms: ["dor referida na parede torácica", "hiperalgesia cutânea segmentar"], mod: "tavns" },
    acupoint: { name: "Ponto reflexo ST36 (Zusanli)", structures: ["Nervo fibular profundo", "Músculo tibial anterior", "Fusos neuromusculares", "Órgãos tendinosos de Golgi"],
      fibers: ["abeta", "adelta", "aalpha"], symptoms: ["dor musculoesquelética (alvo de pesquisa)"], mod: "acu" }
  };
  const FIBERS = {
    aalpha: { n: "Aα", d: "12–20 µm", v: "70–120 m/s", c: "#ffd36b", f: "motora / propriocepção" },
    abeta: { n: "Aβ", d: "6–12 µm", v: "35–75 m/s", c: "#4fb3ff", f: "tato, pressão, vibração — alvo da Teoria do Portão" },
    adelta: { n: "Aδ", d: "1–5 µm", v: "5–30 m/s", c: "#ff8a3d", f: "dor rápida e frio" },
    c: { n: "C", d: "0,2–1,5 µm", v: "0,5–2 m/s", c: "#c084fc", f: "dor lenta, eferentes autonômicos — fora do modelo nodal" }
  };
  const MECH = {
    tens: [["Recruta Aβ antes de Aδ (I_lim ∝ D^−1,13)", "mod"], ["Inibição segmentar no corno dorsal (Teoria do Portão)", "lit", "melzack"]],
    scs: [["Ativação de colunas dorsais (Aβ) e inibição segmentar", "lit", "melzack"], ["HF10: alteração de condução + aquecimento mensurável", "lit", "teixeira"]],
    ea: [["Agulha reduz r e a impedância cutânea", "der"], ["2–10 Hz: encefalinas/β-endorfina; 80–100 Hz: dinorfina (pré-clínico)", "lit", "han"], ["Eficácia analgésica clínica", "hip"]],
    acu: [["Deformação de membrana ativa Piezo2/TRAAK em Aβ", "lit", "coste"], ["Inibição segmentar via portão; sem risco eletroquímico", "lit", "melzack"], ["Relação pressão→fração ativada (Boltzmann)", "pre"]],
    tavns: [["Aferentes Aβ do ABVN → NTS", "lit", "peuker"], ["LC, rafe, PAG e via colinérgica anti-inflamatória (α7nAChR)", "hip"], ["Parâmetros usuais 20–30 Hz, 200–250 µs", "lit", "farmer"]],
    lifu: [["λ = c/f: foco de 10 µm exige 150 MHz e 75 dB/cm", "der"], ["Ativação mecânica de canais (Piezo/TRAAK)", "lit", "coste"]],
    ti: [["Envelope de batimento em profundidade; resolução centimétrica", "lit", "teixeira"]],
    opto: [["Campo próximo contorna a difração: ≈ 39,6 µm", "lit", "teixeira"]]
  };
  const PHYS = {
    1: [["Recrutamento inverso", "I_lim ∝ D^(−1,13)", "Fibras grossas (Aβ) têm limiar menor que as finas (Aδ). Neste modelo, não há geometria que inverta a hierarquia.", "mod"],
        ["Mapa de dermátomos", "derme(y) → raiz", "Esquema didático; dermátomos individuais variam e se sobrepõem.", "pre"]],
    2: [["Potencial extracelular (fonte pontual)", "Vₑ(x) = −ρₑ·I / (4π·√(x² + r²))", "r cresce com a espessura do tecido adiposo: o limiar sobe e a razão Aδ/Aβ aumenta (2,17 a 0,5 mm → 4,07 a 1,5 mm).", "lit", "rattay"],
        ["Penetração acústica", "λ = c/f ; α = 0,5 dB·cm⁻¹·MHz⁻¹", "Foco menor exige frequência maior, que é atenuada mais depressa.", "der"]],
    3: [["Barreira perineural", "ρ_perineuro ≫ ρ_endoneuro", "O perineuro desvia a corrente axialmente: eletrodos TIME/LIFE o perfuram para aproximar a fonte.", "lit", "teixeira"],
        ["Monte Carlo do fascículo", "N = 20 000 · bootstrap 2 000", "Razão de medianas 3,10 (IC 95 % 2,98–3,22); com F_Aβ ≤ 10 %, F_Aδ = 0,38 %.", "mod"],
        ["Ramificação dos axônios no feixe", "plexo intrafascicular · ramo colateral", "Ao longo do tronco, axônios trocam de fascículo (plexo de Sunderland); um ramo leva consigo fibras de fascículos específicos — por isso a topografia fascicular muda entre o proximal e o distal e a seletividade por posição do contato é limitada. Trajetos ilustrativos; composição do ramo vem da amostra do modelo.", "lit"]],
    4: [["Função de ativação (Rattay)", "fₙ = Vₑ,ₙ₋₁ − 2Vₑ,ₙ + Vₑ,ₙ₊₁", "Positiva sob o cátodo (despolariza), negativa nos nós laterais.", "lit", "rattay"],
        ["Cadeia nodal passiva", "C·dVₙ/dt = −g·Vₙ + Gₐ(Vₙ₋₁ − 2Vₙ + Vₙ₊₁) + Gₐ·fₙ", "Euler explícito Δt = 1 µs; cota de estabilidade ≈ 7 µs (D = 1 µm).", "der"],
        ["Geometria", "d = 0,7·D ; L = 100·D ; Lₙ = 2,5 µm", "Cₘ = 2 µF/cm² · g_L = 30,3 mS/cm² · ρᵢ = 110 Ω·cm · ρₑ = 300 Ω·cm · V_lim = 20 mV", "lit"]],
    5: [["Escala térmica", "k_B·T ≈ 4,28 × 10⁻²¹ J (310 K)", "Transições com barreira dessa ordem ocorrem espontaneamente: piso de ruído.", "lit"],
        ["Langevin", "Cₘ dV/dt = −I_íon + I_ext + ξ(t)", "Ressonância estocástica: ótimo em σ ≈ 0,61 (detector adimensional do livro).", "mod"],
        ["Seletividade molecular", "NaV1.7 / NaV1.8", "Especificidade de nociceptores: via de seletividade que não depende de geometria.", "lit"]]
  };
  const PROTO = [
    ["Fase 0 · consolidação computacional (meses 0–12)", "Substituir membrana passiva por MRG/NEURON; FEM anisotrópico; erro < 25 % em ≥ 2 conjuntos de dados publicados."],
    ["Fase 1 · bancada e phantom (12–24)", "Hidrofone e termometria; erro de foco < 0,2 mm; ΔT < 1 °C (metade do critério ITRUSST)."],
    ["Fase 2 · ex vivo (22–36)", "Nervo ciático isolado de roedor (3R); CAP por velocidade de condução; aceitar/rejeitar a razão prevista de 3,1."],
    ["Fase 3 · piloto in vivo (34–44)", "Reversibilidade sem lesão histológica; protocolo CEUA aprovado antes do início. Não há etapa em humanos."]
  ];
  const INSILICO = [
    "Selecione a região no corpo (Nível 1) ou no Navegador.",
    "Escolha a intervenção no painel direito e ajuste r, tₚ e amplitude.",
    "Aproxime até o fascículo (Nível 3): veja quais fibras acendem.",
    "Abra o Preditor (App 3) e compare a curva ao vivo com a de referência.",
    "Confira as 4 fronteiras (App 4) antes de aumentar a amplitude.",
    "Aplique uma variação anatômica e observe o deslocamento das curvas.",
    "Exporte o estado com versão e semente (rodapé do App 3)."
  ];
  const SCHEDULE = [["Fase 0 · computacional", 0, 12, "#3ee6c5"], ["Revisão sistemática", 6, 20, "#4fb3ff"], ["Fase 1 · bancada", 12, 24, "#ffb547"], ["Fase 2 · ex vivo", 22, 36, "#ff8a3d"], ["Fase 3 · in vivo", 34, 44, "#c084fc"], ["Redação e defesa", 40, 48, "#e6f4f5"]];
  const FAQ = [
    [/seletiv|aδ|adelta|razão|ratio/i, "No modelo verificado, a razão Aδ(3 µm)/Aβ(9 µm) a 1 mm é 3,21; no fascículo simulado, 3,10 (IC 95 % 2,98–3,22). Selecionar nociceptores por amplitude não funciona, por razões geométricas.", "mod"],
    [/shannon|carga|charge/i, "k = log₁₀(D) + log₁₀(Q). k < 1,75 é a referência conservadora; 1,75–2,0 atenção; ≥ 2,0 risco. Ajustada a córtex animal — extrapolar para agulha é premissa.", "lit"],
    [/vago|tavns|orelha|concha|ear/i, "A cymba conchae é inervada pelo ABVN em 100 % dos espécimes; o lóbulo não (local sham). A cascata NTS → LC/rafe/PAG e a via anti-inflamatória são hipóteses em investigação.", "lit"],
    [/acupunt|eletroacup|needle|agulha/i, "Na EA, a agulha aproxima a fonte do feixe (r menor) e tem área pequena — a densidade de carga sobe rápido. 2–10 Hz e 80–100 Hz associam-se a neuropeptídeos distintos (pré-clínico).", "lit"],
    [/press|piezo|portão|gate/i, "A pressão focal deforma a membrana e abre canais Piezo2/TRAAK em Aβ, ativando a inibição segmentar descrita por Melzack & Wall. A curva pressão→fração no axon é ilustrativa.", "pre"],
    [/fibra c|c fiber|amiel/i, "Fibras C (0,2–1,5 µm) são amielínicas, em feixes de Remak: estão fora do modelo nodal mielinizado e por isso não aparecem nas curvas.", "lit"],
    [/ruído|noise|estocást|langevin/i, "Ressonância estocástica: há uma intensidade de ruído que maximiza a transferência de um sinal subliminar. O livro encontra σ ≈ 0,61 num detector adimensional; não é modelo de axônio.", "mod"],
    [/valida|v&v|asme/i, "O núcleo está verificado (resolve corretamente as equações) e não validado (falta confronto com dados experimentais) — elevar a validado é a Fase 0.", "lit"]
  ];
  g.AxonData = { TAG, REF, MODS, REGIONS, FIBERS, MECH, PHYS, PROTO, INSILICO, SCHEDULE, FAQ };
})(window);
