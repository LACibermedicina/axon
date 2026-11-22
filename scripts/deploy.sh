#!/usr/bin/env bash
# axon — build e restart na VPS (chamado pelo GitHub Actions via SSH ou pelo autoupdate.sh). Idempotente.
# Imagens são marcadas com a versão (axon-api:<versão>); se a nova não ficar saudável, volta à última boa.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib-ports.sh
SHA="${1:-manual}"; SOURCE="${2:-manual}"
V="$(cat VERSION)"; STATUS=data/status; mkdir -p "$STATUS"
echo "[deploy] axon v$V · commit ${SHA} · origem ${SOURCE}"
[[ -f .env ]] || { echo ".env ausente — rode: sudo bash scripts/setup_vps.sh <email>"; exit 1; }
HP="$(env_get .env HTTP_PORT)"
if [[ -z "$HP" ]] || { ! port_is_free "$HP" && ! is_axon_http "$HP" && [[ " $(own_ports | tr '\n' ' ') " != *" $HP "* ]]; }; then
  echo "[deploy] ERRO: HTTP_PORT=${HP:-vazia} ocupada por outro serviço. Rode setup_vps.sh. Nada foi alterado."; exit 1
fi
[[ -f frontend/release.json ]] || { command -v python3 >/dev/null && python3 scripts/release.py json --sha "${SHA:0:7}" >/dev/null 2>&1 || true; }
PREV="$(cat "$STATUS/last_good" 2>/dev/null || true)"
export GIT_SHA="$SHA" AXON_VERSION="$V"
docker compose build --pull
docker compose up -d --remove-orphans
healthy=0
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:$HP/api/health" 2>/dev/null | grep -q "\"version\":\"$V\""; then healthy=1; break; fi; sleep 3
done
if [[ $healthy -eq 1 ]]; then
  echo "$V" > "$STATUS/last_good"
  printf '{"version":"%s","sha":"%s","source":"%s","at":"%s"}\n' "$V" "$SHA" "$SOURCE" "$(date -u +%FT%TZ)" > "$STATUS/deploy.json"
  echo "[deploy] OK: v$V saudável em 127.0.0.1:$HP"
  docker image prune -f >/dev/null
  # mantém as 3 versões mais recentes de cada imagem para rollback rápido
  for img in axon-api axon-web; do docker images "$img" --format '{{.Tag}}' | sort -V | head -n -3 | xargs -r -I{} docker rmi "$img:{}" >/dev/null 2>&1 || true; done
  docker compose ps
else
  echo "[deploy] FALHA: v$V não ficou saudável."
  if [[ -n "$PREV" && "$PREV" != "$V" ]]; then
    echo "[deploy] Rollback para v$PREV (imagens locais)"; AXON_VERSION="$PREV" docker compose up -d --no-build --remove-orphans || true
  fi
  exit 1
fi
