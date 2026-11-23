#!/usr/bin/env bash
# =============================================================================
# axon — provisionamento da VPS (Ubuntu 22.04/24.04, Debian 12) em /opt/axon
# Seguro para servidor COMPARTILHADO (outras apps LACibermedicina, Odoo, sites):
#   • nenhuma porta < 1024 e nenhuma porta ocupada é aberta pelo axon;
#   • HTTPS pelo proxy já existente (nginx/apache + certbot) com rollback se o vhost quebrar;
#   • UFW: só é ajustado se já estiver ativo (garante 22/80/443); nunca é ligado à força;
#   • Traefik próprio apenas com AXON_TRAEFIK=1 em VPS dedicada.
#
# Uso (root):  bash scripts/setup_vps.sh <email-letsencrypt> [arquivo-chave-publica-deploy]
# Opcionais:   AXON_TRAEFIK=1 · AXON_PROFILES=collab,data · HARDEN_SSH=1 · SKIP_BUILD=1
# =============================================================================
set -Eeuo pipefail
trap 'echo -e "\n\033[1;31m[axon] ERRO na linha $LINENO: $BASH_COMMAND\033[0m\nNada foi alterado nos outros serviços." >&2' ERR

PROJETO_NOME="axon"
SUBDOMINIO="axon.m3d.pro"
APP_DIR="/opt/${PROJETO_NOME}"
DEPLOY_USER="deploy"
LE_EMAIL="${1:-}"
DEPLOY_PUBKEY_FILE="${2:-}"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
. "$SRC_DIR/scripts/lib-ports.sh"

