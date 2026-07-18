#!/usr/bin/env bash
# Restauration d'une sauvegarde Chiffréo (base Postgres + volume uploads) — OPS-3.
#
# Deux modes, même chemin de code :
#   --mode verify (défaut) : cible jetable auto-créée, restaurée, vérifiée,
#                             puis détruite (sauf --keep). Sûr par défaut —
#                             ne touche jamais une base/volume réel.
#   --mode prod             : cible explicite (VPS réel), jamais détruite
#                             automatiquement. Nécessite une confirmation
#                             explicite si la cible correspond à un nom protégé.
#
# Voir docs/deploy/BACKUP.md pour la procédure complète (drill de
# vérification routine, et reprise sur sinistre).
set -euo pipefail
umask 077

MODE="verify"
DB_BACKUP=""
UPLOADS_BACKUP=""
DB_TARGET=""
UPLOADS_TARGET=""
KEEP=0
CONFIRM_PROD=0
PROTECTED_TARGETS=("chiffreo-db" "chiffreo_uploads")

usage() {
  cat <<'EOF'
Usage: restore.sh --db-backup PATH.dump.gpg [--uploads-backup PATH.tar.gz.gpg]
                   [--mode verify|prod] [--db-target NAME] [--uploads-target VOLUME]
                   [--keep] [--yes-i-know-this-is-production]

  --mode verify (défaut) : cible jetable, testée puis détruite.
  --mode prod             : restauration réelle, cible explicite requise.
  --keep                  : (mode verify) ne pas détruire la cible à la fin.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --db-backup) DB_BACKUP="$2"; shift 2 ;;
    --uploads-backup) UPLOADS_BACKUP="$2"; shift 2 ;;
    --mode) MODE="$2"; shift 2 ;;
    --db-target) DB_TARGET="$2"; shift 2 ;;
    --uploads-target) UPLOADS_TARGET="$2"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    --yes-i-know-this-is-production) CONFIRM_PROD=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Option inconnue: $1" >&2; usage; exit 1 ;;
  esac
done

[ -n "$DB_BACKUP" ] || { echo "ERREUR: --db-backup requis" >&2; usage; exit 1; }
[ "$MODE" = "verify" ] || [ "$MODE" = "prod" ] || { echo "ERREUR: --mode doit être 'verify' ou 'prod'" >&2; exit 1; }

for cmd in docker gpg; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "ERREUR: '$cmd' introuvable" >&2; exit 1; }
done

TS="$(date -u +%Y%m%dT%H%M%SZ)"
WORKDIR="$(mktemp -d)"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

decrypt_file() {
  local src="$1" dest="$2"
  gpg --batch --yes --output "$dest" --decrypt "$src"
}

wait_for_postgres() {
  # Un conteneur postgres neuf démarre une instance temporaire (init des
  # scripts), l'arrête, puis relance l'instance définitive : pg_isready peut
  # répondre "ready" pendant la fenêtre transitoire, juste avant l'arrêt.
  # On attend donc la 2ᵉ occurrence du message de démarrage dans les logs,
  # seul signal fiable que l'instance définitive est bien celle qui tourne.
  local container="$1" tries=60
  until [ "$(docker logs "$container" 2>&1 | grep -c 'database system is ready to accept connections')" -ge 2 ]; do
    tries=$((tries - 1))
    [ "$tries" -gt 0 ] || { echo "ERREUR: postgres ($container) jamais prêt" >&2; return 1; }
    sleep 1
  done
}

restore_db() {
  local container="$1" db_user="$2" db_password="$3" db_name="$4" plain_dump="$5"
  log "Restauration base → $container/$db_name…"
  docker cp "$plain_dump" "$container:/tmp/restore.dump"
  docker exec -e PGPASSWORD="$db_password" "$container" \
    pg_restore -U "$db_user" -d "$db_name" \
    --clean --if-exists --no-owner --no-privileges -j2 /tmp/restore.dump
  docker exec "$container" rm -f /tmp/restore.dump
}

restore_uploads() {
  local target_volume="$1" plain_tar="$2"
  log "Restauration uploads → volume $target_volume…"
  docker volume create "$target_volume" >/dev/null
  docker run --rm \
    -v "$target_volume":/data \
    -v "$(dirname "$plain_tar")":/backup:ro \
    alpine sh -c "tar xzf /backup/$(basename "$plain_tar") -C /data"
}

