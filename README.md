# Chiffréo

Application d'estimation de matériaux pour projets de rénovation. Scannez votre pièce ou saisissez ses dimensions, sélectionnez vos travaux, et obtenez une liste d'achat précise tenant compte des pertes, découpes et de votre niveau de compétence.

## Architecture

```
┌─────────────────────────────────────────────┐
│        Frontend (Next.js 16 + React 19)     │
│            http://localhost:3000             │
└────────────────┬────────────────────────────┘
                 │ REST API
                 ▼
┌─────────────────────────────────────────────┐
│     Backend API (NestJS 11 + TypeORM)       │
│       http://localhost:3001/api/v1          │
└────┬──────────────────────────┬─────────────┘
     │ HTTP                     │ SQL
     ▼                          ▼
┌──────────────────┐  ┌──────────────────┐
│ CV Service       │  │ PostgreSQL 16    │
│ (Python FastAPI) │  │                  │
│ :8000            │  │                  │
└──────────────────┘  └──────────────────┘
```

**3 applications** dans un monorepo pnpm :

| App | Stack | Rôle |
|-----|-------|------|
| `apps/api` | NestJS 11, TypeORM, PostgreSQL | API REST, moteur d'estimation, auth Firebase, paiements Stripe |
| `apps/web` | Next.js 16, React 19, Tailwind CSS 4 | Interface utilisateur web |
| `apps/cv-service` | Python FastAPI, Depth Anything V2, YOLOv8 | Analyse de photos par vision par ordinateur |

## Prérequis

- **Node.js** >= 20
- **pnpm** >= 9
- **Python** >= 3.11
- **Docker** et **Docker Compose** (pour PostgreSQL et le CV service)
- Un projet **Firebase** (Authentication)
- Un compte **Stripe** (abonnements)

## Quick Start

### 1. Cloner et installer

```bash
git clone <repository-url>
cd Chiffreo
pnpm install
```

### 2. Configurer l'environnement

```bash
cp .env.example .env
```

Remplir les variables dans `.env` (voir [Variables d'environnement](#variables-denvironnement)).

### 3. Lancer les services Docker

```bash
docker compose up -d
```

Cela démarre PostgreSQL et le CV service.

### 4. Exécuter les migrations

```bash
pnpm db:migrate
```

### 5. Lancer les serveurs de développement

```bash
# Dans des terminaux séparés :
pnpm dev:api    # API sur http://localhost:3001
pnpm dev:web    # Web sur http://localhost:3000
```

Ou pour le CV service seul (sans Docker) :

```bash
pnpm dev:cv     # CV service sur http://localhost:8000
```

## Scripts disponibles

| Commande | Description |
|----------|-------------|
| `pnpm dev:api` | Lance l'API NestJS en mode watch |
| `pnpm dev:web` | Lance le frontend Next.js en mode dev |
| `pnpm dev:cv` | Lance le CV service Python (uvicorn) |
| `pnpm build:api` | Build de production de l'API |
| `pnpm build:web` | Build de production du frontend |
| `pnpm test:api` | Tests unitaires + e2e de l'API |
| `pnpm test:web` | Tests du frontend |
| `pnpm lint` | Lint de l'API et du frontend |
| `pnpm db:migrate` | Exécute les migrations TypeORM |

## Structure du projet

```
Chiffreo/
├── apps/
│   ├── api/                # Backend NestJS (16 modules, 27 migrations)
│   ├── web/                # Frontend Next.js (App Router)
│   └── cv-service/         # Microservice Python (Depth Anything V2 + YOLOv8)
├── docs/
│   ├── CONTEXT.md          # Brief produit (personas, epics, modèle économique)
│   ├── ARCHITECTURE.md     # Architecture technique détaillée
│   └── API.md              # Référence API REST complète
├── .env.example            # Template des variables d'environnement
├── docker-compose.yml      # PostgreSQL + CV service
├── pnpm-workspace.yaml     # Configuration monorepo
├── CONTRIBUTING.md         # Guide de contribution
└── CLAUDE.md               # Workflow IA
```

## Variables d'environnement

Copier `.env.example` vers `.env` et renseigner les valeurs :

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DB_HOST` | Hôte PostgreSQL | `localhost` |
| `DB_PORT` | Port PostgreSQL | `5432` |
| `DB_USERNAME` | Utilisateur DB | `chiffreo` |
| `DB_PASSWORD` | Mot de passe DB | `chiffreo_dev` |
| `DB_NAME` | Nom de la base | `chiffreo` |
| `PORT` | Port de l'API | `3001` |
| `CORS_ORIGIN` | Origine autorisée | `http://localhost:3000` |
| `FIREBASE_PROJECT_ID` | ID du projet Firebase | — |
| `FIREBASE_CLIENT_EMAIL` | Email du service account | — |
| `FIREBASE_PRIVATE_KEY` | Clé privée Firebase | — |
| `NEXT_PUBLIC_FIREBASE_*` | Config Firebase client (4 variables) | — |
| `CV_SERVICE_URL` | URL du CV service | `http://localhost:8000` |
| `CV_SERVICE_TIMEOUT_MS` | Timeout du CV service | `60000` |
| `NEXT_PUBLIC_API_URL` | URL de l'API pour le frontend | `http://localhost:3001/api/v1` |
| `PRICE_MOCK_ENABLED` | Activer les fournisseurs mock | `false` |

## Documentation

- [Architecture technique](docs/ARCHITECTURE.md)
- [Référence API REST](docs/API.md)
- [Contexte produit](docs/CONTEXT.md)
- [Stratégie produit — analyse d'écart et architecture cible](docs/PRODUCT_STRATEGY.md)
- [Backlog priorisé](docs/BACKLOG.md)
- [Backend API](apps/api/README.md)
- [Frontend Web](apps/web/README.md)
- [CV Service](apps/cv-service/README.md)
- [Guide de contribution](CONTRIBUTING.md)

## Modèle économique

| Tier | Fonctionnalités |
|------|----------------|
| **Free** | 2 projets actifs, saisie manuelle, estimation basique, export PDF |
| **Pro** (9,99 €/mois) | Projets illimités, analyse CV, facteurs de perte avancés, suivi budgétaire |
| **Contractor** (50-200 €/mois) | Gestion clients, génération de devis, outils de chiffrage pro |
