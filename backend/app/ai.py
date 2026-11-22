"""axon · Microsserviço de IA contextual (tradutor App 7 e Axon Bot App 8).

Chaves vêm SOMENTE do ambiente do container (.env da VPS em /opt/axon/.env), que o
GitHub Actions preenche a partir do secret `SERVIDOR_ENV` (formato .env) e/ou de
secrets individuais — job `sync-ai-env` → scripts/merge-env.sh (lista permitida).
Convenção idêntica à das demais apps LACibermedicina na mesma VPS.

Regras de integridade científica:
  • A IA NUNCA produz números exibidos como resultado. Números vêm do núcleo
    (core/*) com etiqueta de procedência; a IA só explica, traduz ou resume.
  • Toda resposta da IA é marcada [HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO] quando
    trata de efeito esperado, e traz a origem (provedor/modelo) para auditoria.
  • LGPD: só texto de interface/consulta é enviado — nunca dados pessoais.
  • Chaves nunca são logadas nem devolvidas pela API.
Failover: AI_PROVIDERS define a ordem; provedor que falha entra em pausa (AI_COOLDOWN_S).
Sem nenhuma chave, as rotas respondem com fallback offline (dicionários i18n e FAQ do livro).
"""
from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Dict, List, Optional

log = logging.getLogger("axon.ai")

DEFAULT_ORDER = "anthropic,openai,groq,gemini,github,cerebras,mistral,openrouter,deepseek,xai,together"


@dataclass
class Provider:
    name: str
    key_envs: tuple
    model_env: str
    default_model: str
    kind: str                 # anthropic | openai | gemini
    url: str = ""
    paused_until: float = 0.0
    failures: int = 0

    def key(self) -> str:
        for k in self.key_envs:
            v = os.getenv(k, "").strip().strip('"').strip("'")
            if v:
                return v
        return ""

    def model(self) -> str:
        return os.getenv(self.model_env, "").strip() or self.default_model


PROVIDERS: Dict[str, Provider] = {p.name: p for p in [
    Provider("anthropic", ("ANTHROPIC_API_KEY", "CLAUDE_API_KEY"), "AI_MODEL", "claude-sonnet-4-5", "anthropic",
             "https://api.anthropic.com/v1/messages"),
    Provider("openai", ("OPENAI_API_KEY",), "OPENAI_MODEL", "gpt-4o-mini", "openai",
             "https://api.openai.com/v1/chat/completions"),
    Provider("groq", ("GROQ_API_KEY",), "GROQ_MODEL", "llama-3.3-70b-versatile", "openai",
             "https://api.groq.com/openai/v1/chat/completions"),
    Provider("gemini", ("GEMINI_API_KEY", "GOOGLE_API_KEY"), "GEMINI_MODEL", "gemini-2.5-flash", "gemini",
             "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"),
    Provider("github", ("GITHUB_MODELS_TOKEN",), "GITHUB_MODELS_MODEL", "openai/gpt-4.1-mini", "openai",
             "https://models.github.ai/inference/chat/completions"),
    Provider("cerebras", ("CEREBRAS_API_KEY",), "CEREBRAS_MODEL", "llama3.1-8b", "openai",
             "https://api.cerebras.ai/v1/chat/completions"),
    Provider("mistral", ("MISTRAL_API_KEY",), "MISTRAL_MODEL", "mistral-small-latest", "openai",
             "https://api.mistral.ai/v1/chat/completions"),
    Provider("openrouter", ("OPENROUTER_API_KEY",), "OPENROUTER_MODEL", "openrouter/free", "openai",
             "https://openrouter.ai/api/v1/chat/completions"),
    Provider("deepseek", ("DEEPSEEK_API_KEY",), "DEEPSEEK_MODEL", "deepseek-chat", "openai",
             "https://api.deepseek.com/chat/completions"),
    Provider("xai", ("XAI_API_KEY",), "XAI_MODEL", "grok-3-mini", "openai",
             "https://api.x.ai/v1/chat/completions"),
    Provider("together", ("TOGETHER_API_KEY",), "TOGETHER_MODEL", "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free", "openai",
             "https://api.together.xyz/v1/chat/completions"),
]}


def chain() -> List[Provider]:
    """Provedores com chave, na ordem de AI_PROVIDERS (os demais configurados vão ao fim)."""
    order = [s.strip() for s in os.getenv("AI_PROVIDERS", DEFAULT_ORDER).split(",") if s.strip()]
    order += [n for n in PROVIDERS if n not in order]
    return [PROVIDERS[n] for n in order if n in PROVIDERS and PROVIDERS[n].key()]


def status() -> Dict:
    """Estado público (sem chaves) — exibido no painel de administração."""
    now = time.time()
    return {"configured": [p.name for p in chain()],
            "paused": [p.name for p in chain() if p.paused_until > now],
            "source": "SERVIDOR_ENV/secrets do GitHub → /opt/axon/.env",
            "offline_fallback": True}


