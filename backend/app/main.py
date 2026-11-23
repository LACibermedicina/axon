"""axon · API (FastAPI). Interface em mm/µm/mA; núcleo em CGS (conversão na fronteira)."""
from __future__ import annotations

import functools
import os
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from core import bio_model as bm
from core import safety, stochastic, integrative, anatomy
from . import ai

DISCLAIMER = ("Ferramenta de pesquisa, ensino e modelagem in silico (ASME V&V 40 — verificado, não validado; "
              "Resolução CNS nº 510/2016). Não é dispositivo médico nem protocolo clínico.")

app = FastAPI(title="axon API", version=bm.__version__, description=DISCLAIMER,
              docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=[f"https://{os.getenv('SUBDOMINIO', 'axon.m3d.pro')}"],
                   allow_methods=["GET", "POST"], allow_headers=["*"])


def envelope(data: Dict, tag: str) -> Dict:
    return {"data": data, "provenance": tag, "version": bm.__version__, "seed": bm.SEED, "disclaimer": DISCLAIMER}


@app.get("/api/health")
def health():
    return {"status": "ok", "project": "axon", "version": bm.__version__, "git_sha": os.getenv("GIT_SHA", "dev")}


@app.get("/api/release")
def release():
    """Versão no ar e registro de alterações (gerado por scripts/release.py)."""
    import json, pathlib
    for p in (pathlib.Path("/srv/release.json"), pathlib.Path(__file__).resolve().parents[2] / "frontend" / "release.json"):
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
    return {"version": bm.__version__, "releases": []}


@app.get("/api/model/provenance")
def provenance():
    return envelope(bm.PROVENANCE, "LITERATURA/PREMISSA/DERIVADO")


class ThresholdIn(BaseModel):
    D_um: float = Field(..., description="Diâmetro externo da fibra (µm)")
    r_mm: float = Field(..., description="Distância eletrodo–fibra (mm)")
    pw_us: float = 100.0


@app.post("/api/model/threshold")
def threshold(p: ThresholdIn):
    try:
        I = bm.Ith_checked(p.D_um, p.r_mm / 10, pw=p.pw_us * 1e-6) * 1e3
    except bm.DomainError as e:
        raise HTTPException(422, f"Recusado (fora do domínio verificado): {e}")
    return envelope({"Ith_mA": I, "D_um": p.D_um, "r_mm": p.r_mm}, "RESULTADO DE MODELO")


@functools.lru_cache(maxsize=1)
def _reference() -> Dict:
    return bm.run_reference()


@app.get("/api/model/reference")
def reference():
    """res.json do Anexo G (semente 42) — benchmarks obrigatórios."""
    return envelope(_reference(), "RESULTADO DE MODELO - SEMENTE 42")


@app.get("/api/model/profile")
def profile(D_um: float = 9, r_mm: float = 1, I_mA: float = 1):
    return envelope(bm.activation_profile(D_um, r_mm / 10, I_mA * 1e-3), "RESULTADO DE MODELO")


class SafetyIn(BaseModel):
    I_mA: float; pw_us: float; area_cm2: float
    q_W_m3: float = 0; duration_s: float = 60
    p_neg_MPa: float = 0; f_MHz: float = 0.5; ispta: float = 0; z_ratio: float = 1


@app.post("/api/safety/frontiers")
def frontiers(p: SafetyIn):
    try:
        return envelope(safety.all_frontiers(**p.model_dump()), "DERIVADO")
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.get("/api/noise/sr")
def noise_sr():
    return envelope(stochastic.sr_curve(), "RESULTADO DE MODELO - SEMENTE 42")


class EAIn(BaseModel):
    freq_Hz: float = 2; I_mA: float = 1; pw_us: float = 200; tip_to_nerve_mm: float = 1
    needle_diam_mm: float = .25; exposed_len_mm: float = 2


@app.post("/api/integrative/electroacupuncture")
def ea(p: EAIn):
    return envelope(integrative.electroacupuncture(**p.model_dump()), "DERIVADO")


class TaVNSIn(BaseModel):
    site: str = "cymba_conchae"; freq_Hz: float = 25; pw_us: float = 250; I_mA: float = .5
    depth_mm: float = .8; electrode_area_cm2: float = .5


@app.post("/api/integrative/tavns")
def tavns(p: TaVNSIn):
    try:
        return envelope(integrative.tavns(**p.model_dump()), "DERIVADO")
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.get("/api/integrative/acupressure")
def acupressure(pressure_kPa: float = 60, contact_area_cm2: float = 1):
    return envelope(integrative.acupressure(pressure_kPa, contact_area_cm2), "HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO")


@app.post("/api/anatomy/predict")
def anatomy_predict(profile: Dict[str, float]):
    try:
        prof = anatomy.Profile.from_dict(profile)
    except (TypeError, ValueError) as e:
        raise HTTPException(422, str(e))
    return envelope(anatomy.predict(prof), "HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO")


# ------------------------------------------------------------------- IA (App 7 / App 8)
@app.get("/api/ai/status")
def ai_status():
    return ai.status()


class BotIn(BaseModel):
    question: str = Field(..., max_length=1000); lang: str = "pt"; context: Optional[Dict] = None


@app.post("/api/ai/bot")
def bot(p: BotIn):
    return ai.bot_answer(p.question, p.lang, p.context)


class TrIn(BaseModel):
    texts: List[str] = Field(..., max_length=200); target: str


@app.post("/api/ai/translate")
def translate(p: TrIn):
    try:
        return ai.translate(p.texts, p.target)
    except ValueError as e:
        raise HTTPException(422, str(e))
