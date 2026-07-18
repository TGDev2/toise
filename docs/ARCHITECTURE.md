# Architecture technique — Chiffréo

## Vue d'ensemble

Chiffréo est un **monorepo pnpm** composé de 3 applications communicant via REST HTTP :

```
                        ┌──────────────────────────────────┐
                        │         Client (Navigateur)      │
                        │    Next.js 16 · React 19         │
                        │    Tailwind CSS 4                │
                        │    Firebase Auth (Client SDK)    │
                        └──────────────┬───────────────────┘
                                       │ HTTPS
                                       │ Bearer Token (Firebase ID Token)
                                       ▼
                        ┌──────────────────────────────────┐
                        │        API Gateway               │
                        │    NestJS 11 · TypeORM           │
                        │    Firebase Auth (Admin SDK)     │
                        │    Stripe · PDFKit · Sharp       │
                        │    :3001/api/v1                  │
                        └───────┬──────────────┬───────────┘
                                │              │
                    HTTP POST   │              │  SQL
                    /analyze    │              │
                                ▼              ▼
                 ┌────────────────┐  ┌─────────────────────┐
                 │  CV Service    │  │   PostgreSQL 16      │
                 │  FastAPI       │  │                      │
                 │  Depth Any. V2 │  │   27 migrations      │
                 │  YOLOv8n       │  │   25+ entités        │
                 │  :8000         │  │                      │
                 └────────────────┘  └─────────────────────┘
                         │                     ▲
                         │     Résultats       │
                         └─────────────────────┘
                           (via API, stockés en DB)
```

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Frontend | Next.js | 16.2.1 |
| UI | React | 19.2.4 |
| CSS | Tailwind CSS | 4.0 |
| Backend | NestJS | 11.0.1 |
| ORM | TypeORM | 0.3.28 |
| Base de données | PostgreSQL | 16 (Alpine) |
| Auth | Firebase Admin SDK | 13.7.0 |
| Auth (client) | Firebase Client SDK | 12.11.0 |
| Paiements | Stripe | 21.0.1 |
| Images | Sharp | 0.34.5 |
| PDF | PDFKit | 0.18.0 |
| CV - Framework | FastAPI | 0.115.6 |
| CV - Depth | Depth Anything V2 Small | HuggingFace Transformers |
| CV - Détection | YOLOv8n | Ultralytics |
| Charts | Recharts | 3.8.1 |
| Package manager | pnpm | 9+ |
| Tests | Jest | — |
| Linting | ESLint + Prettier | — |

## Modules backend (NestJS)

L'API est organisée en **16 modules NestJS** indépendants :

```
AppModule
├── AuthModule              # Inscription, connexion, Firebase sync, guest merge
├── UsersModule             # Gestion des utilisateurs
├── ProjectsModule          # CRUD projets, dimensions, ouvertures, work items
├── MaterialsModule         # Catalogue matériaux (admin), waste factors, packaging
├── EstimationsModule       # Moteur de calcul des quantités
├── ShoppingListsModule     # Listes d'achat, export PDF, partage par token
├── PhotosModule            # Upload photos, thumbnails, stockage local
├── AnalysisModule          # Pipeline CV (jobs asynchrones)
├── AnalyticsModule         # Tracking d'événements
├── FeatureGatesModule      # Feature flags par tier d'abonnement
├── SubscriptionsModule     # Intégration Stripe (checkout, webhooks, portail)
├── PriceComparisonModule   # Comparaison de prix fournisseurs (mock/réel)
├── CompanyProfilesModule   # Profils entreprise (tier Contractor)
├── ClientsModule           # Gestion clients (tier Contractor)
├── QuotesModule            # Génération de devis + export PDF
└── CommunityModule         # Galerie communautaire, commentaires, likes
```

## Flux de données principaux

### 1. Création de projet et estimation (flux principal)

