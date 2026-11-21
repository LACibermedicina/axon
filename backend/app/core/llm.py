"""Cliente de IA com failover entre provedores (tradução contextual e assistente Maestro).

Provedores (entram na cadeia só se a chave existir no .env da VPS):
  pagos/assinatura: anthropic, openai
  gratuitos (free tier, sem cartão): groq, gemini, github (GitHub Models), cerebras, mistral, openrouter (openrouter/free)
Ordem: AI_PROVIDERS (os configurados que não estiverem na lista entram no fim, para nenhuma chave ficar ociosa).
Em erro de rede, timeout, 429, 5xx ou chave inválida, o próximo provedor responde; o que falhou fica em pausa
crescente (circuit breaker, AI_COOLDOWN_S). Se TODOS falharem, as rotas usam fallbacks sem IA generativa
(tradução gratuita MyMemory e respostas do Maestro offline) — as funcionalidades sempre respondem.

LGPD: só textos de interface e resumos musicais são enviados — nunca nome/e-mail de usuários.
Chaves NUNCA são logadas nem devolvidas pela API.
"""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass

import httpx
from fastapi import HTTPException

log = logging.getLogger("harmonia.llm")
DEFAULT_ORDER = "anthropic,openai,groq,gemini,github,cerebras,mistral,openrouter"


@dataclass
class Provider:
    name: str
    label: str
    key_envs: tuple[str, ...]          # aceita nomes alternativos (ex.: GOOGLE_API_KEY)
    model_env: str
    default_model: str
    kind: str                          # anthropic | openai | gemini
    url: str = ""
    free: bool = False
    db_key: str = ""                   # cadastrada no painel (sobrepõe o .env)
    db_model: str = ""
    source: str = "env"
    custom: bool = False
    failures: int = 0
    paused_until: float = 0.0
    last_error: str = ""
    last_ok: float = 0.0
    calls: int = 0

    @property
    def key(self) -> str:
        if self.db_key:
            return self.db_key
        for k in self.key_envs:
            v = os.getenv(k, "").strip().strip('"').strip("'")
            if v:
                return v
        return ""

    @property
    def model(self) -> str:
        return self.db_model or os.getenv(self.model_env, "").strip() or self.default_model

    @property
    def key_source(self) -> str:
        if self.db_key:
            return "painel"
        return "env" if any(os.getenv(k, "").strip() for k in self.key_envs) else ""


PROVIDERS: dict[str, Provider] = {p.name: p for p in [
    Provider("anthropic", "Anthropic Claude", ("ANTHROPIC_API_KEY", "CLAUDE_API_KEY"), "AI_MODEL", "claude-sonnet-4-5", "anthropic"),
    Provider("openai", "OpenAI", ("OPENAI_API_KEY",), "OPENAI_MODEL", "gpt-4o-mini", "openai",
             "https://api.openai.com/v1/chat/completions"),
    Provider("groq", "Groq (gratuito)", ("GROQ_API_KEY",), "GROQ_MODEL", "llama-3.3-70b-versatile", "openai",
             "https://api.groq.com/openai/v1/chat/completions", free=True),
    Provider("gemini", "Google Gemini (gratuito)", ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_AI_API_KEY"), "GEMINI_MODEL",
             "gemini-2.5-flash", "gemini", free=True),
    Provider("github", "GitHub Models (gratuito)", ("GITHUB_MODELS_TOKEN", "GH_MODELS_TOKEN"), "GITHUB_MODELS_MODEL",
             "openai/gpt-4.1-mini", "openai", "https://models.github.ai/inference/chat/completions", free=True),
    Provider("cerebras", "Cerebras (gratuito)", ("CEREBRAS_API_KEY",), "CEREBRAS_MODEL", "llama3.1-8b", "openai",
             "https://api.cerebras.ai/v1/chat/completions", free=True),
    Provider("mistral", "Mistral (gratuito)", ("MISTRAL_API_KEY",), "MISTRAL_MODEL", "mistral-small-latest", "openai",
             "https://api.mistral.ai/v1/chat/completions", free=True),
    Provider("openrouter", "OpenRouter (modelos :free)", ("OPENROUTER_API_KEY",), "OPENROUTER_MODEL", "openrouter/free", "openai",
             "https://openrouter.ai/api/v1/chat/completions", free=True),
]}


BUILTIN = set(PROVIDERS)
_loaded_at = 0.0


