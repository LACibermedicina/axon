"""axon · diário de bordo publicado (link só-leitura) e comentários.

Cada publicação guarda o HTML gerado pelo navegador (renderizado na página pública dentro de um iframe
isolado, sem scripts), título, autor e contadores. Um token de edição devolvido ao autor permite apagar.
Comentários: nome + texto curtos, com limite de taxa por IP. Armazenamento em PORTAL_DIR/logbook/<id>.json
com escrita atômica. Não aceitar dados de pacientes reais (aviso na interface antes de publicar).
"""
from __future__ import annotations

import html as _html
import json
import os
import re
import secrets
import time
from pathlib import Path
from typing import Any, Dict, List

from .portal import PORTAL_DIR

MAX_HTML = 6_000_000
ID_RE = re.compile(r"^[a-z0-9]{10}$")


def _dir() -> Path:
    d = PORTAL_DIR / "logbook"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _write(p: Path, data: Dict[str, Any]) -> None:
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, p)


def _clean(s: Any, n: int) -> str:
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(s or ""))[:n].strip()


def publish(title: str, author: str, html: str, notes: int = 0, sessions: int = 0) -> Dict[str, str]:
    if not html or len(html) > MAX_HTML:
        raise ValueError("conteúdo vazio ou maior que 6 MB")
    pid = secrets.token_hex(5)
    token = secrets.token_urlsafe(18)
    _write(_dir() / f"{pid}.json", {"id": pid, "token": token, "t": int(time.time()), "title": _clean(title, 160) or "Diário de bordo",
                                     "author": _clean(author, 80) or "Usuário do axon", "html": html, "notes": int(notes), "sessions": int(sessions), "comments": []})
    return {"id": pid, "token": token}


def get(pid: str, public: bool = True) -> Dict[str, Any]:
    if not ID_RE.match(pid or ""):
        raise KeyError(pid)
    p = _dir() / f"{pid}.json"
    if not p.exists():
        raise KeyError(pid)
    d = json.loads(p.read_text(encoding="utf-8"))
    if public:
        d.pop("token", None)
    return d


def comment(pid: str, name: str, text: str) -> Dict[str, Any]:
    d = get(pid, public=False)
    name, text = _clean(name, 60) or "Leitor", _clean(text, 2000)
    if len(text) < 2:
        raise ValueError("comentário vazio")
    if len(d["comments"]) >= 500:
        raise ValueError("limite de comentários atingido")
    c = {"id": len(d["comments"]) + 1, "t": int(time.time()), "name": _html.escape(name), "text": _html.escape(text)}
    d["comments"].append(c)
    _write(_dir() / f"{pid}.json", d)
    return c


def delete(pid: str, token: str) -> bool:
    d = get(pid, public=False)
    if not secrets.compare_digest(d.get("token", ""), token or ""):
        raise PermissionError("token inválido")
    (_dir() / f"{pid}.json").unlink()
    return True


def list_comments(pid: str) -> List[Dict[str, Any]]:
    return get(pid)["comments"]
