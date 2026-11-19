# Changelog — harmonIA

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) · Versionamento: [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.3-alpha] — 2026-11-19

### Adicionado
- **Administração** (somente o papel `admin`): visão geral com estatísticas, usuários (busca, troca de papel, bloquear/liberar acesso), moderação da biblioteca pública (despublicar) e trilha de auditoria LGPD. Endpoints `/api/admin/*` validados no servidor; o admin não consegue remover o próprio acesso.
- **Inserir compasso**: um "+" discreto em cada barra de compasso (entre compassos, no início e no final). Alt+clique insere 4 compassos. As notas que cruzam a barra são divididas, e cifras, anotações, gravações e a seleção são deslocadas. Funciona com desfazer (⌘Z).

### Alterado
- **Fluxo de IA** e **Administração** ficam ocultos no Dock, no menu lateral, nos ícones do desktop e no menu Janelas para quem não é admin. A abertura direta é bloqueada, e as janelas administrativas fecham ao sair da conta.
- `instalar-do-mac.sh` passa a usar o pacote `harmonia-v*.zip` mais recente e recusa os usuários `deploy` e `root` no login.
- A API lê a versão do arquivo `VERSION` da raiz também em desenvolvimento.

## [0.1.2-alpha] — 2026-11-19

### Adicionado
- `infra/scripts/instalar-do-mac.sh`: instala e atualiza a partir do Mac com um único comando. Ele envia o pacote, cria a chave pessoal e a chave de deploy, roda o setup com sudo e deixa o `VPS_SSH_KEY` copiado na área de transferência.
- **Modo de IA leve** (`AI_ML=0`, escolhido automaticamente com menos de 8 GB de RAM ou 20 GB de disco livre): o ai-worker fica com ~700 MB, sem PyTorch. Editor, cifra, harmonização e exportação MIDI/MusicXML/PDF/WAV/MP3 continuam funcionando; a transcrição de áudio e foto mostra aviso claro. `/api/health` informa `ai_full`.
- O próprio setup agora constrói, sobe, migra e testa a stack. O site fica no ar antes mesmo do GitHub Actions.

### Alterado (servidor compartilhado com Odoo e outros serviços)
- O setup deixa de mexer no firewall quando o UFW está desligado, e nunca liga o UFW por conta própria.
- vhost do nginx com rollback automático se `nginx -t` falhar, e suporte a `conf.d` quando não existe `sites-enabled`.
- Antes do certbot, confere se o DNS do subdomínio aponta para o IP público. Se não apontar, informa o comando para rodar depois.
- Usuário `deploy` corrigido: home e shell bash, entra só com chave, fica no grupo `docker` e sai do grupo `sudo` (menor privilégio).
- Checagens prévias de disco (mínimo de 4 GB) e swap; `apt-get update` tolera repositórios de terceiros com chave GPG vencida.
- Instala o plugin `docker compose` se estiver faltando. A API usa 1 worker em máquinas com menos de 4 GB de RAM.

## [0.1.1-alpha] — 2026-11-19

### Alterado — regra de portas: nenhuma porta < 1024 e nenhuma porta já em uso
- O harmonIA não publica mais 80/443. O nginx da stack passou para `nginxinc/nginx-unprivileged`, que escuta 8080 no container e só fica acessível em **`127.0.0.1:HTTP_PORT`** no host.
- `infra/scripts/lib-ports.sh`: detecta as portas em uso (via `ss`, com fallback em `/proc/net` e nas portas publicadas pelo Docker) e escolhe portas altas livres (≥ 20000): `HTTP_PORT`, `TURN_PORT` e a faixa de relay `TURN_MIN_PORT`–`TURN_MAX_PORT`. As escolhas ficam gravadas no `.env` e são reaproveitadas nos próximos deploys.
- `deploy.sh` confere as portas antes de subir. Se alguma ficou ocupada por outro serviço, o deploy é abortado sem alterar nada.
- O HTTPS público fica com o **proxy que já existe no servidor**. O `setup-vps.sh` detecta nginx ou apache, cria o vhost `harmonia.m3d.pro → 127.0.0.1:HTTP_PORT` e emite o certificado com `certbot --nginx` ou `certbot --apache`. Para Caddy e Traefik gera instruções. Sem proxy, há a opção do túnel Cloudflare (perfil `tunnel`, sem porta de entrada).
- Removidos o certbot standalone (que usava a porta 80) e o cron de renovação próprio. A renovação passa para o `certbot.timer` do host.
- coturn: portas dinâmicas e `--no-tcp-relay`. O servidor realtime passou a anunciar o `TURN_PORT` correto.

### Corrigido
- Firewall: o setup não derruba mais serviços que já rodam na VPS. Se o UFW está ativo, as regras existentes são mantidas. Se está inativo, todas as portas públicas que já estão em escuta são liberadas antes de ativá-lo. A porta do SSH é detectada.
- O endurecimento do SSH (desligar o login por senha) agora é opcional (`HARDEN_SSH=1`), porque afeta o servidor inteiro.
- `api` e `ai-worker` ganharam a rede `egress`. Antes, a rede `internal` bloqueava as chamadas à API de IA e o download dos modelos.
- CI: health check interno via SSH em `127.0.0.1:HTTP_PORT`, seguido do health check público. Se só o público falhar, sai um aviso (problema de proxy/DNS) em vez de erro.

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
