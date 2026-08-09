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
                        └───────────────┬───────────────────┘
                                        │  SQL
                                        ▼
                        ┌──────────────────────────────────┐
                        │           PostgreSQL 16           │
                        │        65 migrations · 25+        │
                        │             entités                │
                        └──────────────────────────────────┘
```

`apps/cv-service` (vision par ordinateur, FastAPI + Depth Anything V2 +
YOLOv8n) reste dans le dépôt mais n'est plus sollicité en production
(débranché, ADR 0001 §D2, `CV_ENABLED=false`) : la boîte et la liaison
`POST /analyze` qui apparaissaient ici ont disparu du schéma. Condition de
réouverture : ADR 0001 §5.2.

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
| CV - Framework *(débranché de la prod, ADR 0001)* | FastAPI | 0.115.6 |
| CV - Depth *(débranché de la prod, ADR 0001)* | Depth Anything V2 Small | HuggingFace Transformers |
| CV - Détection *(débranché de la prod, ADR 0001)* | YOLOv8n (poids = artefact GitHub Release `cv-model-vN`, hors git ; repli heuristique OpenCV si absents) | Ultralytics |
| Charts | Recharts | 3.8.1 |
| Package manager | pnpm | 9+ |
| Tests | Jest | — |
| Linting | ESLint + Prettier | — |

## Modules backend (NestJS)

L'API est organisée en **19 modules NestJS** indépendants :

```
AppModule
├── AuthModule              # Inscription, connexion, Firebase sync, guest merge
├── UsersModule             # Gestion des utilisateurs
├── ProjectsModule          # CRUD projets, pièces (rooms), dimensions, ouvertures, work items
├── MaterialsModule         # Catalogue matériaux (admin), waste factors, packaging
├── EstimationsModule       # Moteur de calcul des quantités
├── ShoppingListsModule     # Listes d'achat, export PDF, partage par token
├── PhotosModule            # Upload photos, thumbnails, stockage local
├── AnalysisModule          # Pipeline CV (jobs asynchrones)
├── AnalyticsModule         # Tracking d'événements (funnel DATA-1, événements typés)
│                           #   POST /analytics/events (auth requise) + POST /public/analytics/events (auth optionnelle, anonyme)
├── AdminAnalyticsModule    # Tableau de bord North Star (funnel, MRR, listes/semaine) — DATA-2
├── FeatureGatesModule      # Feature flags par tier d'abonnement
├── SubscriptionsModule     # Intégration Stripe (checkout, webhooks, portail)
├── PriceComparisonModule   # Comparaison de prix fournisseurs (mock/réel)
├── CompanyProfilesModule   # Profils entreprise (tier Chiffréo Pro)
├── ClientsModule           # Gestion clients (tier Chiffréo Pro)
├── QuotesModule            # Génération de devis + export PDF
├── CommunityModule         # Galerie communautaire, commentaires, likes
├── DataRetentionModule     # Effacement des fichiers et purge des suppressions logiques (E6-1)
│                           #   Cron 3 h + `pnpm purge:retention` (simulation par défaut)
│                           #   Politique et durée : docs/RETENTION_DONNEES.md
├── DataExportModule        # Export RGPD des données personnelles, art. 20 (E6-2)
│                           #   Toujours asynchrone, archive écrite en flux (`archiver`)
│                           #   Contenu et exclusions : docs/EXPORT_DONNEES.md
├── OrganizationsModule     # Organisations, membres, rôles, invitations (PLAT-4)
│   └── OrgContextModule    # Résolution de la portée (organisation active + auteur), sans dépendance applicative
├── ApiKeysModule           # API publique `/partner`, clés portées par l'organisation, quotas (PLAT-5)
└── EnterpriseModule        # Contrats annuels, SLA, connexions SSO SAML/OIDC et domaines (PLAT-6)
                            #   Ce qui arrive à une session au moment de la connexion (rattachement
                            #   JIT + enforcement) vit dans `auth/sso-session.service.ts` : le graphe
                            #   de modules reste à sens unique.
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

> Débranché de la production (ADR 0001 §D2, `CV_ENABLED=false`) : ce flux ne
> s'exécute plus en prod. Documenté ici pour référence et pour la condition
> de réouverture (ADR §5.2).

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
    │              ├── invoice.payment_failed → past_due (délai de grâce)
    │              ├── customer.subscription.updated → mettre à jour
    │              ├── customer.subscription.deleted → annuler
    │              └── charge.refunded → tracer, et fermer si total
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

**Tiers :** `free` < `pro` < `contractor_essentiel` < `contractor_standard` < `contractor_premium` < `enterprise`

