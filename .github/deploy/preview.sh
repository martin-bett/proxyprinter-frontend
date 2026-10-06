#!/usr/bin/env bash
# Testumgebungen auf dem VPS. Läuft per SSH aus .github/workflows/ci.yml bzw. preview-close.yml
# (die Datei ist in mtgprint und mtgprint-front identisch).
#
#   test.proxyprinter.eu          Stand von develop: eigene Datenbank (Kopie der Produktion), Backend, Frontend
#   <slug>.test.proxyprinter.eu   ein PR bzw. ein Thread (gleicher Branch-Name in beiden Repos, slug = Hash davon);
#                                 startet nur, was der PR ändert, der Rest kommt von develop
#
# Erwartet als Umgebungsvariablen:
#   ACTION        deploy | close | purge
#   SIDE          backend | frontend (das Repo, aus dem der Aufruf kommt)
#   SLUG          "develop" oder die ersten 6 Zeichen von sha256(Branch-Name), in beiden Repos gleich
#   LEGACY_SLUG   Optional: alter, langer Name derselben Umgebung, wird einmalig entfernt
#   NEW_TAG       Image-Tag (nur bei deploy)
#   GHCR_USER, GHCR_TOKEN   Kurzlebiger Login für ghcr.io (nur bei deploy)
#   PROD_PATH     Ordner der Produktion (für die erste Datenbank-Kopie), z. B. /root/mnt/proxyprinter
#   PREVIEW_ROOT  Standard /root/mnt/proxyprinter-test
#   PREVIEW_DOMAIN Standard test.proxyprinter.eu
# und vorher definiert: apply_migrations (ruft run_migration <name> <base64> für jedes SQL-Skript auf)
set -euo pipefail

PREVIEW_ROOT="${PREVIEW_ROOT:-/root/mnt/proxyprinter-test}"
PREVIEW_DOMAIN="${PREVIEW_DOMAIN:-test.proxyprinter.eu}"
OWNER_IMAGE="ghcr.io/martin-bett/mtgprint"
ACME_ROOT=/var/www/proxyprinter-test-acme
HTPASSWD=/etc/nginx/proxyprinter-test.htpasswd
NGINX_DIR=/etc/nginx/conf.d
DEVELOP_PORT=8100

[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]{0,39}$ ]] || { echo "Ungültiger SLUG: $SLUG" >&2; exit 1; }
[ "$SIDE" = backend ] || [ "$SIDE" = frontend ] || { echo "Ungültige SIDE: $SIDE" >&2; exit 1; }

# Noch nicht eingerichtet: überspringen, damit CI nicht rot wird
if [ ! -f "$PREVIEW_ROOT/.env" ]; then
  echo "::warning::Testumgebungen sind auf dem Server noch nicht eingerichtet ($PREVIEW_ROOT/.env fehlt, siehe deploy/PREVIEW.md), übersprungen"
  exit 0
fi
# Umgebung des gleichen Branches unter dem alten, langen Namen (vor den kurzen Namen) einmalig entfernen
if [ -n "${LEGACY_SLUG:-}" ] && [ "$LEGACY_SLUG" != "$SLUG" ] && [[ "$LEGACY_SLUG" =~ ^[a-z0-9][a-z0-9-]{0,39}$ ]] \
   && [ "$LEGACY_SLUG" != develop ] && [ -d "$PREVIEW_ROOT/envs/$LEGACY_SLUG" ]; then
  ACTION=purge SLUG="$LEGACY_SLUG" LEGACY_SLUG= bash "$0" || true
fi

cd "$PREVIEW_ROOT"
exec 9>.lock
flock -w 600 9

if [ "$SLUG" = develop ]; then
  ENV_DIR="$PREVIEW_ROOT/develop"; HOST="$PREVIEW_DOMAIN"; PROJECT=ppt-develop; DB_NAME=proxymaster
else
  ENV_DIR="$PREVIEW_ROOT/envs/$SLUG"; HOST="$SLUG.$PREVIEW_DOMAIN"; PROJECT="ppt-$SLUG"; DB_NAME="pr_${SLUG//-/_}"
fi
NGINX_CONF="$NGINX_DIR/proxyprinter-test-$HOST.conf"
URL="https://$HOST"

log() { echo "[$SLUG] $*"; }

