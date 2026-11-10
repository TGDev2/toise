#!/usr/bin/env bash
# Récupère les poids du détecteur portes/fenêtres depuis la GitHub Release
# cv-model-vN vers apps/cv-service/models/ — CV-1. Idempotent : ne retélécharge
# pas si les poids locaux ont déjà le bon SHA-256. À lancer AVANT
# `docker compose build cv-service` (le Dockerfile fait COPY models/).
#
# Usage :
#   ./scripts/fetch-model.sh              # dernière release cv-model-* (requiert gh)
#   ./scripts/fetch-model.sh cv-model-v1  # tag explicite
#
# Voie préférée : gh authentifié. Repli sans gh : curl + python3, avec
# GITHUB_REPOSITORY=owner/repo et (repo privé) GITHUB_TOKEN — le tag est alors
# obligatoire.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
MODELS_DIR=$(dirname "$SCRIPT_DIR")/models
ASSETS=(door-window-yolov8n.pt metrics.json MODEL_CARD.md)
TAG="${1:-}"

mkdir -p "$MODELS_DIR"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# ─── Téléchargement (gh, sinon curl+python3) ──────────────────────
if command -v gh >/dev/null 2>&1; then
  if [ -z "$TAG" ]; then
    TAG=$(gh release list --limit 100 --json tagName \
      --jq '[.[] | select(.tagName | startswith("cv-model-"))][0].tagName // empty')
    [ -n "$TAG" ] || { echo "ERREUR: aucune release cv-model-* trouvée" >&2; exit 1; }
    echo "Dernière release modèle : $TAG"
  fi
  gh release download "$TAG" --pattern SHA256SUMS --output "$TMP/SHA256SUMS" \
    || { echo "ERREUR: release '$TAG' ou asset SHA256SUMS introuvable" >&2; exit 1; }
  download_assets() {
    for asset in "${ASSETS[@]}"; do
      gh release download "$TAG" --pattern "$asset" --output "$MODELS_DIR/$asset" --clobber
    done
  }
else
  [ -n "$TAG" ] || { echo "ERREUR: sans gh, le tag est obligatoire (ex. cv-model-v1)" >&2; exit 1; }
  : "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY requis sans gh (ex. owner/toise)}"
  command -v python3 >/dev/null 2>&1 \
    || { echo "ERREUR: python3 requis pour le repli curl" >&2; exit 1; }
  AUTH=()
  [ -n "${GITHUB_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN")
  RELEASE_JSON="$TMP/release.json"
  curl -fsSL "${AUTH[@]}" \
    "https://api.github.com/repos/$GITHUB_REPOSITORY/releases/tags/$TAG" \
    -o "$RELEASE_JSON" \
    || { echo "ERREUR: release '$TAG' introuvable sur $GITHUB_REPOSITORY" >&2; exit 1; }
  asset_id() {  # id numérique de l'asset $1 dans release.json
    python3 -c "import json,sys; d=json.load(open('$RELEASE_JSON'));\
print(next((a['id'] for a in d['assets'] if a['name']==sys.argv[1]), ''))" "$1"
  }
  fetch_one() {
    local id; id=$(asset_id "$1")
    [ -n "$id" ] || { echo "ERREUR: asset '$1' absent de la release $TAG" >&2; exit 1; }
    curl -fsSL "${AUTH[@]}" -H "Accept: application/octet-stream" \
      "https://api.github.com/repos/$GITHUB_REPOSITORY/releases/assets/$id" -o "$2"
  }
  fetch_one SHA256SUMS "$TMP/SHA256SUMS"
  download_assets() {
    for asset in "${ASSETS[@]}"; do
      fetch_one "$asset" "$MODELS_DIR/$asset"
    done
  }
fi

# ─── Idempotence : déjà à jour ? ──────────────────────────────────
if [ -f "$MODELS_DIR/SHA256SUMS" ] \
  && cmp -s "$TMP/SHA256SUMS" "$MODELS_DIR/SHA256SUMS" \
  && (cd "$MODELS_DIR" && sha256sum -c SHA256SUMS >/dev/null 2>&1); then
  echo "Poids déjà à jour ($TAG) — rien à faire."
  exit 0
fi

download_assets
cp "$TMP/SHA256SUMS" "$MODELS_DIR/SHA256SUMS"

# ─── Vérification d'intégrité ─────────────────────────────────────
if ! (cd "$MODELS_DIR" && sha256sum -c SHA256SUMS); then
  echo "ERREUR: SHA-256 invalide — suppression des fichiers téléchargés" >&2
  rm -f "${ASSETS[@]/#/$MODELS_DIR/}" "$MODELS_DIR/SHA256SUMS"
  exit 1
fi

echo
echo "Poids installés dans $MODELS_DIR ($TAG)."
echo "Prod : docker compose -f docker-compose.prod.yml build cv-service && docker compose -f docker-compose.prod.yml up -d cv-service"
echo "Contrôle : GET /health → \"yolo\": true"
