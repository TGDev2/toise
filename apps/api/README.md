# EstiMate — Backend API

Backend REST API construit avec **NestJS 11** et **TypeORM** sur **PostgreSQL 16**.

## Setup local

### Prérequis

- Node.js >= 20
- pnpm >= 9
- PostgreSQL 16 (ou Docker)

### Installation

```bash
# Depuis la racine du monorepo
pnpm install

# Configurer les variables d'environnement
cp .env.example .env
# Remplir les variables DB_*, FIREBASE_*, STRIPE_*, etc.

# Lancer PostgreSQL via Docker
docker compose up -d db

# Exécuter les migrations
pnpm db:migrate

# Lancer en mode développement
pnpm dev:api
```

L'API sera disponible sur `http://localhost:3001/api/v1`.

### Scripts

| Commande | Description |
|----------|-------------|
| `pnpm dev` | Mode watch (développement) |
| `pnpm build` | Build de production |
| `pnpm start:prod` | Lancer le build de production |
| `pnpm test` | Tests unitaires (Jest) |
| `pnpm test:watch` | Tests en mode watch |
| `pnpm test:cov` | Tests avec couverture |
| `pnpm test:e2e` | Tests end-to-end |
| `pnpm lint` | ESLint |
| `pnpm migration:generate -- ./migrations/<NomMigration>` | Générer une migration |
| `pnpm migration:run` | Exécuter les migrations |
| `pnpm migration:revert` | Annuler la dernière migration |

## Architecture

### Structure des fichiers

```
src/
├── main.ts                    # Bootstrap (prefix, CORS, validation, filters)
├── app.module.ts              # Module racine (imports des 16 modules)
├── config/
│   ├── configuration.ts       # Chargement des variables d'environnement
│   ├── firebase.config.ts     # Initialisation Firebase Admin SDK
│   └── data-source.ts         # DataSource TypeORM (pour CLI migrations)
├── auth/
│   ├── auth.controller.ts     # Routes /auth/*
│   ├── auth.service.ts        # Logique d'authentification
│   ├── guards/
│   │   ├── firebase-auth.guard.ts   # Vérifie le token Firebase
│   │   ├── optional-auth.guard.ts   # Auth optionnelle (routes publiques)
│   │   └── admin.guard.ts           # Vérifie le rôle admin
│   ├── decorators/
│   │   ├── current-user.decorator.ts      # @CurrentFirebaseUser()
│   │   └── current-app-user.decorator.ts  # @CurrentAppUser()
│   └── dto/
├── projects/
│   ├── projects.controller.ts
│   ├── projects.service.ts
│   ├── entities/              # Project, RoomDimensions, Opening, WorkType, ProjectWorkItem
│   └── dto/
├── materials/
│   ├── materials.controller.ts
│   ├── materials.service.ts
│   ├── entities/              # MaterialCatalog, MaterialPackaging, WasteFactor
│   └── dto/
├── estimations/               # Moteur de calcul
├── shopping-lists/            # Listes d'achat, export PDF, partage
├── photos/                    # Upload, thumbnails, stockage local
├── analysis/                  # Pipeline CV (jobs asynchrones)
├── analytics/                 # Tracking d'événements
├── feature-gates/             # Feature flags par tier
├── subscriptions/             # Stripe (checkout, webhooks, portail)
├── price-comparison/          # Comparaison prix fournisseurs
├── company-profiles/          # Profils entreprise (Contractor)
├── clients/                   # Gestion clients (Contractor)
├── quotes/                    # Devis + export PDF (Contractor)
├── community/                 # Galerie, commentaires, likes
├── users/                     # Entité User, UsersService
└── common/
    └── filters/
        └── all-exceptions.filter.ts  # Filtre d'erreurs global
```

### Modules

| Module | Responsabilité |
|--------|---------------|
| **AuthModule** | Inscription, connexion, Firebase sync, guest merge, guards |
| **UsersModule** | CRUD utilisateurs, recherche par Firebase UID/email |
| **ProjectsModule** | Projets, dimensions, ouvertures, work items |
| **MaterialsModule** | Catalogue matériaux (admin), waste factors, packaging |
| **EstimationsModule** | Moteur de calcul : surface nette × rendement × waste factor → quantités |
| **ShoppingListsModule** | Listes d'achat, matériaux complémentaires, budget, export PDF, partage |
| **PhotosModule** | Upload multipart, validation MIME, thumbnail Sharp, stockage local |
| **AnalysisModule** | Orchestration du pipeline CV, jobs asynchrones |
| **AnalyticsModule** | Tracking d'événements (PostHog/Mixpanel ready) |
| **FeatureGatesModule** | Feature flags par tier, guard `@RequireFeature()` |
| **SubscriptionsModule** | Stripe Checkout, webhooks, portail client |
| **PriceComparisonModule** | Adapteurs fournisseurs (mock/réel), cache de prix |
| **CompanyProfilesModule** | Profil SIRET, adresse, spécialités (Contractor) |
| **ClientsModule** | CRUD clients rattachés à un contractor |
| **QuotesModule** | Création de devis, calcul HT/TTC, export PDF |
| **CommunityModule** | Galerie publique, modération admin, likes, commentaires |

