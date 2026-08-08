#!/usr/bin/env bash
# Cycle complet de sauvegarde et de restauration, joué de bout en bout.
#
#   peupler → sauvegarder → DÉTRUIRE → restaurer → vérifier → démarrer l'appli
#
# Rejoué chaque semaine par la CI (.github/workflows/backup-drill.yml) et
# exécutable à la main sur n'importe quel hôte Linux avec Docker. C'est la
# seule preuve que `backup.sh` produit des artefacts réellement restaurables :
# une sauvegarde qu'on n'a jamais restaurée n'est pas une sauvegarde, c'est un
# fichier.
#
# Tout est jetable et préfixé `chiffreo-drill-` : ce script ne peut pas toucher
# une base, un volume ou une sauvegarde de production, même lancé sur le VPS.
#
# Prérequis : docker, gpg, une image de l'API (DRILL_API_IMAGE) — c'est elle qui
# applique les migrations et qui, à la fin, doit démarrer sur la base restaurée.
set -euo pipefail

# ─── Paramètres ───────────────────────────────────────────────────
API_IMAGE="${DRILL_API_IMAGE:-chiffreo-api:drill}"
PREFIX="chiffreo-drill"
NETWORK="${PREFIX}-net"
DB_CONTAINER="${PREFIX}-db"
API_CONTAINER="${PREFIX}-api"
PGDATA_VOLUME="${PREFIX}-pgdata"
UPLOADS_VOLUME="${PREFIX}-uploads"

# ≥ 16 caractères : `env.validation.ts` refuse plus court en production, et
# c'est bien l'API de production qu'on démarre à la fin.
DB_PASSWORD="drill-restore-cycle-pw"
DB_USERNAME="chiffreo"
DB_NAME="chiffreo"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$(mktemp -d)"
BACKUP_DIR="$WORK/backups"
export GNUPGHOME="$WORK/gnupg"
GPG_RECIPIENT="drill-backup@chiffreo.test"
KEEP_ON_EXIT="${DRILL_KEEP:-0}"

mkdir -p "$BACKUP_DIR" "$GNUPGHOME"
chmod 700 "$GNUPGHOME"

STEP_START=0
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
info() { printf '   %s\n' "$*"; }
start_timer() { STEP_START=$(date +%s); }
elapsed() { echo $(( $(date +%s) - STEP_START )); }

fail() { printf '\n\033[31mÉCHEC DU DRILL : %s\033[0m\n' "$*" >&2; exit 1; }

cleanup() {
  local rc=$?
  if [ "$KEEP_ON_EXIT" = "1" ]; then
    echo "DRILL_KEEP=1 — ressources conservées : $WORK, conteneurs ${PREFIX}-*"
    return
  fi
  docker rm -f "$API_CONTAINER" "$DB_CONTAINER" >/dev/null 2>&1 || true
  docker volume rm "$PGDATA_VOLUME" "$UPLOADS_VOLUME" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  # gpg-agent garde GNUPGHOME ouvert ; sans ça, `rm -rf` laisse un répertoire.
  gpgconf --kill all >/dev/null 2>&1 || true
  rm -rf "$WORK"
  exit $rc
}
trap cleanup EXIT

# ─── 0. Préparation ───────────────────────────────────────────────
say "0. Préparation"
for cmd in docker gpg; do
  command -v "$cmd" >/dev/null 2>&1 || fail "'$cmd' introuvable"
done
docker image inspect "$API_IMAGE" >/dev/null 2>&1 \
  || fail "image '$API_IMAGE' absente (construire: docker build -f apps/api/Dockerfile -t $API_IMAGE .)"

