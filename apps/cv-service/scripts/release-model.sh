#!/usr/bin/env bash
# Publie les poids du détecteur portes/fenêtres en GitHub Release — CV-1.
# Les poids ne vont JAMAIS dans git : ils sont attachés à une release au tag
# dédié cv-model-vN (ne matche pas le trigger CD v*.*.* de deploy.yml).
# Versions immuables : pour republier, incrémenter N.
#
# Usage :
#   ./scripts/release-model.sh cv-model-v1 models/door-window-yolov8n.pt \
#       training/reports/metrics.json training/reports/MODEL_CARD.md
#
# Prérequis : gh authentifié (gh auth login), evaluate.py en PASS.
set -euo pipefail

usage() {
  grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed -n '2,10p' >&2
  exit 1
}

[ $# -eq 4 ] || usage
TAG="$1"; WEIGHTS="$2"; METRICS="$3"; CARD="$4"

# Suffixe optionnel (-test…) toléré pour les répétitions de bout en bout.
[[ "$TAG" =~ ^cv-model-v[0-9]+([.-][A-Za-z0-9.-]+)?$ ]] \
  || { echo "ERREUR: tag '$TAG' invalide (attendu : cv-model-vN)" >&2; exit 1; }

command -v gh >/dev/null 2>&1 \
  || { echo "ERREUR: 'gh' introuvable (https://cli.github.com)" >&2; exit 1; }

for f in "$WEIGHTS" "$METRICS" "$CARD"; do
  [ -s "$f" ] || { echo "ERREUR: fichier absent ou vide : $f" >&2; exit 1; }
done
# Garde-fou : un checkpoint yolov8n pèse plusieurs Mo — un fichier minuscule
# est presque sûrement une erreur d'argument.
WEIGHTS_SIZE=$(wc -c < "$WEIGHTS")
[ "$WEIGHTS_SIZE" -gt 1000000 ] \
  || { echo "ERREUR: $WEIGHTS fait ${WEIGHTS_SIZE} octets (< 1 Mo) — mauvais fichier ?" >&2; exit 1; }

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "ERREUR: la release '$TAG' existe déjà — les versions sont immuables, incrémenter N" >&2
  exit 1
fi

# ─── Assets aux noms canoniques + sommes de contrôle ──────────────
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cp "$WEIGHTS" "$TMP/door-window-yolov8n.pt"
cp "$METRICS" "$TMP/metrics.json"
cp "$CARD"    "$TMP/MODEL_CARD.md"
(cd "$TMP" && sha256sum door-window-yolov8n.pt metrics.json MODEL_CARD.md > SHA256SUMS)

gh release create "$TAG" \
  --title "Modèle portes/fenêtres — $TAG" \
  --notes-file "$TMP/MODEL_CARD.md" \
  "$TMP/door-window-yolov8n.pt" \
  "$TMP/metrics.json" \
  "$TMP/MODEL_CARD.md" \
  "$TMP/SHA256SUMS"

echo
echo "Release '$TAG' publiée."
echo "Déploiement : sur le VPS, ./scripts/fetch-model.sh $TAG puis"
echo "  docker compose -f docker-compose.prod.yml build cv-service && docker compose -f docker-compose.prod.yml up -d cv-service"
