"""Portal do projeto: notícias, agenda, linha do tempo, mídia, podcast, newsletter e apoio.

Armazenamento: um arquivo JSON em PORTAL_DIR (volume persistente data/portal), com trava de arquivo,
e as mídias enviadas em PORTAL_DIR/media. Nada aqui é dado de paciente; o cadastro da newsletter guarda
só e-mail, temas e a data do consentimento (LGPD), com descadastro por link.

Administração: token em ADMIN_TOKEN (.env). O assistente de IA nunca altera nada sozinho: ele devolve uma
proposta de operações que o administrador revisa e aplica. Itens novos nascem como rascunho; só o que o
administrador publica aparece no site, nos feeds e na playlist.
"""
from __future__ import annotations

import csv
import datetime as dt
import fcntl
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import smtplib
import ssl
import time
import urllib.request
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Dict, List, Optional
from xml.sax.saxutils import escape as xesc

from . import ai

PORTAL_DIR = Path(os.getenv("PORTAL_DIR", "/srv/portal"))
SEED = Path(__file__).with_name("seed_portal.json")
SITE = os.getenv("SITE_URL", "https://" + os.getenv("SUBDOMINIO", "axon.m3d.pro"))
MAX_UPLOAD = int(os.getenv("PORTAL_MAX_UPLOAD_MB", "80")) * 1024 * 1024

# esquema: campos aceitos por coleção (o resto é descartado) — vale para a IA e para o painel
SCHEMA: Dict[str, Dict[str, type]] = {
    "news": {"title": str, "summary": str, "body": str, "category": str, "image": str, "date": str, "tags": list, "status": str},
    "events": {"title": str, "description": str, "start": str, "end": str, "location": str, "kind": str, "link": str, "status": str},
    "timeline": {"title": str, "description": str, "date": str, "track": str, "phase": str, "state": str, "status": str},
    "media": {"title": str, "caption": str, "kind": str, "file": str, "url": str, "mime": str, "size": int, "date": str, "category": str, "status": str},
    "episodes": {"title": str, "summary": str, "script": str, "audio": str, "duration": int, "date": str, "sources": list, "status": str},
}
PRIVATE = ("subscribers", "tickets", "log")
CHOICES = {
    "news.category": ["novidade", "atualizacao", "publicacao", "evento", "bastidores"],
    "events.kind": ["evento", "atividade", "prazo", "reuniao", "apresentacao"],
    "timeline.track": ["in-silico", "vinculado"],
    "timeline.state": ["feito", "agora", "previsto"],
    "media.kind": ["foto", "video", "documento", "audio"],
    "status": ["rascunho", "publicado", "arquivado"],
}


# ------------------------------------------------------------------ armazenamento
def _path() -> Path:
    return PORTAL_DIR / "portal.json"


def _empty() -> Dict[str, Any]:
    return {k: [] for k in list(SCHEMA) + list(PRIVATE)}


def load() -> Dict[str, Any]:
    p = _path()
    if not p.exists():
        data = _empty()
        if SEED.exists():
            data.update(json.loads(SEED.read_text(encoding="utf-8")))
        try:
            save(data)
        except OSError:
            pass
        return data
    with open(p, encoding="utf-8") as f:
        fcntl.flock(f, fcntl.LOCK_SH)
        data = json.load(f)
    for k in _empty():
        data.setdefault(k, [])
    return data


def save(data: Dict[str, Any]) -> None:
    PORTAL_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _path().with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.flush(); os.fsync(f.fileno())
    os.replace(tmp, _path())


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _today() -> str:
    return dt.date.today().isoformat()


def _id(prefix: str) -> str:
    return f"{prefix}-{dt.date.today():%Y%m%d}-{secrets.token_hex(3)}"


