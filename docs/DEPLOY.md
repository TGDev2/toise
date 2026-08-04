# Déploiement en production (VPS + Docker Compose)

Ce guide décrit le déploiement d'Chiffréo sur un VPS (Hetzner, OVH, Scaleway…)
avec Docker Compose et Caddy comme reverse proxy (TLS automatique).

## Prérequis

- Un VPS Linux Ubuntu/Debian (2 Go de RAM minimum ; 4 Go recommandés, ex.
  Hetzner CX22). Le service de vision par ordinateur (`apps/cv-service`),
  qui portait l'essentiel de cette exigence, est débranché de la production
  (ADR 0001 §D2) — il reste dans le dépôt, condition de réouverture au §5.2
  de l'ADR.
- Un nom de domaine pointant vers le VPS via des enregistrements DNS `A` (et
  `AAAA` en IPv6) — ex. `chiffreo.fr` et `api.chiffreo.fr`.
- Exécuter [`docs/deploy/provision.sh`](deploy/provision.sh) sur le VPS neuf
  (root) : installe Docker + Compose, Caddy (dépôt officiel — absent des
  dépôts Debian/Ubuntu par défaut) et configure le pare-feu UFW
  (SSH/80/443 uniquement).

  ```bash
  ssh root@<ip> 'bash -s' < docs/deploy/provision.sh
  ```
- Un projet **Firebase** avec Authentication activée (Email/Password, Google,
  Apple, Anonyme) et un service account (clé privée JSON).
- Un compte **Stripe** avec les produits/prix créés (plan Pro obligatoire,
  plans Contractor optionnels) et un endpoint webhook configuré.

## 1. Préparer l'environnement

```bash
git clone <repository-url> && cd Chiffreo
cp .env.example .env
```

Renseigner **toutes** les variables de `.env`. En production les variables
critiques sont validées au démarrage de l'API (démarrage refusé si absentes) :

| Variable | Exemple |
|---|---|
| `NODE_ENV` | `production` |
| `DB_PASSWORD` | mot de passe fort généré |
| `CORS_ORIGIN` | `https://chiffreo.fr` |
| `PUBLIC_URL` | `https://chiffreo.fr` |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | depuis la clé de service account |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRO_PRICE_ID` | depuis le dashboard Stripe |
| `NEXT_PUBLIC_API_URL` | `https://api.chiffreo.fr/api/v1` |
| `NEXT_PUBLIC_SITE_URL` | `https://chiffreo.fr` |
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

Vérifier l'état :

```bash
docker compose -f docker-compose.prod.yml ps          # tous "healthy"
curl -s localhost:3001/api/v1/health                  # {"status":"ok"}
```

Les ports 3000 (web) et 3001 (api) ne sont exposés que sur `127.0.0.1` :
seul le reverse proxy les rend accessibles de l'extérieur.

## 3. Reverse proxy (Caddy)

Caddy est déjà installé par `provision.sh`. Copier le Caddyfile du repo puis
recharger :

```bash
sudo cp docs/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy obtient et renouvelle automatiquement les certificats TLS.

## 4. Webhook Stripe

Dans le dashboard Stripe → Developers → Webhooks, créer un endpoint :

- URL : `https://api.chiffreo.fr/api/v1/subscriptions/webhook`
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

La procédure complète (chiffrement GPG, rotation, cron, et surtout la
**restauration testée** sur une base jetable) est documentée dans
[`docs/deploy/BACKUP.md`](deploy/BACKUP.md). Une fois la clé GPG et
`/etc/chiffreo/backup.env` en place (`BACKUP.md` §3), l'installation se
résume à une ligne de crontab :

```bash
sudo crontab -e
# ajouter :
15 3 * * * bash /opt/chiffreo/docs/deploy/backup.sh >> /var/log/chiffreo-backup.log 2>&1
```

Renseigner aussi `BACKUP_REMOTE` (copie hors-site) et `BACKUP_MONITOR_URL`
(alerte sur échec **et** sur run manquant) dans `/etc/chiffreo/backup.env` :
sans eux, les sauvegardes vivent sur le disque qu'elles protègent et un échec
cron reste muet. Voir `BACKUP.md` §4 et §5.

## 6. Déploiement continu (CD)

> ⚠️ `cv-service` a été retiré de `docker-compose.prod.yml` (débranché, ADR
> 0001 §D2), mais `.github/workflows/deploy.yml` construit et déploie encore
> une image `cv-service` à ce jour — son `docker compose up -d ... cv-service`
> échouera sur le VPS (service inconnu) tant que ce workflow n'est pas mis à
> jour en conséquence (backlog `docs/BACKLOG_V1.md` §E3-2).