# Clé de sauvegarde éphémère, dans un trousseau jetable. Sans passphrase :
# `backup.sh` chiffre avec la publique, `restore.sh` déchiffre avec la privée,
# et les deux tournent sans interaction — comme sur le VPS, où la privée n'est
# justement pas là (BACKUP.md §2) mais où le drill, lui, doit aller au bout.
# `default default` et non `rsa3072 default` : avec un algorithme explicite,
# `--quick-generate-key` fabrique une clé **unique** dont l'usage `default` est
# signature+certification, sans sous-clé de chiffrement — et gpg refuse ensuite
# de chiffrer avec (« Unusable public key »). L'algorithme par défaut, lui,
# crée la paire primaire + sous-clé de chiffrement attendue.
gpg --batch --quiet --passphrase '' --quick-generate-key "$GPG_RECIPIENT" default default never
info "clé GPG éphémère : $GPG_RECIPIENT"

docker rm -f "$API_CONTAINER" "$DB_CONTAINER" >/dev/null 2>&1 || true
docker volume rm "$PGDATA_VOLUME" "$UPLOADS_VOLUME" >/dev/null 2>&1 || true
docker network create "$NETWORK" >/dev/null 2>&1 || true

# ─── Fonctions de plomberie ───────────────────────────────────────
# start_db [--wait]
# Sans `--wait`, rend la main dès que `docker run` a rendu la sienne. C'est
# volontaire pour la phase 5 : la reprise sur sinistre enchaîne `up -d postgres`
# et `restore.sh` sans rien attendre entre les deux (BACKUP.md §7), et c'est
# précisément cet enchaînement qu'il faut éprouver. Attendre ici rendrait le
# drill aveugle à l'absence d'attente dans `restore.sh`.
start_db() {
  docker run -d --name "$DB_CONTAINER" --network "$NETWORK" \
    -e POSTGRES_USER="$DB_USERNAME" \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_DB="$DB_NAME" \
    -v "$PGDATA_VOLUME":/var/lib/postgresql/data \
    postgres:16-alpine >/dev/null
  [ "${1:-}" = "--wait" ] || return 0
  # TCP et non le socket unix : voir wait_for_postgres() dans restore.sh.
  local tries=90
  until docker exec "$DB_CONTAINER" pg_isready -h 127.0.0.1 -U "$DB_USERNAME" -d "$DB_NAME" >/dev/null 2>&1; do
    tries=$((tries - 1))
    [ "$tries" -gt 0 ] || fail "postgres du drill jamais prêt"
    sleep 1
  done
}

psql_q() {
  docker exec -e PGPASSWORD="$DB_PASSWORD" -i "$DB_CONTAINER" \
    psql -U "$DB_USERNAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
}

# Écrit/lit le volume uploads depuis un conteneur jetable.
uploads_sh() {
  docker run --rm -i -v "$UPLOADS_VOLUME":/data alpine sh -c "$1"
}

# ─── 1. Peupler ───────────────────────────────────────────────────
say "1. Base peuplée d'un jeu de données représentatif"
start_timer
start_db --wait

# Le schéma vient des migrations du dépôt, jamais d'un SQL réécrit à la main :
# c'est l'image de production qui les applique, exactement comme au démarrage
# d'un conteneur API réel.
docker run --rm --network "$NETWORK" \
  -e NODE_ENV=production \
  -e DB_HOST="$DB_CONTAINER" -e DB_PORT=5432 \
  -e DB_USERNAME="$DB_USERNAME" -e DB_PASSWORD="$DB_PASSWORD" -e DB_NAME="$DB_NAME" \
  "$API_IMAGE" node dist/scripts/migrate.js >/dev/null \
  || fail "les migrations n'ont pas pu s'appliquer"
info "schéma créé par les migrations du dépôt"

psql_q -q -f - < "$SCRIPT_DIR/restore-drill-seed.sql" || fail "seed refusé"