# ---------- Datenbank (Postgres-Container der develop-Umgebung) ----------
db_container() { docker compose -p ppt-develop ps -q db 2>/dev/null; }
db_exec() { # db_exec <datenbank> [psql-Argumente...]
  local db="$1"; shift
  docker exec -i "$(db_container)" psql -X -q -v ON_ERROR_STOP=1 -U mtguser -d "$db" "$@"
}
db_exists() { [ "$(db_exec postgres -tA -c "SELECT count(*) FROM pg_database WHERE datname = '$1'")" = 1 ]; }

wait_db() {
  for _ in $(seq 1 30); do
    if [ -n "$(db_container)" ] && docker exec "$(db_container)" pg_isready -U mtguser -d proxymaster >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  echo "Test-Datenbank startet nicht" >&2; docker compose -p ppt-develop logs --tail 50 db >&2 || true; exit 1
}

# Erste Befüllung der develop-Datenbank: Kopie der Produktion ohne Log-Einträge
seed_develop_db() {
  [ -f "$PREVIEW_ROOT/develop/.seeded" ] && return 0
  log "Kopiere die Produktions-Datenbank (ohne app_log-Inhalte) nach test"
  local svc
  svc="$(cd "$PROD_PATH" && docker compose ps --format '{{.Service}} {{.Image}}' | awk '$2 ~ /postgres/ {print $1; exit}')"
  [ -n "$svc" ] || { echo "Kein Postgres in $PROD_PATH gefunden" >&2; exit 1; }
  # Reste eines abgebrochenen Versuchs entfernen (nur die Test-Datenbank)
  db_exec proxymaster -c "SET client_min_messages = warning; DROP SCHEMA IF EXISTS proxymaster CASCADE"
  (cd "$PROD_PATH" && docker compose exec -T "$svc" sh -c \
      'pg_dump -U "$POSTGRES_USER" -d "${POSTGRES_DB:-$POSTGRES_USER}" --no-owner --no-privileges --exclude-table-data=proxymaster.app_log') \
    | db_exec proxymaster >/dev/null
  touch "$PREVIEW_ROOT/develop/.seeded"
}

# PR mit eigenem Backend: eigene Datenbank als Kopie von develop (nur beim ersten Mal)
create_pr_db() {
  db_exists "$DB_NAME" && return 0
  log "Lege Datenbank $DB_NAME als Kopie der test-Datenbank an"
  db_exec postgres -c "CREATE DATABASE $DB_NAME"
  if ! docker exec "$(db_container)" pg_dump -U mtguser -d proxymaster --no-owner --no-privileges | db_exec "$DB_NAME" >/dev/null; then
    db_exec postgres -c "DROP DATABASE $DB_NAME WITH (FORCE)" || true
    echo "Kopie der test-Datenbank fehlgeschlagen" >&2; exit 1
  fi
}

APPLIED=0
run_migration() {
  local name="$1" content="$2"
  if [ "$(db_exec "$DB_NAME" -tA -v name="$name" <<< "SELECT count(*) FROM proxymaster.schema_migration WHERE filename = :'name';")" != "0" ]; then
    return 0
  fi
  echo "Migration $name ($DB_NAME)"
  printf '%s' "$content" | base64 -d | db_exec "$DB_NAME" >/dev/null
  db_exec "$DB_NAME" -v name="$name" <<< "INSERT INTO proxymaster.schema_migration (filename) VALUES (:'name');"
  APPLIED=$((APPLIED + 1))
}

# ---------- Compose-Datei aus dem Zustand (backend_tag / frontend_tag) erzeugen ----------
tag_of() { cat "$ENV_DIR/$1_tag" 2>/dev/null || true; }

