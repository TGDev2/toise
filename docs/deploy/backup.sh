#!/usr/bin/env bash
# Sauvegarde chiffrée de Chiffréo (base Postgres + volume uploads) — OPS-3.
# Destiné à être lancé depuis cron sur le VPS, en root.
# Voir docs/deploy/BACKUP.md pour la mise en place (clé GPG, config, cron).
#
# Deux usages :
#   (défaut)            sauvegarde complète nocturne (base + uploads).
#   --pre-deploy <tag>  point de restauration pris juste avant un déploiement,
#                       par la CD (E6-5). Voir POINT DE RESTAURATION ci-dessous.
set -euo pipefail
umask 077

# ─── Point de restauration pré-déploiement ────────────────────────────
#
# Un seul drapeau porte les trois différences avec le run nocturne, plutôt que
# trois drapeaux qu'il faudrait penser à combiner à chaque appel :
#
#   1. l'artefact est nommé `…-predeploy-<tag>`, pour que la procédure de retour
#      arrière puisse le désigner sans ambiguïté (docs/DEPLOY.md) ;
#   2. **base seule** : une migration ne touche pas le volume `uploads`, et les
#      fichiers restent alors un sur-ensemble de ce que le dump référence — le
#      sens bénin décrit au §1 de BACKUP.md. Faire attendre chaque déploiement
#      derrière une archive de photos coûterait des minutes pour rien ;
#   3. **aucun ping de supervision** : `BACKUP_MONITOR_URL` surveille le *cron*.
#      Un ping émis par un déploiement masquerait un run nocturne manquant,
#      c'est-à-dire précisément ce que ce moniteur existe pour voir. L'échec,
#      lui, est déjà signalé — bruyamment — par la CD qui rougit.
PRE_DEPLOY_TAG=""

while [ $# -gt 0 ]; do
  case "$1" in
    --pre-deploy)
      [ $# -ge 2 ] || { echo "ERREUR: --pre-deploy attend un tag" >&2; exit 1; }
      # Le tag finit dans un nom de fichier : tout ce qui n'est pas sûr y
      # devient `_`.
      PRE_DEPLOY_TAG="$(printf '%s' "$2" | tr -c 'A-Za-z0-9._-' '_')"
      [ -n "$PRE_DEPLOY_TAG" ] || { echo "ERREUR: --pre-deploy attend un tag non vide" >&2; exit 1; }
      shift 2
      ;;
    -h|--help)
      echo "Usage: backup.sh [--pre-deploy <tag>]"
      exit 0
      ;;
    *)
      echo "Option inconnue: $1" >&2
      exit 1
      ;;
  esac
done

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

# Image utilitaire pour lire le volume uploads. Debian et non Alpine : la passe
# de rattrapage ci-dessous exige `tar --append` et `find -newermt`, que le tar
# et le find de BusyBox ne connaissent pas.
HELPER_IMAGE="${HELPER_IMAGE:-debian:12-slim}"

# Destination rclone de la copie hors-site (ex. `b2:chiffreo-backups/vps`).
# Vide = sauvegardes conservées uniquement sur le VPS qu'elles protègent.
BACKUP_REMOTE="${BACKUP_REMOTE:-}"

# URL de supervision, convention healthchecks.io : pingée à la fin d'un run
# réussi, suffixée `/fail` sur échec. Couvre aussi le cas qu'aucune alerte sur
# échec ne voit — le cron qui n'a pas tourné du tout.
BACKUP_MONITOR_URL="${BACKUP_MONITOR_URL:-}"

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

REQUIRED_COMMANDS=(docker gpg gzip)
[ -z "$BACKUP_REMOTE" ] || REQUIRED_COMMANDS+=(rclone)
[ -z "$BACKUP_MONITOR_URL" ] || REQUIRED_COMMANDS+=(curl)
for cmd in "${REQUIRED_COMMANDS[@]}"; do
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
UPLOADS_TAR="$BACKUP_DIR/.tmp/uploads-${TS}.tar"

