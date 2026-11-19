# harmonIA · `harmonia.m3d.pro`

Áudio, foto de partitura ou cifra → partitura de piano com IA. Harmonize compassos selecionados, grave trechos que faltam, edite com drag & drop em camadas, publique na biblioteca e exporte MIDI, PDF, WAV e MP3.

**Versão:** `0.1.3-alpha` (ver [CHANGELOG](CHANGELOG.md))

## Arquitetura

```
  Internet ─443─▶ proxy JÁ EXISTENTE no host (nginx/apache/caddy + Let's Encrypt)   ← harmonIA não abre 80/443
                    │
                    └──▶ 127.0.0.1:HTTP_PORT (porta alta livre, ex. 20080) ──▶ nginx da stack (container :8080)
                                 │ /api ─────────▶ api (FastAPI) ──▶ postgres
                                 │                    │  jobs leves (síncronos)
                                 │                    └─▶ redis (fila) ──▶ ai-worker (Demucs, Basic Pitch,
                                 │                                          pYIN, Whisper, oemer, Verovio, FluidSynth)
                                 └ /ws ──────────▶ realtime (chat, WebRTC, eventos de jobs) ◀── redis pub/sub
  coturn: TURN_PORT + faixa TURN_MIN_PORT–TURN_MAX_PORT/udp (portas altas livres) — relay WebRTC
```

| Pasta | Conteúdo |
|---|---|
| `.github/workflows/deploy.yml` | CI (testes e build) e deploy via SSH a cada push na `main` |
| `infra/` | Setup da VPS, deploy, backup e configuração do Nginx |
| `backend/` | API FastAPI: autenticação, RBAC, LGPD, composições, biblioteca, jobs e IA |
| `ai-worker/` | Motor musical e pipelines de IA (`harmonia_ai`) e testes |
| `realtime/` | Servidor WebSocket: chat, sinalização WebRTC e eventos |
| `frontend/` | Desktop web (Vite + TypeScript + Three.js) |

## Regra de portas

Nenhuma porta abaixo de 1024 e nenhuma porta já ocupada é usada. O setup escolhe portas altas livres e grava no `.env`. Para ver o estado atual: `make ports`. Os detalhes de publicação estão em [`infra/host-proxy/README.md`](infra/host-proxy/README.md).

## Instalação rápida (do Mac, um comando)

```bash
ZIP="$(ls -t ~/Downloads/harmonia-v*.zip | head -1)" && unzip -o -q -j "$ZIP" 'harmonia/infra/scripts/instalar-do-mac.sh' -d /tmp && bash /tmp/instalar-do-mac.sh
```

## Primeira instalação manual (VPS 159.223.22.82)

1. DNS: registro **A** `harmonia.m3d.pro → 159.223.22.82` (não é necessário se usar o túnel Cloudflare).
2. Copie o projeto para a VPS e rode como root: `bash infra/scripts/setup-vps.sh seu-email@m3d.pro`.
   O script escolhe as portas, configura o vhost no proxy existente e emite o certificado.
3. GitHub → Environment `production` → secrets `VPS_HOST`, `VPS_USER=deploy` e `VPS_SSH_KEY`.
4. `git push` na `main`.

## Desenvolvimento local

```bash
cd frontend && npm install && npm run dev        # http://localhost:5173 (funciona offline em modo demo)
cd backend && pip install -r requirements.txt && PYTHONPATH=../ai-worker uvicorn app.main:app --reload
cd ai-worker && pytest -q tests                   # motor musical
cd backend && pytest -q tests                     # API (SQLite + fakeredis)
```

## Contrato do Score JSON

```jsonc
{ "title": "…", "tempo": 92, "timeSig": [4,4], "keySig": 0, "measures": 8,
  "layers": [{ "id", "name", "kind": "melody|harmony|voice|bass|omr|recording", "staff": "treble|bass",
               "notes": [{ "id", "pitch": 72, "start": 0, "dur": 1, "vel": 84, "lyric": "a-", "effect": "vibrato" }],
               "visible", "muted", "solo", "locked", "volume", "color", "audio", "audioOffset", "measures" }],
  "chords": [[{ "beat": 0, "dur": 4, "root": 0, "quality": "maj7", "bass": null, "symbol": "C7M" }]],
  "annotations": [{ "id", "measure", "beat", "text", "color" }] }
```

As posições são contadas em tempos (semínimas). O compasso `m` ocupa o intervalo `[m·bpm, (m+1)·bpm)`.