log()  { printf '\033[1;36m[axon]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m  !\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m  ✗ %s\033[0m\n' "$*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || die "Execute como root (sudo)."
[[ "$LE_EMAIL" == *@*.* ]] || die "Informe um e-mail válido: setup_vps.sh voce@dominio"

log "1/8 Checando o servidor"
FREE_GB=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
ok "Disco livre: ${FREE_GB} GB · RAM: ${MEM_MB} MB"
[[ "$FREE_GB" -ge 3 ]] || die "Menos de 3 GB livres em /."

log "2/8 Pacotes"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null 2>&1 || warn "apt-get update teve avisos — seguindo."
apt-get install -y ca-certificates curl gnupg rsync jq iproute2 openssl dnsutils git >/dev/null
ok "ok"

log "3/8 Docker e Compose"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh >/dev/null
systemctl enable --now docker >/dev/null 2>&1 || true
docker compose version >/dev/null 2>&1 || apt-get install -y docker-compose-plugin >/dev/null
ok "$(docker --version | cut -d, -f1)"

log "4/8 Usuário '${DEPLOY_USER}' (chave SSH, sem sudo, grupo docker)"
id -u "$DEPLOY_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"; passwd -l "$DEPLOY_USER" >/dev/null 2>&1 || true
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/${DEPLOY_USER}/.ssh"
touch "/home/${DEPLOY_USER}/.ssh/authorized_keys"
if [[ -n "$DEPLOY_PUBKEY_FILE" && -s "$DEPLOY_PUBKEY_FILE" ]]; then
  grep -qxF "$(cat "$DEPLOY_PUBKEY_FILE")" "/home/${DEPLOY_USER}/.ssh/authorized_keys" \
    || cat "$DEPLOY_PUBKEY_FILE" >> "/home/${DEPLOY_USER}/.ssh/authorized_keys"
  ok "Chave de deploy do GitHub (secret VPS_SSH_KEY) autorizada"
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/${DEPLOY_USER}/.ssh"; chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"

log "5/8 Código em ${APP_DIR}"
install -d "$APP_DIR" "$APP_DIR/data" "$APP_DIR/data/status"
[[ "$SRC_DIR" != "$APP_DIR" ]] && rsync -a --delete --exclude '.env' --exclude 'data/' --exclude '.git/' "$SRC_DIR/" "$APP_DIR/"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
ok "Versão $(cat "$APP_DIR/VERSION")"

log "6/8 Segredos (.env, chmod 600) — chaves de IA chegam do GitHub (SERVIDOR_ENV)"
ENV="$APP_DIR/.env"
if [[ ! -f "$ENV" ]]; then
  gen() { openssl rand -hex "$1"; }
  sed -e "s/^LE_EMAIL=.*/LE_EMAIL=${LE_EMAIL}/" \
      -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(gen 24)/" \
      -e "s/^NEO4J_PASSWORD=.*/NEO4J_PASSWORD=$(gen 24)/" \
      -e "s/^JWT_SECRET=.*/JWT_SECRET=$(gen 48)/" "$APP_DIR/.env.example" > "$ENV"
  ok ".env criado a partir de .env.example"
else
  ok ".env existente preservado (chaves de IA são mescladas pelo merge-env.sh)"
fi
[[ -n "${AXON_PROFILES:-}" ]] && env_set "$ENV" COMPOSE_PROFILES "$AXON_PROFILES"
[[ -n "$(env_get "$ENV" AUTOUPDATE)" ]] || env_set "$ENV" AUTOUPDATE 1
[[ -n "$(env_get "$ENV" AUTOUPDATE_REPO)" ]] || env_set "$ENV" AUTOUPDATE_REPO "https://github.com/LACibermedicina/axon.git"
env_set "$ENV" API_WORKERS "$([[ "$MEM_MB" -lt 4000 ]] && echo 1 || echo 2)"
chmod 600 "$ENV"

log "7/8 Portas e firewall"
ensure_ports "$ENV"; chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV"
HTTP_PORT="$(env_get "$ENV" HTTP_PORT)"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
  ok "UFW ativo: 22/80/443 garantidas; ${HTTP_PORT} permanece só em 127.0.0.1"
else
  warn "UFW desligado — não alterado (para não afetar outros serviços)."
fi
if [[ "${HARDEN_SSH:-0}" == "1" ]]; then
  sed -i -E 's/^#?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
  systemctl reload ssh 2>/dev/null || systemctl reload sshd; warn "SSH por senha desativado."
fi

log "Atualização automática (timer systemd a cada 2 min, só tags aprovadas no CI)"
cat > /etc/systemd/system/axon-autoupdate.service <<UNIT
[Unit]
Description=axon — aplica a última versão aprovada (tag v*) com rollback
After=docker.service network-online.target
[Service]
Type=oneshot
User=${DEPLOY_USER}
WorkingDirectory=${APP_DIR}
ExecStart=/bin/bash ${APP_DIR}/scripts/autoupdate.sh
UNIT
cat > /etc/systemd/system/axon-autoupdate.timer <<UNIT
[Unit]
Description=axon — verifica novas versões a cada 2 minutos
[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
RandomizedDelaySec=20
[Install]
WantedBy=timers.target
UNIT
git config --system --add safe.directory "$APP_DIR" 2>/dev/null || true
systemctl daemon-reload && systemctl enable --now axon-autoupdate.timer >/dev/null && ok "axon-autoupdate.timer ativo (journalctl -u axon-autoupdate)"

log "8/8 Stack e HTTPS"
cd "$APP_DIR"
COMPOSE=(docker compose)
[[ "${AXON_TRAEFIK:-0}" == "1" ]] && COMPOSE+=(-f docker-compose.yml -f infra/traefik/docker-compose.traefik.yml)
if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  export AXON_VERSION="$(cat VERSION)"; "${COMPOSE[@]}" build && "${COMPOSE[@]}" up -d --remove-orphans && echo "$AXON_VERSION" > data/status/last_good 2>/dev/null || true
  for i in $(seq 1 40); do
    curl -fsS "http://127.0.0.1:${HTTP_PORT}/api/health" >/dev/null 2>&1 && { ok "App em 127.0.0.1:${HTTP_PORT}"; break; }
    [[ $i -eq 40 ]] && die "App não respondeu. Veja: docker compose logs --tail=80 api web"; sleep 3
  done
fi
if [[ "${AXON_TRAEFIK:-0}" == "1" ]]; then
  ok "Traefik + Let's Encrypt (ACME HTTP-01) atendendo ${SUBDOMINIO}"; exit 0
fi
PROXY=none
systemctl is-active --quiet nginx 2>/dev/null && PROXY=nginx
[[ $PROXY == none ]] && systemctl is-active --quiet apache2 2>/dev/null && PROXY=apache
DNS_IP="$( { dig +short A "$SUBDOMINIO" @1.1.1.1 2>/dev/null || getent ahostsv4 "$SUBDOMINIO" | awk '{print $1}'; } | { grep -E '^[0-9.]+$' || true; } | tail -1)"
ok "Proxy do host: ${PROXY} · DNS ${SUBDOMINIO} → ${DNS_IP:-não encontrado}"
case "$PROXY" in
  nginx)
    apt-get install -y certbot python3-certbot-nginx >/dev/null
    VH="/etc/nginx/sites-available/${SUBDOMINIO}"
    # outros vhosts já atendendo o mesmo domínio (ex.: instalação anterior) são desativados, com backup
    BK="/etc/nginx/axon-vhost-backup-$(date +%Y%m%d%H%M%S)"; moved=()
    for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
      [[ -e "$f" && "$(basename "$f")" != "$SUBDOMINIO" ]] || continue
      names="$( { grep -oE '(^|[[:space:]{;])server_name[[:space:]][^;]*' "$f" || true; } | sed -E 's/^.*server_name//' | tr ' \t' '\n\n' | { grep -v '^$' || true; } | sort -u)"
      grep -qxF "$SUBDOMINIO" <<<"$names" || continue
      if [[ "$(grep -vxF "$SUBDOMINIO" <<<"$names" | { grep -v '^$' || true; })" != "" ]]; then
        warn "$f também atende outros domínios — não alterado; confira se ele ainda responde por ${SUBDOMINIO}"; continue; fi
      mkdir -p "$BK"; mv "$f" "$BK/"; moved+=("$f")
    done
    [[ ${#moved[@]} -gt 0 ]] && warn "vhosts anteriores de ${SUBDOMINIO} desativados (backup em $BK): ${moved[*]}"
    sed "s/__HTTP_PORT__/${HTTP_PORT}/" infra/host-proxy/nginx-axon.conf > "$VH"
    ln -sf "$VH" "/etc/nginx/sites-enabled/${SUBDOMINIO}"
    if nginx -t >/dev/null 2>&1; then systemctl reload nginx; ok "vhost nginx ativo"
    else rm -f "/etc/nginx/sites-enabled/${SUBDOMINIO}"; for f in "${moved[@]}"; do mv "$BK/$(basename "$f")" "$f"; done
      die "vhost quebrou o nginx — removido e anteriores restaurados (rollback)."; fi
    [[ -n "$DNS_IP" ]] && certbot --nginx -n --agree-tos -m "$LE_EMAIL" -d "$SUBDOMINIO" --redirect \
      && ok "Let's Encrypt emitido (renovação: certbot.timer)" || warn "Aponte o DNS A de ${SUBDOMINIO} e rode: certbot --nginx -d ${SUBDOMINIO}";;
  apache)
    apt-get install -y certbot python3-certbot-apache >/dev/null; a2enmod proxy proxy_http proxy_wstunnel headers >/dev/null
    cat > "/etc/apache2/sites-available/${SUBDOMINIO}.conf" <<EOF
<VirtualHost *:80>
  ServerName ${SUBDOMINIO}
  ProxyPreserveHost On
  ProxyPass /ws/ ws://127.0.0.1:${HTTP_PORT}/ws/
  ProxyPass / http://127.0.0.1:${HTTP_PORT}/
  ProxyPassReverse / http://127.0.0.1:${HTTP_PORT}/
</VirtualHost>
EOF
    a2ensite "${SUBDOMINIO}" >/dev/null
    apachectl configtest >/dev/null 2>&1 && systemctl reload apache2 || { a2dissite "${SUBDOMINIO}"; die "vhost quebrou o apache (rollback)."; }
    certbot --apache -n --agree-tos -m "$LE_EMAIL" -d "$SUBDOMINIO" --redirect || warn "Rode certbot --apache após o DNS propagar.";;
  *) warn "Nenhum proxy no host. Use AXON_TRAEFIK=1 (VPS dedicada) ou instale nginx e rode de novo.";;
esac
log "Pronto: https://${SUBDOMINIO}  ·  versão $(cat VERSION)"