# Marque le point de restauration dans le nom du fichier. La rotation
# (`chiffreo-*.gpg`) continue de le voir, donc il vieillit comme les autres.
NAME_SUFFIX=""
[ -z "$PRE_DEPLOY_TAG" ] || NAME_SUFFIX="-predeploy-${PRE_DEPLOY_TAG}"
DB_BACKUP_NAME="chiffreo-db-${TS}${NAME_SUFFIX}.dump.gpg"

# Repère de la passe de rattrapage (cf. « Instantané cohérent » plus bas). Une
# seconde de marge : `find -newermt` compare des mtimes à la seconde, et un
# fichier écrit pendant la seconde du repère serait sinon manqué par les deux
# passes.
MARK_EPOCH=$(( START_TIME - 1 ))

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

ping_monitor() {
  # Muet en pré-déploiement : voir l'en-tête, point 3.
  [ -z "$PRE_DEPLOY_TAG" ] || return 0
  [ -n "$BACKUP_MONITOR_URL" ] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "${BACKUP_MONITOR_URL}${1:-}" \
    || echo "AVERTISSEMENT: ping de supervision impossible (${BACKUP_MONITOR_URL}${1:-})" >&2
}

cleanup_tmp() {
  rm -f "$BACKUP_DIR"/.tmp/db.* "$BACKUP_DIR"/.tmp/enc.* \
        "$BACKUP_DIR"/.tmp/uploads-*.tar "$BACKUP_DIR"/.tmp/uploads-*.tar.gz 2>/dev/null || true
}

on_exit() {
  local rc=$?
  cleanup_tmp
  if [ "$rc" -ne 0 ]; then
    echo "ÉCHEC de la sauvegarde (code $rc)" >&2
    ping_monitor /fail
  fi
}
trap on_exit EXIT

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

# uploads_container <commande shell exécutée dans le conteneur>
# Volume monté en lecture seule : la sauvegarde ne peut rien abîmer.
uploads_container() {
  docker run --rm \
    -v "$UPLOADS_VOLUME":/data:ro \
    -v "$BACKUP_DIR/.tmp":/backup \
    -e MARK="$MARK_EPOCH" \
    -e ARCHIVE="/backup/uploads-${TS}.tar" \
    "$HELPER_IMAGE" sh -c "$1"
}

# ─── Instantané cohérent base ↔ fichiers ──────────────────────────
#
# Le dump et l'archive portent sur des données vivantes : rien ne les fige
# ensemble. L'ordre et le rattrapage ci-dessous rendent malgré tout l'ensemble
# restaurable, en garantissant une propriété unique et vérifiable :
#
#   le jeu de fichiers archivé est un SUR-ENSEMBLE de ce que le dump référence.
#
# - passe de base à t0, AVANT le dump : tout fichier existant à t0 est capturé,
#   y compris ceux qu'une suppression fera disparaître ensuite ;
# - dump à t1 ;
# - passe de rattrapage à t2, APRÈS le dump : tout fichier apparu ou modifié
#   depuis t0 est ajouté à la même archive.
#
# Toute ligne du dump (état à t1) référence un fichier qui existait à t1 : soit
# il existait déjà à t0 (passe de base), soit il est né dans (t0, t1] et son
# mtime le place dans la passe de rattrapage. Donc jamais de référence sans
# fichier — le seul défaut possible est un fichier sans ligne, orphelin bénin.
#
# Reste hors de portée : un fichier créé *et* supprimé à l'intérieur de la
# fenêtre alors que le dump le référence encore. Fermer cette course-là
# demanderait un instantané de système de fichiers (LVM/ZFS), pas un tar.

snapshot_uploads() {
  log "Instantané du volume uploads ($UPLOADS_VOLUME)…"
  uploads_container 'set -eu; tar cf "$ARCHIVE" -C /data .'
  log "OK: instantané de base"
}

