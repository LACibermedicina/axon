#!/usr/bin/env bash
# =============================================================================
# harmonIA — Setup inicial da VPS (Ubuntu 22.04/24.04 ou Debian 12)
# Uso (como root, UMA vez):
#   curl -fsSL <raw>/infra/scripts/setup-vps.sh | bash -s -- admin@m3d.pro
#   ou: sudo bash infra/scripts/setup-vps.sh admin@m3d.pro
#
# ⚠️  RISCOS ANTES DE EXECUTAR:
#   - Ativa UFW: garanta que a porta SSH (22 ou SSH_PORT) está liberada antes
#     de fechar a sessão atual, ou você perde o acesso.
#   - Desativa login root por senha. Confirme que sua chave pública funciona
#     com o usuário "deploy" em OUTRA sessão antes de sair.
# =============================================================================
set -euo pipefail

PROJETO_NOME="harmonia"
SUBDOMINIO="harmonia.m3d.pro"
APP_DIR="/opt/${PROJETO_NOME}"
DEPLOY_USER="deploy"
SSH_PORT="${SSH_PORT:-22}"
LE_EMAIL="${1:-}"

log() { printf '\033[1;35m[harmonIA]\033[0m %s\n' "$*"; }
[[ $EUID -eq 0 ]] || { echo "Execute como root"; exit 1; }
[[ -n "$LE_EMAIL" ]] || { echo "Informe o e-mail do Let's Encrypt: setup-vps.sh voce@dominio"; exit 1; }

log "1/8 Atualizando sistema e pacotes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw fail2ban rsync git unattended-upgrades jq

log "2/8 Instalando Docker Engine + Compose plugin"
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

log "3/8 Usuário de deploy (${DEPLOY_USER}) com acesso Docker"
id -u "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/${DEPLOY_USER}/.ssh"
if [[ -f /root/.ssh/authorized_keys ]]; then
  cp -n /root/.ssh/authorized_keys "/home/${DEPLOY_USER}/.ssh/authorized_keys" || true
  chown "$DEPLOY_USER:$DEPLOY_USER" "/home/${DEPLOY_USER}/.ssh/authorized_keys"
  chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"
fi

log "4/8 Árvore de diretórios em ${APP_DIR}"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
  "$APP_DIR" "$APP_DIR/data/postgres" "$APP_DIR/data/redis" "$APP_DIR/data/media" \
  "$APP_DIR/data/models" "$APP_DIR/data/backups" "$APP_DIR/certbot/conf" "$APP_DIR/certbot/www"

log "5/8 Firewall UFW (SSH ${SSH_PORT}, HTTP/HTTPS, TURN WebRTC)"
ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_PORT}/tcp" comment 'SSH'
ufw allow 80/tcp  comment 'HTTP (ACME + redirect)'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 3478/tcp comment 'TURN'
ufw allow 3478/udp comment 'TURN'
ufw allow 49160:49200/udp comment 'TURN relay'
ufw --force enable

log "6/8 Hardening SSH + fail2ban"
sed -i -E 's/^#?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i -E 's/^#?PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl reload ssh 2>/dev/null || systemctl reload sshd
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

log "7/8 Arquivo .env (segredos gerados localmente, permissão 600)"
if [[ ! -f "$APP_DIR/.env" ]]; then
  gen() { openssl rand -hex "$1"; }
  cat > "$APP_DIR/.env" <<EOF
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
# Preencha para tradução contextual e assistente (opcional):
ANTHROPIC_API_KEY=
AI_MODEL=claude-sonnet-4-5
ADMIN_EMAIL=${LE_EMAIL}
ADMIN_PASSWORD=$(gen 12)
EOF
  chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  log "Senha inicial do admin: $(grep ADMIN_PASSWORD "$APP_DIR/.env" | cut -d= -f2) (troque no primeiro login)"
fi

log "8/8 Certificado SSL Let's Encrypt (standalone, antes do Nginx subir)"
if [[ ! -d "$APP_DIR/certbot/conf/live/${SUBDOMINIO}" ]]; then
  docker run --rm -p 80:80 \
    -v "$APP_DIR/certbot/conf:/etc/letsencrypt" -v "$APP_DIR/certbot/www:/var/www/certbot" \
    certbot/certbot certonly --standalone -d "$SUBDOMINIO" \
    --email "$LE_EMAIL" --agree-tos --no-eff-email --non-interactive
fi
# Renovação automática (2x/dia) + reload do Nginx
cat > /etc/cron.d/harmonia-certbot <<EOF
17 3,15 * * * ${DEPLOY_USER} cd ${APP_DIR} && docker compose run --rm certbot renew --webroot -w /var/www/certbot --quiet && docker compose exec -T nginx nginx -s reload
EOF
# Backup diário do Postgres (retém 14 dias)
cat > /etc/cron.d/harmonia-backup <<EOF
40 2 * * * ${DEPLOY_USER} cd ${APP_DIR} && bash infra/scripts/backup.sh
EOF

log "Concluído. Aponte o DNS A de ${SUBDOMINIO} para este IP e faça push na main."
log "Secrets do GitHub: VPS_HOST, VPS_USER=${DEPLOY_USER}, VPS_SSH_KEY (chave privada de deploy)."
