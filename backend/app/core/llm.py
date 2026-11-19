"""Cliente de IA com failover entre provedores (tradução contextual e assistente Maestro).

Ordem definida em AI_PROVIDERS (padrão: anthropic,openai,gemini,openrouter). Cada provedor só entra na
cadeia se a sua chave existir no .env da VPS. Em erro de rede, timeout, 429 ou 5xx o próximo é usado;
o provedor que falhou fica em "pausa" por AI_COOLDOWN_S segundos (circuit breaker), para não atrasar
as próximas requisições. Erros 4xx de configuração (chave inválida) também pulam para o próximo.

LGPD: só textos de interface e resumos musicais são enviados — nunca nome/e-mail de usuários.
Chaves NUNCA são logadas nem devolvidas pela API.
"""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field

import httpx
from fastapi import HTTPException

log = logging.getLogger("harmonia.llm")


@dataclass
class Provider:
    name: str
    key_env: str
    model_env: str
    default_model: str
    failures: int = 0
    paused_until: float = 0.0
    last_error: str = ""
    last_ok: float = 0.0
    calls: int = 0
    extra: dict = field(default_factory=dict)

    @property
    def key(self) -> str:
        return os.getenv(self.key_env, "").strip()

    @property
    def model(self) -> str:
        return os.getenv(self.model_env, "").strip() or self.default_model


PROVIDERS: dict[str, Provider] = {
    "anthropic": Provider("anthropic", "ANTHROPIC_API_KEY", "AI_MODEL", "claude-sonnet-4-5"),
    "openai": Provider("openai", "OPENAI_API_KEY", "OPENAI_MODEL", "gpt-4o-mini"),
    "gemini": Provider("gemini", "GEMINI_API_KEY", "GEMINI_MODEL", "gemini-2.0-flash"),
    "openrouter": Provider("openrouter", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct"),
}


def chain() -> list[Provider]:
    order = [p.strip() for p in os.getenv("AI_PROVIDERS", "anthropic,openai,gemini,openrouter").split(",") if p.strip()]
    return [PROVIDERS[n] for n in order if n in PROVIDERS and PROVIDERS[n].key]


async def _call(p: Provider, client: httpx.AsyncClient, system: str, user: str, max_tokens: int) -> str:
    if p.name == "anthropic":
        r = await client.post("https://api.anthropic.com/v1/messages",
                              headers={"x-api-key": p.key, "anthropic-version": "2023-06-01"},
                              json={"model": p.model, "max_tokens": max_tokens, "system": system,
                                    "messages": [{"role": "user", "content": user}]})
        r.raise_for_status()
        return "".join(b.get("text", "") for b in r.json().get("content", []))
    if p.name in ("openai", "openrouter"):
        url = "https://api.openai.com/v1/chat/completions" if p.name == "openai" else "https://openrouter.ai/api/v1/chat/completions"
        headers = {"Authorization": f"Bearer {p.key}"}
        if p.name == "openrouter":
            headers |= {"HTTP-Referer": os.getenv("PUBLIC_BASE_URL", "https://harmonia.m3d.pro"), "X-Title": "harmonIA"}
        r = await client.post(url, headers=headers,
                              json={"model": p.model, "max_tokens": max_tokens,
                                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]})
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"] or ""
    if p.name == "gemini":
        r = await client.post(f"https://generativelanguage.googleapis.com/v1beta/models/{p.model}:generateContent",
                              headers={"x-goog-api-key": p.key},
                              json={"systemInstruction": {"parts": [{"text": system}]},
                                    "contents": [{"role": "user", "parts": [{"text": user}]}],
                                    "generationConfig": {"maxOutputTokens": max_tokens}})
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
        raise HTTPException(503, "IA não configurada: defina ao menos uma chave (ANTHROPIC_API_KEY, OPENAI_API_KEY, "
                                 "GEMINI_API_KEY ou OPENROUTER_API_KEY) no .env do servidor")
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
    order = [p.strip() for p in os.getenv("AI_PROVIDERS", "anthropic,openai,gemini,openrouter").split(",") if p.strip()]
    now = time.time()
    return [{"name": n, "configured": bool(PROVIDERS[n].key), "model": PROVIDERS[n].model, "position": i + 1,
             "paused": PROVIDERS[n].paused_until > now, "failures": PROVIDERS[n].failures,
             "lastError": PROVIDERS[n].last_error, "lastOk": PROVIDERS[n].last_ok or None, "calls": PROVIDERS[n].calls}
            for i, n in enumerate(order) if n in PROVIDERS]
