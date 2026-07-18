#!/usr/bin/env bash
# Provisionnement initial d'un VPS neuf (Ubuntu/Debian) pour Chiffréo — OPS-1.
# À exécuter une fois, en root, sur le VPS fraîchement créé.
# Usage : ssh root@<ip> 'bash -s' < docs/deploy/provision.sh
set -euo pipefail

echo "==> Mise à jour du système"
apt-get update && apt-get upgrade -y

echo "==> Installation Docker Engine + Compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Installation Caddy (dépôt officiel — pas dans les dépôts Debian/Ubuntu)"
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

echo "==> Pare-feu (UFW) : SSH + HTTP/HTTPS uniquement"
apt-get install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Terminé. Prochaines étapes :"
echo "  1. git clone <repo> && cd Chiffreo && cp .env.example .env"
echo "  2. Renseigner .env (voir docs/DEPLOY.md section 1)"
echo "  3. docker compose -f docker-compose.prod.yml up -d --build"
echo "  4. cp docs/deploy/Caddyfile /etc/caddy/Caddyfile && systemctl reload caddy"
