"""IA contextual: tradução de tudo o que está na tela (com cache) e assistente/avatar musical.
LGPD: nenhum dado pessoal (nome, e-mail) é enviado ao provedor de IA — apenas textos de UI e um
resumo musical da composição aberta, quando o próprio usuário pergunta."""
import hashlib
import json

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..core.config import settings
from ..core.security import current_user, optional_user
from .media import rds

router = APIRouter(prefix="/api/ai", tags=["ai"])
LANGS = {"zh": "Mandarim (chinês simplificado)", "es": "Espanhol", "en": "Inglês", "hi": "Hindi", "pt": "Português do Brasil"}


async def _claude(system: str, user: str, max_tokens: int = 2000) -> str:
    s = settings()
    if not s.anthropic_key:
        raise HTTPException(503, "IA não configurada (ANTHROPIC_API_KEY ausente)")
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post("https://api.anthropic.com/v1/messages",
                         headers={"x-api-key": s.anthropic_key, "anthropic-version": "2023-06-01"},
                         json={"model": s.ai_model, "max_tokens": max_tokens, "system": system,
                               "messages": [{"role": "user", "content": user}]})
    if r.status_code >= 400:
        raise HTTPException(502, "Falha no provedor de IA")
    return "".join(b.get("text", "") for b in r.json().get("content", []))


class TranslateIn(BaseModel):
    target: str = Field(pattern="^(zh|es|en|hi|pt)$")
    texts: list[str] = Field(max_length=400)
    context: str = "Interface de app de composição musical e partitura para piano"


@router.post("/translate")
async def translate(body: TranslateIn, _=Depends(optional_user)):
    """Traduz em lote preservando termos musicais (cifras, nomes de notas, dinâmicas) e placeholders."""
    out: dict[str, str] = {}
    missing = []
    for t in dict.fromkeys(body.texts):
        k = "harmonia:tr:" + body.target + ":" + hashlib.sha1(t.encode()).hexdigest()
        cached = rds().get(k)
        if cached is not None:
            out[t] = cached
        else:
            missing.append(t)
    if missing:
        system = ("Você é um tradutor técnico-musical. Traduza cada string para " + LANGS[body.target] +
                  ". Preserve exatamente: cifras (C7M, Am7(b5)), nomes de notas, termos italianos de dinâmica "
                  "(p, mf, crescendo), números, {placeholders}, emojis e quebras de linha. Mantenha comprimento "
                  "próximo ao original para não quebrar o layout. Responda SOMENTE com um array JSON de strings, "
                  "na mesma ordem.")
        txt = await _claude(system, f"Contexto: {body.context}\n\n" + json.dumps(missing, ensure_ascii=False), 4000)
        try:
            arr = json.loads(txt[txt.index("["): txt.rindex("]") + 1])
        except (ValueError, json.JSONDecodeError):
            raise HTTPException(502, "Resposta de tradução inválida")
        for src, dst in zip(missing, arr):
            out[src] = dst
            rds().setex("harmonia:tr:" + body.target + ":" + hashlib.sha1(src.encode()).hexdigest(), 60 * 60 * 24 * 30, dst)
    return {"target": body.target, "translations": out}


class AskIn(BaseModel):
    question: str = Field(max_length=2000)
    lang: str = "pt"
    score_summary: dict | None = None  # título, tom, compassos, acordes, camadas (sem dados pessoais)


@router.post("/assistant")
async def assistant(body: AskIn, _user=Depends(current_user)):
    system = ("Você é o Maestro, assistente didático do harmonIA. Explique teoria musical, harmonia, leitura "
              "de partitura e o uso do editor (camadas, drag & drop, harmonização, gravação, exportação) de forma "
              "curta, encorajadora e precisa. Quando sugerir acordes use cifra brasileira. Responda em " +
              LANGS.get(body.lang, "Português do Brasil") + ". Nunca peça dados pessoais.")
    ctx = json.dumps(body.score_summary, ensure_ascii=False)[:6000] if body.score_summary else "nenhuma"
    answer = await _claude(system, f"Composição aberta: {ctx}\n\nPergunta: {body.question}", 900)
    return {"answer": answer}
