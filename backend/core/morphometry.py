"""axon · Preditor morfométrico do axônio no feixe nervoso.

Espelho exato de frontend/js/morpho.js (mesmas equações, quantis analíticos, determinístico).
A partir de biometria (idade, sexo, altura, peso) e clínica (temperatura do membro, HbA1c,
tempo de diabetes, desmielinização e perda de fibras finas) estima, por classe de fibra
(Aα, Aβ, Aγ, Aδ, B, C): diâmetro externo p10/mediana/p90, axônio, g-ratio, mielina,
internodo, velocidade de condução e fração de axônios do nervo.

Procedência: faixas de classe e efeitos (direção) [LITERATURA]; magnitudes calibradas,
composição por nervo e dispersões [PREMISSA]; combinações [DERIVADO]. Não é medida
individual nem diagnóstico.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional

Z10 = 1.2815516

# lo, hi, mu, sd (µm), k (m/s por µm), g, mielinizada
CL: Dict[str, tuple] = {
    "Aα": (12, 20, 14, 1.8, 4.4, .70, True),
    "Aβ": (6, 12, 9, 1.5, 4.6, .62, True),
    "Aγ": (3, 6, 4.5, .7, 4.6, .70, True),
    "Aδ": (1, 5, 3, .8, 4.6, .70, True),
    "B": (1, 3, 2, .4, 4.6, .72, True),
    "C": (.2, 1.5, .8, .25, None, 1.0, False),
}
KIND: Dict[str, Dict[str, float]] = {
    "cutaneo": {"Aβ": .09, "Aδ": .14, "C": .77},
    "misto": {"Aα": .12, "Aγ": .04, "Aβ": .1, "Aδ": .12, "C": .62},
    "muscular": {"Aα": .28, "Aγ": .12, "Aβ": .06, "Aδ": .14, "C": .4},
    "vago": {"Aβ": .01, "Aδ": .05, "B": .08, "C": .86},
    "abvn": {"Aβ": .18, "Aδ": .12, "C": .7},
    "raizv": {"Aα": .6, "Aγ": .3, "B": .1},
    "raizd": {"Aα": .06, "Aβ": .12, "Aδ": .14, "C": .68},
    "trig": {"Aβ": .12, "Aδ": .16, "C": .72},
}


@dataclass
class Patient:
    sex: str = "M"
    age: float = 45
    height: float = 175
    weight: float = 75
    temp: float = 33
    hba1c: float = 5.4
    dmYears: float = 0
    demy: float = 0
    sfl: float = 0

    @property
    def bmi(self) -> float:
        return self.weight / (self.height / 100) ** 2

    def validate(self) -> None:
        lim = {"age": (0, 110), "height": (100, 230), "weight": (25, 300), "temp": (20, 40),
               "hba1c": (3, 20), "dmYears": (0, 80), "demy": (0, .9), "sfl": (0, .9)}
        for k, (a, b) in lim.items():
            v = getattr(self, k)
            if not a <= v <= b:
                raise ValueError(f"{k}={v} fora de [{a}, {b}]")
        if self.sex not in ("M", "F"):
            raise ValueError("sex deve ser 'M' ou 'F'")


def clamp(x: float, a: float, b: float) -> float:
    return max(a, min(b, x))


def kind_of(nerve: str) -> str:
    n = (nerve or "").lower()
    if re.search(r"auricular|abvn|concha", n):
        return "abvn"
    if re.search(r"vago|vagus", n):
        return "vago"
    if re.search(r"trigêmeo|trigemin|maxilar|mandibular|oftálmico|v1|v2|v3", n):
        return "trig"
    if re.search(r"raiz.*ventral|ventral", n):
        return "raizv"
    if re.search(r"raiz|gânglio|dorsal", n):
        return "raizd"
    if re.search(r"sural|safeno|cutâneo|superficial do radial|intercostal", n):
        return "misto" if "intercostal" in n else "cutaneo"
    if re.search(r"ramo muscular|motor", n):
        return "muscular"
    return "misto"


def region_of(nerve: str) -> str:
    if re.search(r"ciátic|tibial|fibular|sural|femoral|safeno|plantar|glúte|obturat|lombar|sacral|l[45]|s[12]", nerve or "", re.I):
        return "inferior"
    if re.search(r"mediano|ulnar|radial|musculocut|axilar|braquial|c[5-8]", nerve or "", re.I):
        return "superior"
    return "outro"


def predict(p: Patient, nerve: str = "Nervo mediano") -> Dict:
    p.validate()
    kind, reg = kind_of(nerve), region_of(nerve)
    dec = max(0.0, p.age - 30) / 10
    s_age = 1 - .016 * dec
    n_age_l = 1 - .08 * max(0.0, p.age - 60) / 10
    n_age = 1 - .26 * clamp((p.age - 15) / 60, 0, 1)
    s_h = 1 - .02 * (p.height - 170) / 10 if reg == "inferior" else 1.0
    s_bmi = 1 - .0025 * max(0.0, p.bmi - 25)
    dT = max(0.0, 33 - p.temp)
    xa = max(0.0, p.hba1c - 5.7)
    n_dml = (1 - .01 * xa) * (1 - .015 * p.dmYears)
    s_dm = 1 - .004 * p.dmYears
    n_dmc = max(.2, 1 - .02 * p.dmYears)

    def large(c): return c in ("Aα", "Aβ")
    def scale(c): return (s_age * s_dm if large(c) else 1) * s_h

    def count(c):
        v = n_age * ((n_age_l if p.age > 60 else 1) * n_dml if large(c) else 1)
        if c == "C":
            v *= n_dmc * (1 - p.sfl)
        elif c == "Aδ":
            v *= 1 - p.sfl
        return v

    def cvk(c, cv0):
        my = CL[c][6]
        return max(.2, (cv0 - 1.7 * dT * cv0 / 50) * s_bmi * ((1 - .6 * p.demy) if my else 1))

    raw = [(c, v, v * count(c)) for c, v in KIND[kind].items() if v > 0]
    tot = sum(w for *_, w in raw)
    out: List[Dict] = []
    for c, v0, w in raw:
        lo, hi, mu, sd, k, g0, my = CL[c]
        s = scale(c)
        q = lambda z: clamp((mu + sd * z) * s, lo * .6, hi * 1.05)
        D = {"p10": q(-Z10), "med": q(0), "p90": q(Z10)}
        g = g0 + (.85 - g0) * p.demy if my else 1.0
        cv0 = k * D["med"] if my else .5 + (D["med"] - .2) / 1.3 * 1.5
        out.append({"cls": c, "D_um": D, "axon_um": D["med"] * g, "g": g,
                    "myelin_um": (D["med"] - D["med"] * g) / 2 if my else 0.0,
                    "internode_um": 100 * D["med"] if my else None,
                    "cv_ms": cvk(c, cv0), "cv0_ms": cv0, "share": w / tot,
                    "in_verified_domain": bool(my and 1 <= D["med"] <= 16),
                    "range_um": [lo, hi]})
    return {"nerve": nerve, "kind": kind, "region": reg, "bmi": p.bmi, "patient": asdict(p),
            "relative_density": tot / sum(KIND[kind].values()), "classes": out,
            "tags": {"faixas_e_direcoes": "LITERATURA", "magnitudes_e_composicao": "PREMISSA",
                     "saida": "DERIVADO"}}


def latency_ms(length_mm: float, cv_ms: float, nmj_ms: float = .8) -> float:
    """Latência raiz → placa motora: condução (mm / (m/s) = ms) + junção neuromuscular [PREMISSA 0,8 ms]."""
    if cv_ms <= 0 or length_mm < 0:
        raise ValueError("comprimento e velocidade devem ser positivos")
    return length_mm / cv_ms + nmj_ms


def from_dict(d: Optional[Dict]) -> Patient:
    d = d or {}
    fields = {k: d[k] for k in Patient.__dataclass_fields__ if k in d}
    return Patient(**fields)
