#!/usr/bin/env bash
# Restauration d'une sauvegarde Toisé (base Postgres + volume uploads) — OPS-3.
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
PROTECTED_TARGETS=("toise-db" "toise_uploads")

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
  # Un conteneur postgres neuf démarre une instance temporaire (exécution des
  # scripts d'init), l'arrête, puis lance l'instance définitive. Pendant cette
  # fenêtre, `pg_isready` **sur le socket unix** répond déjà « accepting
  # connections » — et la connexion suivante tombe sur
  # `FATAL: the database system is shutting down`, en plein `pg_restore`.
  #
  # Le signal fiable est TCP : l'instance temporaire est démarrée par
  # `docker_temp_server_start()` avec, dans les mots de l'entrypoint de
  # l'image, « does not listen on external TCP/IP ». Une sonde sur 127.0.0.1
  # ne peut donc réussir que contre l'instance définitive.
  #
  # Comptait auparavant les occurrences du message de démarrage dans
  # `docker logs`. Ce repère ne vaut que pour un conteneur qui vient de
  # naître : sur une base de production démarrée depuis des semaines, le
  # journal en contient une seule (ou plus aucune, après rotation), et la
  # boucle n'aurait jamais rendu la main.
  local container="$1" user="$2" db="$3" tries=60
  until docker exec "$container" pg_isready -h 127.0.0.1 -U "$user" -d "$db" >/dev/null 2>&1; do
    tries=$((tries - 1))
    [ "$tries" -gt 0 ] || { echo "ERREUR: postgres ($container) jamais prêt" >&2; return 1; }
    sleep 1
  done
}

# Refuse de restaurer par-dessus une application encore branchée.
#
# `docs/DEPLOY.md` demande `stop api web` avant toute restauration, et
# `BACKUP.md` §7 le suppose. Le script, lui, ne vérifiait rien : lancé sur une
# base vivante il rendait `RESTAURATION: PASS` pendant que l'API continuait de
# servir un schéma qu'on était en train de remplacer sous ses pieds. Une
# consigne que rien ne fait respecter n'est pas une consigne.
assert_no_active_clients() {
  local container="$1" db_user="$2" db_password="$3" db_name="$4" clients
  clients="$(docker exec -e PGPASSWORD="$db_password" "$container" \
    psql -U "$db_user" -d postgres -tAqc \
    "select count(*) from pg_stat_activity where datname = '$db_name' and pid <> pg_backend_pid();" \
    | tr -d '[:space:]')"
  [ "${clients:-0}" -eq 0 ] && return 0
  cat >&2 <<EOF
ERREUR: $clients connexion(s) encore ouverte(s) sur « $db_name ».
        Arrêter l'application avant de restaurer :
          docker compose -f docker-compose.prod.yml stop api web
EOF
  return 1
}

# Restaure dans une base RECRÉÉE, jamais par-dessus l'existante.
#
# `pg_restore --clean` ne supprime que ce que le dump connaît. Tout ce qui est
# né après la sauvegarde survit donc à la « restauration » — et la table
# `migrations`, elle, revient en arrière puisqu'elle *est* dans le dump. Le
# schéma et son registre se retrouvent en désaccord.
#
# Mesuré, pas supposé : restaurer un dump antérieur à la migration 078 sur une
# base où elle avait tourné laisse `data_export_requests` en place et sa ligne
# absente de `migrations`. Au redémarrage suivant, le runner rejoue la 078,
# `CREATE TABLE` tombe sur `heap_create_with_catalog: relation already exists`,
# `migrate.js` sort en 3 et le conteneur API boucle en `Restarting`. C'est
# exactement le chemin de recours documenté d'un retour arrière (DEPLOY.md), et
# l'ancienne version rendait `RESTAURATION: PASS` dessus.
#
# Contrepartie assumée : la base cible est détruite avant que la restauration
# n'ait fait ses preuves. Ce n'est pas une régression — `--clean` la démolissait
# déjà objet par objet — et le dump reste la source de vérité en main.
recreate_database() {
  local container="$1" db_user="$2" db_password="$3" db_name="$4"
  log "Recréation de la base « $db_name » (ce que le dump ignore ne doit pas survivre)…"
  docker exec -e PGPASSWORD="$db_password" "$container" \
    psql -U "$db_user" -d postgres -q -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"$db_name\";" \
    -c "CREATE DATABASE \"$db_name\" OWNER \"$db_user\";"
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
    db_container="${DB_TARGET:-toise-restore-verify-$TS}"
    uploads_volume="${UPLOADS_TARGET:-toise-restore-verify-uploads-$TS}"
    db_user="restore"
    db_password="restore"
    db_name="restore_verify"

    log "Cible jetable: conteneur $db_container"
    docker run -d --name "$db_container" \
      -e POSTGRES_USER="$db_user" -e POSTGRES_PASSWORD="$db_password" \
      -e POSTGRES_DB="$db_name" \
      postgres:16-alpine >/dev/null

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
    db_user="${DB_USERNAME:-toise}"
    db_password="${DB_PASSWORD:?DB_PASSWORD requis en --mode prod (mot de passe de la base cible)}"
    db_name="${DB_NAME:-toise}"
    confirm_protected_target "$db_container"
    [ -z "$uploads_volume" ] || confirm_protected_target "$uploads_volume"
    trap "rm -rf '$WORKDIR'" EXIT
  fi

  # Attente commune aux deux modes, et c'est le mode `prod` qui en avait le
  # plus besoin : la reprise sur sinistre (BACKUP.md §7) enchaîne
  # `up -d postgres` sur un VPS neuf et cette restauration. La cible y est
  # donc, elle aussi, un conteneur qui vient de naître — celui qui traverse la
  # fenêtre où le serveur s'arrête. L'attente n'était faite que pour la cible
  # jetable du mode `verify`, celle qui risquait le moins.
  wait_for_postgres "$db_container" "$db_user" "$db_name"

  # En mode `verify`, la cible vient d'être créée par ce script : elle est vide
  # par construction, rien ne peut y survivre et personne n'y est branché. Les
  # deux garde-fous ci-dessous n'ont de sens que sur une base réelle.
  if [ "$MODE" = "prod" ]; then
    assert_no_active_clients "$db_container" "$db_user" "$db_password" "$db_name"
    recreate_database "$db_container" "$db_user" "$db_password" "$db_name"
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
