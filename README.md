# harmonIA · `harmonia.m3d.pro`

Áudio, foto de partitura ou cifra → partitura de piano com IA. Harmonize compassos selecionados, grave trechos que faltam, edite com drag & drop em camadas, publique na biblioteca e exporte MIDI, PDF, WAV e MP3.

**Versão:** `0.1.0-alpha` (ver [CHANGELOG](CHANGELOG.md))

## Arquitetura

```
             Internet ──443──▶ nginx (frontend estático + proxy, TLS Let's Encrypt)
                                 │ /api ─────────▶ api (FastAPI) ──▶ postgres
                                 │                    │  jobs leves (síncronos)
                                 │                    └─▶ redis (fila) ──▶ ai-worker (Demucs, Basic Pitch,
                                 │                                          pYIN, Whisper, oemer, Verovio, FluidSynth)
                                 └ /ws ──────────▶ realtime (chat, WebRTC, eventos de jobs) ◀── redis pub/sub
             coturn (3478 + 49160-49200/udp) — relay WebRTC
```

| Pasta | Conteúdo |
|---|---|
| `.github/workflows/deploy.yml` | CI (testes e build) e deploy via SSH a cada push na `main` |
| `infra/` | Setup da VPS, deploy, backup e configuração do Nginx |
| `backend/` | API FastAPI: autenticação, RBAC, LGPD, composições, biblioteca, jobs e IA |
| `ai-worker/` | Motor musical e pipelines de IA (`harmonia_ai`) e testes |
| `realtime/` | Servidor WebSocket: chat, sinalização WebRTC e eventos |
| `frontend/` | Desktop web (Vite + TypeScript + Three.js) |

## Primeira instalação (VPS 159.223.22.82)

1. DNS: crie o registro **A** `harmonia.m3d.pro → 159.223.22.82`.
2. Na VPS, como root (depois de copiar o repositório ou baixar o script):
   ```bash
   sudo bash infra/scripts/setup-vps.sh seu-email@m3d.pro
   ```
   ⚠️ O script ativa o UFW e desativa o login por senha no SSH. **Antes de fechar a sessão atual, teste o acesso `ssh deploy@159.223.22.82` em outra janela.**
3. Gere uma chave só para o deploy e autorize-a:
   ```bash
   ssh-keygen -t ed25519 -f harmonia_deploy -N ""
   ssh-copy-id -i harmonia_deploy.pub deploy@159.223.22.82
   ```
4. No GitHub, em **Settings → Environments → production → Secrets**, crie: `VPS_HOST=159.223.22.82`, `VPS_USER=deploy` e `VPS_SSH_KEY` (o conteúdo de `harmonia_deploy`).
5. Opcional: preencha `ANTHROPIC_API_KEY` em `/opt/harmonia/.env` para ativar a tradução contextual e o assistente.
6. Faça `git push` na `main` e acompanhe em **Actions**.

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