# Photos réelles sur le volume, à l'emplacement qu'écrit `LocalStorageService`
# (`<project_id>/<uuid>.jpg`), avec les cas qui cassent une chaîne tar/gzip/gpg
# mal faite : accents dans le nom, espace, fichier vide, gros fichier binaire.
PROJECT_WITH_PHOTOS="a0000000-0000-4000-8000-000000000002"
uploads_sh "
  set -eu
  mkdir -p '/data/$PROJECT_WITH_PHOTOS'
  cd '/data/$PROJECT_WITH_PHOTOS'
  dd if=/dev/urandom of=b1000000-0000-4000-8000-000000000001.jpg bs=1k count=180 2>/dev/null
  dd if=/dev/urandom of=thumb_b1000000-0000-4000-8000-000000000001.jpg bs=1k count=12 2>/dev/null
  dd if=/dev/urandom of=b1000000-0000-4000-8000-000000000002.jpg bs=1k count=2048 2>/dev/null
  dd if=/dev/urandom of='salle de bain - été.jpg' bs=1k count=64 2>/dev/null
  : > vide.jpg
  mkdir -p sous/repertoire
  dd if=/dev/urandom of=sous/repertoire/profond.jpg bs=1k count=8 2>/dev/null
" || fail "écriture des photos impossible"
info "photos écrites sur le volume $UPLOADS_VOLUME"
info "peuplement : $(elapsed)s"

# ─── 2. Empreinte d'avant ─────────────────────────────────────────
# Trois relevés indépendants. Un seul suffirait à rater ce que les deux autres
# voient : le contenu ligne à ligne ne dit rien des fichiers, le manifeste de
# fichiers ne dit rien des compteurs, et les compteurs ne disent rien des
# extensions dont dépendent les valeurs par défaut du schéma.
fingerprint_db() {
  local out="$1"
  {
    echo "-- extensions"
    psql_q -tAq -c "select extname || '@' || n.nspname from pg_extension e
      join pg_namespace n on n.oid = e.extnamespace order by 1;"
    echo "-- migrations appliquées"
    psql_q -tA -c "select count(*) from migrations;"
    psql_q -tA -c "select name from migrations order by timestamp desc limit 1;"
    echo "-- compteurs de numérotation"
    psql_q -tA -c "select organization_id, year, last_number from quote_sequences order by 1,2;"
    psql_q -tA -c "select organization_id, year, last_number from invoice_sequences order by 1,2;"
    echo "-- numéros émis"
    psql_q -tA -c "select quote_number from quotes order by 1;"
    psql_q -tA -c "select invoice_number from invoices order by 1;"
    echo "-- contenu, table par table"
    # md5 du contenu entier de chaque table : une ligne perdue n'importe où
    # (y compris dans les tables seedées du catalogue) change l'empreinte.
    for t in $(psql_q -tA -c "select tablename from pg_tables where schemaname='public' order by 1;"); do
      printf '%s=' "$t"
      psql_q -tA -c "set timezone='UTC'; select coalesce(md5(string_agg(h, '|' order by h)), 'vide') from (select md5(t.*::text) as h from \"$t\" t) s;"
    done
  } > "$out"
}

fingerprint_uploads() {
  uploads_sh 'cd /data && find . -type f | sort | while read -r f; do
      printf "%s  %s\n" "$(sha256sum "$f" | cut -d" " -f1)" "$f"
    done' > "$1"
}

say "2. Empreinte d'avant"
fingerprint_db "$WORK/db.before"
fingerprint_uploads "$WORK/uploads.before"
info "$(grep -c . "$WORK/db.before") lignes d'empreinte base, $(grep -c . "$WORK/uploads.before") fichiers uploads"

# ─── 3. Sauvegarde ────────────────────────────────────────────────
say "3. Sauvegarde (docs/deploy/backup.sh, sans modification)"
start_timer
# Une sauvegarde périmée volontairement déposée : la rotation doit l'emporter
# et ne toucher à rien d'autre. Sans elle, `RETENTION_DAYS` n'est jamais exercé.
touch -d '30 days ago' "$BACKUP_DIR/chiffreo-db-20260101T000000Z.dump.gpg" 2>/dev/null \
  || touch -t 202601010000 "$BACKUP_DIR/chiffreo-db-20260101T000000Z.dump.gpg"