append_uploads_delta() {
  log "Rattrapage des fichiers apparus pendant le dump…"
  uploads_container '
    set -eu
    cd /data
    find . -newermt "@$MARK" -print0 > /tmp/delta.list0
    if [ -s /tmp/delta.list0 ]; then
      tar rf "$ARCHIVE" --null --no-recursion -T /tmp/delta.list0
    fi
    printf "entrées rattrapées: %s\n" "$(tr -cd "\0" < /tmp/delta.list0 | wc -c)"
  '
}

finalize_uploads() {
  # Compression sur l'hôte : un aller-retour conteneur de moins, et `.tar.gz`
  # reste le format qu'attend restore.sh.
  gzip -n "$UPLOADS_TAR"
  encrypt_to "${UPLOADS_TAR}.gz" "chiffreo-uploads-${TS}.tar.gz.gpg"
  rm -f "${UPLOADS_TAR}.gz"
  log "OK: chiffreo-uploads-${TS}.tar.gz.gpg"
}

backup_database() {
  log "Sauvegarde base de données ($DB_CONTAINER/$DB_NAME)…"
  local tmp_dump
  tmp_dump="$(mktemp "$BACKUP_DIR/.tmp/db.XXXXXX")"
  docker exec -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    pg_dump -U "$DB_USERNAME" -Fc "$DB_NAME" > "$tmp_dump"
  encrypt_to "$tmp_dump" "$DB_BACKUP_NAME"
  rm -f "$tmp_dump"
  log "OK: $DB_BACKUP_NAME"
}

# ─── Copie hors-site ──────────────────────────────────────────────
push_offsite() {
  if [ -z "$BACKUP_REMOTE" ]; then
    log "AVERTISSEMENT: BACKUP_REMOTE non configuré — prod et sauvegardes" \
        "partagent le même disque, une panne les emporte ensemble (BACKUP.md §5)."
    return 0
  fi
  log "Copie hors-site → $BACKUP_REMOTE…"
  # `copy` et non `sync`, délibérément : une sauvegarde hors-site qui reflète
  # les suppressions locales n'en est pas une — un VPS compromis effacerait la
  # copie distante avec la sienne. La rétention distante se règle côté
  # fournisseur (règle de cycle de vie), hors d'atteinte du VPS.
  # shellcheck disable=SC2086
  rclone copy "$BACKUP_DIR" "$BACKUP_REMOTE" \
    --include 'chiffreo-*.gpg' --no-traverse ${RCLONE_FLAGS:-}
  log "OK: copie hors-site"
}

rotate_old_backups() {
  log "Rotation (rétention ${RETENTION_DAYS}j)…"
  find "$BACKUP_DIR" -maxdepth 1 -name 'chiffreo-*.gpg' -mtime "+${RETENTION_DAYS}" -print -delete
}

main() {
  if [ -n "$PRE_DEPLOY_TAG" ]; then
    log "Point de restauration pré-déploiement ($PRE_DEPLOY_TAG) — base seule."
    backup_database
    push_offsite
    # Pas de rotation ici : supprimer est le seul geste irréversible de ce
    # script, et un déploiement n'a rien à effacer. Le cron nocturne s'en charge.
    local duration=$(( $(date +%s) - START_TIME ))
    log "Terminé en ${duration}s."
    # Dernière ligne, format stable : la CD la capture pour nommer le point de
    # restauration dans son résumé d'échec (docs/DEPLOY.md, retour arrière).
    echo "BACKUP_FILE=$BACKUP_DIR/$DB_BACKUP_NAME"
    return 0
  fi

  snapshot_uploads      # t0 — avant le dump
  backup_database       # t1
  append_uploads_delta  # t2 — après le dump
  finalize_uploads

  push_offsite
  rotate_old_backups

  local duration=$(( $(date +%s) - START_TIME ))
  log "Terminé en ${duration}s. Contenu de $BACKUP_DIR :"
  ls -lh "$BACKUP_DIR"/chiffreo-*.gpg 2>/dev/null || true
  ping_monitor
}

main "$@"
