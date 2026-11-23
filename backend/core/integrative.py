"""axon · Acoplamento das modalidades integrativas ao núcleo nodal.

Eletroacupuntura (EA), taVNS e acupressão/pressão reflexa.
Tudo aqui é EXTENSÃO do núcleo verificado: reaproveita h()/Ith() dentro do
domínio verificado e etiqueta explicitamente o que é premissa ou hipótese.
Nenhuma saída é recomendação terapêutica.
"""
from __future__ import annotations

import math
from typing import Dict

from .bio_model import Ith, check_domain, DomainError
from .safety import shannon

REFS = {
    "han2003": "Han JS. Acupuncture: neuropeptide release produced by electrical stimulation "
               "of different frequencies. Trends Neurosci. 2003;26(1):17-22.",
    "peuker2002": "Peuker ET, Filler TJ. The nerve supply of the human auricle. Clin Anat. 2002;15(1):35-7.",
    "farmer2021": "Farmer AD, Strzelczyk A, Finisguerra A, et al. International consensus based review and "
                  "recommendations for minimum reporting standards in research on transcutaneous vagus "
                  "nerve stimulation (version 2020). Front Hum Neurosci. 2021;14:568051.",
    "melzack1965": "Melzack R, Wall PD. Pain mechanisms: a new theory. Science. 1965;150(3699):971-9.",
    "coste2010": "Coste B, Mathur J, Schmidt M, et al. Piezo1 and Piezo2 are essential components of "
                 "distinct mechanically activated cation channels. Science. 2010;330(6000):55-60.",
}

# Inervação do pavilhão pelo ramo auricular do vago (ABVN) — % de espécimes [LITERATURA peuker2002]
ABVN_INNERVATION = {"cymba_conchae": 100, "cavum_conchae": 45, "antihelix": 73,
                    "tragus": 45, "crus_helicis": 20, "lobulo": 0}


def _pair_thresholds(r_cm: float, pw_s: float, rho_e_factor: float = 1.0) -> Dict:
    check_domain(9, r_cm)
    from .bio_model import RHO_E
    kw = {"pw": pw_s, "rho_e": RHO_E * rho_e_factor}
    ab = Ith(9, r_cm, **kw) * 1e3
    ad = Ith(3, r_cm, **kw) * 1e3
    return {"Ith_Abeta_mA": float(ab), "Ith_Adelta_mA": float(ad), "ratio": float(ad / ab)}


def electroacupuncture(freq_Hz: float, I_mA: float, pw_us: float = 200., tip_to_nerve_mm: float = 1.0,
                       needle_diam_mm: float = 0.25, exposed_len_mm: float = 2.0) -> Dict:
    """EA: agulha como fonte pontual próxima ao feixe neurovascular.

    Área ativa: cilindro exposto π·d·ℓ [PREMISSA geométrica]. Bandas de frequência
    e neuroquímica: [LITERATURA pré-clínica han2003] — eficácia clínica: [HIPÓTESE].
    """
    r = tip_to_nerve_mm / 10
    out: Dict = {"modality": "electroacupuncture", "tag": "DERIVADO"}
    try:
        out.update(_pair_thresholds(r, pw_us * 1e-6))
        out["recruits_Abeta"] = bool(I_mA >= out["Ith_Abeta_mA"])
        out["recruits_Adelta"] = bool(I_mA >= out["Ith_Adelta_mA"])
        if pw_us != 100:
            out["note"] = "Largura de pulso ≠ 100 µs: extensão do núcleo (forma de onda), fora da condição de verificação."
    except DomainError as e:
        out["domain_error"] = str(e)
    area = math.pi * (needle_diam_mm / 10) * (exposed_len_mm / 10)   # cm²
    out["safety"] = shannon(I_mA, pw_us, area)
    out["area_cm2"] = area
    if freq_Hz <= 10:
        band = {"band": "baixa (2–10 Hz)", "mechanism": "encefalinas/β-endorfina (receptores µ/δ)",
                "tag": "LITERATURA", "ref": REFS["han2003"]}
    elif freq_Hz >= 80:
        band = {"band": "alta (80–100 Hz)", "mechanism": "dinorfina (receptor κ) e fechamento do portão medular",
                "tag": "LITERATURA", "ref": REFS["han2003"] + " · " + REFS["melzack1965"]}
    else:
        band = {"band": "intermediária / alternada (2/100 Hz)", "mechanism": "mistura de vias",
                "tag": "HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO", "ref": REFS["han2003"]}
    out["frequency_band"] = band
    out["clinical_efficacy"] = {"tag": "HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO",
                                "text": "Evidência pré-clínica; efeito clínico depende de desenho de estudo."}
    return out