BACKUP_ENV_FILE=/nonexistent \
APP_ENV_FILE=/nonexistent \
BACKUP_DIR="$BACKUP_DIR" \
GPG_RECIPIENT="$GPG_RECIPIENT" \
DB_CONTAINER="$DB_CONTAINER" \
DB_USERNAME="$DB_USERNAME" \
DB_PASSWORD="$DB_PASSWORD" \
DB_NAME="$DB_NAME" \
UPLOADS_VOLUME="$UPLOADS_VOLUME" \
  bash "$SCRIPT_DIR/backup.sh" || fail "backup.sh a échoué"
BACKUP_SECONDS=$(elapsed)

DB_ARTIFACT="$(ls -1 "$BACKUP_DIR"/chiffreo-db-*.dump.gpg | grep -v 20260101 | tail -1)"
UPLOADS_ARTIFACT="$(ls -1 "$BACKUP_DIR"/chiffreo-uploads-*.tar.gz.gpg | tail -1)"
[ -s "$DB_ARTIFACT" ] || fail "artefact base absent ou vide"
[ -s "$UPLOADS_ARTIFACT" ] || fail "artefact uploads absent ou vide"
[ ! -f "$BACKUP_DIR/chiffreo-db-20260101T000000Z.dump.gpg" ] \
  || fail "rotation: la sauvegarde périmée est toujours là"
# Chiffré veut dire illisible : le contrôle porte sur les octets. `PGDMP` est la
# signature d'un dump `pg_dump -Fc` en clair — la trouver ici voudrait dire que
# la sauvegarde part en clair chez l'hébergeur du stockage hors-site.
if head -c 16 "$DB_ARTIFACT" | grep -q 'PGDMP'; then
  fail "l'artefact de base n'est PAS chiffré (signature PGDMP en clair)"
fi
if head -c 16 "$UPLOADS_ARTIFACT" | od -An -tx1 | grep -q '1f 8b'; then
  fail "l'artefact uploads n'est PAS chiffré (en-tête gzip en clair)"
fi
info "base    : $(basename "$DB_ARTIFACT") ($(du -h "$DB_ARTIFACT" | cut -f1))"
info "uploads : $(basename "$UPLOADS_ARTIFACT") ($(du -h "$UPLOADS_ARTIFACT" | cut -f1))"
info "sauvegarde : ${BACKUP_SECONDS}s"

# ─── 4. Destruction totale ────────────────────────────────────────
say "4. Destruction de la base ET du volume"
docker rm -f "$DB_CONTAINER" >/dev/null
docker volume rm "$PGDATA_VOLUME" "$UPLOADS_VOLUME" >/dev/null
docker volume inspect "$PGDATA_VOLUME" >/dev/null 2>&1 && fail "volume pgdata encore présent"
docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1 && fail "volume uploads encore présent"
info "conteneur et volumes détruits — plus rien à quoi se raccrocher"

# ─── 5. Restauration ──────────────────────────────────────────────
say "5. Restauration (docs/deploy/restore.sh --mode prod)"
start_timer
start_db   # sans attendre : c'est restore.sh qui doit savoir attendre (BACKUP.md §7)
DB_USERNAME="$DB_USERNAME" DB_PASSWORD="$DB_PASSWORD" DB_NAME="$DB_NAME" \
  bash "$SCRIPT_DIR/restore.sh" \
    --db-backup "$DB_ARTIFACT" \
    --uploads-backup "$UPLOADS_ARTIFACT" \
    --mode prod \
    --db-target "$DB_CONTAINER" \
    --uploads-target "$UPLOADS_VOLUME" \
  || fail "restore.sh a échoué"
RESTORE_SECONDS=$(elapsed)
info "restauration : ${RESTORE_SECONDS}s"

# ─── 6. Vérification ──────────────────────────────────────────────
say "6. Vérification"
fingerprint_db "$WORK/db.after"
fingerprint_uploads "$WORK/uploads.after"