```
Utilisateur
    │
    ├─1─▶ POST /auth/register          Inscription (ou guest session)
    │
    ├─2─▶ POST /projects               Créer un projet
    │
    ├─3─▶ PUT /projects/:id/dimensions  Saisir les dimensions (manuel)
    │     POST /projects/:id/openings   Ajouter portes/fenêtres
    │     POST /projects/:id/work-items Choisir type de travaux + skill level
    │
    ├─4─▶ POST /projects/:id/estimate   Lancer le calcul d'estimation
    │         │
    │         └──▶ EstimationsService
    │              ├── Récupérer dimensions + ouvertures
    │              ├── Calculer surface nette
    │              ├── Appliquer waste factors (matériau × pose × skill)
    │              ├── Arrondir au conditionnement commercial
    │              └── Sauvegarder EstimationResult
    │
    ├─5─▶ GET /projects/:id/shopping-list   Générer la liste d'achat
    │         │
    │         └──▶ ShoppingListsService
    │              ├── Récupérer estimation
    │              ├── Ajouter matériaux complémentaires
    │              └── Calculer budget summary
    │
    └─6─▶ GET /projects/:id/shopping-list/export/pdf   Exporter en PDF
```

### 2. Analyse par vision par ordinateur

```
Utilisateur
    │
    ├─1─▶ POST /projects/:id/photos     Upload 3-5 photos
    │         │
    │         └──▶ PhotosService
    │              ├── Valider format (JPEG/PNG/HEIC, max 20MB)
    │              ├── Générer thumbnail (Sharp)
    │              └── Stocker sur disque local
    │
    ├─2─▶ POST /projects/:id/analyze    Lancer l'analyse CV
    │         │
    │         └──▶ AnalysisService
    │              ├── Créer AnalysisJob (status: pending)
    │              ├── Appeler CV Service (POST /analyze)
    │              │       │
    │              │       └──▶ DimensionCalculator
    │              │            ├── Charger images
    │              │            ├── Estimer profondeur (Depth Anything V2)
    │              │            ├── Détecter contours (OpenCV)
    │              │            ├── Détecter objet de référence (porte)
    │              │            ├── Calibrer l'échelle (px → cm)
    │              │            ├── Calculer dimensions pièce
    │              │            ├── Détecter ouvertures (YOLOv8n)
    │              │            ├── Fusionner résultats multi-images (médiane)
    │              │            └── Évaluer le score de confiance
    │              │
    │              └── Sauvegarder résultats + mettre à jour dimensions
    │
    └─3─▶ GET /projects/:id/analyze/:jobId/status   Polling (toutes les 3s)
```

### 3. Abonnement et paiement

```
Utilisateur
    │
    ├─1─▶ POST /subscriptions/checkout   Créer session Stripe Checkout
    │         └──▶ Redirection vers Stripe
    │
    ├─2─▶ Stripe ──▶ POST /subscriptions/webhook
    │         │
    │         └──▶ SubscriptionsService
    │              ├── Vérifier signature webhook
    │              ├── checkout.session.completed → créer Subscription
    │              ├── invoice.paid → renouveler
    │              ├── customer.subscription.updated → mettre à jour
    │              └── customer.subscription.deleted → annuler
    │
    └─3─▶ GET /subscriptions/current    Vérifier status abonnement
```

## Patterns architecturaux

### Authentification Firebase (dual-SDK)

```
Frontend                          Backend
┌──────────────────┐              ┌──────────────────┐
│ Firebase Client  │   ID Token   │ Firebase Admin   │
│ SDK              │──────────────▶ SDK              │
│                  │              │                  │
│ - signIn         │              │ - verifyIdToken  │
│ - signUp         │              │ - createUser     │
│ - OAuth          │              │                  │
│ - Anonymous      │              │                  │
└──────────────────┘              └──────────────────┘
```

- Le **frontend** utilise le Firebase Client SDK pour l'authentification (email/password, Google, Apple, anonymous)
- Le **backend** vérifie les ID tokens via le Firebase Admin SDK dans le `FirebaseAuthGuard`
- L'utilisateur Firebase est synchronisé avec la table `users` locale via `POST /auth/sync`

### Feature Gating par tier

```
Requête entrante
    │
    ▼
FirebaseAuthGuard          Vérifie le token Firebase
    │
    ▼
FeatureGateGuard           Lit @RequireFeature('feature_key')
    │                      Récupère le tier de l'utilisateur
    │                      Consulte feature_gates table
    ▼
Accès autorisé / 403 Forbidden
```

