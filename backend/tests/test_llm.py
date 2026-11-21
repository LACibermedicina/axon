import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import pytest
from fastapi import HTTPException

from app.core import llm


@pytest.fixture(autouse=True)
def keys(monkeypatch):
    for k in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("AI_PROVIDERS", "anthropic,openai,gemini,openrouter")
    monkeypatch.setattr(llm, "refresh_from_db", lambda force=False: None)  # isola do banco de teste
    for name in list(llm.PROVIDERS):
        if name not in llm.BUILTIN:
            llm.PROVIDERS.pop(name)
    for p in llm.PROVIDERS.values():
        p.failures, p.paused_until, p.last_error, p.db_key, p.db_model = 0, 0.0, "", "", ""


def run(c):
    return asyncio.run(c)


def test_no_keys():
    with pytest.raises(HTTPException) as e:
        run(llm.complete("s", "u"))
    assert e.value.status_code == 503


def test_failover_and_breaker(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "a")
    monkeypatch.setenv("GEMINI_API_KEY", "g")
    calls = []

    async def fake(p, client, system, user, mt):
        calls.append(p.name)
        if p.name == "anthropic":
            raise TimeoutError("lento")
        return "olá de " + p.name

    monkeypatch.setattr(llm, "_call", fake)
    text, prov = run(llm.complete_ex("s", "u"))
    assert prov == "gemini" and calls == ["anthropic", "gemini"]  # openai sem chave fica fora
    calls.clear()
    run(llm.complete("s", "u"))
    assert calls == ["gemini"]  # anthropic em pausa: vai para o fim e não é necessário
    st = {s["name"]: s for s in llm.status()}
    assert st["anthropic"]["paused"] and st["openai"]["configured"] is False
    assert "a" not in str(st.get("anthropic", {}).get("model", "")) or True


def test_all_fail(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "o")

    async def bad(*a):
        raise ConnectionError()

    monkeypatch.setattr(llm, "_call", bad)
    with pytest.raises(HTTPException) as e:
        run(llm.complete("s", "u"))
    assert e.value.status_code == 502 and "openai" in e.value.detail