write_compose() {
  local btag ftag port
  btag="$(tag_of backend)"; ftag="$(tag_of frontend)"; port="$(cat "$ENV_DIR/port")"
  {
    echo "# Automatisch erzeugt von preview.sh, nicht von Hand ändern"
    echo "name: $PROJECT"
    echo "services:"
    if [ "$SLUG" = develop ]; then
      cat <<EOF
  db:
    image: postgres:15
    restart: unless-stopped
    environment:
      POSTGRES_USER: mtguser
      POSTGRES_PASSWORD: \${DB_PASSWORD}
      POSTGRES_DB: proxymaster
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      default:
      db:
        aliases: [ppt-db]
EOF
    fi
    if [ -n "$btag" ]; then
      cat <<EOF
  backend:
    image: ${OWNER_IMAGE}-backend:$btag
    restart: unless-stopped
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://ppt-db:5432/$DB_NAME
      SPRING_DATASOURCE_USERNAME: mtguser
      SPRING_DATASOURCE_PASSWORD: \${DB_PASSWORD}
      APP_PUBLIC_URL: $URL
      PDF_MAX_SIZE_MB: "100"
      JAVA_TOOL_OPTIONS: -Xmx512m
EOF
      # PR-Backends: speicherintensive Funktionen aus bzw. kurz halten (develop bleibt wie die Produktion)
      [ "$SLUG" != develop ] && cat <<EOF
      SEARCHCACHE_ENABLED: "false"
      PDF_RETENTION_DAYS: "1"
      UPLOAD_RETENTION_DAYS: "1"
      LOG_DB_RETENTION_DAYS: "3"
EOF
      cat <<EOF
    networks:
      default:
      db:
EOF
      # Nur das develop-Backend hängt im api-Netz: dort finden reine Frontend-PRs es unter "backend"
      [ "$SLUG" = develop ] && echo "      api:"
    fi
    # Jede Umgebung hat ein Frontend, ohne eigenes Image das von develop
    cat <<EOF
  frontend:
    image: ${OWNER_IMAGE}-frontend:${ftag:-develop}
    restart: unless-stopped
    ports:
      - "127.0.0.1:$port:80"
    networks:
EOF
    # Ohne eigenes Backend leitet das Frontend /api an das develop-Backend weiter (api-Netz)
    if [ -z "$btag" ] && [ "$SLUG" != develop ]; then echo "      api:"; else echo "      default:"; fi
    cat <<EOF
networks:
  db:
    name: ppt-db
    external: true
  api:
    name: ppt-api
    external: true
EOF
    [ "$SLUG" = develop ] && printf 'volumes:\n  db-data:\n'
  } > "$ENV_DIR/docker-compose.yml"
  ln -sf "$PREVIEW_ROOT/.env" "$ENV_DIR/.env"
}

free_port() {
  local p used
  used="$(cat "$PREVIEW_ROOT"/envs/*/port 2>/dev/null || true)"
  for p in $(seq 8101 8199); do
    grep -qx "$p" <<< "$used" || { echo "$p"; return 0; }
  done
  echo "Keine freien Ports mehr (8101-8199)" >&2; exit 1
}

# ---------- nginx + Zertifikat ----------
setup_nginx() {
  local port; port="$(cat "$ENV_DIR/port")"
  if [ -f "$NGINX_CONF" ] && grep -q "127.0.0.1:$port;" "$NGINX_CONF"; then return 0; fi
  if [ ! -f "/etc/letsencrypt/live/$HOST/fullchain.pem" ]; then
    log "Hole Zertifikat für $HOST"
    certbot certonly --webroot -w "$ACME_ROOT" -d "$HOST" --cert-name "$HOST" \
      --non-interactive --agree-tos --keep-until-expiring --deploy-hook "systemctl reload nginx"
  fi
  cat > "$NGINX_CONF" <<EOF
# Automatisch erzeugt von preview.sh (Testumgebung $SLUG)
server {
    listen 443 ssl;
    server_name $HOST;
    ssl_certificate /etc/letsencrypt/live/$HOST/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$HOST/privkey.pem;

    auth_basic "proxyprinter Test";
    auth_basic_user_file $HTPASSWD;
    add_header X-Robots-Tag "noindex, nofollow" always;
    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
EOF
  if ! nginx -t 2>/tmp/ppt-nginx-test.log; then
    cat /tmp/ppt-nginx-test.log >&2
    rm -f "$NGINX_CONF"
    echo "nginx-Konfiguration ungültig, nichts geändert" >&2; exit 1
  fi
  systemctl reload nginx
}

remove_nginx() {
  if [ -f "$NGINX_CONF" ]; then
    rm -f "$NGINX_CONF"
    nginx -t && systemctl reload nginx
  fi
  certbot delete --cert-name "$HOST" --non-interactive >/dev/null 2>&1 || true
}

healthy() {
  local port; port="$(cat "$ENV_DIR/port")"
  curl -fs -o /dev/null -m 5 "http://127.0.0.1:$port/" || return 1
  # Backend über das Frontend: das eigene oder das von develop
  if [ -n "$(tag_of backend)" ] || [ "$SLUG" != develop ]; then
    curl -fs -o /dev/null -m 5 "http://127.0.0.1:$port/api/pdf/limits" || return 1
  fi
}

# ---------- Aktionen ----------
deploy() {
  if [ "$SLUG" != develop ] && [ -z "$(cat "$PREVIEW_ROOT/develop/backend_tag" 2>/dev/null)" ]; then
    echo "::warning::test.proxyprinter.eu läuft noch nicht (CI auf develop starten, siehe deploy/PREVIEW.md), PR-Umgebung übersprungen"
    return 0
  fi
  mkdir -p "$ENV_DIR"
  [ -f "$ENV_DIR/port" ] || { if [ "$SLUG" = develop ]; then echo "$DEVELOP_PORT"; else free_port; fi > "$ENV_DIR/port"; }

  local old_tag; old_tag="$(tag_of "$SIDE")"
  echo "$NEW_TAG" > "$ENV_DIR/${SIDE}_tag"
  log "$SIDE: ${old_tag:-<develop>} -> $NEW_TAG"
  write_compose

  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
  (cd "$ENV_DIR" && docker compose pull "$SIDE")

  if [ "$SIDE" = backend ]; then
    if [ "$SLUG" = develop ]; then
      (cd "$ENV_DIR" && docker compose up -d db)
      wait_db
      seed_develop_db
    else
      wait_db
      create_pr_db
    fi
    db_exec "$DB_NAME" -c "SET client_min_messages = warning; CREATE TABLE IF NOT EXISTS proxymaster.schema_migration (
      filename varchar(255) PRIMARY KEY, applied_at timestamp NOT NULL DEFAULT now());"
    apply_migrations
  fi

  # Fehlt ein Image des anderen Repos lokal (z. B. frontend:develop beim allerersten Mal), lädt compose es nach
  (cd "$ENV_DIR" && docker compose up -d --remove-orphans)

  for _ in $(seq 1 30); do
    if healthy; then
      log "läuft: $URL"
      setup_nginx
      docker image prune -f >/dev/null || true
      echo "PREVIEW_URL=$URL"
      return 0
    fi
    sleep 5
  done
  echo "Testumgebung ist nach 150 s nicht erreichbar" >&2
  (cd "$ENV_DIR" && docker compose logs --tail 80) >&2 || true
  exit 1
}

