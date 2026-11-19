# Changelog — harmonIA

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) · Versionamento: [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.7-alpha] — 2026-11-19

### Adicionado — failover entre provedores de IA
- `backend/app/core/llm.py`: tradução contextual e assistente Maestro usam uma cadeia de provedores **Anthropic → OpenAI → Gemini → OpenRouter** (ordem configurável em `AI_PROVIDERS`). Entram na cadeia só os provedores com chave.
  - Em timeout, erro de rede, 429/5xx ou chave inválida, o próximo provedor responde.
  - O provedor que falhou fica em pausa crescente (circuit breaker, `AI_COOLDOWN_S`).
  - As chaves nunca são logadas nem devolvidas pela API.
- `infra/scripts/configurar-ia.sh`: grava as chaves no `.env` da VPS com digitação **oculta**, faz backup do `.env`, define a ordem e reinicia só a API.
- Administração → **🤖 IA**: provedores, modelo, estado (ok/em pausa), chamadas e o botão **Testar failover**, que mostra qual provedor respondeu.

## [0.1.6-alpha] — 2026-11-19

### Adicionado — atualizações automáticas
- **`infra/scripts/autoupdate.sh` + systemd timer (`harmonia-autoupdate.timer`)**. A cada 5 minutos a VPS:
  1. consulta o GitHub (`LACibermedicina/harmonia`, branch `main`);
  2. aplica só commits cujo CI (testes + build) passou;
  3. reconstrói, reinicia e confere `/api/health`;
  4. se falhar, faz **rollback** automático para a versão anterior e bloqueia o commit ruim.

  Preserva `.env` e `data/`. É o modelo "pull": nenhuma chave da VPS fica guardada no GitHub.
- O script executa uma cópia temporária de si mesmo, porque a atualização pode substituir o próprio arquivo, e usa trava (`flock`) contra execuções simultâneas.
- Aviso no app: quando o servidor muda de versão, aparece "Nova versão instalada — Recarregar agora". Antes de recarregar, salva a composição aberta.
- Administração → **🔄 Atualizações**: versão em execução, estado (em dia, aguardando CI, aplicando, revertido), commit e log (`/api/admin/system`).
- `instalar-do-mac.sh` publica o código no GitHub ao final, e esse repositório passa a ser a origem das atualizações.

### Alterado
- Workflow renomeado para `ci-harmonia`. O job de deploy por SSH só roda com a variável `DEPLOY_MODE=push`; por padrão o CI só testa e a VPS busca sozinha.
- `deploy.sh` tenta a migração várias vezes enquanto a API inicia. O setup instala `git` e configura as variáveis `AUTOUPDATE_*`.

## [0.1.5-alpha] — 2026-11-19

### Corrigido
- **A transcrição agora chega à Composição como camada.** No modo leve (servidor pequeno), o áudio caía num erro porque dependia do PyTorch. Agora existe um motor de transcrição leve, que usa só numpy e ffmpeg:
  - **melodia:** detecção de altura por YIN, com vibrato e glissando;
  - **andamento:** detectado pelos ataques;
  - **acordes:** por cromagrama, por meio compasso, com acompanhamento de piano.
  Ao terminar, a janela de Composição é aberta, o painel Camadas é revelado, a camada nova fica ativa e uma notificação diz quais camadas foram criadas. O mesmo vale para a cifra e para a foto.
- As camadas criadas por importação recebem o nome do arquivo de origem (ex.: "Melodia transcrita — minha-musica").
- Selecionar compassos limpa a seleção de notas e vice-versa, para não haver ambiguidade sobre o que será copiado ou recortado.

### Adicionado
- **Copiar ou recortar para nova camada** as notas ou os compassos selecionados:
  - pela barra de seleção acima da partitura, pelo painel Propriedades ou pelos atalhos ⌘⇧C / ⌘⇧X;
  - é criada uma camada por pauta de origem (Sol/Fá);
  - camadas bloqueadas não são recortadas.
- **Identidade visual por camada**:
  - cada camada nova recebe uma cor ainda não usada;
  - cabeça, haste, bandeirola, linhas suplementares, ponto, acidente e sílaba da nota usam a cor da camada;
  - a barra de duração ganha uma **textura própria por camada** (lisa, listrada, pontilhada, xadrez, vertical, ondas), que distingue as camadas também sem depender de cor;
  - legenda de camadas acima da partitura (clique ativa a camada, duplo clique oculta) e tooltip "Camada: …" em cada nota;
  - anotações e gravações mostram a cor da camada, e o painel Propriedades mostra a etiqueta da camada das notas selecionadas.

## [0.1.4-alpha] — 2026-11-19

### Adicionado
- **Painel lateral direito acoplável**, do lado oposto ao menu lateral esquerdo, com os painéis da partitura:
  - **Propriedades**: dados da partitura (título, andamento, fórmula, tonalidade, nº de compassos). Para notas selecionadas: altura (±semitom/oitava, nome em solfejo e cifra), duração, intensidade, sílaba, efeito vocal, mover de camada, apagar. Para compassos selecionados: cifra, harmonizar, ouvir, inserir antes/depois, limpar, excluir.
  - **Camadas**: o gestor de camadas passa de janela para painel, com layout compacto.
  - **Anotações**: lista, edição inline, cor, ir ao compasso e remover.
- Comportamento dos painéis:
  - arrastar o cabeçalho para fora do dock (ou ⇱ ou duplo clique) transforma o painel em flutuante, movível e redimensionável;
  - arrastar de volta sobre o dock reacopla o painel na posição da linha guia; o mesmo gesto reordena os painéis dentro do dock;
  - cada painel pode ser recolhido (▾) ou fechado (✕);
  - o dock inteiro recolhe para uma faixa de ícones (☰), como o menu esquerdo, e ↺ restaura o layout padrão;
  - o layout fica salvo no navegador.
- `store.deleteMeasures()`: exclui compassos e puxa o conteúdo seguinte para trás (cifras, anotações e gravações acompanham; notas que invadiam o trecho são encurtadas).

### Alterado
- Os ícones 3D usam gradientes globais (corrige ícones sem cor quando o mesmo ícone aparece em vários lugares).
- A janela de Composição se ajusta à largura disponível entre os dois menus laterais; ícones do desktop, Maestro e janelas maximizadas respeitam o dock direito.

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
