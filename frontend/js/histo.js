/* axon · histo.js — histotripsia: ablação mecânica por cavitação com ultrassom focado.
   Não é neuromodulação: o tecido no foco é fracionado em resíduo acelular (efeito irreversível).
   Modelo didático, com a procedência de cada passo:
   1. pressão negativa de pico no foco, corrigida pela atenuação do tecido (linear, sem propagação não linear) [PREMISSA];
   2. probabilidade de cavitação por pulso: sigmoide em torno do limiar intrínseco de 26–30 MPa em tecidos ricos em água
      (Maxwell 2013) e 24,7–30,6 MPa, pouco dependente de frequência e rigidez (Vlaisavljevich 2015) [LITERATURA];
   3. tecido mais rígido exige mais pressão para formar a nuvem de cavitação (Vlaisavljevich 2014) [LITERATURA];
   4. tamanho da zona focal por λ e número f do transdutor; lesão = região acima do limiar [DERIVADO];
   5. fracionamento cresce com o número de pulsos [PREMISSA ilustrativa].
   Não é dispositivo médico; números do modelo não se aplicam a um paciente. */
(function (g) {
  "use strict";
  const REF = {
    maxwell13: { t: "Maxwell AD, Cain CA, Hall TL, Fowlkes JB, Xu Z. Probability of cavitation for single ultrasound pulses applied to tissues and tissue-mimicking materials. Ultrasound Med Biol. 2013;39(3):449-65.", pmid: "23380152", doi: "10.1016/j.ultrasmedbio.2012.09.004" },
    vlais15: { t: "Vlaisavljevich E, Lin KW, Maxwell A, et al. Effects of ultrasound frequency and tissue stiffness on the histotripsy intrinsic threshold for cavitation. Ultrasound Med Biol. 2015;41(6):1651-67.", pmid: "25766571", doi: "10.1016/j.ultrasmedbio.2015.01.028" },
    vlais14: { t: "Vlaisavljevich E, Maxwell A, Warnez M, Johnsen E, Cain CA, Xu Z. Histotripsy-induced cavitation cloud initiation thresholds in tissues of different mechanical properties. IEEE Trans Ultrason Ferroelectr Freq Control. 2014;61(2):341-52.", pmid: "24474139", doi: "10.1109/TUFFC.2014.6722618" },
    khok11: { t: "Khokhlova TD, Canney MS, Khokhlova VA, Sapozhnikov OA, Crum LA, Bailey MR. Controlled tissue emulsification produced by high intensity focused ultrasound shock waves and millisecond boiling. J Acoust Soc Am. 2011;130(5):3498-510.", pmid: "22088025", doi: "10.1121/1.3626152" },
    xu21: { t: "Xu Z, Hall TL, Vlaisavljevich E, Lee FT Jr. Histotripsy: the first noninvasive, non-ionizing, non-thermal ablation technique based on ultrasound. Int J Hyperthermia. 2021;38(1):561-575.", pmid: "33827375", doi: "10.1080/02656736.2021.1905189" },
    hope24: { t: "Mendiratta-Lala M, Wiggermann P, Pech M, et al. The #HOPE4LIVER single-arm pivotal trial for histotripsy of primary and metastatic liver tumors. Radiology. 2024;312(3):e233051.", pmid: "39225612", doi: "10.1148/radiol.233051" },
  };
  const C_SOUND = 1540, ALPHA = .5;            // m/s; dB/cm/MHz em tecido mole (valor típico de livro-texto, usado como premissa)
  const PT = 28, SIG = 1.2;                    // MPa: limiar intrínseco (P = 0,5) e largura da sigmoide [LITERATURA; largura PREMISSA]
  const STIFF = { mole: 0, musculo: .5, pele: 1, nervo: 1.5, tendao: 2.5, osso: Infinity };   // acréscimo ao limiar (MPa) [tendão +2–3 MPa LITERATURA; demais PREMISSA]
  const erf = x => { const t = 1 / (1 + .3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
  const pcav = (p, pt) => .5 * (1 + erf((p - pt) / (SIG * Math.SQRT2)));
  // p: { f (MHz), Pn (MPa, pico negativo no foco medido em água), prf (Hz), N (pulsos), depth (cm), fnum, cyc }
  function focal(p, tissue = "mole") {
    const f = p.f || 1, d = p.depth || 4, Pn = p.Pn || 30, fnum = p.fnum || .9, N = p.N || 500, cyc = p.cyc || 2, prf = p.prf || 100;
    const att = Math.pow(10, -ALPHA * f * d / 20), pin = Pn * att;                       // pressão in situ (corrigida)
    const pt = PT + (STIFF[tissue] ?? 0), P1 = isFinite(pt) ? pcav(pin, pt) : 0;
    const lam = C_SOUND / (f * 1e6) * 1e3;                                               // mm
    const wLat = lam * fnum, wAx = 7 * lam * fnum * fnum;                                // largura a meia altura (mm), aproximação de transdutor focado
    const s = x => x / 2.355, ratio = pin / pt;
    const rl = ratio > 1 ? s(wLat) * Math.sqrt(2 * Math.log(ratio)) : 0, al = ratio > 1 ? s(wAx) * Math.sqrt(2 * Math.log(ratio)) : 0;   // semi-eixos da lesão (mm)
    const frac = P1 * (1 - Math.exp(-N / 200));                                            // fracionamento: cresce com os pulsos [PREMISSA ilustrativa]
    const vol = 4 / 3 * Math.PI * rl * rl * al;                                          // mm³ por posição do foco
    const duty = cyc / (f * 1e6) * prf, MI = pin / Math.sqrt(f);                         // ciclo de trabalho; índice mecânico (pressão negativa derada ÷ √f)
    return { f, d, Pn, pin, att, pt, P1, lam, wLat, wAx, rl, al, frac, vol, duty, MI, N, prf, cyc, tissue };
  }
  // efeito sobre um nervo a dist mm do centro do foco: fibras dentro da lesão perdem a condução (não seletivo por calibre)
  function onNerve(F, distMm, nerveRadiusMm = 1.5) {
    if (!F.rl) return { hit: 0, txt: "pressão abaixo do limiar de cavitação: sem lesão" };
    const over = Math.max(0, Math.min(1, (F.rl + nerveRadiusMm - distMm) / (2 * nerveRadiusMm)));
    return { hit: over * F.frac, txt: over > 0 ? `a lesão alcança ${Math.round(over * 100)} % da secção do nervo` : `nervo fora da lesão (${distMm.toFixed(1).replace(".", ",")} mm do foco; raio da lesão ${F.rl.toFixed(2).replace(".", ",")} mm)` };
  }
  const THEORY = [
    ["O que é", "Histotripsia é uma técnica de ablação por ultrassom focado. Pulsos de poucos microssegundos e pressão negativa muito alta formam uma nuvem de bolhas de cavitação no foco; a expansão e o colapso das bolhas fracionam as células em resíduo acelular. É não invasiva, não usa radiação ionizante e não depende de calor.", "lit", ["xu21"]],
    ["Limiar intrínseco", "Em tecidos com muita água, a probabilidade de cavitação com um único pulso segue uma sigmoide da pressão negativa de pico, com limiar estatístico (P = 0,5) entre 26 e 30 MPa. Esse limiar varia pouco com a frequência (de 345 kHz a 3 MHz) e com a rigidez do tecido, subindo cerca de 2–3 MPa no tendão.", "lit", ["maxwell13", "vlais15"]],
    ["Seletividade por tecido", "Tecidos mais rígidos exigem mais pressão para iniciar a nuvem de cavitação e expandem menos as bolhas. É a base da seletividade relativa: estruturas ricas em colágeno resistem mais que o parênquima mole.", "lit", ["vlais14"]],
    ["Variantes", "Na histotripsia de nuvem de cavitação, pulsos de 1 a 2 ciclos superam o limiar intrínseco. Na histotripsia por ebulição, pulsos de milissegundos com ondas de choque aquecem o foco até ferver em menos de 20 ms, e o tecido é emulsionado sem desnaturação térmica quando o ciclo de trabalho fica abaixo de 0,02.", "lit", ["khok11"]],
    ["Uso clínico", "No estudo pivotal #HOPE4LIVER (44 participantes, tumores hepáticos menores que 3 cm), houve sucesso técnico em 42 de 44 tumores (95 %) e complicações maiores relacionadas ao procedimento em 3 de 44 participantes (7 %).", "lit", ["hope24"]],
    ["Relação com a neuromodulação", "A histotripsia destrói o tecido no foco: um nervo dentro da lesão perde a condução de forma irreversível, sem seletividade por calibre de fibra. É o oposto conceitual da neuromodulação, que altera a excitabilidade sem destruir o axônio. No axon, ela aparece para comparar mecanismos e mostrar o risco de atingir nervos perto do alvo.", "der", []],
    ["O que o modelo simplifica", "A pressão no foco é corrigida por atenuação linear (0,5 dB/cm/MHz), sem a formação de ondas de choque nem o espalhamento que, na prática, iniciam a nuvem. O tamanho da lesão usa a zona focal de um transdutor ideal. O número de pulsos para fracionar o tecido é ilustrativo. Interfaces com gás (pulmão, alça intestinal) e ossos no trajeto bloqueiam ou desviam o feixe e não são calculadas.", "pre", []],
  ];
  g.AxonHisto = { REF, THEORY, STIFF, PT, SIG, ALPHA, focal, onNerve, pcav };
})(window);
