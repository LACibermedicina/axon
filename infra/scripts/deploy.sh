#!/usr/bin/env bash
# Executado na VPS pelo GitHub Actions (usuário deploy). Idempotente.
# Garante a regra de portas: nada < 1024, nada ocupado por outro serviço.
set -euo pipefail
cd "$(dirname "$0")/../.."
. infra/scripts/lib-ports.sh
SHA="${1:-manual}"
echo "[deploy] versão $(cat VERSION) commit ${SHA}"
[[ -f .env ]] || { echo ".env ausente — rode: sudo bash infra/scripts/setup-vps.sh <email>"; exit 1; }

# Confere se as portas gravadas continuam válidas (livres ou do próprio harmonIA).
cp .env /tmp/harmonia-ports-check.env
ensure_ports /tmp/harmonia-ports-check.env >/dev/null
for k in HTTP_PORT TURN_PORT TURN_MIN_PORT TURN_MAX_PORT; do
  if [[ "$(env_get .env "$k")" != "$(env_get /tmp/harmonia-ports-check.env "$k")" ]]; then
    echo "[deploy] ERRO: $k=$(env_get .env "$k") agora está ocupada por outro serviço ou ausente."
    echo "         Rode 'sudo bash infra/scripts/setup-vps.sh <email>' para escolher novas portas"
    echo "         e atualizar o proxy/firewall. Nada foi alterado."
    rm -f /tmp/harmonia-ports-check.env; exit 1
  fi
done
rm -f /tmp/harmonia-ports-check.env
echo "[deploy] portas: HTTP 127.0.0.1:$(env_get .env HTTP_PORT) · TURN $(env_get .env TURN_PORT) · relay $(env_get .env TURN_MIN_PORT)-$(env_get .env TURN_MAX_PORT)"

export GIT_SHA="$SHA"
docker compose build --pull
docker compose up -d --remove-orphans
docker compose exec -T api python -m app.migrate
docker image prune -f >/dev/null
docker compose ps
