# Déploiement en production (VPS + Docker Compose)

Ce guide décrit le déploiement d'EstiMate sur un VPS (Hetzner, OVH, Scaleway…)
avec Docker Compose et Caddy comme reverse proxy (TLS automatique).

## Prérequis

- Un VPS Linux (4 Go de RAM minimum — le service CV consomme jusqu'à 4 Go
  pendant l'inférence ; 8 Go recommandés), Docker + Docker Compose installés.
- Un nom de domaine pointant vers le VPS (ex. `estimate.fr` et
  `api.estimate.fr`).
- Un projet **Firebase** avec Authentication activée (Email/Password, Google,
  Apple, Anonyme) et un service account (clé privée JSON).
- Un compte **Stripe** avec les produits/prix créés (plan Pro obligatoire,
  plans Contractor optionnels) et un endpoint webhook configuré.

## 1. Préparer l'environnement

```bash
git clone <repository-url> && cd Estimate
cp .env.example .env
```

Renseigner **toutes** les variables de `.env`. En production les variables
critiques sont validées au démarrage de l'API (démarrage refusé si absentes) :

| Variable | Exemple |
|---|---|
| `NODE_ENV` | `production` |
| `DB_PASSWORD` | mot de passe fort généré |
| `CORS_ORIGIN` | `https://estimate.fr` |
| `PUBLIC_URL` | `https://estimate.fr` |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | depuis la clé de service account |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRO_PRICE_ID` | depuis le dashboard Stripe |
| `NEXT_PUBLIC_API_URL` | `https://api.estimate.fr/api/v1` |
| `NEXT_PUBLIC_SITE_URL` | `https://estimate.fr` |
| `NEXT_PUBLIC_FIREBASE_*` | config web Firebase |

> ⚠️ Les variables `NEXT_PUBLIC_*` sont **figées au build de l'image web**.
> Tout changement (URL API, config Firebase) impose `docker compose -f
> docker-compose.prod.yml up -d --build web`.

## 2. Lancer les services

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- Les **migrations TypeORM s'exécutent automatiquement** au démarrage du
  conteneur API (avant `node dist/main.js`).
- Premier démarrage du service CV : le modèle de profondeur est déjà embarqué
  dans l'image (pré-téléchargé au build), mais l'initialisation peut prendre
  1 à 2 minutes (`start_period` de 120 s sur le healthcheck).

Vérifier l'état :

```bash
docker compose -f docker-compose.prod.yml ps          # tous "healthy"
curl -s localhost:3001/api/v1/health                  # {"status":"ok"}
curl -s localhost:8000/health                         # état des modèles CV
```

Les ports 3000 (web) et 3001 (api) ne sont exposés que sur `127.0.0.1` :
seul le reverse proxy les rend accessibles de l'extérieur.

## 3. Reverse proxy (Caddy)

```bash
sudo apt install caddy
```

`/etc/caddy/Caddyfile` :

```caddy
estimate.fr {
    reverse_proxy localhost:3000
}

api.estimate.fr {
    reverse_proxy localhost:3001
}
```

```bash
sudo systemctl reload caddy
```

Caddy obtient et renouvelle automatiquement les certificats TLS.

## 4. Webhook Stripe

Dans le dashboard Stripe → Developers → Webhooks, créer un endpoint :

- URL : `https://api.estimate.fr/api/v1/subscriptions/webhook`
- Événements : `checkout.session.completed`, `invoice.paid`,
  `invoice.payment_failed`, `customer.subscription.updated`,
  `customer.subscription.deleted`
- Copier le signing secret dans `STRIPE_WEBHOOK_SECRET` puis redémarrer l'API.

Les événements sont dédupliqués par `event.id` (table `stripe_events`) : les
retries Stripe ne provoquent pas de double traitement.

## 5. Sauvegardes

Deux volumes Docker contiennent les données persistantes :

- `pgdata` — base PostgreSQL
- `uploads` — photos des projets

Exemple de sauvegarde quotidienne (cron) :

```bash
# Base de données
docker exec estimate-db pg_dump -U estimate estimate | gzip > /backup/estimate-$(date +%F).sql.gz

# Uploads
docker run --rm -v estimate_uploads:/data -v /backup:/backup alpine \
  tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

## 6. Mise à jour de l'application

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Les migrations éventuelles sont appliquées automatiquement au redémarrage de
l'API.

## Dépannage

| Symptôme | Piste |
|---|---|
| L'API refuse de démarrer avec « Configuration invalide » | une variable requise manque dans `.env` (le message liste lesquelles) |
| Checkout Stripe → 503 | `STRIPE_SECRET_KEY` absente (l'API tourne mais les paiements sont désactivés) |
| Analyse CV systématiquement en échec | vérifier `docker logs estimate-cv` ; augmenter `CV_SERVICE_TIMEOUT_MS` ou la limite mémoire (4 G par défaut) |
| Images de la galerie cassées | `NEXT_PUBLIC_API_URL` au build web ne correspond pas à l'URL publique de l'API |