def _post(url: str, headers: Dict, body: Dict, timeout: float) -> Dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={**headers, "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:   # noqa: S310 (URLs fixas acima)
        return json.loads(r.read().decode())


def _call(p: Provider, system: str, user: str, max_tokens: int, timeout: float) -> str:
    key, model = p.key(), p.model()
    if p.kind == "anthropic":
        d = _post(p.url, {"x-api-key": key, "anthropic-version": "2023-06-01"},
                  {"model": model, "max_tokens": max_tokens, "system": system,
                   "messages": [{"role": "user", "content": user}]}, timeout)
        return "".join(b.get("text", "") for b in d.get("content", []))
    if p.kind == "gemini":
        d = _post(p.url.format(model=model) + f"?key={key}", {},
                  {"systemInstruction": {"parts": [{"text": system}]},
                   "contents": [{"role": "user", "parts": [{"text": user}]}],
                   "generationConfig": {"maxOutputTokens": max_tokens}}, timeout)
        return "".join(pt.get("text", "") for pt in d["candidates"][0]["content"]["parts"])
    d = _post(p.url, {"authorization": f"Bearer {key}"},
              {"model": model, "max_tokens": max_tokens,
               "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}, timeout)
    return d["choices"][0]["message"]["content"]


def complete(system: str, user: str, max_tokens: int = 800) -> Optional[Dict]:
    """Tenta cada provedor da cadeia. None se todos falharem ou não houver chave."""
    timeout = float(os.getenv("AI_TIMEOUT_S", "45")); cool = float(os.getenv("AI_COOLDOWN_S", "60"))
    now = time.time()
    for p in chain():
        if p.paused_until > now:
            continue
        try:
            text = _call(p, system, user, max_tokens, timeout)
            p.failures = 0
            return {"text": text.strip(), "provider": p.name, "model": p.model()}
        except (urllib.error.URLError, KeyError, IndexError, ValueError, TimeoutError) as e:
            p.failures += 1; p.paused_until = time.time() + cool * min(p.failures, 10)
            log.warning("provedor %s falhou (%s); próximo", p.name, type(e).__name__)
    return None


# --------------------------------------------------------------------------- usos
LANGS = {"pt": "Português (Brasil)", "en": "English", "es": "Español", "zh": "中文 (简体)", "hi": "हिन्दी"}

BOT_SYSTEM = (
    "Você é o Axon Bot, assistente didático da plataforma axon (pesquisa e ensino in silico; "
    "NÃO é dispositivo médico). Baseie-se no livro 'Biofísica da Neuromodulação' (Teixeira LS, Ibilce/UNESP, 2026). "
    "Regras: (1) nunca invente números; cite apenas os valores do modelo fornecidos no contexto, com a etiqueta de "
    "procedência; (2) nunca prescreva parâmetros para pessoas; (3) marque efeitos clínicos como "
    "[HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO]; (4) responda no idioma pedido, em até 180 palavras."
)

OFFLINE_FAQ = {
    "seletividade": "No modelo nodal verificado, a razão Aδ(3 µm)/Aβ(9 µm) a 1 mm é 3,21 [RESULTADO DE MODELO - SEMENTE 42]. "
                    "Selecionar nociceptores por amplitude não funciona, por razões geométricas (Cap. 7).",
    "taVNS": "A cymba conchae é inervada pelo ramo auricular do vago em 100% dos espécimes [LITERATURA: Peuker & Filler 2002]. "
             "Efeitos analgésicos: [HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO].",
    "shannon": "k = log10(D) + log10(Q); k < 1,75 é a referência conservadora [LITERATURA: Shannon 1992].",
}


def bot_answer(question: str, lang: str = "pt", context: Optional[Dict] = None) -> Dict:
    ctx = json.dumps(context or {}, ensure_ascii=False)[:4000]
    r = complete(BOT_SYSTEM, f"Idioma: {LANGS.get(lang, lang)}\nContexto do modelo: {ctx}\nPergunta: {question}")
    if r:
        return {**r, "tag": "HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO", "mode": "ia"}
    q = question.lower()
    for k, v in OFFLINE_FAQ.items():
        if k.lower() in q:
            return {"text": v, "mode": "offline", "tag": "LITERATURA"}
    return {"text": "Modo offline: consulte o Manual do Usuário e o Anexo F do livro.", "mode": "offline", "tag": "PREMISSA"}


def translate(texts: List[str], target: str) -> Dict:
    if target not in LANGS:
        raise ValueError("idioma não suportado")
    if target == "pt":
        return {"texts": texts, "mode": "identity"}
    sys = ("Translate scientific UI strings. Keep symbols, units, Greek letters, equations and provenance tags "
           "like [LITERATURA] unchanged. Return a JSON array of strings only.")
    r = complete(sys, f"Target: {LANGS[target]}\n{json.dumps(texts, ensure_ascii=False)}", max_tokens=2000)
    if r:
        try:
            out = json.loads(r["text"][r["text"].find("["): r["text"].rfind("]") + 1])
            if isinstance(out, list) and len(out) == len(texts):
                return {"texts": out, "mode": "ia", "provider": r["provider"]}
        except ValueError:
            pass
    return {"texts": texts, "mode": "offline", "note": "Use os dicionários i18n estáticos do frontend."}