`enterprise` n'est pas achetable en libre-service : il est ouvert par un contrat annuel actif
rattaché à l'**organisation** (`enterprise_agreements`, PLAT-6), résolu par `OrgContextService`
avant tout repli sur le palier du propriétaire.

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
- Les événements gérés : `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`

## Modèle de données (relations principales)

```
users ─────────────────┬──────────────────┬───────────────────┐
  │                    │                  │                   │
  │ 1:N                │ 1:1              │ 1:N               │ 1:1
  ▼                    ▼                  ▼                   ▼
projects          subscription      company_profile       clients
  │                                                         │
  ├── 1:N rooms ──┬── 1:1 room_dimensions                   │
  │               ├── 1:N openings                          │
  │               └── 1:N project_work_items ──▶ work_types │
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
- Migrations : 65 fichiers versionnés dans `apps/api/src/migrations/`

## Sécurité

### Authentification et autorisation

| Couche | Mécanisme |
|--------|-----------|
| Auth | Firebase ID Token (Bearer) vérifié par `FirebaseAuthGuard` |
| Auth optionnelle | `OptionalAuthGuard` pour les routes publiques avec contexte utilisateur optionnel |
| Admin | `AdminGuard` vérifie `user.role === 'admin'` |
| Feature access | `FeatureGateGuard` + `@RequireFeature()` sur le palier **effectif de l'organisation active** (celui de son propriétaire), pas celui de l'appelant |
| Ownership | Chaque service vérifie que la ressource appartient à l'**organisation** courante (PLAT-4), résolue côté serveur par `OrgContextService` — jamais depuis un en-tête ou un paramètre client |
| Rôles d'organisation | `owner` / `admin` / `member` sur `organization_memberships`, orthogonaux au `users.role` (rôle plateforme) |
| SSO d'entreprise | Une session est rattachée à une organisation par le `provider_id` **émis par nous** chez GCIP, jamais par le domaine de l'adresse affirmée par l'IdP (PLAT-6). Les domaines, prouvés par DNS, ne servent qu'à la découverte |
| Enforcement SSO | `FirebaseAuthGuard` refuse (`403 SSO_REQUIRED`) une session hors IdP quand l'organisation active l'exige. Le propriétaire est exempté (bris de glace), et `@SsoExempt()` dispense les quatre routes sans lesquelles un membre bloqué n'aurait aucune sortie |

### Validation et protection

| Protection | Implémentation |
|------------|---------------|
| Validation entrée | `ValidationPipe` global : `whitelist`, `forbidNonWhitelisted`, `transform` |
| Rate limiting | `ThrottlerModule` : **un seul** limiteur global (100 req/min). Les plafonds plus stricts (auth : 5 req/15 min, mots de passe oubliés : 3 req/h) sont des surcharges `@Throttle({ default: … })` par route. Ne jamais déclarer un second limiteur nommé : `ThrottlerGuard` les applique **tous** à **toutes** les routes, donc un limiteur strict global devient le plafond du produit entier |
| IP réelle | `TRUST_PROXY` (`app.set('trust proxy')`). Non renseigné = `req.ip` est l'IP du reverse proxy, et tous les compteurs de rate limiting sont partagés par l'ensemble du trafic |
| CORS | Origine configurable via `CORS_ORIGIN` |
| Upload fichiers | JPEG/PNG/HEIC uniquement, max 20 MB, validation MIME type |
| Path traversal *(débranché de la prod, ADR 0001)* | CV service : validation des chemins d'images (pas de `..`, pas de chemins absolus, vérification `relative_to()`) |
| Accès au CV service *(débranché de la prod, ADR 0001)* | Isolement réseau (pas de `ports:` en prod, loopback en dev) **et** secret partagé `CV_SERVICE_TOKEN` sur `POST /analyze`. Le service refuse de démarrer sans ce secret dès que `CV_SERVICE_ENV != development` : l'isolement seul est une hypothèse qu'un `ports:` ajouté pour un débogage annule sans bruit. En production, `CV_ENABLED=false` refuse toute demande d'analyse avant même d'atteindre ce service |
| Upload : contenu réel | Octets de signature vérifiés (`detectImageFormat`) **avant** que le fichier n'atteigne sharp/libvips ; le `mime_type` stocké et resservi est celui qu'a constaté le décodage, jamais l'en-tête déclaré par le client |
| Injection SQL | TypeORM avec requêtes paramétrées |
| Webhook Stripe | Vérification de signature avec `rawBody` |
| Stripe Price IDs | Validation du `priceId` checkout contre une liste autorisée |

### Gestion des erreurs

- `AllExceptionsFilter` global capture toutes les exceptions
- Les erreurs HTTP retournent la réponse de l'exception
- Les erreurs non gérées retournent `500 Internal Server Error`
- Les erreurs >= 500 sont loggées côté serveur
