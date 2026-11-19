#!/usr/bin/env bash
# =============================================================================
# harmonIA — Setup inicial da VPS (Ubuntu 22.04/24.04 ou Debian 12)
#
# REGRA DE PORTAS: o harmonIA NÃO abre nenhuma porta < 1024 e NÃO usa porta já
# ocupada. A stack escuta só em 127.0.0.1:<porta alta livre>; o HTTPS público
# (443) continua com o proxy que JÁ existe no servidor (nginx/apache/caddy),
# que recebe um vhost para harmonia.m3d.pro. Sem proxy no host, use o túnel
# Cloudflare (perfil "tunnel"), que não abre nenhuma porta de entrada.
#
# Uso (como root):  bash infra/scripts/setup-vps.sh seu-email@m3d.pro
# Opcional:         HARDEN_SSH=1  → desativa login por senha (afeta TODO o servidor)
# =============================================================================
set -euo pipefail

PROJETO_NOME="harmonia"
SUBDOMINIO="harmonia.m3d.pro"
APP_DIR="/opt/${PROJETO_NOME}"
DEPLOY_USER="deploy"
LE_EMAIL="${1:-}"
SRC_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib-ports.sh
. "$SRC_DIR/infra/scripts/lib-ports.sh"

log()  { printf '\033[1;35m[harmonIA]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[atenção]\033[0m %s\n' "$*"; }
[[ $EUID -eq 0 ]] || { echo "Execute como root"; exit 1; }
[[ -n "$LE_EMAIL" ]] || { echo "Uso: setup-vps.sh seu-email@dominio"; exit 1; }

log "1/7 Pacotes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg ufw fail2ban rsync git jq iproute2 openssl

log "2/7 Docker Engine + Compose"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  . /etc/os-release
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

log "3/7 Usuário ${DEPLOY_USER} e diretórios em ${APP_DIR}"
id -u "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/${DEPLOY_USER}/.ssh"
if [[ -f /root/.ssh/authorized_keys && ! -f "/home/${DEPLOY_USER}/.ssh/authorized_keys" ]]; then
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /root/.ssh/authorized_keys "/home/${DEPLOY_USER}/.ssh/authorized_keys"
fi
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
  "$APP_DIR" "$APP_DIR/data/postgres" "$APP_DIR/data/redis" "$APP_DIR/data/media" "$APP_DIR/data/models" "$APP_DIR/data/backups"
rsync -a --exclude '.env' --exclude 'data/' "$SRC_DIR/" "$APP_DIR/"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

log "4/7 Segredos (.env, chmod 600)"
ENV="$APP_DIR/.env"
if [[ ! -f "$ENV" ]]; then
  gen() { openssl rand -hex "$1"; }
  cat > "$ENV" <<EOF
PROJETO_NOME=${PROJETO_NOME}
SUBDOMINIO=${SUBDOMINIO}
LE_EMAIL=${LE_EMAIL}
POSTGRES_DB=harmonia
POSTGRES_USER=harmonia
POSTGRES_PASSWORD=$(gen 24)
REDIS_PASSWORD=$(gen 24)
JWT_SECRET=$(gen 48)
DATA_ENCRYPTION_KEY=$(gen 32)
TURN_SECRET=$(gen 24)
ANTHROPIC_API_KEY=
AI_MODEL=claude-sonnet-4-5
ADMIN_EMAIL=${LE_EMAIL}
ADMIN_PASSWORD=$(gen 12)
CLOUDFLARE_TUNNEL_TOKEN=
EOF
  chmod 600 "$ENV"
fi

log "5/7 Escolhendo portas altas livres (nenhuma < 1024, nenhuma ocupada)"
log "Portas já em uso neste servidor: $(ports_in_use | tr '\n' ' ')"
ensure_ports "$ENV"
chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV"
HTTP_PORT="$(env_get "$ENV" HTTP_PORT)"
TURN_PORT="$(env_get "$ENV" TURN_PORT)"
TURN_MIN="$(env_get "$ENV" TURN_MIN_PORT)"; TURN_MAX="$(env_get "$ENV" TURN_MAX_PORT)"

log "6/7 Firewall (sem derrubar serviços existentes)"
SSH_PORT="$(ss -Htlnp 2>/dev/null | awk '/sshd/ {print $4}' | sed -E 's/.*:([0-9]+)$/\1/' | head -1)"
SSH_PORT="${SSH_PORT:-22}"
if ufw status | grep -q "Status: active"; then
  log "UFW já ativo — mantendo regras existentes, só acrescentando as do TURN."
