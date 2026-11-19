#!/usr/bin/env bash
# Executado na VPS pelo GitHub Actions. Idempotente.
set -euo pipefail
cd "$(dirname "$0")/../.."
SHA="${1:-manual}"
echo "[deploy] versão $(cat VERSION) commit ${SHA}"
[[ -f .env ]] || { echo ".env ausente — rode setup-vps.sh"; exit 1; }
export GIT_SHA="$SHA"
docker compose pull --ignore-buildable --quiet || true
docker compose build --pull
docker compose up -d --remove-orphans
docker compose exec -T api python -m app.migrate
docker image prune -f >/dev/null
docker compose ps
