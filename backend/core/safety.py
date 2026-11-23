"""axon · Monitor das 4 Fronteiras de Segurança Tecidual (Cap. 11 do livro).

Cada função devolve valor + classificação + etiqueta de procedência.
Ferramenta de ensino: os limites são referências da literatura, não garantias clínicas.
"""
from __future__ import annotations

import math
from typing import Dict, Sequence

# --- Fronteira eletroquímica: relação de Shannon -----------------------------
SHANNON_K_CONSERVATIVE = 1.75   # [LITERATURA] Shannon 1992 (ref. 61); ref. 63
SHANNON_K_RISK = 2.0            # [LITERATURA] §21 — faixa Atenção 1,75 ≤ k < 2,0


def shannon(I_mA: float, pw_us: float, area_cm2: float) -> Dict:
    """k = log10(D) + log10(Q), Q em µC/fase, D = Q/A em µC/cm²/fase."""
    if I_mA <= 0 or pw_us <= 0 or area_cm2 <= 0:
        raise ValueError("I, tp e A devem ser positivos")
    Q = I_mA * 1e-3 * pw_us * 1e-6 * 1e6        # µC
    D = Q / area_cm2                              # µC/cm²
    k = math.log10(D) + math.log10(Q)
    level = "conservador" if k < SHANNON_K_CONSERVATIVE else ("atencao" if k < SHANNON_K_RISK else "risco")
    return {"Q_uC": Q, "D_uC_cm2": D, "k": k, "level": level,
            "limit": SHANNON_K_CONSERVATIVE, "tag": "DERIVADO",
            "ref": "Shannon RV. IEEE Trans Biomed Eng. 1992;39(4):424-6 (ref. 61)",
            "caveat": "Ajustada a estimulação cortical em animais; extrapolação para nervo periférico/agulha é PREMISSA."}


# --- Fronteira térmica: CEM43 + Pennes 0D ------------------------------------
def cem43(temps_C: Sequence[float], dt_s: float) -> float:
    """Dose térmica acumulada (min equivalentes a 43 °C) — Sapareto & Dewey."""
    total = 0.0
    for T in temps_C:
        R = 0.5 if T >= 43 else 0.25
        total += (dt_s / 60.0) * R ** (43 - T)
    return total


def pennes_0d(q_W_m3: float, duration_s: float, T0: float = 37.0, wb: float = 0.5e-3,
              rho_c: float = 3.6e6, rho_b_cb: float = 4.0e6, dt: float = 0.1) -> Dict:
    """Pennes sem difusão espacial (pior caso local): ρc dT/dt = q − wb·ρb·cb·(T − Ta).

    q: deposição volumétrica (W/m³). wb: perfusão (1/s) [PREMISSA de ordem de grandeza].
    """
    T = T0; hist = []
    n = int(duration_s / dt)
    for _ in range(n):
        T += dt * (q_W_m3 - wb * rho_b_cb * (T - T0)) / rho_c
        hist.append(T)
    dT = (max(hist) if hist else T0) - T0
    dose = cem43(hist, dt)
    level = "conservador" if dT <= 1 else ("atencao" if dT <= 2 else "risco")
    return {"dT_C": dT, "CEM43_min": dose, "level": level, "limit_dT": 2.0,
            "tag": "DERIVADO", "ref": "Pennes 1948 (ref. 65); ITRUSST ΔT ≤ 2 °C / 2 CEM43 (ref. 74)",
            "caveat": "Modelo 0D sem condução: superestima ΔT. Perfusão e calor específico são PREMISSA."}


# --- Fronteira mecânica: MI e ISPTA.3 ----------------------------------------
MI_LIMIT = 1.9          # [LITERATURA] FDA 510(k) diagnóstico (ref. 66); ITRUSST (ref. 74)
ISPTA_LIMIT = 720.0     # mW/cm² [LITERATURA] ref. 66 (limite de imageamento)


def mechanical(p_neg_MPa: float, f_MHz: float, ispta_mW_cm2: float,
               alpha_db_cm_MHz: float = 0.5, depth_cm: float = 0.0) -> Dict:
    """MI = p_r,0.3 / sqrt(f). Derating de 0,3 dB/cm/MHz conforme norma."""
    derate = 10 ** (-0.3 * f_MHz * depth_cm / 20)
    p3 = p_neg_MPa * derate
    MI = p3 / math.sqrt(f_MHz)
    I3 = ispta_mW_cm2 * derate ** 2
    level = "conservador" if (MI <= MI_LIMIT and I3 <= ISPTA_LIMIT) else "risco"
    return {"MI": MI, "ISPTA3_mW_cm2": I3, "level": level, "MI_limit": MI_LIMIT,
            "ISPTA_limit": ISPTA_LIMIT, "tag": "DERIVADO",
            "ref": "FDA 510(k) Track 3 (ref. 66); ITRUSST (ref. 74)",
            "caveat": "720 mW/cm² descreve segurança do imageamento, não a fronteira da neuromodulação terapêutica."}


# --- Fronteira biológica crônica ---------------------------------------------
def chronic(impedance_ratio: float) -> Dict:
    """Indicador qualitativo de encapsulamento: Z(t)/Z(0). [HIPÓTESE] limiares ilustrativos."""
    level = "conservador" if impedance_ratio < 1.5 else ("atencao" if impedance_ratio < 3 else "risco")
    return {"Z_ratio": impedance_ratio, "level": level, "tag": "HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO",
            "caveat": "Sem modelo quantitativo validado; faixas 1,5× e 3× são ilustrativas."}


# --- Fronteira acústica: difração × atenuação (Cap. 9) -----------------------
def diffraction_attenuation(focus_um: float, c: float = 1500.0, alpha_db_cm_MHz: float = 0.5) -> Dict:
    """Frequência exigida para λ = foco e a atenuação correspondente. 10 µm ⇒ 150 MHz e 75 dB/cm."""
    f = c / (focus_um * 1e-6)                    # Hz
    att = alpha_db_cm_MHz * f / 1e6              # dB/cm
    return {"f_MHz": f / 1e6, "attenuation_dB_cm": att, "tag": "DERIVADO",
            "ref": "c = 1500 m/s; α = 0,5 dB·cm⁻¹·MHz⁻¹ (ref. 45)"}


def all_frontiers(I_mA: float, pw_us: float, area_cm2: float, q_W_m3: float = 0.0,
                  duration_s: float = 60.0, p_neg_MPa: float = 0.0, f_MHz: float = 0.5,
                  ispta: float = 0.0, z_ratio: float = 1.0) -> Dict:
    return {"electrochemical": shannon(I_mA, pw_us, area_cm2),
            "thermal": pennes_0d(q_W_m3, duration_s),
            "mechanical": mechanical(p_neg_MPa, f_MHz, ispta) if p_neg_MPa > 0 else
            {"MI": 0.0, "ISPTA3_mW_cm2": 0.0, "level": "conservador", "tag": "DERIVADO"},
            "chronic": chronic(z_ratio)}
