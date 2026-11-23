"""axon · núcleo biofísico verificado (v0.1.0-alpha).

Preditor de limiar por calibre — cadeia nodal McNeal-like, membrana passiva,
regime linear. Reimplementação fiel do Anexo G de:

    Teixeira LS. Biofísica da Neuromodulação: Resolução de Fibra Única e
    Limiares de Segurança Tecidual. Ibilce/UNESP; 2026. Ed. consolidada 1.0.

Unidades do núcleo: CGS elétrico (cm, Ω·cm, S, F, s, A, V).
Na interface pública: D em µm, r em cm (as camadas HTTP/UI convertem mm → cm).
Toda conversão acontece na fronteira da função pública — nunca no meio do cálculo.

FERRAMENTA DE PESQUISA E ENSINO (in silico; ASME V&V 40 — verificado, NÃO validado).
NÃO É DISPOSITIVO MÉDICO. Não calcula dose para pessoas.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Dict, Iterable, Tuple

import numpy as np

import pathlib as _pl


def _read_version() -> str:
    for p in (_pl.Path(__file__).resolve().parents[1] / "VERSION", _pl.Path(__file__).resolve().parents[2] / "VERSION"):
        if p.exists():
            return p.read_text().strip()
    return "0.0.0-dev"


__version__ = _read_version()   # fonte única: arquivo VERSION na raiz do repositório
SEED = 42

# ---------------------------------------------------------------------------
# Parâmetros com etiqueta de procedência (Tabela 6.1 do livro)
# ---------------------------------------------------------------------------
RHO_I = 110.0      # Ω·cm   [LITERATURA] ref. 35 do livro (modelo nodal de referência)
RHO_E = 300.0      # Ω·cm   [PREMISSA] razões independentes de ρe (§6.1)
CM = 2e-6          # F/cm²  [LITERATURA] ref. 35
GL = 30.3e-3       # S/cm²  [LITERATURA] ref. 35
LN = 2.5e-4        # cm (2,5 µm) [LITERATURA] ref. 35
VTH = 0.020        # V (20 mV) [PREMISSA] limiar subliminar convencional

PROVENANCE: Dict[str, Dict[str, str]] = {
    "rho_i": {"value": "110 Ω·cm", "tag": "LITERATURA", "ref": "Tabela 6.1, ref. 35"},
    "rho_e": {"value": "300 Ω·cm", "tag": "PREMISSA", "ref": "§6.1 — razões independentes de ρe"},
    "Cm": {"value": "2 µF/cm²", "tag": "LITERATURA", "ref": "Tabela 6.1, ref. 35"},
    "gL": {"value": "30,3 mS/cm²", "tag": "LITERATURA", "ref": "Tabela 6.1, ref. 35"},
    "Ln": {"value": "2,5 µm", "tag": "LITERATURA", "ref": "Tabela 6.1, ref. 35"},
    "d/D": {"value": "0,7", "tag": "LITERATURA", "ref": "Tabela 6.1, refs. 2 e 35"},
    "L/D": {"value": "100", "tag": "LITERATURA", "ref": "Tabela 6.1, ref. 2"},
    "Vth": {"value": "20 mV", "tag": "PREMISSA", "ref": "Tabela 6.1"},
    "pulse": {"value": "100 µs retangular catódico", "tag": "PREMISSA", "ref": "Tabela 6.1"},
    "fascicle": {"value": "40% Aβ~N(9;1,5) · 60% Aδ~N(3;0,8) · r~U(0,3;1,5) mm",
                 "tag": "PREMISSA", "ref": "Tabela 6.1 — premissa mais frágil do modelo"},
    "dt": {"value": "1 µs", "tag": "DERIVADO", "ref": "cota de estabilidade §6.4 (≈7 µs no pior caso)"},
    "N": {"value": "41 nós", "tag": "DERIVADO", "ref": "convergência espacial §6.4 (<0,5% para 81 nós)"},
    "seed": {"value": "42 (PCG64)", "tag": "PREMISSA", "ref": "§19.5 reprodutibilidade"},
}

# Domínio verificado — parte do contrato (§22.6). Fora dele o núcleo recusa.
D_MIN, D_MAX = 1.0, 16.0          # µm
R_MIN, R_MAX = 0.03, 0.15         # cm (0,3–1,5 mm)


class DomainError(ValueError):
    """Pedido fora do domínio verificado (1–16 µm; 0,3–1,5 mm)."""


def check_domain(D: float, r: float) -> None:
    if not (D_MIN - 1e-9 <= D <= D_MAX + 1e-9):
        raise DomainError(f"D={D} µm fora do domínio verificado [{D_MIN}, {D_MAX}] µm")
    if not (R_MIN - 1e-9 <= r <= R_MAX + 1e-9):
        raise DomainError(f"r={r*10:.3f} mm fora do domínio verificado [0,3; 1,5] mm")


# ---------------------------------------------------------------------------
# Núcleo — duas funções puras (Anexo G, sem alteração numérica)
# ---------------------------------------------------------------------------
def h(D: float, r: float, pw: float = 100e-6, rho_i: float = RHO_I, N: int = 41,
      dt: float = 1e-6, rho_e: float = RHO_E, ln: float = LN) -> float:
    """Despolarização nodal máxima (V) por A de corrente catódica. D em µm, r em cm.

    Pura: sem estado global, sem efeitos colaterais.
    """
    Dc = D * 1e-4                       # µm → cm
    d = .7 * Dc; L = 100 * Dc           # relações de escala [LITERATURA refs. 2, 35]
    Ga = np.pi * d ** 2 / 4 / (rho_i * L)   # condutância axial
    ar = np.pi * d * ln; C = CM * ar; g = GL * ar  # área, capacitância, vazamento do nó
    x = (np.arange(N) - N // 2) * L     # posições dos nós, origem no nó central
    Ve = -rho_e / (4 * np.pi * np.sqrt(x ** 2 + r ** 2))   # fonte pontual, meio homogêneo
    drv = np.zeros(N)
    drv[1:-1] = Ga * (Ve[:-2] - 2 * Ve[1:-1] + Ve[2:])     # função de ativação (Rattay)
    V = np.zeros(N); vm = 0
    for k in range(int((pw + 300e-6) / dt)):               # pulso + cauda de relaxação
        Vp = np.pad(V, 1, mode="edge")                     # bordas de Neumann
        lap = Vp[:-2] - 2 * V + Vp[2:]
        V = V + dt / C * (-g * V + Ga * lap + (drv if k * dt < pw else 0))
        vm = max(vm, V.max())
    return vm


def Ith(D: float, r: float, **kw) -> float:
    """Limiar em ampères: VTH / h(D, r). Linearidade ⇒ limiar por divisão."""
    return VTH / h(D, r, **kw)


def Ith_checked(D: float, r: float, **kw) -> float:
    """Igual a Ith, mas recusa pedidos fora do domínio verificado."""
    check_domain(D, r)
    return Ith(D, r, **kw)


def stability_bound(D: float, rho_i: float = RHO_I) -> float:
    """Cota de estabilidade do Euler explícito: Δt < C/(g + 4·Ga) (s)."""
    Dc = D * 1e-4; d = .7 * Dc; L = 100 * Dc
    Ga = np.pi * d ** 2 / 4 / (rho_i * L); ar = np.pi * d * LN
    return CM * ar / (GL * ar + 4 * Ga)


# ---------------------------------------------------------------------------
# Perfis espaciais (para o mapa de calor Δ²Ve do palco 3D)
# ---------------------------------------------------------------------------
def activation_profile(D: float, r: float, I: float = 1e-3, N: int = 41,
                       rho_e: float = RHO_E) -> Dict[str, list]:
    """Ve (V) e função de ativação Δ²Ve (V) por nó, para corrente I (A) catódica."""
    Dc = D * 1e-4; L = 100 * Dc
    x = (np.arange(N) - N // 2) * L
    Ve = -rho_e * I / (4 * np.pi * np.sqrt(x ** 2 + r ** 2))
    f = np.zeros(N); f[1:-1] = Ve[:-2] - 2 * Ve[1:-1] + Ve[2:]
    return {"x_mm": (x * 10).tolist(), "Ve_mV": (Ve * 1e3).tolist(), "f_mV": (f * 1e3).tolist(),
            "tag": "RESULTADO DE MODELO"}


# ---------------------------------------------------------------------------
# Execução de referência (Anexo G) — produz o mesmo res.json do livro
# ---------------------------------------------------------------------------
DS_GRID = np.arange(1, 16.1, 1.0)
RS_GRID = np.array([.03, .05, .07, .10, .15])


def threshold_grid(Ds: Iterable[float] = DS_GRID, rs: Iterable[float] = RS_GRID, **kw) -> np.ndarray:
    Ds = np.asarray(list(Ds), float); rs = np.asarray(list(rs), float)
    return np.array([[Ith(D, r, **kw) for r in rs] for D in Ds]) * 1e3  # mA


def scaling_exponent(T: np.ndarray, Ds: np.ndarray = DS_GRID, col: int = 3) -> float:
    return float(-np.polyfit(np.log(Ds), np.log(T[:, col]), 1)[0])


@dataclass
class Fascicle:
    """Fascículo hipotético (Tabela 6.1) — [PREMISSA]."""
    n: int = 20000
    frac_abeta: float = .4
    abeta: Tuple[float, float] = (9.0, 1.5)
    adelta: Tuple[float, float] = (3.0, .8)
    r_range: Tuple[float, float] = (.03, .15)


def monte_carlo(T: np.ndarray, fasc: Fascicle = Fascicle(), seed: int = SEED,
                n_boot: int = 2000, Ds: np.ndarray = DS_GRID, rs: np.ndarray = RS_GRID) -> Dict:
    from scipy.interpolate import RegularGridInterpolator as RGI
    rng = np.random.default_rng(seed); n = fasc.n
    ab = rng.random(n) < fasc.frac_abeta
    D = np.where(ab, rng.normal(*fasc.abeta, n), rng.normal(*fasc.adelta, n)).clip(1, 16)
    r = rng.uniform(*fasc.r_range, n)
    f = RGI((np.log(Ds), np.log(rs)), np.log(T))
    It = np.exp(f(np.c_[np.log(D), np.log(r)]))
    i50 = lambda m: float(np.median(It[m]))
    bs = []
    for _ in range(n_boot):
        j = rng.integers(0, n, n); m = ab[j]
        bs.append(np.median(It[j][~m]) / np.median(It[j][m]))
    I = np.logspace(-1.5, 1.5, 200)
    fa = [(It[ab] <= i).mean() for i in I]; fd = [(It[~ab] <= i).mean() for i in I]
    ok = [j for j, _ in enumerate(I) if fa[j] <= .10]
    return {
        "I50_Abeta_mA": i50(ab), "I50_Adelta_mA": i50(~ab),
        "ratio_I50": i50(~ab) / i50(ab),
        "ratio_CI95": np.percentile(bs, [2.5, 97.5]).tolist(),
        "Adelta_frac_when_Abeta_le10pct": float(fd[ok[-1]]) if ok else 0.,
        "recruitment": {"I_mA": I.tolist(), "F_Abeta": [float(v) for v in fa],
                        "F_Adelta": [float(v) for v in fd]},
        "_samples": {"D": D, "r": r, "It": It, "abeta": ab},
    }


def run_reference(n_boot: int = 2000) -> Dict:
    """Reproduz res.json do Anexo G (semente 42)."""
    T = threshold_grid()
    R: Dict = {"version": __version__, "seed": SEED,
               "tag": "RESULTADO DE MODELO - SEMENTE 42",
               "alpha_r1mm": scaling_exponent(T),
               "Ith_mA_r1mm": dict(zip(map(float, DS_GRID), T[:, 3].round(3).tolist()))}
    for lab, rho in (("rho_i70", 70.), ("rho_i150", 150.)):
        R["ratio_3_9_" + lab] = Ith(3, .1, rho_i=rho) / Ith(9, .1, rho_i=rho)
    R["ratio_3_9_r1mm"] = Ith(3, .1) / Ith(9, .1)
    R["ratio_3_9_r05mm"] = Ith(3, .05) / Ith(9, .05)
    R["ratio_3_9_r15mm"] = Ith(3, .15) / Ith(9, .15)
    R["Ith_1um_r1mm"] = Ith(1, .1) * 1e3
    mc = monte_carlo(T, n_boot=n_boot)
    mc.pop("_samples")
    R.update(mc)
    R["grid"] = {"D_um": DS_GRID.tolist(), "r_mm": (RS_GRID * 10).tolist(), "Ith_mA": T.tolist()}
    return R


if __name__ == "__main__":  # pragma: no cover
    res = run_reference()
    with open("res.json", "w") as fh:
        json.dump({k: v for k, v in res.items() if k != "recruitment"}, fh, indent=1)
    for k in ("alpha_r1mm", "ratio_3_9_r1mm", "ratio_I50", "ratio_CI95", "Adelta_frac_when_Abeta_le10pct"):
        print(f"{k:34s} {res[k]}")