def tavns(site: str = "cymba_conchae", freq_Hz: float = 25., pw_us: float = 250., I_mA: float = 0.5,
          depth_mm: float = 0.8, electrode_area_cm2: float = 0.5) -> Dict:
    """taVNS: eletrodo de superfície sobre ABVN. Profundidade pele→fibra = r."""
    if site not in ABVN_INNERVATION:
        raise ValueError(f"local desconhecido: {site}")
    out: Dict = {"modality": "taVNS", "site": site,
                 "abvn_probability_pct": ABVN_INNERVATION[site],
                 "abvn_tag": "LITERATURA", "abvn_ref": REFS["peuker2002"],
                 "parameter_ref": REFS["farmer2021"]}
    try:
        out.update(_pair_thresholds(depth_mm / 10, pw_us * 1e-6))
        out["recruits_Abeta"] = bool(I_mA >= out["Ith_Abeta_mA"])
    except DomainError as e:
        out["domain_error"] = str(e)
    out["safety"] = shannon(I_mA, pw_us, electrode_area_cm2)
    out["cascade"] = [
        {"step": "Aferentes Aβ do ABVN", "tag": "LITERATURA"},
        {"step": "Núcleo do Trato Solitário (NTS)", "tag": "LITERATURA"},
        {"step": "Locus coeruleus · núcleos da rafe · PAG", "tag": "HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO"},
        {"step": "Via colinérgica anti-inflamatória (α7nAChR, baço)", "tag": "HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO"},
    ]
    out["alerts"] = ["Monitorar frequência cardíaca (risco teórico de bradicardia).",
                     "Lóbulo: sem inervação ABVN — local de controle sham."]
    if not (20 <= freq_Hz <= 30 and 200 <= pw_us <= 250):
        out["alerts"].append("Parâmetros fora da faixa usual relatada (20–30 Hz; 200–250 µs).")
    return out


def acupressure(pressure_kPa: float, contact_area_cm2: float = 1.0,
                p50_kPa: float = 40., slope_kPa: float = 12.) -> Dict:
    """Pressão focal → fração de mecanorreceptores Aβ ativados (Boltzmann).

    p50 e inclinação: [PREMISSA ilustrativa]; canais Piezo2/TRAAK: [LITERATURA coste2010].
    Sem corrente injetada ⇒ fronteira eletroquímica não se aplica.
    """
    frac = 1 / (1 + math.exp(-(pressure_kPa - p50_kPa) / slope_kPa))
    force_N = pressure_kPa * 1e3 * contact_area_cm2 * 1e-4
    level = "conservador" if pressure_kPa < 200 else ("atencao" if pressure_kPa < 300 else "risco")
    return {"modality": "acupressure", "F_Abeta_mech": frac, "force_N": force_N,
            "tag": "HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO",
            "premises": {"p50_kPa": p50_kPa, "slope_kPa": slope_kPa},
            "channels": {"names": ["Piezo1", "Piezo2", "TRAAK", "TREK"], "tag": "LITERATURA", "ref": REFS["coste2010"]},
            "gate_control": {"tag": "LITERATURA", "ref": REFS["melzack1965"]},
            "safety": {"electrochemical": "não se aplica", "mechanical_level": level,
                       "note": "Limiar de dor à pressão em algometria da ordem de 300 kPa [PREMISSA de ordem de grandeza]."}}
