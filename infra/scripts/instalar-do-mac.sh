#!/usr/bin/env bash
# harmonIA — instala/atualiza na VPS a partir do Mac (rode NO MAC, não na VPS).
set -euo pipefail
VPS="159.223.22.82"
[[ "$(uname)" == "Darwin" ]] || { echo "⚠️  Rode este script no seu Mac (Terminal), não na VPS."; exit 1; }
read -rp "Seu usuário SSH na VPS (o que tem sudo) [lucasdasilvateixeira]: " U </dev/tty; U="${U:-lucasdasilvateixeira}"
if [[ "$U" == "deploy" || "$U" == "root" ]]; then echo "ℹ️  Use o seu usuário pessoal (com sudo), não '$U'. Usando lucasdasilvateixeira."; U="lucasdasilvateixeira"; fi
read -rp "E-mail para o certificado SSL (Let's Encrypt): " EMAIL </dev/tty
[[ "$EMAIL" == *@*.* ]] || { echo "E-mail inválido"; exit 1; }

# Usa o pacote mais recente (harmonia-vX.Y.Z-alpha.zip) — ou o caminho passado como 1º argumento
ZIP="${1:-$(ls -t ~/Downloads/harmonia-v*.zip ~/Desktop/harmonia-v*.zip ~/dev/harmonia-v*.zip 2>/dev/null | head -1 || true)}"
[[ -n "$ZIP" && -f "$ZIP" ]] || { echo "❌ Não achei harmonia-v*.zip em Downloads/Desktop/dev. Baixe o arquivo do chat e rode de novo."; exit 1; }
echo "📦 Pacote: $ZIP"

# 1) Chave pessoal do Mac → login sem senha na VPS (pede a senha só desta vez)
[[ -f ~/.ssh/id_ed25519 ]] || ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -C "lucas-mac"
ssh-copy-id -i ~/.ssh/id_ed25519.pub "$U@$VPS"

# 2) Chave exclusiva do GitHub Actions → usuário deploy
[[ -f ~/.ssh/harmonia_deploy ]] || ssh-keygen -t ed25519 -N "" -f ~/.ssh/harmonia_deploy -C "github-actions-harmonia"

# 3) Envia pacote + chave pública e roda o setup como root (pede a senha do sudo)
scp -q "$ZIP" "$U@$VPS:/tmp/harmonia.zip"
scp -q ~/.ssh/harmonia_deploy.pub "$U@$VPS:/tmp/harmonia_deploy.pub"
ssh -t "$U@$VPS" "sudo bash -c 'set -e; rm -rf /tmp/harmonia-src && mkdir -p /tmp/harmonia-src && cd /tmp/harmonia-src && (command -v unzip >/dev/null || apt-get install -y unzip >/dev/null) && unzip -q /tmp/harmonia.zip && bash harmonia/infra/scripts/setup-vps.sh \"$EMAIL\" /tmp/harmonia_deploy.pub; rm -f /tmp/harmonia.zip'"

# 4) Teste da chave de deploy e dados para o GitHub
if ssh -i ~/.ssh/harmonia_deploy -o BatchMode=yes -o StrictHostKeyChecking=accept-new deploy@"$VPS" "docker compose -f /opt/harmonia/docker-compose.yml ps --format '{{.Service}}: {{.State}}'"; then
  echo "✅ Chave de deploy OK."
fi
pbcopy < ~/.ssh/harmonia_deploy
cat <<MSG

──────────────── GitHub (Settings → Environments → production → secrets) ────────────────
  VPS_HOST     = $VPS
  VPS_USER     = deploy
  VPS_SSH_KEY  = (já está na área de transferência — só colar com ⌘V)
──────────────────────────────────────────────────────────────────────────────────────────
MSG
