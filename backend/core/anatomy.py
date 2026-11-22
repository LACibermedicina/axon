"""axon · Simulador de variações anatômicas por perfil (v0.1.0-alpha).

Motor de regras determinístico e transparente. O microsserviço de IA preditiva
(ai-service) previsto na arquitetura NÃO está implementado nesta versão: ele
receberá a mesma interface `predict(profile)` e deverá devolver as mesmas
etiquetas de procedência. Todas as regras abaixo são [HIPÓTESE].

Perfis são anônimos por construção (LGPD): só aceitam parâmetros geométricos
e de composição, nunca identificadores pessoais.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict

from .bio_model import RHO_E, Ith, check_domain, DomainError

ALLOWED_KEYS = {"subcut_fat_mm", "base_depth_mm", "demyelination", "small_fiber_loss",
                "perineural_hypertrophy", "fibrosis"}


@dataclass
class Profile:
    base_depth_mm: float = 1.0          # distância eletrodo–fibra de referência
    subcut_fat_mm: float = 0.0          # espessura adicional de tecido adiposo
    demyelination: float = 0.0          # 0–1: alongamento nodal efetivo
    small_fiber_loss: float = 0.0       # 0–1: perda de fibras finas (Aδ)
    perineural_hypertrophy: float = 0.0  # 0–1: desvio axial de corrente (↓ fração transmitida)
    fibrosis: float = 0.0               # 0–1: encapsulamento (↑ impedância)

    @classmethod
    def from_dict(cls, d: Dict) -> "Profile":
        bad = set(d) - ALLOWED_KEYS
        if bad:
            raise ValueError(f"campos não permitidos (LGPD/anonimização): {sorted(bad)}")
        return cls(**d)


def predict(profile: Profile) -> Dict:
    r_mm = profile.base_depth_mm + profile.subcut_fat_mm
    # Barreira perineural/fibrótica desvia corrente: fração transmitida < 1 (equivale a escalar Ve)
    transmission = 1 / (1 + 0.8 * profile.perineural_hypertrophy + 0.5 * profile.fibrosis)
    rho_factor = transmission
    ln_factor = 1 + 4 * profile.demyelination
    out: Dict = {"profile": asdict(profile), "engine": "regras-v0.1 (IA não implementada)",
                 "tag": "HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO", "effective_r_mm": r_mm,
                 "transmission_factor": transmission, "nodal_length_factor": ln_factor}
    try:
        check_domain(9, r_mm / 10)
        from .bio_model import LN
        kw = {"rho_e": RHO_E * rho_factor, "ln": LN * ln_factor}
        ab0 = Ith(9, .1) * 1e3; ad0 = Ith(3, .1) * 1e3
        ab = Ith(9, r_mm / 10, **kw) * 1e3; ad = Ith(3, r_mm / 10, **kw) * 1e3
        out.update({k: float(v) for k, v in {"Ith_Abeta_mA": ab, "Ith_Adelta_mA": ad, "ratio": ad / ab,
                    "delta_Abeta_pct": 100 * (ab / ab0 - 1), "delta_Adelta_pct": 100 * (ad / ad0 - 1)}.items()})
    except DomainError as e:
        out["domain_error"] = str(e)
        out["message"] = "Recusado: a variação desloca a fibra para fora do domínio verificado."
    out["effects"] = [
        {"factor": "Tecido adiposo", "effect": "aumenta r ⇒ eleva limiares e a razão Aδ/Aβ (Fig. 7)"},
        {"factor": "Hipertrofia perineural / fibrose", "effect": "reduz a corrente transmitida ⇒ eleva o limiar absoluto, mas não muda as razões (§6.1)"},
        {"factor": "Desmielinização", "effect": "aumenta área nodal efetiva ⇒ maior vazamento"},
        {"factor": "Perda de fibras finas", "effect": f"reduz população Aδ em {profile.small_fiber_loss*100:.0f}% no Monte Carlo"},
    ]
    return out
