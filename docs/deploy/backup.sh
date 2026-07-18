#!/usr/bin/env bash
# Sauvegarde chiffrée de Chiffréo (base Postgres + volume uploads) — OPS-3.
# Destiné à être lancé depuis cron sur le VPS, en root.
# Voir docs/deploy/BACKUP.md pour la mise en place (clé GPG, config, cron).
set -euo pipefail
umask 077

# ─── Configuration ────────────────────────────────────────────────
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/etc/chiffreo/backup.env}"
if [ -f "$BACKUP_ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$BACKUP_ENV_FILE"
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/chiffreo}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
GPG_RECIPIENT="${GPG_RECIPIENT:?GPG_RECIPIENT requis (clé publique de sauvegarde importée dans le trousseau)}"
APP_ENV_FILE="${APP_ENV_FILE:-/opt/chiffreo/.env}"
DB_CONTAINER="${DB_CONTAINER:-chiffreo-db}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-chiffreo_uploads}"

# Identifiants DB : source unique de vérité = le .env de l'appli (évite deux
# copies du mot de passe qui divergent). Peuvent être surchargés par
# l'environnement (tests locaux, voir BACKUP.md §7).
if [ -f "$APP_ENV_FILE" ]; then
  DB_USERNAME="${DB_USERNAME:-$(grep -m1 '^DB_USERNAME=' "$APP_ENV_FILE" | cut -d= -f2-)}"
  DB_PASSWORD="${DB_PASSWORD:-$(grep -m1 '^DB_PASSWORD=' "$APP_ENV_FILE" | cut -d= -f2-)}"
  DB_NAME="${DB_NAME:-$(grep -m1 '^DB_NAME=' "$APP_ENV_FILE" | cut -d= -f2-)}"
fi
DB_USERNAME="${DB_USERNAME:-chiffreo}"
DB_NAME="${DB_NAME:-chiffreo}"
: "${DB_PASSWORD:?DB_PASSWORD manquant (ni en variable, ni dans $APP_ENV_FILE)}"

for cmd in docker gpg; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "ERREUR: '$cmd' introuvable" >&2; exit 1; }
done

mkdir -p "$BACKUP_DIR" "$BACKUP_DIR/.tmp"
chmod 700 "$BACKUP_DIR" "$BACKUP_DIR/.tmp"

# ─── Verrou anti-chevauchement ────────────────────────────────────
LOCK_FILE="$BACKUP_DIR/.backup.lock"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "ERREUR: une sauvegarde est déjà en cours ($LOCK_FILE)" >&2; exit 1; }

TS="$(date -u +%Y%m%dT%H%M%SZ)"
START_TIME=$(date +%s)

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

cleanup_tmp() {
  rm -f "$BACKUP_DIR"/.tmp/db.* "$BACKUP_DIR"/.tmp/enc.* "$BACKUP_DIR"/.tmp/uploads-*.tar.gz 2>/dev/null || true
}
trap cleanup_tmp EXIT

# encrypt_to <fichier-source-clair> <nom-final-dans-BACKUP_DIR>
# Chiffre vers un fichier temporaire puis renomme (même filesystem ⇒
# renommage atomique) : un run interrompu ne laisse jamais de fichier
# corrompu au nom final.
encrypt_to() {
  local src="$1" dest_name="$2" tmp_enc
  tmp_enc="$(mktemp "$BACKUP_DIR/.tmp/enc.XXXXXX")"
  gpg --batch --yes --trust-model always --recipient "$GPG_RECIPIENT" \
      --output "$tmp_enc" --encrypt "$src"
  mv -f "$tmp_enc" "$BACKUP_DIR/$dest_name"
}

backup_database() {
  log "Sauvegarde base de données ($DB_CONTAINER/$DB_NAME)…"
  local tmp_dump
  tmp_dump="$(mktemp "$BACKUP_DIR/.tmp/db.XXXXXX")"
  docker exec -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    pg_dump -U "$DB_USERNAME" -Fc "$DB_NAME" > "$tmp_dump"
  encrypt_to "$tmp_dump" "chiffreo-db-${TS}.dump.gpg"
  rm -f "$tmp_dump"
  log "OK: chiffreo-db-${TS}.dump.gpg"
}

backup_uploads() {
  log "Sauvegarde volume uploads ($UPLOADS_VOLUME)…"
  local tmp_name="uploads-${TS}.tar.gz"
  docker run --rm \
    -v "$UPLOADS_VOLUME":/data:ro \
    -v "$BACKUP_DIR/.tmp":/backup \
    alpine tar czf "/backup/$tmp_name" -C /data .
  encrypt_to "$BACKUP_DIR/.tmp/$tmp_name" "chiffreo-uploads-${TS}.tar.gz.gpg"
  rm -f "$BACKUP_DIR/.tmp/$tmp_name"
  log "OK: chiffreo-uploads-${TS}.tar.gz.gpg"
}

rotate_old_backups() {
  log "Rotation (rétention ${RETENTION_DAYS}j)…"
  find "$BACKUP_DIR" -maxdepth 1 -name 'chiffreo-*.gpg' -mtime "+${RETENTION_DAYS}" -print -delete
}

main() {
  backup_database
  backup_uploads
  rotate_old_backups
  local duration=$(( $(date +%s) - START_TIME ))
  log "Terminé en ${duration}s. Contenu de $BACKUP_DIR :"
  ls -lh "$BACKUP_DIR"/chiffreo-*.gpg 2>/dev/null || true
}

main "$@"