if ! diff -u "$WORK/db.before" "$WORK/db.after" > "$WORK/db.diff"; then
  cat "$WORK/db.diff"
  fail "la base restaurée diffère de l'originale"
fi
info "base : identique (extensions, migrations, compteurs, contenu de chaque table)"

# Assertion explicite, en plus du diff. Le diff seul serait satisfait si
# l'extension avait disparu des DEUX empreintes — un contrôle qui passe parce
# que l'objet surveillé n'existe nulle part ne surveille rien.
EXT="$(psql_q -tAq -c "select count(*) from pg_extension where extname = 'uuid-ossp';" | tr -d '[:space:]')"
[ "$EXT" = "1" ] || fail "l'extension uuid-ossp n'a pas été restaurée (count=$EXT)"
info "extension uuid-ossp : restaurée"

if ! diff -u "$WORK/uploads.before" "$WORK/uploads.after" > "$WORK/uploads.diff"; then
  cat "$WORK/uploads.diff"
  fail "le volume uploads restauré diffère de l'original"
fi
info "uploads : $(grep -c . "$WORK/uploads.after") fichiers, sha256 identiques"

# Les compteurs ne valent pas par leur valeur mais par ce qu'ils empêchent :
# une allocation qui rendrait un numéro déjà émis. On rejoue donc la requête
# exacte de QuotesService/InvoicesService sur la base restaurée.
ORG="a0000000-0000-4000-8000-000000000001"
YEAR=2026
# `-q` : sans lui, psql ajoute son propre « INSERT 0 1 » à la valeur rendue.
NEXT_QUOTE="$(psql_q -tAq -c "
  INSERT INTO quote_sequences (organization_id, year, last_number) VALUES ('$ORG', $YEAR, 1)
  ON CONFLICT (organization_id, year) DO UPDATE SET last_number = quote_sequences.last_number + 1
  RETURNING last_number;" | tr -d '[:space:]')"
NEXT_INVOICE="$(psql_q -tAq -c "
  INSERT INTO invoice_sequences (organization_id, year, last_number) VALUES ('$ORG', $YEAR, 1)
  ON CONFLICT (organization_id, year) DO UPDATE SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number;" | tr -d '[:space:]')"
[ "$NEXT_QUOTE" = "3" ] || fail "devis suivant = $NEXT_QUOTE, attendu 3 (le compteur n'a pas survécu)"
[ "$NEXT_INVOICE" = "2" ] || fail "facture suivante = $NEXT_INVOICE, attendu 2 (le compteur n'a pas survécu)"
COLLISIONS="$(psql_q -tA -c "
  select (select count(*) from quotes where quote_number = 'D-2026-003')
       + (select count(*) from invoices where invoice_number = 'F-2026-0002');" | tr -d '[:space:]')"
[ "$COLLISIONS" = "0" ] || fail "un numéro alloué après restauration collisionne avec un document existant"
info "numérotation : prochain devis D-2026-003, prochaine facture F-2026-0002 — sans collision"

# ─── 7. L'application démarre sur la base restaurée ───────────────
# Un dump qui se recharge n'est pas la même chose qu'une application qui
# tourne dessus (leçon 19). C'est ici que se voient une extension manquante,
# une migration à moitié rejouée ou un volume monté vide.
say "7. Démarrage de l'application sur la base restaurée"
start_timer
FIREBASE_KEY="$(openssl genrsa 2048 2>/dev/null | awk '{printf "%s\\n", $0}')"
docker run -d --name "$API_CONTAINER" --network "$NETWORK" \
  -e NODE_ENV=production -e PORT=3001 \
  -e DB_HOST="$DB_CONTAINER" -e DB_PORT=5432 \
  -e DB_USERNAME="$DB_USERNAME" -e DB_PASSWORD="$DB_PASSWORD" -e DB_NAME="$DB_NAME" \
  -e CORS_ORIGIN=https://drill.chiffreo.test \
  -e PUBLIC_URL=https://drill.chiffreo.test \
  -e FIREBASE_PROJECT_ID=chiffreo-drill \
  -e FIREBASE_CLIENT_EMAIL=drill@chiffreo-drill.iam.gserviceaccount.com \
  -e FIREBASE_PRIVATE_KEY="$FIREBASE_KEY" \
  -e STRIPE_SECRET_KEY=sk_test_drill \
  -e STRIPE_WEBHOOK_SECRET=whsec_drill \
  -e BREVO_API_KEY=drill \
  -e BREVO_SENDER_EMAIL=drill@chiffreo.test \
  -e CV_ENABLED=false \
  -e STORAGE_PROVIDER=local -e STORAGE_LOCAL_PATH=/app/uploads \
  -v "$UPLOADS_VOLUME":/app/uploads \
  "$API_IMAGE" >/dev/null