Une fois les sections 1 à 3 faites au moins une fois (VPS provisionné, `.env`
renseigné, premier `docker compose up -d --build` réussi), les mises à jour sont
automatisées : `.github/workflows/deploy.yml` se déclenche sur un tag `vX.Y.Z`,
rejoue la CI (`ci.yml`, en `workflow_call`) comme garde-fou, construit et pousse
les **trois** images vers GHCR (`ghcr.io/tgdev2/chiffreo-api`, `-web` et `-cv`),
puis se connecte en SSH au VPS pour synchroniser `docker-compose.prod.yml` et
faire `docker compose pull` + `up -d` sur `api`, `web` et `cv-service`.

Les trois portent le même `IMAGE_TAG`, délibérément : l'API et le service CV
partagent un contrat HTTP (`AnalyzeRequest`/`AnalyzeResponse`) qui n'est ni
versionné ni négocié. Les livrer séparément revient à accepter qu'un tag déploie
une API neuve contre un CV ancien — et à découvrir l'incompatibilité en `422`
sur le trafic réel.

```bash
git tag v1.0.0
git push origin v1.0.0
```

Le pipeline ne bootstrap pas un VPS neuf : il suppose `/opt/chiffreo` déjà
cloné et fonctionnel (même chemin que `docs/deploy/backup.sh`).

### Secrets GitHub requis

À renseigner dans *Settings → Secrets and variables → Actions* du dépôt.

| Secret | Usage |
|---|---|
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | build-args figés dans l'image `web` (mêmes valeurs que dans le `.env` du VPS) |
| `VPS_SSH_HOST` | IP ou domaine du VPS |
| `VPS_SSH_USER` | utilisateur SSH capable de lancer `docker` (root aujourd'hui, comme le reste de ce guide) |
| `VPS_SSH_KEY` | clé privée SSH (idéalement une clé dédiée au déploiement plutôt que la clé personnelle/root, à ajouter dans `authorized_keys` du VPS) |
| `VPS_SSH_KNOWN_HOSTS` | empreinte du VPS, épinglée à l'avance (pas de confiance au premier contact) |

Génération de `VPS_SSH_KNOWN_HOSTS` :

```bash
ssh-keyscan -H -t ed25519,rsa <ip-ou-domaine-vps> > known_hosts_chiffreo
# Vérifier l'empreinte affichée contre celle donnée par la console web du
# fournisseur VPS avant de coller le contenu du fichier dans le secret.
```

L'authentification au registre GHCR n'a besoin d'aucun secret supplémentaire :
le job de build pousse avec le `GITHUB_TOKEN` automatique, et le job de
déploiement relaie ce même token (valable seulement le temps du run) au VPS
par SSH pour le `pull`, puis `docker logout` — aucun identifiant de registre
durable n'est stocké sur le VPS.

### Variables de dépôt (optionnelles)

À renseigner dans *Settings → Secrets and variables → Actions → Variables*.

| Variable | Usage |
|---|---|
| `CV_MODEL_TAG` | Épingle la release de poids YOLO utilisée au build du service CV (ex. `cv-model-v1`). Vide → dernière release `cv-model-*` |

### Rollback

```bash
# Sur le VPS, dans /opt/chiffreo :
IMAGE_TAG=v1.0.0 docker compose -f docker-compose.prod.yml pull api web
IMAGE_TAG=v1.0.0 docker compose -f docker-compose.prod.yml up -d api web
```

### Limites connues

- Redémarrage bref d'`api`/`web` à chaque déploiement (identique au flux
  manuel `--build` existant, pas une régression).
- `:latest` sur GHCR reflète le tag/build le plus récent, pas nécessairement
  le plus haut en semver — la CD elle-même ne s'appuie jamais dessus, elle
  épingle toujours `IMAGE_TAG` explicitement.

### Poids du modèle portes/fenêtres (`cv-service`)

> ℹ️ `cv-service` est débranché de la production (ADR 0001 §D2) : cette
> sous-section documente son ancien flux de déploiement, gardée pour
> référence et pour la condition de réouverture (ADR §5.2).

Les poids YOLO portes/fenêtres (`models/door-window-yolov8n.pt`) ne sont **pas
dans git** : ce sont des artefacts de GitHub Release (tags `cv-model-vN`,
publiés par `apps/cv-service/scripts/release-model.sh` — cycle complet dans
[`apps/cv-service/training/README.md`](../apps/cv-service/training/README.md)),
et le Dockerfile fait `COPY models/`.

**En CD, rien à faire** : le workflow lance `fetch-model.sh` avant de construire
l'image CV, avec le `GITHUB_TOKEN` du run. L'étape est bloquante — sans poids,
l'image publiée basculerait en mode heuristique (`"yolo": false`) et prendrait
silencieusement la place d'un conteneur équipé. Un déploiement qui s'arrête est
préférable à une précision qui baisse sans que rien ne le dise.

