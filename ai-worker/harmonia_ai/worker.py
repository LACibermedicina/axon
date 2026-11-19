"""Worker de IA: consome a fila Redis `harmonia:jobs`, publica progresso em `harmonia:job:<id>`
e notifica o canal pub/sub `harmonia:events` (repassado ao frontend pelo serviço realtime)."""
from __future__ import annotations

import json
import logging
import os
import signal
import time
import traceback

import redis

from .jobs import HANDLERS

log = logging.getLogger("harmonia.worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
r = redis.Redis.from_url(os.environ["REDIS_URL"], decode_responses=True)
RUNNING = True


def _stop(*_):
    global RUNNING
    RUNNING = False


signal.signal(signal.SIGTERM, _stop)
signal.signal(signal.SIGINT, _stop)


def _set(job_id: str, **fields):
    key = f"harmonia:job:{job_id}"
    r.hset(key, mapping={k: json.dumps(v) if not isinstance(v, str) else v for k, v in fields.items()})
    r.expire(key, 60 * 60 * 24)
    owner = r.hget(key, "owner")
    r.publish("harmonia:events", json.dumps({"type": "job", "id": job_id, "owner": owner,
                                             "status": fields.get("status")}))


def main():
    log.info("worker pronto — handlers: %s", ", ".join(HANDLERS))
    while RUNNING:
        item = r.blpop("harmonia:jobs", timeout=5)
        if not item:
            continue
        job = json.loads(item[1])
        jid, kind = job["id"], job["type"]
        t0 = time.time()
        _set(jid, status="running")
        try:
            result = HANDLERS[kind](job["payload"])
            _set(jid, status="done", result=result, seconds=round(time.time() - t0, 2))
            log.info("job %s (%s) ok em %.1fs", jid, kind, time.time() - t0)
        except ModuleNotFoundError as e:
            log.warning("job %s (%s) requer IA completa: %s", jid, kind, e)
            _set(jid, status="error", error="Transcrição por IA indisponível neste servidor (modo leve). "
                 "Ela exige a IA completa (AI_ML=1, ≥ 8 GB de RAM). Cifra, harmonização, edição e exportação seguem disponíveis.")
        except Exception as e:  # noqa: BLE001
            log.error("job %s falhou: %s", jid, traceback.format_exc())
            _set(jid, status="error", error=str(e))


if __name__ == "__main__":
    main()
