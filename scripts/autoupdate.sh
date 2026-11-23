#!/usr/bin/env bash
# =============================================================================
# axon — atualização automática pela própria VPS (modelo "pull"; timer systemd a cada 2 min)
#
#  1. Consulta as tags v* do repositório (git ls-remote, sem limite de API).
#  2. Tags só existem para commits aprovados no CI (job release depende do job test).
#  3. Se a última tag for mais nova que VERSION: checkout da tag, deploy.sh, verificação de saúde.
#  4. Se falhar: volta para a versão anterior (rollback) e marca a tag como ruim.
# Convive com o deploy por SSH do GitHub Actions: os dois comparam pelo arquivo VERSION.
# Configuração em /opt/axon/.env: AUTOUPDATE=1 · AUTOUPDATE_REPO=https://github.com/LACibermedicina/axon.git
# Uso manual: bash scripts/autoupdate.sh [--force]
# =============================================================================
set -Eeuo pipefail
if [[ -z "${AXON_AU_COPY:-}" ]]; then   # roda de uma cópia: o checkout substitui este arquivo
  APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"; TMP="$(mktemp /tmp/axon-autoupdate.XXXXXX.sh)"; cp "$0" "$TMP"
  AXON_AU_COPY="$TMP" APP_DIR="$APP_DIR" exec bash "$TMP" "$@"
fi
trap 'rm -f "$AXON_AU_COPY"' EXIT
cd "$APP_DIR"; . scripts/lib-ports.sh
STATUS="$APP_DIR/data/status"; mkdir -p "$STATUS"; LOG="$STATUS/autoupdate.log"
exec 9>"$STATUS/.lock"; flock -n 9 || exit 0
log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG"; }
state() { printf '{"state":"%s","message":"%s","version":"%s","at":"%s"}\n' "$1" "$2" "$(cat VERSION)" "$(date -u +%FT%TZ)" > "$STATUS/autoupdate.json"; }
tail -n 2000 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG" || true

[[ "$(env_get .env AUTOUPDATE)" == "0" ]] && { state disabled "AUTOUPDATE=0"; exit 0; }
REPO="$(env_get .env AUTOUPDATE_REPO)"; REPO="${REPO:-https://github.com/LACibermedicina/axon.git}"
LATEST="$(git ls-remote --tags --refs "$REPO" 'v*' 2>/dev/null | awk '{print $2}' | sed 's#refs/tags/##' | sort -V | tail -1)"
[[ -n "$LATEST" ]] || { state error "nenhuma tag v* em $REPO"; exit 0; }
CUR="v$(cat VERSION)"; BAD="$STATUS/bad-tags"; touch "$BAD"
if [[ "${1:-}" != "--force" ]]; then
  [[ "$LATEST" == "$CUR" ]] && { state ok "em dia ($CUR)"; exit 0; }
  [[ "$(printf '%s\n%s\n' "$CUR" "$LATEST" | sort -V | tail -1)" == "$CUR" ]] && { state ok "versão local $CUR ≥ $LATEST"; exit 0; }
  grep -qx "$LATEST" "$BAD" && { state skipped "$LATEST marcada como ruim"; exit 0; }
fi
log "Atualizando $CUR → $LATEST"
[[ -d .git ]] || { git init -q; git remote add origin "$REPO"; }
git remote set-url origin "$REPO"; git config core.fileMode false
PREV="$(git rev-parse -q --verify HEAD 2>/dev/null || true)"
git fetch -q --depth 1 origin "refs/tags/$LATEST:refs/tags/$LATEST"
git checkout -q -f "$LATEST"
if bash scripts/deploy.sh "$(git rev-parse --short HEAD)" autoupdate >> "$LOG" 2>&1; then
  state ok "atualizado para $LATEST"; log "OK: $LATEST no ar"
else
  log "FALHA em $LATEST — rollback"; echo "$LATEST" >> "$BAD"
  if [[ -n "$PREV" ]]; then git checkout -q -f "$PREV"; bash scripts/deploy.sh "$(git rev-parse --short HEAD)" rollback >> "$LOG" 2>&1 || true; fi
  state error "falha ao aplicar $LATEST; mantida $CUR"
fi