def refresh_from_db(force: bool = False) -> None:
    """Carrega credenciais cadastradas no painel (cache de 30 s; cada worker do uvicorn recarrega sozinho)."""
    global _loaded_at
    if not force and time.time() - _loaded_at < 30:
        return
    _loaded_at = time.time()
    try:
        from sqlalchemy import select

        from ..models import AICredential
        from .db import SessionLocal
        from .security import decrypt
        with SessionLocal() as db:
            rows = list(db.scalars(select(AICredential)))
    except Exception as e:  # noqa: BLE001 — banco fora: segue só com o .env
        log.warning("credenciais do painel indisponíveis: %s", type(e).__name__)
        return
    seen = set()
    for r in rows:
        seen.add(r.name)
        try:
            key = decrypt(r.key_enc) if r.enabled else ""
        except Exception:  # noqa: BLE001
            key = ""
        p = PROVIDERS.get(r.name)
        if p is None:
            p = PROVIDERS[r.name] = Provider(r.name, r.label or r.name, (), "", r.model or "", r.kind, r.url, free=r.free, custom=True)
        p.db_key, p.db_model, p.source = key, r.model or "", "painel"
        if p.custom:
            p.kind, p.url, p.label, p.default_model, p.free = r.kind, r.url, r.label or r.name, r.model or p.default_model, r.free
    for name in list(PROVIDERS):
        if name not in seen:
            if name in BUILTIN:
                PROVIDERS[name].db_key = PROVIDERS[name].db_model = ""
            else:
                PROVIDERS.pop(name)


def order() -> list[str]:
    listed = [p.strip() for p in (os.getenv("AI_PROVIDERS") or DEFAULT_ORDER).split(",") if p.strip() in PROVIDERS]
    rest = [n for n in DEFAULT_ORDER.split(",") if n not in listed]
    custom = [n for n in PROVIDERS if n not in listed and n not in rest]
    return listed + rest + custom


def chain() -> list[Provider]:
    refresh_from_db()
    return [PROVIDERS[n] for n in order() if PROVIDERS[n].key]


