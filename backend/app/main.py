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
    texts: List[str] = Field(..., max_length=400); target: str; context: str = Field("", max_length=300)


@app.post("/api/ai/translate")
def translate(p: TrIn):
    try:
        return ai.translate([t[:600] for t in p.texts], p.target, p.context)
    except ValueError as e:
        raise HTTPException(422, str(e))


# ================================================================== portal: notícias, agenda, mídia, podcast, newsletter, apoio
from fastapi import Header, Request  # noqa: E402
from fastapi.responses import FileResponse, PlainTextResponse, Response  # noqa: E402
from . import portal  # noqa: E402


def _admin(authorization: Optional[str]) -> None:
    if not os.getenv("ADMIN_TOKEN"):
        raise HTTPException(503, "Painel desativado: defina ADMIN_TOKEN no .env do servidor.")
    if not portal.check_admin(authorization or ""):
        raise HTTPException(401, "Token de administrador inválido.")


def _ip(req: Request) -> str:
    return (req.headers.get("x-forwarded-for") or (req.client.host if req.client else "?")).split(",")[0].strip()


@app.get("/api/portal/public")
def portal_public():
    return portal.public()


@app.get("/api/portal/media/{name}")
def portal_media(name: str):
    p = portal.media_path(name)
    if not p:
        raise HTTPException(404, "arquivo não encontrado")
    d = portal.load()
    item = next((m for col in ("media", "episodes") for m in d[col] if name in (m.get("file"), m.get("audio"))), None)
    if not item or item.get("status") != "publicado":
        raise HTTPException(404, "arquivo não publicado")
    return FileResponse(p, headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api/portal/feed.xml")
def portal_rss():
    return Response(portal.rss(), media_type="application/rss+xml; charset=utf-8")


@app.get("/api/portal/podcast.xml")
def portal_podcast():
    return Response(portal.podcast_rss(), media_type="application/rss+xml; charset=utf-8")


@app.get("/api/portal/calendar.ics")
def portal_ics():
    return Response(portal.ics(), media_type="text/calendar; charset=utf-8")


class SubIn(BaseModel):
    email: str = Field(..., max_length=254); topics: List[str] = []; consent: bool = False


@app.post("/api/portal/subscribe")
def portal_subscribe(p: SubIn, req: Request):
    if not portal.throttle(_ip(req)):
        raise HTTPException(429, "Muitas tentativas. Tente de novo em alguns minutos.")
    try:
        return portal.subscribe(p.email, p.topics, p.consent)
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.get("/api/portal/unsubscribe", response_class=PlainTextResponse)
def portal_unsubscribe(token: str):
    return "Inscrição cancelada. Seu e-mail foi apagado." if portal.unsubscribe(token) else "Link inválido ou já utilizado."


class SupIn(BaseModel):
    name: str = Field("", max_length=120); email: str = Field("", max_length=254); topic: str = Field("geral", max_length=40); message: str = Field(..., max_length=5000)


@app.post("/api/portal/support")
def portal_support(p: SupIn, req: Request):
    if not portal.throttle("s:" + _ip(req), limit=4):
        raise HTTPException(429, "Muitas mensagens seguidas. Tente de novo em alguns minutos.")
    try:
        return portal.support(p.name, p.email, p.topic, p.message)
    except ValueError as e:
        raise HTTPException(422, str(e))


# ---- administração (Authorization: Bearer <ADMIN_TOKEN>)
@app.get("/api/portal/admin/all")
def portal_admin_all(authorization: Optional[str] = Header(None)):
    _admin(authorization); d = portal.load()
    return {**{k: d[k] for k in portal.SCHEMA}, "tickets": d["tickets"], "subscribers": len(d["subscribers"]), "log": d["log"][-30:],
            "smtp": portal.smtp_ready(), "tts": bool(os.getenv("OPENAI_API_KEY")), "ai": ai.status() if hasattr(ai, "status") else None}


class OpsIn(BaseModel):
    ops: List[Dict] = Field(..., max_length=100)


@app.post("/api/portal/admin/apply")
def portal_admin_apply(p: OpsIn, authorization: Optional[str] = Header(None)):
    _admin(authorization); return portal.apply_ops(p.ops)


class AssistIn(BaseModel):
    prompt: str = Field(..., max_length=4000); material: str = Field("", max_length=12000)


@app.post("/api/portal/admin/assist")
def portal_admin_assist(p: AssistIn, authorization: Optional[str] = Header(None)):
    _admin(authorization); return portal.assist(p.prompt, p.material)


@app.post("/api/portal/admin/upload")
async def portal_admin_upload(req: Request, title: str = "", kind: str = "", category: str = "galeria", authorization: Optional[str] = Header(None)):
    _admin(authorization)
    raw = await req.body()
    try:
        return portal.store_upload(raw, (req.headers.get("content-type") or "").split(";")[0].strip(), title, kind, category)
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.get("/api/portal/admin/media/{name}")
def portal_admin_media(name: str, authorization: Optional[str] = Header(None)):
    _admin(authorization); p = portal.media_path(name)
    if not p:
        raise HTTPException(404, "arquivo não encontrado")
    return FileResponse(p)


@app.post("/api/portal/admin/episodes/{eid}/tts")
def portal_admin_tts(eid: str, authorization: Optional[str] = Header(None)):
    _admin(authorization); return portal.tts(eid)


@app.get("/api/portal/admin/subscribers.csv", response_class=PlainTextResponse)
def portal_admin_csv(authorization: Optional[str] = Header(None)):
    _admin(authorization); return PlainTextResponse(portal.subscribers_csv(), media_type="text/csv; charset=utf-8")


@app.get("/api/portal/admin/newsletter/draft")
def portal_admin_nl_draft(authorization: Optional[str] = Header(None)):
    _admin(authorization); return portal.newsletter_draft()


class NlIn(BaseModel):
    subject: str = Field(..., max_length=180); html: str = Field(..., max_length=60000); test_to: str = Field("", max_length=254)


@app.post("/api/portal/admin/newsletter/send")
def portal_admin_nl_send(p: NlIn, authorization: Optional[str] = Header(None)):
    _admin(authorization); return portal.send_newsletter(p.subject, p.html, p.test_to)


class TkIn(BaseModel):
    state: str = Field(..., max_length=20); notes: str = Field("", max_length=5000)


@app.post("/api/portal/admin/tickets/{tid}")
def portal_admin_ticket(tid: str, p: TkIn, authorization: Optional[str] = Header(None)):
    _admin(authorization)
    if not portal.ticket_update(tid, p.state, p.notes):
        raise HTTPException(404, "chamado não encontrado")
    return {"ok": True}


class PatIn(BaseModel):
    text: str = Field(..., max_length=2000)


@app.post("/api/ai/patient")
def ai_patient(p: PatIn):
    return ai.patient(p.text)


class PlanIn(BaseModel):
    facts: Dict = Field(...)


@app.post("/api/ai/plan")
def ai_plan(p: PlanIn):
    return ai.plan_text(p.facts)