HEALTH=""
for _ in $(seq 1 60); do
  HEALTH="$(docker exec "$API_CONTAINER" wget -qO- http://127.0.0.1:3001/api/v1/health 2>/dev/null || true)"
  [ -z "$HEALTH" ] || break
  sleep 2
done
[ -n "$HEALTH" ] || { docker logs --tail 40 "$API_CONTAINER"; fail "l'API n'a pas démarré sur la base restaurée"; }
echo "$HEALTH" | grep -q '"status":"ok"' || { docker logs --tail 40 "$API_CONTAINER"; fail "/health dégradé : $HEALTH"; }
BOOT_SECONDS=$(elapsed)
info "/api/v1/health → $HEALTH (${BOOT_SECONDS}s)"

# Les migrations ont rejoué au démarrage : sur une base restaurée elles ne
# doivent RIEN avoir à faire. Un ALTER TABLE ici signifierait que le dump ne
# portait pas le schéma qu'il prétendait porter.
MIGRATIONS_AFTER="$(psql_q -tA -c "select count(*) from migrations;" | tr -d '[:space:]')"
MIGRATIONS_BEFORE="$(sed -n '/-- migrations appliquées/{n;p;}' "$WORK/db.before" | tr -d '[:space:]')"
[ "$MIGRATIONS_AFTER" = "$MIGRATIONS_BEFORE" ] \
  || fail "l'API a appliqué des migrations sur la base restaurée ($MIGRATIONS_BEFORE → $MIGRATIONS_AFTER)"
info "migrations : $MIGRATIONS_AFTER appliquées, aucune rejouée au démarrage"

# Les fichiers, vus par l'application elle-même — pas par un conteneur jetable
# monté pour l'occasion : c'est le montage de production qui doit les exposer.
docker exec "$API_CONTAINER" sh -c 'cd /app/uploads && find . -type f | sort | while read -r f; do
    printf "%s  %s\n" "$(sha256sum "$f" | cut -d" " -f1)" "$f"
  done' > "$WORK/uploads.api"
diff -u "$WORK/uploads.before" "$WORK/uploads.api" \
  || fail "l'application ne voit pas les fichiers restaurés"
info "l'API voit les $(grep -c . "$WORK/uploads.api") fichiers restaurés, octet pour octet"

# ─── 8. Refus de restaurer sous une application branchée ──────────
# `DEPLOY.md` demande d'arrêter l'API avant de restaurer. Tant que le script ne
# le vérifiait pas, la consigne ne protégeait que ceux qui l'avaient lue.
say "8. Refus de restaurer par-dessus une base encore utilisée"
docker exec -e PGPASSWORD="$DB_PASSWORD" -d "$DB_CONTAINER" \
  psql -U "$DB_USERNAME" -d "$DB_NAME" -c "select pg_sleep(45);" >/dev/null
sleep 2
set +e
REFUS="$(DB_USERNAME="$DB_USERNAME" DB_PASSWORD="$DB_PASSWORD" DB_NAME="$DB_NAME" \
  bash "$SCRIPT_DIR/restore.sh" --db-backup "$DB_ARTIFACT" \
    --mode prod --db-target "$DB_CONTAINER" 2>&1)"