else
  # Antes de ativar: libera TODAS as portas públicas que já estão em escuta,
  # para não interromper nenhum serviço que já roda neste servidor.
  while read -r proto port; do
    ufw allow "${port}/${proto}" comment 'servico existente' >/dev/null
  done < <(ss -Htlnu | awk '$5 !~ /^(127\.|\[::1\])/ {split($5,a,":"); print ($1=="udp"?"udp":"tcp"), a[length(a)]}' | sort -u)
  ufw allow "${SSH_PORT}/tcp" comment 'SSH' >/dev/null
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw --force enable
fi
ufw allow "${TURN_PORT}/tcp" comment 'harmonIA TURN' >/dev/null
ufw allow "${TURN_PORT}/udp" comment 'harmonIA TURN' >/dev/null
ufw allow "${TURN_MIN}:${TURN_MAX}/udp" comment 'harmonIA TURN relay' >/dev/null
# HTTP_PORT NÃO é liberado: escuta só em 127.0.0.1 e é acessado pelo proxy local.
systemctl enable --now fail2ban
if [[ "${HARDEN_SSH:-0}" == "1" ]]; then
  sed -i -E 's/^#?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
  warn "Login por senha desativado. Teste 'ssh ${DEPLOY_USER}@<ip>' em outra janela antes de sair."
fi

log "7/7 Publicação HTTPS de ${SUBDOMINIO} pelo proxy existente → 127.0.0.1:${HTTP_PORT}"
PROXY="none"
if systemctl is-active --quiet nginx 2>/dev/null; then PROXY="nginx"
elif systemctl is-active --quiet apache2 2>/dev/null; then PROXY="apache"
elif systemctl is-active --quiet caddy 2>/dev/null; then PROXY="caddy"
elif docker ps --format '{{.Image}}' | grep -qiE 'traefik|nginx-proxy|caddy'; then PROXY="docker-proxy"; fi
log "Proxy detectado: ${PROXY}"

case "$PROXY" in
  nginx)
    sed -e "s/__HTTP_PORT__/${HTTP_PORT}/g" "$APP_DIR/infra/host-proxy/nginx-harmonia.conf" \
      > "/etc/nginx/sites-available/${SUBDOMINIO}"
    ln -sf "/etc/nginx/sites-available/${SUBDOMINIO}" "/etc/nginx/sites-enabled/${SUBDOMINIO}"
    nginx -t && systemctl reload nginx
    apt-get install -y certbot python3-certbot-nginx
    # certbot --nginx usa o nginx que JÁ escuta em 80/443 (nenhuma porta nova é aberta)
    certbot --nginx -d "$SUBDOMINIO" -m "$LE_EMAIL" --agree-tos --no-eff-email --redirect --non-interactive
    ;;
  apache)
    a2enmod proxy proxy_http proxy_wstunnel headers rewrite >/dev/null
    sed -e "s/__HTTP_PORT__/${HTTP_PORT}/g" "$APP_DIR/infra/host-proxy/apache-harmonia.conf" \
      > "/etc/apache2/sites-available/${SUBDOMINIO}.conf"
    a2ensite "${SUBDOMINIO}.conf" >/dev/null && apachectl configtest && systemctl reload apache2
    apt-get install -y certbot python3-certbot-apache
    certbot --apache -d "$SUBDOMINIO" -m "$LE_EMAIL" --agree-tos --no-eff-email --redirect --non-interactive
    ;;
  caddy)
    warn "Caddy detectado. Acrescente ao Caddyfile e rode 'systemctl reload caddy' (TLS automático):"
    sed -e "s/__HTTP_PORT__/${HTTP_PORT}/g" "$APP_DIR/infra/host-proxy/Caddyfile.snippet"
    ;;
  docker-proxy)
    warn "Proxy em container (Traefik/nginx-proxy) detectado. Veja infra/host-proxy/README.md"
    warn "para ligar o serviço 'nginx' do harmonIA à rede do seu proxy."
    ;;
  none)
    warn "Nenhum proxy ocupa 80/443. Pela regra do projeto o harmonIA não abre essas portas."
    warn "Use o túnel Cloudflare (sem portas de entrada): preencha CLOUDFLARE_TUNNEL_TOKEN em ${ENV}"
    warn "e suba com: docker compose --profile tunnel up -d  (veja infra/host-proxy/README.md)"
    ;;
esac

cat > /etc/cron.d/harmonia-backup <<EOF
40 2 * * * ${DEPLOY_USER} cd ${APP_DIR} && bash infra/scripts/backup.sh
EOF

log "Concluído."
log "  App interno:  http://127.0.0.1:${HTTP_PORT}  (não exposto à internet)"
log "  TURN WebRTC:  ${TURN_PORT}/tcp+udp, relay ${TURN_MIN}-${TURN_MAX}/udp"
log "  Senha inicial do admin: $(env_get "$ENV" ADMIN_PASSWORD)"
log "Próximo: cadastre os secrets no GitHub e faça push na main."
