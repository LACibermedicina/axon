/* axon · i18n.js — dicionários estáticos (offline). App 7 usa a IA do servidor quando disponível. */
(function (g) {
  const D = {
    pt: {
      sim: "Simulação", cases: "Casos clínicos", monitor: "Monitor do paciente", network: "Rede fisiológica",
      vessels: "Vasos", muscles: "Músculos",
      skin: "Pele (translúcida)", skeleton: "Esqueleto", organs: "Órgãos", updates: "Atualizações", newVersion: "Nova versão disponível", reload: "Recarregar",
      disclaimer: "Ferramenta de pesquisa, ensino e modelagem in silico (ASME V&V 40 · Res. CNS 510/2016). Não é dispositivo médico nem protocolo clínico.",
      leftTitle: "Anatomia, sintomas & protocolo", rightTitle: "Parâmetros & IA preditiva",
      tabAnat: "Anatomia", tabPhys: "Biofísica", tabProto: "Protocolo",
      scale1: "Corpo · dermátomos", scale2: "Região · tronco nervoso", scale3: "Fascículo", scale4: "Axônio · nós de Ranvier", scale5: "Membrana · canais",
      modality: "Intervenção", freq: "Frequência", amp: "Amplitude", pw: "Largura de pulso", dist: "Distância r", area: "Área de contato", pressure: "Pressão", noise: "Ruído σ", fiber: "Calibre D",
      variations: "Variações anatômicas (perfil anônimo)", fat: "Tecido adiposo +", demy: "Desmielinização", sfl: "Perda de fibras finas", peri: "Hipertrofia perineural", fib: "Fibrose",
      impact: "Impacto previsto", selectivity: "Seletividade Aδ/Aβ", fAbeta: "Aβ recrutadas", fAdelta: "Aδ recrutadas", shannonMargin: "Margem Shannon", efficacy: "Eficácia analgésica",
      notEstimable: "não estimável pelo modelo", outside: "Fora do domínio verificado — o núcleo recusa responder.",
      app1: "Navegador anatômico", app2: "Estúdio de intervenções", app3: "Preditor de calibre", app4: "Fronteiras de segurança", app5: "Ruído & RE", app6: "Grafos clínico-biofísicos", app7: "Tradutor", app8: "Axon Bot & agenda",
      recruitment: "Curvas de recrutamento", safety: "Fronteiras de segurança tecidual", temperature: "Temperatura", charge: "Densidade de carga", mi: "Índice mecânico", chronic: "Crônica",
      ask: "Pergunte ao Axon Bot…", send: "Enviar", mute: "Silenciar", offline: "modo offline", online: "IA conectada",
      reflex: "Pontos reflexos", morpho: "Calibre do axônio (preditor)", graph: "Grafo 3D de correlações", atlas: "Atlas de pontos", terminals: "Terminações nervosas", explain: "Assistente · o que foi calculado", tests: "Registro de testes", manuscript: "Manuscrito · diário de bordo", book: "Livro teórico", tray: "Bandeja de instrumentos", patientcard: "Cartão do paciente", depth: "Dissecção e camadas", imaging: "Imagens e EMG", patient: "Paciente", maps: "Mapas: acupuntura, YNSA e aurículo", relations: "Músculo ↔ nervo", cns: "Sistema nervoso e órgãos", planner: "Plano terapêutico", guide: "Guia passo a passo", tools: "Exploração e técnica", layers: "Camadas", dermatomes: "Dermátomos", nerves: "Nervos periféricos", autonomic: "Cadeias autonômicas", acupoints: "Pontos reflexos / acupontos",
      symptoms: "Sintomas associados", fibers: "Fibras predominantes", mechanism: "Mecanismo esperado", run: "Executar", reset: "Restaurar", step: "Passo",
      scaling: "Lei de escala", window: "Janela de seletividade", map: "Mapa calibre × distância", sr: "Ressonância estocástica", schedule: "Cronograma 48 meses", rooms: "Salas de estudo",
      provenance: "Procedência", version: "versão", seed: "semente"
    },
    en: {
      sim: "Simulation", cases: "Clinical cases", monitor: "Patient monitor", network: "Physiological network",
      vessels: "Vessels", muscles: "Muscles",
      skin: "Skin (translucent)", skeleton: "Skeleton", organs: "Organs", updates: "Updates", newVersion: "New version available", reload: "Reload",
      disclaimer: "Research, teaching and in silico modelling tool (ASME V&V 40 · CNS Res. 510/2016). Not a medical device or clinical protocol.",
      leftTitle: "Anatomy, symptoms & protocol", rightTitle: "Parameters & predictive AI",
      tabAnat: "Anatomy", tabPhys: "Biophysics", tabProto: "Protocol",
      scale1: "Body · dermatomes", scale2: "Region · nerve trunk", scale3: "Fascicle", scale4: "Axon · nodes of Ranvier", scale5: "Membrane · channels",
      modality: "Intervention", freq: "Frequency", amp: "Amplitude", pw: "Pulse width", dist: "Distance r", area: "Contact area", pressure: "Pressure", noise: "Noise σ", fiber: "Diameter D",
      variations: "Anatomical variations (anonymous profile)", fat: "Adipose tissue +", demy: "Demyelination", sfl: "Small-fibre loss", peri: "Perineural hypertrophy", fib: "Fibrosis",
      impact: "Predicted impact", selectivity: "Aδ/Aβ selectivity", fAbeta: "Aβ recruited", fAdelta: "Aδ recruited", shannonMargin: "Shannon margin", efficacy: "Analgesic efficacy",
      notEstimable: "not estimable by the model", outside: "Outside the verified domain — the core refuses to answer.",
      app1: "Anatomical navigator", app2: "Intervention studio", app3: "Diameter predictor", app4: "Safety frontiers", app5: "Noise & SR", app6: "Clinical-biophysical graphs", app7: "Translator", app8: "Axon Bot & schedule",
      recruitment: "Recruitment curves", safety: "Tissue safety boundaries", temperature: "Temperature", charge: "Charge density", mi: "Mechanical index", chronic: "Chronic",
      ask: "Ask Axon Bot…", send: "Send", mute: "Mute", offline: "offline mode", online: "AI connected",
      reflex: "Reflex points", morpho: "Axon caliber (predictor)", graph: "3D correlation graph", atlas: "Point atlas", terminals: "Nerve terminals", explain: "Assistant · what was computed", tests: "Test log", manuscript: "Manuscript · logbook", book: "Theory book", tray: "Instrument tray", patientcard: "Patient card", depth: "Dissection and layers", imaging: "Imaging and EMG", patient: "Patient", maps: "Maps: acupuncture, YNSA and auricular", relations: "Muscle ↔ nerve", cns: "Nervous system and organs", planner: "Treatment plan", guide: "Step-by-step guide", tools: "Exploration and technique", layers: "Layers", dermatomes: "Dermatomes", nerves: "Peripheral nerves", autonomic: "Autonomic chains", acupoints: "Reflex points / acupoints",
      symptoms: "Associated symptoms", fibers: "Predominant fibres", mechanism: "Expected mechanism", run: "Run", reset: "Reset", step: "Step",
      scaling: "Scaling law", window: "Selectivity window", map: "Diameter × distance map", sr: "Stochastic resonance", schedule: "48-month schedule", rooms: "Study rooms",
      provenance: "Provenance", version: "version", seed: "seed"
    },
    es: {
      sim: "Simulación", cases: "Casos clínicos", monitor: "Monitor del paciente", network: "Red fisiológica",
      vessels: "Vasos", muscles: "Músculos",
      skin: "Piel (translúcida)", skeleton: "Esqueleto", organs: "Órganos", updates: "Actualizaciones", newVersion: "Nueva versión disponible", reload: "Recargar",
      disclaimer: "Herramienta de investigación, enseñanza y modelado in silico (ASME V&V 40 · Res. CNS 510/2016). No es un dispositivo médico ni un protocolo clínico.",
      leftTitle: "Anatomía, síntomas y protocolo", rightTitle: "Parámetros e IA predictiva",
      tabAnat: "Anatomía", tabPhys: "Biofísica", tabProto: "Protocolo",
      scale1: "Cuerpo · dermatomas", scale2: "Región · tronco nervioso", scale3: "Fascículo", scale4: "Axón · nodos de Ranvier", scale5: "Membrana · canales",
      modality: "Intervención", freq: "Frecuencia", amp: "Amplitud", pw: "Ancho de pulso", dist: "Distancia r", area: "Área de contacto", pressure: "Presión", noise: "Ruido σ", fiber: "Calibre D",
      variations: "Variaciones anatómicas (perfil anónimo)", fat: "Tejido adiposo +", demy: "Desmielinización", sfl: "Pérdida de fibras finas", peri: "Hipertrofia perineural", fib: "Fibrosis",
      impact: "Impacto previsto", selectivity: "Selectividad Aδ/Aβ", fAbeta: "Aβ reclutadas", fAdelta: "Aδ reclutadas", shannonMargin: "Margen de Shannon", efficacy: "Eficacia analgésica",
      notEstimable: "no estimable por el modelo", outside: "Fuera del dominio verificado — el núcleo se niega a responder.",
      app1: "Navegador anatómico", app2: "Estudio de intervenciones", app3: "Predictor de calibre", app4: "Fronteras de seguridad", app5: "Ruido y RE", app6: "Grafos clínico-biofísicos", app7: "Traductor", app8: "Axon Bot y agenda",
      recruitment: "Curvas de reclutamiento", safety: "Fronteras de seguridad tisular", temperature: "Temperatura", charge: "Densidad de carga", mi: "Índice mecánico", chronic: "Crónica",
      ask: "Pregunta al Axon Bot…", send: "Enviar", mute: "Silenciar", offline: "modo sin conexión", online: "IA conectada",
      reflex: "Puntos reflejos", layers: "Capas", dermatomes: "Dermatomas", nerves: "Nervios periféricos", autonomic: "Cadenas autonómicas", acupoints: "Puntos reflejos / acupuntos",
      symptoms: "Síntomas asociados", fibers: "Fibras predominantes", mechanism: "Mecanismo esperado", run: "Ejecutar", reset: "Restaurar", step: "Paso",
      scaling: "Ley de escala", window: "Ventana de selectividad", map: "Mapa calibre × distancia", sr: "Resonancia estocástica", schedule: "Cronograma 48 meses", rooms: "Salas de estudio",
      provenance: "Procedencia", version: "versión", seed: "semilla"
    },
    zh: {
      sim: "模拟", cases: "临床病例", monitor: "患者监护", network: "生理网络",
      vessels: "血管", muscles: "肌肉",
      skin: "皮肤（半透明）", skeleton: "骨骼", organs: "器官", updates: "更新", newVersion: "有新版本", reload: "重新加载",
      disclaimer: "科研、教学与计算机模拟（in silico）工具（ASME V&V 40 · CNS 第510/2016号决议）。非医疗器械，亦非临床方案。",
      leftTitle: "解剖、症状与方案", rightTitle: "参数与预测性 AI",
      tabAnat: "解剖", tabPhys: "生物物理", tabProto: "方案",
      scale1: "全身 · 皮节", scale2: "区域 · 神经干", scale3: "神经束", scale4: "轴突 · 郎飞结", scale5: "细胞膜 · 离子通道",
      modality: "干预方式", freq: "频率", amp: "幅度", pw: "脉宽", dist: "距离 r", area: "接触面积", pressure: "压力", noise: "噪声 σ", fiber: "纤维直径 D",
      variations: "解剖变异（匿名档案）", fat: "皮下脂肪 +", demy: "脱髓鞘", sfl: "小纤维丢失", peri: "神经束膜增厚", fib: "纤维化",
      impact: "预测影响", selectivity: "Aδ/Aβ 选择性", fAbeta: "Aβ 募集比例", fAdelta: "Aδ 募集比例", shannonMargin: "Shannon 余量", efficacy: "镇痛效果",
      notEstimable: "模型无法估计", outside: "超出已验证范围——核心拒绝给出结果。",
      app1: "解剖导航", app2: "干预工作室", app3: "直径预测器", app4: "安全边界", app5: "噪声与随机共振", app6: "临床-生物物理图谱", app7: "翻译器", app8: "Axon 机器人与日程",
      recruitment: "募集曲线", safety: "组织安全边界", temperature: "温度", charge: "电荷密度", mi: "机械指数", chronic: "慢性",
      ask: "向 Axon 机器人提问…", send: "发送", mute: "静音", offline: "离线模式", online: "AI 已连接",
      reflex: "反射点", layers: "图层", dermatomes: "皮节", nerves: "周围神经", autonomic: "自主神经链", acupoints: "反射点 / 穴位",
      symptoms: "相关症状", fibers: "主要纤维", mechanism: "预期机制", run: "运行", reset: "重置", step: "步骤",
      scaling: "标度律", window: "选择性窗口", map: "直径 × 距离图", sr: "随机共振", schedule: "48 个月进度", rooms: "学习室",
      provenance: "来源", version: "版本", seed: "随机种子"
    },
    hi: {
      sim: "सिमुलेशन", cases: "नैदानिक मामले", monitor: "रोगी मॉनिटर", network: "शारीरिक नेटवर्क",
      vessels: "रक्त वाहिकाएँ", muscles: "मांसपेशियाँ",
      skin: "त्वचा (पारभासी)", skeleton: "कंकाल", organs: "अंग", updates: "अपडेट", newVersion: "नया संस्करण उपलब्ध", reload: "पुनः लोड करें",
      disclaimer: "अनुसंधान, शिक्षण और इन-सिलिको मॉडलिंग उपकरण (ASME V&V 40 · CNS संकल्प 510/2016)। यह चिकित्सा उपकरण या नैदानिक प्रोटोकॉल नहीं है।",
      leftTitle: "शरीर रचना, लक्षण और प्रोटोकॉल", rightTitle: "मापदंड और पूर्वानुमानी AI",
      tabAnat: "शरीर रचना", tabPhys: "जैवभौतिकी", tabProto: "प्रोटोकॉल",
      scale1: "पूरा शरीर · डर्मेटोम", scale2: "क्षेत्र · तंत्रिका तना", scale3: "फैसिकल", scale4: "एक्सॉन · रैनवियर नोड", scale5: "झिल्ली · आयन चैनल",
      modality: "हस्तक्षेप", freq: "आवृत्ति", amp: "आयाम", pw: "पल्स चौड़ाई", dist: "दूरी r", area: "संपर्क क्षेत्र", pressure: "दबाव", noise: "शोर σ", fiber: "व्यास D",
      variations: "शारीरिक विविधताएँ (गुमनाम प्रोफ़ाइल)", fat: "वसा ऊतक +", demy: "डीमाइलिनेशन", sfl: "सूक्ष्म तंतु हानि", peri: "पेरिन्यूरल अतिवृद्धि", fib: "फाइब्रोसिस",
      impact: "अनुमानित प्रभाव", selectivity: "Aδ/Aβ चयनात्मकता", fAbeta: "भर्ती Aβ", fAdelta: "भर्ती Aδ", shannonMargin: "शैनन मार्जिन", efficacy: "दर्दनाशक प्रभावशीलता",
      notEstimable: "मॉडल द्वारा अनुमान योग्य नहीं", outside: "सत्यापित क्षेत्र से बाहर — कोर उत्तर देने से इनकार करता है।",
      app1: "शारीरिक नेविगेटर", app2: "हस्तक्षेप स्टूडियो", app3: "व्यास पूर्वानुमानक", app4: "सुरक्षा सीमाएँ", app5: "शोर और SR", app6: "नैदानिक-जैवभौतिक ग्राफ", app7: "अनुवादक", app8: "Axon बॉट और कार्यक्रम",
      recruitment: "भर्ती वक्र", safety: "ऊतक सुरक्षा सीमाएँ", temperature: "तापमान", charge: "आवेश घनत्व", mi: "यांत्रिक सूचकांक", chronic: "दीर्घकालिक",
      ask: "Axon बॉट से पूछें…", send: "भेजें", mute: "मौन करें", offline: "ऑफ़लाइन मोड", online: "AI जुड़ा है",
      reflex: "रिफ्लेक्स बिंदु", layers: "परतें", dermatomes: "डर्मेटोम", nerves: "परिधीय तंत्रिकाएँ", autonomic: "स्वायत्त शृंखलाएँ", acupoints: "प्रतिवर्त बिंदु / एक्यूपॉइंट",
      symptoms: "संबद्ध लक्षण", fibers: "प्रमुख तंतु", mechanism: "अपेक्षित क्रियाविधि", run: "चलाएँ", reset: "रीसेट", step: "चरण",
      scaling: "स्केलिंग नियम", window: "चयनात्मकता खिड़की", map: "व्यास × दूरी मानचित्र", sr: "स्टोकेस्टिक अनुनाद", schedule: "48 माह कार्यक्रम", rooms: "अध्ययन कक्ष",
      provenance: "उद्गम", version: "संस्करण", seed: "बीज"
    }
  };
  const FLAGS = { zh: "🇨🇳", es: "🇪🇸", en: "🇬🇧", hi: "🇮🇳", pt: "🇧🇷" };
  let lang = "pt";
  const t = k => (D[lang] && D[lang][k]) || D.pt[k] || k;
  function apply(root = document) {
    root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.documentElement.lang = { pt: "pt-BR", en: "en", es: "es", zh: "zh-CN", hi: "hi" }[lang];
  }
  function set(l) { if (!D[l]) return; lang = l; try { localStorage.setItem("axon.lang", l); } catch (e) {} apply(); document.dispatchEvent(new CustomEvent("axon:lang", { detail: l })); }
  try { const s = localStorage.getItem("axon.lang"); if (s && D[s]) lang = s; } catch (e) {}
  g.I18N = { t, set, apply, FLAGS, get lang() { return lang; }, langs: Object.keys(FLAGS) };
})(window);
