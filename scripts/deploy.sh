#!/usr/bin/env bash
# axon — executado na VPS pelo GitHub Actions (usuário deploy). Idempotente.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib-ports.sh
SHA="${1:-manual}"
echo "[deploy] axon $(cat VERSION) · commit ${SHA}"
[[ -f .env ]] || { echo ".env ausente — rode: sudo bash scripts/setup_vps.sh <email>"; exit 1; }
HP="$(env_get .env HTTP_PORT)"
if [[ -z "$HP" ]] || { ! port_is_free "$HP" && ! is_axon_http "$HP" && [[ " $(own_ports | tr '\n' ' ') " != *" $HP "* ]]; }; then
  echo "[deploy] ERRO: HTTP_PORT=${HP:-vazia} ocupada por outro serviço. Rode setup_vps.sh. Nada foi alterado."; exit 1
fi
export GIT_SHA="$SHA"
docker compose build --pull
docker compose up -d --remove-orphans
for _ in $(seq 1 30); do curl -fsS "http://127.0.0.1:$HP/api/health" >/dev/null 2>&1 && break; sleep 3; done
docker image prune -f >/dev/null
docker compose ps
