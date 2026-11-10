#!/usr/bin/env bash
# Test de fumée post-déploiement — E6-5.
#
# Répond à une question, et une seule : « la version que je viens de publier
# est-elle celle qui sert le trafic, et répond-elle ? »
#
# `docker compose up -d --wait` prouve déjà que les conteneurs sont sains au
# sens de leur healthcheck. Ce qu'il ne prouve pas, et que ce script vérifie :
#   - que l'API atteint réellement sa base (le healthcheck fait `SELECT 1`) ;
#   - que le serveur web rend une réponse ;
#   - que les deux annoncent **le tag attendu**. Sans ce dernier contrôle, un
#     `pull` qui a silencieusement resservi l'image précédente (tag déplacé,
#     couche en cache, `latest` périmé) laisse une pile parfaitement saine…
#     et périmée. La version est lue dans l'environnement de l'image, figée au
#     build (`ARG APP_VERSION`), jamais injectée au lancement : elle atteste
#     donc du contenu du conteneur, pas de l'intention du compose.
#
# Exécution depuis la CD, sans rien déposer sur le VPS — l'idiome de
# provision.sh, qui garantit qu'on exécute le script de la version déployée et
# non celui d'un clone /opt/toise possiblement périmé :
#
#   ssh vps 'bash -s -- --expect-version v1.2.3' < docs/deploy/smoke-test.sh
#
# À la main sur le VPS (après un retour arrière, cf. docs/DEPLOY.md) :
#
#   bash /opt/toise/docs/deploy/smoke-test.sh --expect-version v1.1.0
set -euo pipefail

# Cibles par défaut : les ports que docker-compose.prod.yml publie sur la
# loopback. Contrôler par l'URL publique passerait par Caddy, qu'un déploiement
# ne touche pas — cela ajouterait une dépendance au DNS et au TLS sans couvrir
# le moindre mode de panne induit par le déploiement.
API_URL="http://127.0.0.1:3001/api/v1/health"
WEB_URL="http://127.0.0.1:3000/api/health"
EXPECT_VERSION=""
RETRIES=5
DELAY=2

usage() {
  cat <<'EOF'
Usage: smoke-test.sh --expect-version TAG [--api-url URL] [--web-url URL]
                     [--retries N] [--delay SECONDS]

  --expect-version  tag attendu dans le champ `version` des deux sondes (requis)
  --api-url         défaut http://127.0.0.1:3001/api/v1/health
  --web-url         défaut http://127.0.0.1:3000/api/health
  --retries         tentatives par sonde (défaut 5)
  --delay           secondes entre deux tentatives (défaut 2)

Sortie 0 si les deux sondes répondent `status=ok` avec la version attendue,
1 sinon — et le message nomme l'écart constaté.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --api-url) API_URL="$2"; shift 2 ;;
    --web-url) WEB_URL="$2"; shift 2 ;;
    --expect-version) EXPECT_VERSION="$2"; shift 2 ;;
    --retries) RETRIES="$2"; shift 2 ;;
    --delay) DELAY="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Option inconnue: $1" >&2; usage; exit 1 ;;
  esac
done

[ -n "$EXPECT_VERSION" ] || { echo "ERREUR: --expect-version requis" >&2; usage; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "ERREUR: 'curl' introuvable" >&2; exit 1; }

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

# json_field <corps-json> <nom-du-champ>
# Extraction volontairement naïve : les deux sondes sont des objets plats
# produits par ce dépôt, et exiger `jq` sur le VPS pour lire deux champs
# ajouterait un prérequis d'installation à un script dont tout l'intérêt est de
# tourner partout.
json_field() {
  printf '%s' "$1" | sed -n "s/.*\"$2\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p"
}

# probe <libellé> <url> → 0 si la sonde répond `ok` avec la version attendue.
# Une seule et même boucle de reprise pour les trois causes d'échec : juste
# après un `up -d`, le port peut encore être servi par le conteneur sortant, et
# une version inattendue est alors transitoire au même titre qu'un refus de
# connexion.
probe() {
  local label="$1" url="$2"
  local attempt=1 body http_code status version reason

  while :; do
    reason=""
    # Corps puis code HTTP sur la dernière ligne. Pas de `-o /dev/stdout` : tous
    # les curl ne savent pas écrire dans ce pseudo-fichier, et sans `-o` le
    # corps sort de toute façon sur stdout.
    body="$(curl -sS --max-time 10 -w '\n%{http_code}' "$url" 2>/dev/null || true)"
    http_code="${body##*$'\n'}"
    body="${body%$'\n'*}"

    if [ "$http_code" != "200" ]; then
      reason="HTTP ${http_code:-aucune réponse}"
    else
      status="$(json_field "$body" status)"
      version="$(json_field "$body" version)"
      if [ "$status" != "ok" ]; then
        reason="status=\"${status:-absent}\" au lieu de \"ok\""
      elif [ "$version" != "$EXPECT_VERSION" ]; then
        reason="version déployée \"${version:-absente}\" au lieu de \"$EXPECT_VERSION\""
      else
        log "OK: $label — version $version"
        return 0
      fi
    fi

    if [ "$attempt" -ge "$RETRIES" ]; then
      echo "ÉCHEC: $label ($url) — $reason" >&2
      [ -z "$body" ] || echo "  corps reçu : $body" >&2
      return 1
    fi
    log "$label: $reason — nouvelle tentative ($attempt/$RETRIES)…"
    attempt=$((attempt + 1))
    sleep "$DELAY"
  done
}

failed=0
# Les deux sondes sont exécutées même si la première échoue : un opérateur
# réveillé par une CD rouge doit lire l'état des deux services d'un coup, pas
# en découvrir un second après avoir corrigé le premier.
probe "api" "$API_URL" || failed=1
probe "web" "$WEB_URL" || failed=1

if [ "$failed" -ne 0 ]; then
  echo "TEST DE FUMÉE: ÉCHEC (version attendue: $EXPECT_VERSION)" >&2
  exit 1
fi

echo "TEST DE FUMÉE: PASS (version $EXPECT_VERSION)"
