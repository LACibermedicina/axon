# Changelog — harmonIA

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) · Versionamento: [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.0-alpha] — 2026-11-18

Primeira iteração: infraestrutura, motor musical, API e desktop de composição.

### Infra & DevOps
- `.github/workflows/deploy.yml`: testes (motor musical + API) → build do frontend → rsync via SSH → `deploy.sh` na VPS → health check em `https://harmonia.m3d.pro/api/health`.
- `infra/scripts/setup-vps.sh`: Docker + Compose, usuário `deploy`, árvore `/opt/harmonia`, UFW (22/80/443 + TURN), hardening SSH, fail2ban, `.env` com segredos aleatórios (chmod 600), certificado Let's Encrypt, cron de renovação e de backup.
- `docker-compose.yml`: nginx (com build do frontend), api, ai-worker, realtime, postgres 16, redis 7, coturn. Rede `internal` sem saída direta; só o nginx é exposto.
- Nginx: HTTPS/HTTP2, HSTS, cabeçalhos de segurança, rate limit (auth 5/min, API 20/s), upload de até 200 MB, proxy WebSocket `/ws/`.

### Motor musical (ai-worker) — testado
- Cifra brasileira/internacional: `C7M`, `m7(b5)`, `7(9)`, `sus4`, `°`, `/baixo`, solfejo, `%`.
- Cifra em texto → acordes por compasso + letra + seções.
- Harmonização automática (Viterbi com funções T/S/D) **por trecho**, mantendo os outros compassos como contexto; voicing com condução de vozes (bloco, arpejo, Alberti, baixo + acorde).
- Melodia extraída da harmonia (skyline), reconhecimento de acordes a partir das notas, detecção de tonalidade (Krumhansl).
- Silabação em português, alinhamento de letra às notas (pausas e melismas), conferência da letra cantada × letra informada.
- Exportação MIDI (sem dependências) e MusicXML 4.0 (piano em 2 pautas, ligaduras entre compassos, cifras, letra, anotações).
- Wrappers de IA: Demucs (separação), Basic Pitch (áudio → notas), pYIN (voz + vibrato/glissando), faster-whisper (letra com tempos), oemer (OMR), Verovio (PDF), FluidSynth/ffmpeg (WAV/MP3).

### API (FastAPI)
- Autenticação JWT, RBAC (`admin`, `composer`, `student`, `viewer`), senhas com scrypt.
- LGPD: consentimento obrigatório e versionado, e-mail/nome cifrados (AES-256-GCM) com índice HMAC, exportação e exclusão da conta, trilha de auditoria, minimização (biblioteca pública mostra só o primeiro nome; IA não recebe dados pessoais).
- Composições com controle de versão otimista, publicação privada / por link / pública / destaque no link principal, playlists e álbuns com ordenação.
- Upload com validação de tipo e de conteúdo; jobs leves síncronos e pesados em fila Redis.
- Tradução contextual por IA com cache de 30 dias; assistente "Maestro".

### Frontend (Vite + TypeScript)
- Desktop estilo macOS: janelas arrastáveis/redimensionáveis, minimizar para o Dock, maximizar, duplo clique fora fecha a janela ativa, ⌘W.
- Menu lateral recolhível, Dock com magnificação, ícones 3D estilo Pixar com micro-animações.
- Seletor de idiomas (🇨🇳 🇪🇸 🇬🇧 🇮🇳 🇧🇷): dicionário local + tradução por IA de todo texto visível.
- Editor de partitura: sistema Sol/Fá, armadura, fórmula, cifras, letra, anotações; drag & drop de notas (diatônico/cromático, duplicar com Alt), redimensionar duração, figuras arrastadas da paleta, atalhos, desfazer/refazer, seleção de compassos, harmonização por trecho, gravação de trechos com contagem.
- Gestor de camadas, importação (recorte/ganho de áudio, recorte/rotação de foto, cifra com prévia), mesa de edição com exportação, biblioteca, fluxo de IA em grafo, agenda com notas arrastáveis, comunidade com chat e videochamada WebRTC, avatar 3D Maestro (Three.js) com XP.

### Limitações conhecidas (próximas iterações)
- Migrações de banco ainda via `create_all` → Alembic na v0.2.0.
- Remoção física de mídia ao excluir conta: job de limpeza na v0.2.0.
- OMR e transcrição polifônica dependem da qualidade da entrada; revisão manual no editor é esperada.
- Colaboração simultânea na mesma partitura: canal `score-patch` pronto no realtime, integração no editor na v0.2.0.