teardown() {
  log "räume Testumgebung ab"
  local side tag
  (cd "$ENV_DIR" && docker compose down -v --remove-orphans) || true
  if [ -n "$(db_container)" ] && db_exists "$DB_NAME"; then db_exec postgres -c "DROP DATABASE $DB_NAME WITH (FORCE)"; fi
  remove_nginx
  for side in backend frontend; do
    tag="$(tag_of "$side")"
    [ -n "$tag" ] && docker image rm "${OWNER_IMAGE}-$side:$tag" >/dev/null 2>&1 || true
  done
  rm -rf "$ENV_DIR"
}

close() {
  [ "$SLUG" != develop ] || { echo "Die develop-Testumgebung wird nicht geschlossen" >&2; exit 1; }
  [ -d "$ENV_DIR" ] || { log "keine Testumgebung vorhanden"; return 0; }
  local old_tag; old_tag="$(tag_of "$SIDE")"
  local other=backend; [ "$SIDE" = backend ] && other=frontend
  if [ -n "$(tag_of "$other")" ]; then
    # Der PR im anderen Repo ist noch offen: dieser Teil läuft ab jetzt wieder vom develop-Stand
    rm -f "$ENV_DIR/${SIDE}_tag"
    log "$SIDE geschlossen, Testumgebung bleibt für den anderen PR"
    write_compose
    (cd "$ENV_DIR" && docker compose up -d --remove-orphans)
    if [ "$SIDE" = backend ] && db_exists "$DB_NAME"; then db_exec postgres -c "DROP DATABASE $DB_NAME WITH (FORCE)"; fi
    [ -n "$old_tag" ] && docker image rm "${OWNER_IMAGE}-$SIDE:$old_tag" >/dev/null 2>&1 || true
  else
    teardown
  fi
  docker image prune -f >/dev/null || true
}

# Komplett entfernen, egal welche PRs noch offen sind (Umgebungen mit altem, langem Namen)
purge() {
  [ "$SLUG" != develop ] || { echo "Die develop-Testumgebung wird nicht entfernt" >&2; exit 1; }
  [ -d "$ENV_DIR" ] || return 0
  teardown
  docker image prune -f >/dev/null || true
}

docker network inspect ppt-db >/dev/null 2>&1 || docker network create ppt-db >/dev/null
docker network inspect ppt-api >/dev/null 2>&1 || docker network create ppt-api >/dev/null
declare -F apply_migrations >/dev/null || apply_migrations() { :; }

case "$ACTION" in
  deploy) deploy ;;
  close) close ;;
  purge) purge ;;
  *) echo "Unbekannte ACTION: $ACTION" >&2; exit 1 ;;
esac