## Authentification

### Flow

1. Le frontend obtient un **Firebase ID Token** via le Firebase Client SDK
2. Chaque requête authentifiée envoie le token dans `Authorization: Bearer <token>`
3. Le `FirebaseAuthGuard` vérifie le token via le Firebase Admin SDK
4. L'utilisateur Firebase est résolu en `User` local via `UsersService`

### Guards

| Guard | Decorator | Usage |
|-------|-----------|-------|
| `FirebaseAuthGuard` | `@UseGuards(FirebaseAuthGuard)` | Requiert un token Firebase valide |
| `OptionalAuthGuard` | `@UseGuards(OptionalAuthGuard)` | Token optionnel (routes publiques avec contexte user) |
| `AdminGuard` | `@UseGuards(AdminGuard)` | Vérifie `user.role === 'admin'` |
| `FeatureGateGuard` | `@UseGuards(FeatureGateGuard)` | Vérifie l'accès à une feature par tier |

### Decorators

| Decorator | Retourne |
|-----------|----------|
| `@CurrentFirebaseUser()` | `DecodedIdToken` du Firebase Admin SDK |
| `@CurrentAppUser()` | Entité `User` locale (définie par AdminGuard ou FeatureGateGuard) |
| `@RequireFeature('key')` | Metadata lue par `FeatureGateGuard` |

## Feature Gating

Contrôle d'accès par tier d'abonnement (`free` < `pro` < `contractor`).

```typescript
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
@RequireFeature('cv_analysis')
@Post(':id/analyze')
startAnalysis() { ... }
```

La table `feature_gates` définit pour chaque `feature_key` le `min_tier` requis. Le guard compare le tier de l'utilisateur au tier minimum.

## Base de données

### Configuration

- **ORM :** TypeORM avec `autoLoadEntities: true`
- **Synchronize :** `false` (migrations uniquement)
- **Migrations :** 27 fichiers dans `migrations/`

### Entités principales

| Entité | Table | Relations principales |
|--------|-------|----------------------|
| `User` | `users` | 1:N Projects, 1:1 Subscription, 1:1 CompanyProfile, 1:N Clients |
| `Project` | `projects` | 1:1 RoomDimensions, 1:N Openings, 1:N WorkItems, 1:N Photos, 1:N Estimations, 1:1 ShoppingList |
| `RoomDimensions` | `room_dimensions` | 1:1 Project |
| `Opening` | `openings` | N:1 Project |
| `MaterialCatalog` | `materials_catalog` | 1:N Packaging, 1:N WasteFactor |
| `EstimationResult` | `estimation_results` | N:1 Project |
| `ShoppingList` | `shopping_lists` | 1:1 Project |
| `Subscription` | `subscriptions` | 1:1 User |
| `Quote` | `quotes` | N:1 User, N:1 Project, N:1 Client, N:1 Estimation |

### Générer une migration

```bash
cd apps/api
pnpm migration:generate -- ./migrations/NomDeLaMigration
```

### Exécuter les migrations

```bash
pnpm migration:run
```

## Configuration

Toutes les variables d'environnement sont chargées via `ConfigModule` et centralisées dans `src/config/configuration.ts`.

| Variable | Description | Défaut |
|----------|-------------|--------|
| `PORT` | Port du serveur | `3001` |
| `DB_HOST` | Hôte PostgreSQL | `localhost` |
| `DB_PORT` | Port PostgreSQL | `5432` |
| `DB_USERNAME` | Utilisateur DB | `estimate` |
| `DB_PASSWORD` | Mot de passe DB | `estimate_dev` |
| `DB_NAME` | Nom de la base | `estimate` |
| `CORS_ORIGIN` | Origine CORS autorisée | `http://localhost:3000` |
| `FIREBASE_PROJECT_ID` | ID du projet Firebase | — |
| `FIREBASE_CLIENT_EMAIL` | Email du service account | — |
| `FIREBASE_PRIVATE_KEY` | Clé privée Firebase | — |
| `CV_SERVICE_URL` | URL du microservice CV | `http://localhost:8000` |
| `CV_SERVICE_TIMEOUT_MS` | Timeout du CV service | `60000` |
| `PRICE_MOCK_ENABLED` | Activer les fournisseurs mock | `false` |

## Tests

```bash
# Tests unitaires
pnpm test

# Tests avec couverture
pnpm test:cov

# Tests e2e
pnpm test:e2e

# Tests en mode watch
pnpm test:watch
```

Les tests utilisent **Jest**. Couverture minimale attendue : **80%** sur le code modifié.

## Référence API

Voir la [documentation API complète](../../docs/API.md) pour le détail de tous les endpoints.