REFUS_RC=$?
set -e
[ "$REFUS_RC" -ne 0 ] || fail "restore.sh a accepté de restaurer sous une application branchée"
echo "$REFUS" | grep -q 'stop api web' \
  || fail "le refus ne dit pas comment s'y prendre : $REFUS"
info "refusé (code $REFUS_RC), avec la commande à lancer"
psql_q -tAq -c "select pg_terminate_backend(pid) from pg_stat_activity
  where datname = '$DB_NAME' and query like '%pg_sleep%' and pid <> pg_backend_pid();" >/dev/null

# ─── 9. Rien de postérieur à la sauvegarde ne survit ──────────────
# Le piège que `pg_restore --clean` laissait ouvert : il ne supprime que ce que
# le dump connaît. Une table créée par une migration postérieure restait en
# place pendant que `migrations`, elle, revenait en arrière — et le runner
# rejouait la migration sur une table déjà là (`relation already exists`).
say "9. Une restauration ne laisse rien de postérieur à la sauvegarde"
docker rm -f "$API_CONTAINER" >/dev/null   # comme le demande la procédure
psql_q -q -c "CREATE TABLE drill_post_backup (id integer PRIMARY KEY);" >/dev/null
psql_q -q -c "INSERT INTO migrations (timestamp, name) VALUES (1711468800080, 'DrillPostBackup1711468800080');" >/dev/null
info "état d'après-sauvegarde simulé : 1 table + 1 ligne dans migrations"

DB_USERNAME="$DB_USERNAME" DB_PASSWORD="$DB_PASSWORD" DB_NAME="$DB_NAME" \
  bash "$SCRIPT_DIR/restore.sh" --db-backup "$DB_ARTIFACT" \
    --mode prod --db-target "$DB_CONTAINER" >/dev/null \
  || fail "restore.sh a échoué sur le scénario de retour arrière"

STRAY="$(psql_q -tAq -c "select count(*) from information_schema.tables
  where table_schema='public' and table_name='drill_post_backup';" | tr -d '[:space:]')"
[ "$STRAY" = "0" ] || fail "la table postérieure à la sauvegarde a survécu à la restauration"
STRAY_MIG="$(psql_q -tAq -c "select count(*) from migrations where name like 'DrillPostBackup%';" | tr -d '[:space:]')"
[ "$STRAY_MIG" = "0" ] || fail "la ligne de migration postérieure a survécu"
info "table et ligne de migration postérieures : disparues"

# Le juge de paix : le runner de migrations de production, sur cette base.
MIGRATE_OUT="$(docker run --rm --network "$NETWORK" \
  -e NODE_ENV=production -e DB_HOST="$DB_CONTAINER" -e DB_PORT=5432 \
  -e DB_USERNAME="$DB_USERNAME" -e DB_PASSWORD="$DB_PASSWORD" -e DB_NAME="$DB_NAME" \
  "$API_IMAGE" node dist/scripts/migrate.js 2>&1)" \
  || { echo "$MIGRATE_OUT" | tail -15; fail "le runner de migrations échoue sur la base restaurée"; }
echo "$MIGRATE_OUT" | grep -q 'déjà à jour' \
  || fail "des migrations ont été rejouées après restauration : $(echo "$MIGRATE_OUT" | tail -3)"
info "runner de migrations : schéma déjà à jour, rien à rejouer"

# ─── Résumé ───────────────────────────────────────────────────────
say "DRILL DE RESTAURATION : PASS"
printf '   sauvegarde   : %ss\n' "$BACKUP_SECONDS"
printf '   restauration : %ss\n' "$RESTORE_SECONDS"
printf '   artefacts    : %s / %s\n' "$(du -h "$DB_ARTIFACT" | cut -f1)" "$(du -h "$UPLOADS_ARTIFACT" | cut -f1)"