async def _call(p: Provider, client: httpx.AsyncClient, system: str, user: str, max_tokens: int) -> str:
    if p.kind == "anthropic":
        r = await client.post("https://api.anthropic.com/v1/messages",
                              headers={"x-api-key": p.key, "anthropic-version": "2023-06-01"},
                              json={"model": p.model, "max_tokens": max_tokens, "system": system,
                                    "messages": [{"role": "user", "content": user}]})
        r.raise_for_status()
        return "".join(b.get("text", "") for b in r.json().get("content", []))
    if p.kind == "openai":
        headers = {"Authorization": f"Bearer {p.key}"}
        if p.name == "openrouter":
            headers |= {"HTTP-Referer": os.getenv("PUBLIC_BASE_URL", "https://harmonia.m3d.pro"), "X-Title": "harmonIA"}
        if p.name == "github":
            headers |= {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        r = await client.post(p.url, headers=headers,
                              json={"model": p.model, "max_tokens": max_tokens, "temperature": 0.3,
                                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]})
        r.raise_for_status()
        msg = r.json()["choices"][0]["message"]
        return msg.get("content") or ""
    if p.kind == "gemini":
        r = await client.post(f"https://generativelanguage.googleapis.com/v1beta/models/{p.model}:generateContent",
                              headers={"x-goog-api-key": p.key},
                              json={"systemInstruction": {"parts": [{"text": system}]},
                                    "contents": [{"role": "user", "parts": [{"text": user}]}],
                                    "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.3}})
        r.raise_for_status()
        cands = r.json().get("candidates") or []
        return "".join(part.get("text", "") for part in (cands[0].get("content", {}).get("parts", []) if cands else []))
    raise ValueError(p.name)


async def complete(system: str, user: str, max_tokens: int = 2000, timeout: float | None = None) -> str:
    return (await complete_ex(system, user, max_tokens, timeout))[0]


async def complete_ex(system: str, user: str, max_tokens: int = 2000, timeout: float | None = None) -> tuple[str, str]:
    """Como complete(), mas devolve também o nome do provedor que respondeu."""
    providers = chain()
    if not providers:
        raise HTTPException(503, "Nenhum provedor de IA configurado no servidor")
    cooldown = float(os.getenv("AI_COOLDOWN_S", "60"))
    now = time.time()
    # provedores em pausa vão para o fim da fila (ainda são tentados se todos estiverem pausados)
    ordered = [p for p in providers if p.paused_until <= now] + [p for p in providers if p.paused_until > now]
    errors = []
    async with httpx.AsyncClient(timeout=timeout or float(os.getenv("AI_TIMEOUT_S", "45"))) as client:
        for p in ordered:
            p.calls += 1
            try:
                text = await _call(p, client, system, user, max_tokens)
                if not text.strip():
                    raise ValueError("resposta vazia")
                p.failures, p.last_ok, p.last_error, p.paused_until = 0, time.time(), "", 0.0
                return text, p.name
            except Exception as e:  # noqa: BLE001
                code = getattr(getattr(e, "response", None), "status_code", None)
                p.failures += 1
                p.last_error = f"HTTP {code}" if code else type(e).__name__
                p.paused_until = time.time() + cooldown * min(p.failures, 10)
                errors.append(f"{p.name}: {p.last_error}")
                log.warning("IA %s falhou (%s) — tentando o próximo provedor", p.name, p.last_error)
    raise HTTPException(502, "Todos os provedores de IA falharam: " + "; ".join(errors))


def status() -> list[dict]:
    refresh_from_db()
    now = time.time()
    out = []
    for i, n in enumerate(order()):
        p = PROVIDERS[n]
        k = p.key
        out.append({"name": n, "label": p.label, "free": p.free, "configured": bool(k), "model": p.model,
                    "keySource": p.key_source, "keyHint": ("••••" + k[-4:]) if len(k) > 8 else ("••••" if k else ""),
                    "custom": p.custom, "kind": p.kind, "url": p.url if p.custom else "",
                    "position": i + 1, "paused": p.paused_until > now, "failures": p.failures,
                    "lastError": p.last_error, "lastOk": p.last_ok or None, "calls": p.calls})
    return out


ERROR_HINTS = {
    400: "requisição recusada (modelo ou parâmetros inválidos)", 401: "chave inválida ou expirada",
    403: "sem permissão para este modelo/conta", 404: "modelo ou endpoint não encontrado",
    408: "tempo esgotado no provedor", 429: "limite de uso atingido (cota grátis ou por minuto)",
    500: "erro interno do provedor", 502: "provedor indisponível", 503: "provedor sobrecarregado", 504: "provedor não respondeu a tempo",
}


async def diagnose(names: list[str] | None = None, timeout: float = 20) -> list[dict]:
    """Testa cada provedor isoladamente (em paralelo), sem afetar o circuit breaker."""
    import asyncio
    refresh_from_db(force=True)
    targets = [PROVIDERS[n] for n in order() if (names is None or n in names)]

    async def one(p: Provider, client: httpx.AsyncClient) -> dict:
        base = {"name": p.name, "label": p.label, "model": p.model, "free": p.free, "keySource": p.key_source}
        if not p.key:
            return base | {"ok": False, "state": "sem_chave", "detail": "sem chave cadastrada"}
        t0 = time.time()
        try:
            text = await _call(p, client, "Você é um teste de conectividade. Responda apenas: ok", "teste", 16)
            ms = int((time.time() - t0) * 1000)
            if not text.strip():
                return base | {"ok": False, "state": "erro", "ms": ms, "detail": "resposta vazia"}
            p.failures, p.paused_until, p.last_error, p.last_ok = 0, 0.0, "", time.time()
            return base | {"ok": True, "state": "ok", "ms": ms, "reply": text.strip()[:40]}
        except Exception as e:  # noqa: BLE001
            code = getattr(getattr(e, "response", None), "status_code", None)
            detail = ERROR_HINTS.get(code, "") if code else ("tempo esgotado" if "Timeout" in type(e).__name__ else "falha de rede/conexão")
            return base | {"ok": False, "state": "erro", "ms": int((time.time() - t0) * 1000),
                           "code": code, "detail": detail or f"HTTP {code}"}

    async with httpx.AsyncClient(timeout=timeout) as client:
        results = list(await asyncio.gather(*(one(p, client) for p in targets)))
    # fallbacks gratuitos sem chave
    t0 = time.time()
    mm = await free_translate(["Tocar"], "en")
    results.append({"name": "mymemory", "label": "MyMemory (tradução grátis, sem chave)", "free": True, "keySource": "—",
                    "model": "—", "ok": bool(mm), "state": "ok" if mm else "erro", "ms": int((time.time() - t0) * 1000),
                    "detail": "" if mm else "indisponível ou cota diária esgotada"})
    results.append({"name": "offline", "label": "Maestro offline (local)", "free": True, "keySource": "—", "model": "—",
                    "ok": True, "state": "ok", "ms": 0, "detail": "sempre disponível"})
    return results


# ------------------------------------------------------- fallbacks sem chave
MYMEMORY_LANG = {"zh": "zh-CN", "es": "es-ES", "en": "en-GB", "hi": "hi-IN", "pt": "pt-BR"}


async def free_translate(texts: list[str], target: str, source: str = "pt") -> dict[str, str]:
    """Tradução gratuita (MyMemory, sem chave). Agrupa textos curtos para economizar a cota diária."""
    sep = "\n¶\n"
    out: dict[str, str] = {}
    email = os.getenv("MYMEMORY_EMAIL", "").strip()
    batches, cur = [], []
    for t in texts:
        if len(sep.join(cur + [t]).encode()) > 450 and cur:
            batches.append(cur); cur = []
        cur.append(t)
    if cur:
        batches.append(cur)
    async with httpx.AsyncClient(timeout=12) as client:
        for b in batches:
            params = {"q": sep.join(b), "langpair": f"{MYMEMORY_LANG.get(source, source)}|{MYMEMORY_LANG.get(target, target)}"}
            if email:
                params["de"] = email
            try:
                r = await client.get("https://api.mymemory.translated.net/get", params=params)
                txt = r.json().get("responseData", {}).get("translatedText", "")
            except Exception:  # noqa: BLE001
                break
            parts = [x.strip() for x in txt.split("¶")]
            if len(parts) == len(b):
                out.update({src: dst for src, dst in zip(b, parts) if dst and "MYMEMORY WARNING" not in dst})
            elif len(b) == 1 and txt:
                out[b[0]] = txt.strip()
    return out