def clean(col: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Mantém só os campos do esquema, com tipos e valores permitidos."""
    out: Dict[str, Any] = {}
    for k, t in SCHEMA[col].items():
        if k not in data or data[k] is None:
            continue
        v = data[k]
        if t is str:
            v = str(v)[:20000]
        elif t is int:
            try:
                v = int(v)
            except (TypeError, ValueError):
                continue
        elif t is list:
            v = [str(x)[:200] for x in (v if isinstance(v, list) else [v])][:30]
        ch = CHOICES.get(f"{col}.{k}") or (CHOICES["status"] if k == "status" else None)
        if ch and v not in ch:
            continue
        out[k] = v
    return out


# ------------------------------------------------------------------ versões do simulador viram notícias automaticamente
_REL_SYNCED = False


def sync_releases(d: Dict[str, Any]) -> bool:
    """Cada versão nova do simulador (release.json) entra como notícia publicada e marco da linha do tempo."""
    rel = None
    for p in (Path("/srv/release.json"), Path(__file__).resolve().parents[2] / "frontend" / "release.json"):
        if p.exists():
            rel = json.loads(p.read_text(encoding="utf-8")); break
    if not rel:
        return False
    have = {x.get("id") for x in d["news"]} | {x.get("id") for x in d["timeline"]} | set(d.get("deleted") or []); changed = False
    for r in rel.get("releases", [])[:12]:
        v = r.get("version")
        if f"nw-v{v}" not in have:
            body = "\n\n".join(f"**{sec}**\n" + "\n".join("- " + i for i in items) for sec, items in (r.get("sections") or {}).items())
            d["news"].append({"id": f"nw-v{v}", "title": f"Simulador v{v}", "summary": r.get("summary", ""), "body": body, "category": "atualizacao", "image": "img/app/sim-st36.jpg",
                              "date": r.get("date", _today()), "tags": ["simulador", "versão"], "status": "publicado", "created": _now(), "updated": _now(), "source": "release"}); changed = True
        if f"tl-v{v}" not in have:
            d["timeline"].append({"id": f"tl-v{v}", "title": f"Simulador v{v}", "description": r.get("summary", ""), "date": r.get("date", _today()), "track": "in-silico",
                                  "phase": "Fase 1", "state": "feito", "status": "publicado", "created": _now(), "updated": _now(), "source": "release"}); changed = True
    return changed


def sync_seed(d: Dict[str, Any]) -> bool:
    """Conteúdo de base (seed_portal.json) que ainda não está no portal entra publicado, exceto o que o
    administrador apagou (lista "deleted"). Corrige portais criados vazios ou antes do conteúdo de base existir."""
    if not SEED.exists():
        return False
    seed = json.loads(SEED.read_text(encoding="utf-8")); gone = set(d.get("deleted") or []); changed = False
    for col in SCHEMA:
        have = {x.get("id") for x in d[col]}
        for it in seed.get(col) or []:
            if it.get("id") and it["id"] not in have and it["id"] not in gone:
                d[col].append(dict(it)); changed = True
    return changed


# ------------------------------------------------------------------ leitura pública
def public() -> Dict[str, Any]:
    global _REL_SYNCED
    d = load()
    if not _REL_SYNCED:
        _REL_SYNCED = True
        if sync_seed(d) | sync_releases(d):
            try:
                save(d)
            except OSError:
                pass
    pub = lambda xs: [x for x in xs if x.get("status") == "publicado"]
    by_date = lambda xs, key="date": sorted(xs, key=lambda x: x.get(key) or "", reverse=True)
    return {
        "news": by_date(pub(d["news"])),
        "events": sorted(pub(d["events"]), key=lambda x: x.get("start") or ""),
        "timeline": sorted(pub(d["timeline"]), key=lambda x: x.get("date") or ""),
        "media": by_date(pub(d["media"])),
        "episodes": by_date(pub(d["episodes"])),
        "generated_at": _now(),
    }


def media_path(name: str) -> Optional[Path]:
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,120}", name or ""):
        return None
    p = PORTAL_DIR / "media" / name
    return p if p.is_file() else None


# ------------------------------------------------------------------ operações do administrador
def apply_ops(ops: List[Dict[str, Any]], actor: str = "admin") -> Dict[str, Any]:
    d = load(); done = []
    for op in ops[:100]:
        kind, col = op.get("op"), op.get("collection")
        if col not in SCHEMA:
            done.append({"ok": False, "error": f"coleção inválida: {col}"}); continue
        items = d[col]
        if kind == "create":
            item = clean(col, op.get("data") or {})
            if not item.get("title"):
                done.append({"ok": False, "error": "título obrigatório"}); continue
            item.setdefault("status", "rascunho"); item.setdefault("date", _today()) if "date" in SCHEMA[col] else None
            item.update(id=_id(col[:2]), created=_now(), updated=_now(), source=op.get("source", actor))
            items.append(item); done.append({"ok": True, "op": kind, "collection": col, "id": item["id"]})
            continue
        it = next((x for x in items if x.get("id") == op.get("id")), None)
        if it is None:
            done.append({"ok": False, "error": f"item não encontrado: {op.get('id')}"}); continue
        if kind == "update":
            it.update(clean(col, op.get("data") or {})); it["updated"] = _now()
        elif kind in ("publish", "unpublish", "archive"):
            it["status"] = {"publish": "publicado", "unpublish": "rascunho", "archive": "arquivado"}[kind]; it["updated"] = _now()
            if kind == "publish" and col == "episodes" and not it.get("date"):
                it["date"] = _today()
        elif kind == "delete":
            items.remove(it); d["deleted"] = (d.get("deleted") or [])[-2000:] + [it["id"]]
            if it.get("file") and media_path(it["file"]):
                try:
                    (PORTAL_DIR / "media" / it["file"]).unlink()
                except OSError:
                    pass
        else:
            done.append({"ok": False, "error": f"operação inválida: {kind}"}); continue
        done.append({"ok": True, "op": kind, "collection": col, "id": it["id"]})
    d["log"] = (d.get("log") or [])[-400:] + [{"at": _now(), "actor": actor, "ops": [x for x in done if x.get("ok")]}]
    save(d)
    return {"results": done}


ASSIST_SYSTEM = """Você é o assistente editorial do portal do projeto axon (biofísica da neuromodulação, simulação in silico,
Ibilce/UNESP). O administrador escreve um pedido; você responde SOMENTE com JSON:
{"message": "explicação curta em português do que será feito", "ops": [ ... ]}
Cada op: {"op": "create"|"update"|"publish"|"unpublish"|"archive"|"delete", "collection": "news"|"events"|"timeline"|"media"|"episodes",
"id": "(obrigatório exceto em create)", "data": {campos}}.
Campos — news: title, summary (2 frases), body (texto em parágrafos, pode usar **negrito** e listas com "- "), category
(novidade|atualizacao|publicacao|evento|bastidores), date AAAA-MM-DD, tags[]; events: title, description, start e end
(AAAA-MM-DDTHH:MM, horário de Brasília), location, kind (evento|atividade|prazo|reuniao|apresentacao), link; timeline: title,
description, date, track (in-silico = este projeto | vinculado = projeto experimental separado, fora do escopo), phase,
state (feito|agora|previsto); media: title, caption, category (registro|galeria|imprensa) — só para editar mídia já enviada;
episodes: title, summary, script (roteiro falado de 2 a 5 minutos, em português, a partir do material fornecido), sources[].
Regras: (1) nunca invente resultados, números, datas, nomes, locais ou parcerias que não estejam no pedido ou no material;
se faltar um dado, deixe o campo vazio e diga na message; (2) itens novos ficam em rascunho — só use publish se o pedido
disser publicar; (3) delete apenas quando o pedido pedir explicitamente; (4) o escopo deste projeto é simulação in silico:
fases ex vivo e in vivo pertencem a um projeto vinculado, que depende de aprovação de comitês e laboratório credenciado;
(5) não é dispositivo médico: não escreva recomendações clínicas; (6) prefira atualizar um item existente a duplicá-lo."""


def _digest(d: Dict[str, Any]) -> str:
    rows = []
    for col in SCHEMA:
        for x in sorted(d[col], key=lambda x: x.get("date") or x.get("start") or "", reverse=True)[:25]:
            rows.append(f"{col} | {x.get('id')} | {x.get('status')} | {x.get('date') or x.get('start') or ''} | {x.get('title', '')[:90]}")
    return "\n".join(rows)


def assist(prompt: str, material: str = "") -> Dict[str, Any]:
    d = load()
    user = (f"Hoje: {_today()}\nConteúdo atual (coleção | id | status | data | título):\n{_digest(d)}\n\n"
            f"Material de referência do projeto:\n{(material or '')[:12000]}\n\nPedido do administrador:\n{prompt[:4000]}")
    r = ai.complete(ASSIST_SYSTEM, user, max_tokens=3500)
    if not r:
        return {"mode": "offline", "message": "Nenhum provedor de IA respondeu. Use os formulários do painel ou tente de novo.", "ops": []}
    t = r["text"]
    try:
        j = json.loads(t[t.find("{"): t.rfind("}") + 1])
    except ValueError:
        return {"mode": "erro", "message": "A IA respondeu fora do formato. Reformule o pedido.", "ops": [], "raw": t[:2000]}
    ops = []
    for op in (j.get("ops") or [])[:40]:
        col = op.get("collection")
        if col in SCHEMA and op.get("op") in ("create", "update", "publish", "unpublish", "archive", "delete"):
            ops.append({"op": op["op"], "collection": col, "id": op.get("id"), "data": clean(col, op.get("data") or {}), "source": "ia"})
    return {"mode": "ia", "provider": r["provider"], "message": str(j.get("message", ""))[:2000], "ops": ops}


# ------------------------------------------------------------------ mídia
MIME_OK = re.compile(r"^(image/(png|jpeg|webp|gif)|video/(mp4|webm)|audio/(mpeg|mp4|ogg|wav)|application/pdf|text/plain|text/markdown|text/csv)$")
EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "video/mp4": ".mp4", "video/webm": ".webm",
       "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/ogg": ".ogg", "audio/wav": ".wav", "application/pdf": ".pdf",
       "text/plain": ".txt", "text/markdown": ".md", "text/csv": ".csv"}


def store_upload(raw: bytes, mime: str, title: str, kind: str, category: str = "galeria") -> Dict[str, Any]:
    if not MIME_OK.match(mime or ""):
        raise ValueError("tipo de arquivo não aceito")
    if len(raw) > MAX_UPLOAD:
        raise ValueError(f"arquivo acima de {MAX_UPLOAD // 1048576} MB")
    name = f"{dt.date.today():%Y%m%d}-{hashlib.sha256(raw).hexdigest()[:12]}{EXT[mime]}"
    (PORTAL_DIR / "media").mkdir(parents=True, exist_ok=True)
    (PORTAL_DIR / "media" / name).write_bytes(raw)
    kind = kind if kind in CHOICES["media.kind"] else ("foto" if mime.startswith("image/") else "video" if mime.startswith("video/") else "audio" if mime.startswith("audio/") else "documento")
    r = apply_ops([{"op": "create", "collection": "media", "data": {"title": title or name, "kind": kind, "file": name, "mime": mime, "size": len(raw), "category": category, "status": "rascunho"}}])
    return r["results"][0]


# ------------------------------------------------------------------ podcast (roteiro → áudio)
def tts(episode_id: str) -> Dict[str, Any]:
    """Gera o áudio do episódio com a API de voz da OpenAI, se houver chave; senão o site lê o roteiro com a voz do navegador."""
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        return {"ok": False, "error": "sem OPENAI_API_KEY: o episódio será lido pela voz sintetizada do navegador"}
    d = load(); ep = next((x for x in d["episodes"] if x.get("id") == episode_id), None)
    if not ep or not ep.get("script"):
        return {"ok": False, "error": "episódio sem roteiro"}
    req = urllib.request.Request("https://api.openai.com/v1/audio/speech", method="POST",
                                 data=json.dumps({"model": os.getenv("PODCAST_TTS_MODEL", "gpt-4o-mini-tts"), "voice": os.getenv("PODCAST_VOICE", "alloy"),
                                                  "input": ep["script"][:4000], "response_format": "mp3"}).encode(),
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            audio = r.read()
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"falha na síntese de voz: {type(e).__name__}"}
    name = f"ep-{episode_id}.mp3"; (PORTAL_DIR / "media").mkdir(parents=True, exist_ok=True); (PORTAL_DIR / "media" / name).write_bytes(audio)
    ep["audio"] = name; ep["duration"] = int(len(audio) / 16000); ep["updated"] = _now(); save(d)  # ~128 kbit/s
    return {"ok": True, "audio": name}


# ------------------------------------------------------------------ feeds (RSS, podcast, calendário)
def _rfc822(s: str) -> str:
    try:
        d = dt.datetime.fromisoformat((s or _today())[:19])
    except ValueError:
        d = dt.datetime.now()
    return d.strftime("%a, %d %b %Y %H:%M:%S -0300")


def rss() -> str:
    p = public(); items = []
    for n in p["news"][:40]:
        items.append(f"<item><title>{xesc(n['title'])}</title><link>{SITE}/#n-{n['id']}</link><guid isPermaLink=\"false\">{n['id']}</guid>"
                     f"<pubDate>{_rfc822(n.get('date'))}</pubDate><category>{xesc(n.get('category', ''))}</category><description>{xesc(n.get('summary', ''))}</description></item>")
    for e in p["events"][-20:]:
        items.append(f"<item><title>{xesc('Agenda: ' + e['title'])}</title><link>{SITE}/#agenda</link><guid isPermaLink=\"false\">{e['id']}</guid>"
                     f"<pubDate>{_rfc822(e.get('created') or e.get('start'))}</pubDate><description>{xesc((e.get('start') or '') + ' · ' + (e.get('location') or '') + ' — ' + (e.get('description') or ''))}</description></item>")
    return ('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>axon · novidades</title>'
            f"<link>{SITE}/</link><description>Notícias, atualizações e agenda do projeto axon — biofísica da neuromodulação in silico.</description><language>pt-br</language>"
            + "".join(items) + "</channel></rss>")


def podcast_rss() -> str:
    p = public(); items = []
    for e in p["episodes"]:
        if not e.get("audio"):
            continue
        f = media_path(e["audio"]); size = f.stat().st_size if f else 0
        items.append(f"<item><title>{xesc(e['title'])}</title><guid isPermaLink=\"false\">{e['id']}</guid><pubDate>{_rfc822(e.get('date'))}</pubDate>"
                     f"<description>{xesc(e.get('summary', ''))}</description><enclosure url=\"{SITE}/api/portal/media/{e['audio']}\" length=\"{size}\" type=\"audio/mpeg\"/>"
                     f"<itunes:duration>{int(e.get('duration') or 0)}</itunes:duration></item>")
    return ('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>'
            f"<title>axon · resumos em áudio</title><link>{SITE}/#podcast</link><language>pt-br</language><itunes:author>Projeto axon</itunes:author>"
            "<description>Resumos do material desenvolvido e das atividades do projeto, liberados pela coordenação.</description><itunes:explicit>false</itunes:explicit>"
            + "".join(items) + "</channel></rss>")


def ics() -> str:
    def stamp(s: str) -> str:
        s = (s or "")[:16]
        return re.sub(r"[-:]", "", s) + ("00" if "T" in s else "")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//axon//agenda//PT", "X-WR-CALNAME:axon · agenda", "X-WR-TIMEZONE:America/Sao_Paulo"]
    for e in public()["events"]:
        s, en = stamp(e.get("start")), stamp(e.get("end") or e.get("start"))
        tz = ";TZID=America/Sao_Paulo" if "T" in s else ";VALUE=DATE"
        if "T" not in s:  # dia inteiro: DTEND é o dia seguinte (exclusivo)
            try:
                en = (dt.date.fromisoformat((e.get("end") or e.get("start"))[:10]) + dt.timedelta(days=1)).strftime("%Y%m%d")
            except ValueError:
                pass
        lines += ["BEGIN:VEVENT", f"UID:{e['id']}@axon", f"DTSTAMP:{dt.datetime.utcnow():%Y%m%dT%H%M%SZ}", f"DTSTART{tz}:{s}", f"DTEND{tz}:{en}",
                  "SUMMARY:" + (e.get("title") or "").replace("\n", " "), "LOCATION:" + (e.get("location") or "").replace("\n", " "),
                  "DESCRIPTION:" + (e.get("description") or "").replace("\n", "\\n")[:900], "END:VEVENT"]
    return "\r\n".join(lines + ["END:VCALENDAR"]) + "\r\n"


# ------------------------------------------------------------------ newsletter e apoio
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[a-z]{2,}$", re.I)
_hits: Dict[str, List[float]] = {}


def throttle(ip: str, limit: int = 6, window: int = 600) -> bool:
    now = time.time(); h = [t for t in _hits.get(ip, []) if now - t < window]
    if len(h) >= limit:
        _hits[ip] = h; return False
    _hits[ip] = h + [now]; return True


def subscribe(email: str, topics: List[str], consent: bool) -> Dict[str, Any]:
    email = (email or "").strip().lower()
    if not consent:
        raise ValueError("é preciso aceitar o uso do e-mail para o envio do boletim")
    if not EMAIL_RE.match(email):
        raise ValueError("e-mail inválido")
    d = load(); s = next((x for x in d["subscribers"] if x["email"] == email), None)
    if s:
        s["topics"] = topics[:6]
    else:
        d["subscribers"].append({"id": _id("sb"), "email": email, "topics": [t[:30] for t in topics[:6]], "consent_at": _now(), "token": secrets.token_urlsafe(18), "active": True})
    save(d)
    return {"ok": True}


def unsubscribe(token: str) -> bool:
    d = load(); s = next((x for x in d["subscribers"] if hmac.compare_digest(x.get("token", ""), token or "")), None)
    if not s:
        return False
    d["subscribers"].remove(s); save(d); return True


def subscribers_csv() -> str:
    out = io.StringIO(); w = csv.writer(out); w.writerow(["email", "temas", "consentimento"])
    for s in load()["subscribers"]:
        w.writerow([s["email"], ";".join(s.get("topics", [])), s.get("consent_at", "")])
    return out.getvalue()


def smtp_ready() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_FROM"))


def send_newsletter(subject: str, html: str, test_to: str = "") -> Dict[str, Any]:
    if not smtp_ready():
        return {"ok": False, "error": "SMTP não configurado (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM no .env). Exporte o CSV ou use o RSS."}
    d = load(); targets = [{"email": test_to, "token": ""}] if test_to else [s for s in d["subscribers"] if s.get("active", True)]
    host, port = os.getenv("SMTP_HOST"), int(os.getenv("SMTP_PORT", "587")); sent = 0
    with smtplib.SMTP(host, port, timeout=30) as sm:
        sm.starttls(context=ssl.create_default_context())
        if os.getenv("SMTP_USER"):
            sm.login(os.getenv("SMTP_USER"), os.getenv("SMTP_PASS", ""))
        for s in targets:
            m = EmailMessage(); m["Subject"] = subject[:180]; m["From"] = os.getenv("SMTP_FROM"); m["To"] = s["email"]
            foot = f'<p style="font-size:12px;color:#667">Você recebe este boletim porque se inscreveu em {SITE}. <a href="{SITE}/api/portal/unsubscribe?token={s["token"]}">Cancelar inscrição</a>.</p>' if s["token"] else ""
            m.set_content(re.sub(r"<[^>]+>", "", html)); m.add_alternative(html + foot, subtype="html"); sm.send_message(m); sent += 1
    return {"ok": True, "sent": sent}


def newsletter_draft() -> Dict[str, Any]:
    """Rascunho do boletim com as publicações dos últimos 30 dias (a IA só redige; o conteúdo vem do portal)."""
    p = public(); since = (dt.date.today() - dt.timedelta(days=30)).isoformat()
    news = [n for n in p["news"] if (n.get("date") or "") >= since][:8]; evs = [e for e in p["events"] if (e.get("start") or "") >= _today()][:6]
    eps = [e for e in p["episodes"] if (e.get("date") or "") >= since][:4]
    blocks = "".join(f'<h3>{xesc(n["title"])}</h3><p>{xesc(n.get("summary", ""))}</p>' for n in news)
    blocks += ("<h3>Próximas datas</h3><ul>" + "".join(f'<li><b>{xesc((e.get("start") or "")[:16].replace("T", " "))}</b> — {xesc(e["title"])} {xesc(e.get("location") or "")}</li>' for e in evs) + "</ul>") if evs else ""
    blocks += ("<h3>Novos episódios</h3><ul>" + "".join(f'<li>{xesc(e["title"])}</li>' for e in eps) + "</ul>") if eps else ""
    intro = "Resumo das novidades do projeto axon nas últimas semanas."
    r = ai.complete("Escreva uma abertura de 2 frases, em português, calorosa e precisa, para um boletim de projeto científico. Não invente fatos.",
                    "Itens do boletim:\n" + "\n".join(f"- {n['title']}: {n.get('summary', '')}" for n in news), max_tokens=200)
    if r and r.get("text"):
        intro = r["text"].strip()[:600]
    return {"subject": f"axon · novidades de {dt.date.today():%d/%m/%Y}", "html": f"<p>{xesc(intro)}</p>{blocks}<p><a href=\"{SITE}/#novidades\">Ver tudo no site</a></p>"}


def support(name: str, email: str, topic: str, message: str) -> Dict[str, Any]:
    if len((message or "").strip()) < 10:
        raise ValueError("escreva a mensagem com pelo menos 10 caracteres")
    if email and not EMAIL_RE.match(email.strip()):
        raise ValueError("e-mail inválido")
    d = load(); t = {"id": _id("ap"), "name": (name or "")[:120], "email": (email or "").strip()[:200], "topic": (topic or "geral")[:40], "message": message[:5000], "created": _now(), "state": "aberto", "notes": ""}
    d["tickets"].append(t); save(d)
    return {"ok": True, "id": t["id"]}


def ticket_update(tid: str, state: str, notes: str) -> bool:
    d = load(); t = next((x for x in d["tickets"] if x["id"] == tid), None)
    if not t:
        return False
    if state in ("aberto", "em andamento", "respondido", "fechado"):
        t["state"] = state
    t["notes"] = (notes or "")[:5000]; t["updated"] = _now(); save(d); return True


def check_admin(header: str) -> bool:
    tok = os.getenv("ADMIN_TOKEN", "")
    if len(tok) < 16:
        return False
    given = (header or "").removeprefix("Bearer ").strip()
    return hmac.compare_digest(given.encode(), tok.encode())