Publier une nouvelle version des poids se fait donc en deux temps : publier la
release `cv-model-vN`, puis taguer une version applicative (ou pousser un tag
`vX.Y.Z+1`) pour que la CD reconstruise l'image avec ces poids. Pour figer une
version précise, renseigner la variable de dépôt `CV_MODEL_TAG`.

**Construction manuelle** (secours, premier déploiement, VPS sans CD) — le fetch
doit précéder le build :

```bash
# Sur le VPS, dans /opt/chiffreo :
bash apps/cv-service/scripts/fetch-model.sh         # ou un tag précis : cv-model-v1
docker compose -f docker-compose.prod.yml build cv-service
docker compose -f docker-compose.prod.yml up -d cv-service
```

Contrôle, dans les deux cas — `"yolo": true` atteste que les poids sont bien
dans l'image qui tourne :

```bash
docker compose -f docker-compose.prod.yml exec cv-service \
  python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health').read().decode())"
```

Le script préfère `gh` (`apt install gh` puis `gh auth login`, une fois) ; à
défaut, repli `curl` avec `GITHUB_REPOSITORY=owner/repo` et, si le dépôt est
privé, `GITHUB_TOKEN`. Il vérifie le SHA-256 des assets et est idempotent (ne
retélécharge pas des poids déjà à jour).

## 7. Déploiement manuel (secours / premier déploiement)

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Les migrations éventuelles sont appliquées automatiquement au redémarrage de
l'API.

## 8. Monitoring (Sentry)

Optionnel — no-op si les variables sont absentes (l'API démarre et log un
avertissement, le build web reste inchangé). Sans ça, un incident (DB en
panne, webhook Stripe qui échoue) ne se voit qu'en allant lire les logs.

1. Créer **deux** projets sur [sentry.io](https://sentry.io) (ou un
   self-hosted) : un projet *Node* pour l'API, un projet *Next.js* pour le
   web — chacun donne son propre DSN.
2. Renseigner dans `.env` :

   | Variable | Rôle |
   |---|---|
   | `SENTRY_DSN` | DSN du projet Node (API) |
   | `SENTRY_TRACES_SAMPLE_RATE` | Taux d'échantillonnage des traces API (défaut `0.2`) |
   | `NEXT_PUBLIC_SENTRY_DSN` | DSN du projet Next.js (web) — figé au build de l'image, comme les autres `NEXT_PUBLIC_*` |
   | `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Taux d'échantillonnage des traces web (défaut `0.2`) |

3. **Alerte** : chaque projet Sentry envoie par défaut un e-mail à la
   création de toute nouvelle issue — aucune règle supplémentaire n'est
   requise pour une alerte minimale. Vérifier dans le dashboard (Alerts)
   que cette règle par défaut résout bien vers un destinataire réel (elle
   notifie les « Issue Owners » — sans règle d'ownership configurée sur un
   projet neuf, confirmer qu'elle retombe sur l'équipe/vous plutôt que sur
   personne).
   - Le healthcheck DB (`/api/v1/health`) et le webhook Stripe (échec de
     traitement uniquement, tag `component: stripe-webhook` — pas les
     signatures invalides, bruit de scanners attendu sur un endpoint
     public) remontent tous les deux comme des issues via ce même mécanisme.
4. **Uptime réel** (processus API totalement mort, pas juste une DB en
   panne — aucun code embarqué ne peut s'auto-signaler dans ce cas) :
   créer un **Sentry Uptime Monitor** (Alerts → Uptime Monitors) pointé sur
   `https://api.chiffreo.fr/api/v1/health`, et optionnellement un second sur
   `https://chiffreo.fr`. Sentry ping depuis l'extérieur et alerte si
   l'endpoint ne répond plus.
5. **Limite connue** : pas d'upload de source maps (`withSentryConfig`
   volontairement omis — nécessiterait `SENTRY_AUTH_TOKEN`/org/project en
   secrets CI supplémentaires, hors périmètre « minimal »). Les stack traces
   web en prod ne seront pas dé-minifiées dans le dashboard Sentry.

## Dépannage

| Symptôme | Piste |
|---|---|
| L'API refuse de démarrer avec « Configuration invalide » | une variable requise manque dans `.env` (le message liste lesquelles) |
| Checkout Stripe → 503 | `STRIPE_SECRET_KEY` absente (l'API tourne mais les paiements sont désactivés) |
| Analyse photo refusée avec un message d'indisponibilité | comportement attendu : `CV_ENABLED=false` par défaut (débranché, ADR 0001 §D2), l'API refuse proprement toute demande d'analyse — la saisie manuelle des dimensions est le seul chemin en production |
| Images de la galerie cassées | `NEXT_PUBLIC_API_URL` au build web ne correspond pas à l'URL publique de l'API |
| Rien n'apparaît dans Sentry | `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` absente (voir le warn au boot de l'API) ou DSN erroné — le SDK avale silencieusement les échecs d'envoi, jamais d'erreur bruyante |