**Tiers :** `free` < `pro` < `contractor`

| Feature Key | Tier minimum |
|-------------|-------------|
| `unlimited_projects` | pro |
| `cv_analysis` | pro |
| `budget_tracking` | pro |
| `price_comparison` | pro |
| `client_management` | contractor |
| `export_devis` | contractor |
| `community_gallery` | pro |

### Pipeline CV asynchrone

Le traitement CV est découplé via une table `analysis_jobs` :
1. L'API crée un job (status: `pending`)
2. L'API appelle le CV service de façon synchrone (avec timeout)
3. Le résultat est stocké dans le job (status: `completed` ou `failed`)
4. Le frontend poll le status toutes les 3 secondes

### Stripe Webhooks

- Le bootstrap NestJS active `rawBody: true` pour la vérification de signature Stripe
- Le controller webhook est exempt du throttling (`@SkipThrottle()`)
- Les événements gérés : `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`

## Modèle de données (relations principales)

```
users ─────────────────┬──────────────────┬───────────────────┐
  │                    │                  │                   │
  │ 1:N                │ 1:1              │ 1:N               │ 1:1
  ▼                    ▼                  ▼                   ▼
projects          subscription      company_profile       clients
  │                                                         │
  ├── 1:1 room_dimensions                                   │
  ├── 1:N openings                                          │
  ├── 1:N project_work_items ──▶ work_types                 │
  ├── 1:N project_photos                                    │
  ├── 1:N estimation_results                                │
  ├── 1:1 shopping_list                                     │
  ├── 1:N analysis_jobs                                     │
  ├── 1:1 community_project ──┬── 1:N community_comments    │
  │                           └── 1:N community_likes       │
  └── 1:N quotes ─────────────────────────────────────────────┘
              │
              └──▶ estimation_results

materials_catalog ──┬── 1:N material_packaging
                    └── 1:N waste_factors

feature_gates          (configuration globale par feature_key)
analytics_events       (tracking par user_id)
supplier_price_cache   (cache prix fournisseurs)
```

**Conventions DB :**
- Clés primaires : UUID
- Nommage : `snake_case` pour tables et colonnes
- Timestamps : `created_at`, `updated_at` sur toutes les entités
- Soft delete : `deleted_at` sur `projects` et `community_projects`
- Migrations : 27 fichiers versionnés dans `apps/api/migrations/`

## Sécurité

### Authentification et autorisation

| Couche | Mécanisme |
|--------|-----------|
| Auth | Firebase ID Token (Bearer) vérifié par `FirebaseAuthGuard` |
| Auth optionnelle | `OptionalAuthGuard` pour les routes publiques avec contexte utilisateur optionnel |
| Admin | `AdminGuard` vérifie `user.role === 'admin'` |
| Feature access | `FeatureGateGuard` + `@RequireFeature()` par tier d'abonnement |
| Ownership | Chaque service vérifie que la ressource appartient à l'utilisateur courant |

### Validation et protection

| Protection | Implémentation |
|------------|---------------|
| Validation entrée | `ValidationPipe` global : `whitelist`, `forbidNonWhitelisted`, `transform` |
| Rate limiting | `ThrottlerModule` : 100 req/min (général), 5 req/15min (auth) |
| CORS | Origine configurable via `CORS_ORIGIN` |
| Upload fichiers | JPEG/PNG/HEIC uniquement, max 20 MB, validation MIME type |
| Path traversal | CV service : validation des chemins d'images (pas de `..`, pas de chemins absolus, vérification `relative_to()`) |
| Injection SQL | TypeORM avec requêtes paramétrées |
| Webhook Stripe | Vérification de signature avec `rawBody` |
| Stripe Price IDs | Validation du `priceId` checkout contre une liste autorisée |

### Gestion des erreurs

- `AllExceptionsFilter` global capture toutes les exceptions
- Les erreurs HTTP retournent la réponse de l'exception
- Les erreurs non gérées retournent `500 Internal Server Error`
- Les erreurs >= 500 sont loggées côté serveur