sanity_check() {
  local container="$1" db_user="$2" db_password="$3" db_name="$4" table_count
  table_count="$(docker exec -e PGPASSWORD="$db_password" "$container" \
    psql -U "$db_user" -d "$db_name" -tAc \
    "select count(*) from information_schema.tables where table_schema='public';" | tr -d '[:space:]')"
  log "Tables restaurées (public): $table_count"
  [ "$table_count" -gt 0 ] || { echo "ÉCHEC: 0 table restaurée" >&2; return 1; }
  if [ -n "${SANITY_CHECK_SQL:-}" ]; then
    log "Requête de contrôle: $SANITY_CHECK_SQL"
    docker exec -e PGPASSWORD="$db_password" "$container" \
      psql -U "$db_user" -d "$db_name" -tAc "$SANITY_CHECK_SQL"
  fi
}

confirm_protected_target() {
  local target="$1" protected
  for protected in "${PROTECTED_TARGETS[@]}"; do
    if [ "$target" = "$protected" ]; then
      [ "$CONFIRM_PROD" -eq 1 ] || {
        echo "ERREUR: cible '$target' protégée — ajouter --yes-i-know-this-is-production" >&2
        exit 1
      }
      echo "Vous allez restaurer PAR-DESSUS '$target'. Tapez le nom exact pour confirmer :"
      read -r reply
      [ "$reply" = "$target" ] || { echo "ERREUR: confirmation invalide, abandon." >&2; exit 1; }
    fi
  done
}

main() {
  local db_container db_user db_password db_name uploads_volume

  if [ "$MODE" = "verify" ]; then
    db_container="${DB_TARGET:-chiffreo-restore-verify-$TS}"
    uploads_volume="${UPLOADS_TARGET:-chiffreo-restore-verify-uploads-$TS}"
    db_user="restore"
    db_password="restore"
    db_name="restore_verify"

    log "Cible jetable: conteneur $db_container"
    docker run -d --name "$db_container" \
      -e POSTGRES_USER="$db_user" -e POSTGRES_PASSWORD="$db_password" \
      -e POSTGRES_DB="$db_name" \
      postgres:16-alpine >/dev/null
    wait_for_postgres "$db_container"

    if [ "$KEEP" -ne 1 ]; then
      # Détruit la cible jetable (conteneur + volume anonyme + volume uploads)
      # quel que soit le chemin de sortie (succès, échec de sanity_check, etc.)
      # afin qu'un drill de vérification ne laisse jamais de ressources trainantes.
      # shellcheck disable=SC2064
      trap "docker rm -f -v '$db_container' >/dev/null 2>&1 || true; [ -n '$UPLOADS_BACKUP' ] && docker volume rm '$uploads_volume' >/dev/null 2>&1 || true; rm -rf '$WORKDIR'" EXIT
    else
      trap "rm -rf '$WORKDIR'" EXIT
    fi
  else
    [ -n "$DB_TARGET" ] || { echo "ERREUR: --db-target requis en --mode prod" >&2; exit 1; }
    db_container="$DB_TARGET"
    uploads_volume="$UPLOADS_TARGET"
    db_user="${DB_USERNAME:-chiffreo}"
    db_password="${DB_PASSWORD:?DB_PASSWORD requis en --mode prod (mot de passe de la base cible)}"
    db_name="${DB_NAME:-chiffreo}"
    confirm_protected_target "$db_container"
    [ -z "$uploads_volume" ] || confirm_protected_target "$uploads_volume"
    trap "rm -rf '$WORKDIR'" EXIT
  fi

  local plain_dump="$WORKDIR/db.dump"
  decrypt_file "$DB_BACKUP" "$plain_dump"
  restore_db "$db_container" "$db_user" "$db_password" "$db_name" "$plain_dump"
  sanity_check "$db_container" "$db_user" "$db_password" "$db_name"

  if [ -n "$UPLOADS_BACKUP" ]; then
    [ -n "$uploads_volume" ] || { echo "ERREUR: --uploads-target requis avec --uploads-backup" >&2; exit 1; }
    local plain_tar="$WORKDIR/uploads.tar.gz"
    decrypt_file "$UPLOADS_BACKUP" "$plain_tar"
    restore_uploads "$uploads_volume" "$plain_tar"
  fi

  echo "RESTAURATION: PASS"
}

main
