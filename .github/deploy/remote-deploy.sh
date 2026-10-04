#!/usr/bin/env bash
# Läuft auf dem VPS (per SSH aus .github/workflows/deploy.yml hineingepipt).
# Erwartet als Umgebungsvariablen:
#   DEPLOY_PATH   Ordner mit docker-compose.yml und .env (z. B. /opt/proxyprinter)
#   SERVICE       Compose-Service, der aktualisiert wird (backend | frontend)
#   TAG_VAR       Variable in .env, die den Image-Tag hält (BACKEND_TAG | FRONTEND_TAG)
#   NEW_TAG       Neuer Tag, oder "previous" für einen Rollback auf den vorherigen Tag
#   GHCR_USER, GHCR_TOKEN  Kurzlebiger Login für ghcr.io (GITHUB_TOKEN des Workflows)
#   HEALTH_URL    Optional: URL, die aus dem Frontend-Container erreichbar sein muss
set -euo pipefail

cd "$DEPLOY_PATH"
touch .env

# Nur ein Deploy gleichzeitig (Frontend und Backend teilen sich die .env)
exec 9>.deploy.lock
flock -w 300 9

get_var() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- || true; }
set_var() {
  if grep -qE "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}

OLD_TAG="$(get_var "$TAG_VAR")"
PREV_TAG="$(get_var "${TAG_VAR}_PREVIOUS")"

if [ "$NEW_TAG" = "previous" ]; then
  if [ -z "$PREV_TAG" ]; then echo "Kein ${TAG_VAR}_PREVIOUS in .env, Rollback nicht möglich" >&2; exit 1; fi
  NEW_TAG="$PREV_TAG"
fi

echo "$SERVICE: ${OLD_TAG:-<leer>} -> $NEW_TAG"

echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

set_var "$TAG_VAR" "$NEW_TAG"
if ! docker compose pull "$SERVICE"; then
  [ -n "$OLD_TAG" ] && set_var "$TAG_VAR" "$OLD_TAG"
  echo "Image konnte nicht geladen werden, .env zurückgesetzt" >&2
  exit 1
fi
docker compose up -d --no-deps "$SERVICE"

healthy() {
  local cid
  cid="$(docker compose ps -q "$SERVICE")"
  [ -n "$cid" ] || return 1
  [ "$(docker inspect -f '{{.State.Running}}' "$cid")" = "true" ] || return 1
  if [ -n "${HEALTH_URL:-}" ]; then
    docker compose exec -T frontend wget -q -O /dev/null -T 5 "$HEALTH_URL" 2>/dev/null || return 1
  fi
}

for i in $(seq 1 30); do
  if healthy; then
    if [ -n "$OLD_TAG" ] && [ "$OLD_TAG" != "$NEW_TAG" ]; then set_var "${TAG_VAR}_PREVIOUS" "$OLD_TAG"; fi
    echo "$SERVICE läuft mit $NEW_TAG"
    docker image prune -f >/dev/null || true
    exit 0
  fi
  sleep 5
done

echo "$SERVICE ist nach 150 s nicht gesund, Rollback auf ${OLD_TAG:-<nichts>}" >&2
docker compose logs --tail 80 "$SERVICE" >&2 || true
if [ -n "$OLD_TAG" ]; then
  set_var "$TAG_VAR" "$OLD_TAG"
  docker compose up -d --no-deps "$SERVICE"
fi
exit 1
