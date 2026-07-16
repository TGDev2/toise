# EstiMate — Frontend Web

Application web construite avec **Next.js 16** (App Router), **React 19** et **Tailwind CSS 4**.

## Setup local

### Prérequis

- Node.js >= 20
- pnpm >= 9
- API backend en cours d'exécution (`pnpm dev:api`)
- Projet Firebase configuré

### Installation

```bash
# Depuis la racine du monorepo
pnpm install

# Configurer les variables d'environnement
cp .env.example .env
# Remplir les variables NEXT_PUBLIC_*

# Lancer en mode développement
pnpm dev:web
```

L'application sera disponible sur `http://localhost:3000`.

### Scripts

| Commande | Description |
|----------|-------------|
| `pnpm dev` | Mode développement (hot reload) |
| `pnpm build` | Build de production (avec type check) |
| `pnpm start` | Servir le build de production |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Vérification TypeScript |
| `pnpm test` | Tests Jest |

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | URL de l'API backend (défaut: `http://localhost:3001/api/v1`) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Clé API Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Domaine auth Firebase |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ID du projet Firebase |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ID de l'app Firebase |

## Structure du projet

```
src/
├── app/                          # Routes (Next.js App Router)
│   ├── layout.tsx                # Layout racine (AuthProvider, FeatureGateProvider)
│   ├── page.tsx                  # Page d'accueil
│   ├── globals.css               # Styles globaux
│   ├── privacy/page.tsx          # Politique de confidentialité
│   │
│   ├── (auth)/                   # Groupe de routes auth
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── forgot-password/page.tsx
│   │
│   ├── (app)/                    # Groupe de routes principales
│   │   ├── dashboard/page.tsx                    # Dashboard projets
│   │   ├── projects/[id]/
│   │   │   ├── photos/page.tsx                   # Upload photos
│   │   │   ├── dimensions/page.tsx               # Saisie dimensions + analyse CV
│   │   │   ├── work-selection/page.tsx           # Sélection travaux
│   │   │   ├── estimate/page.tsx                 # Résultats estimation
│   │   │   ├── shopping-list/page.tsx            # Liste d'achat
│   │   │   ├── share/page.tsx                    # Paramètres de partage
│   │   │   └── quote/new/page.tsx                # Nouveau devis
│   │   ├── quotes/
│   │   │   ├── page.tsx                          # Liste des devis
│   │   │   └── [id]/page.tsx                     # Détail d'un devis
│   │   ├── settings/company/page.tsx             # Profil entreprise
│   │   ├── subscription/
│   │   │   ├── success/page.tsx                  # Post-checkout
│   │   │   └── cancel/page.tsx                   # Annulation
│   │   └── community/
│   │       ├── page.tsx                          # Galerie communautaire
│   │       └── [id]/page.tsx                     # Détail projet communautaire
│   │
│   ├── (admin)/admin/
│   │   ├── materials/
│   │   │   ├── page.tsx                          # Gestion matériaux
│   │   │   ├── new/page.tsx                      # Créer matériau
│   │   │   └── [id]/page.tsx                     # Éditer matériau
│   │   └── community/page.tsx                    # Modération communauté
│   │
│   └── shared/
│       └── shopping-list/[token]/page.tsx        # Liste partagée (publique)
│
├── components/                   # Composants React
│   ├── auth/                     # LoginForm, RegisterForm, OAuthButtons, GuestPromptModal
│   ├── photos/                   # PhotoDropzone, PhotoUploadItem, PhotoUploadPanel
│   ├── dimensions/               # DimensionsForm, OpeningsSection, RoomPreview
│   ├── analysis/                 # AnalyzeButton, ReferenceObjectPrompt, AnalysisResultPanel
│   ├── estimation/               # WorkTypeSection, SkillLevelSelector, EstimationResults
│   ├── dashboard/                # ProjectCard, ContractorDashboard, StatusBadge
│   ├── shopping-list/            # ShoppingListMaterials, BudgetDashboard, PriceComparisonTable
│   ├── quotes/                   # QuoteStatusBadge, ClientSelect
│   ├── paywall/                  # PaywallModal, ProBadge, ContractorPricingModal
│   ├── community/                # CommunityProjectCard, CommunityGalleryGrid
│   └── CookieConsent.tsx
│
├── contexts/                     # Contexts React
│   ├── AuthContext.tsx           # Authentification (Firebase + backend sync)
│   └── FeatureGateContext.tsx    # Contrôle d'accès par tier
│
├── hooks/                        # Hooks personnalisés
│   ├── useAnalysis.ts            # Gestion du pipeline CV
│   ├── usePhotoUpload.ts         # Upload photos avec compression
│   ├── useSubscription.ts        # État abonnement + checkout Stripe
│   ├── useFeatureGate.ts         # Vérification accès feature
│   ├── useAnalytics.ts           # Tracking d'événements
│   └── useAdminAuth.ts           # Vérification rôle admin
│
└── lib/                          # Utilitaires
    ├── api.ts                    # Client API (apiGet, apiPost, apiUpload, etc.)
    ├── firebase.ts               # Configuration Firebase Client SDK
    ├── project-types.ts          # Types et constantes projets
    ├── estimation-types.ts       # Types estimation
    ├── dimension-validation.ts   # Validation des dimensions
    ├── surface.ts                # Calcul de surfaces
    ├── units.ts                  # Conversions d'unités
    ├── work-types.ts             # Configuration types de travaux
    └── errors.ts                 # Utilitaires d'erreur
```

## Contexts

### AuthContext

Fournit l'état d'authentification à toute l'application. Wrappé dans `layout.tsx`.

**Types d'utilisateurs :**
- **Guest (anonyme)** : session Firebase anonyme, projets en `localStorage`
- **Authentifié** : email/password, Google OAuth, ou Apple OAuth

**Fonctions exposées :**

| Fonction | Description |
|----------|-------------|
| `login(email, password)` | Connexion email/password |
| `register(email, password, displayName?, companyProfile?)` | Inscription |
| `loginWithGoogle()` | Connexion Google OAuth |
| `loginWithApple()` | Connexion Apple OAuth |
| `startGuestSession()` | Créer une session invité |
| `convertGuestAccount()` | Convertir le compte invité en compte permanent |
| `convertGuestWithGoogle()` | Convertir via Google |
| `convertGuestWithApple()` | Convertir via Apple |
| `logout()` | Déconnexion |
| `deleteAccount()` | Suppression du compte |
| `forgotPassword(email)` | Réinitialisation du mot de passe |
| `syncWithBackend()` | Synchroniser le profil avec le backend |

**Migration des projets guest :** Lors de la conversion d'un compte invité, les projets stockés en `localStorage` (clé `estimate_local_projects`) sont automatiquement migrés vers le backend via `migrateLocalProjects()`.

### FeatureGateContext

Contrôle l'accès aux fonctionnalités payantes selon le tier d'abonnement.

**Hiérarchie des tiers :** `free` (0) < `pro` (1) < `contractor` (2)

| Fonction | Description |
|----------|-------------|
| `isFeatureAllowed(featureKey)` | Vérifie si la feature est accessible |
| `showPaywall(featureKey)` | Affiche le modal paywall |
| `closePaywall()` | Ferme le modal paywall |

## Hooks personnalisés

### `useAnalysis(projectId)`

Orchestre l'analyse CV : déclenchement, polling du status (3s), récupération des résultats.

| Propriété | Type | Description |
|-----------|------|-------------|
| `status` | string | `idle`, `starting`, `processing`, `completed`, `failed`, `no_reference` |
| `progressPct` | number | Progression 0-100 |
| `dimensions` | object | Dimensions détectées (length_cm, width_cm, height_cm) |
| `detectedOpenings` | array | Ouvertures détectées avec dimensions et confiance |
| `startAnalysis()` | function | Lancer l'analyse |
| `reset()` | function | Réinitialiser |

### `usePhotoUpload(projectId)`

Gère l'upload de photos avec compression client-side et retry automatique.

| Propriété | Type | Description |
|-----------|------|-------------|
| `photos` | array | Photos avec état d'upload |
| `addFiles(files)` | function | Ajouter et uploader des fichiers |
| `removePhoto(id)` | function | Supprimer une photo |
| `retryPhoto(id)` | function | Réessayer un upload échoué |
| `isUploading` | boolean | Upload en cours |
| `canProceed` | boolean | Au moins une photo prête |
| `readyCount` | number | Nombre de photos uploadées |
| `maxPhotos` | number | Maximum autorisé (5) |

**Contraintes :** max 5 photos, max 20 MB chacune, compression automatique à 2 MB.

### `useSubscription()`

Gère l'état d'abonnement et l'accès au checkout/portail Stripe.

| Propriété | Type | Description |
|-----------|------|-------------|
| `subscription` | object | Détails de l'abonnement (status, tier, dates) |
| `openCheckout()` | function | Ouvrir Stripe Checkout |
| `openPortal()` | function | Ouvrir le portail client Stripe |

### `useFeatureGate(featureKey)`

Vérifie si une feature est accessible pour l'utilisateur courant. Retourne un `boolean`.

### `useAnalytics()`

Tracking d'événements analytics. Retourne des fonctions de tracking.

## Client API

Le client API (`src/lib/api.ts`) centralise toutes les requêtes HTTP vers le backend.

**Configuration :**
- Base URL : `NEXT_PUBLIC_API_URL`
- Auth : Firebase ID Token en header `Authorization: Bearer <token>`

**Méthodes :**

| Méthode | Description |
|---------|-------------|
| `apiGet<T>(path)` | Requête GET |
| `apiPost<T>(path, body?)` | Requête POST |
| `apiPut<T>(path, body)` | Requête PUT |
| `apiPatch<T>(path, body?)` | Requête PATCH |
| `apiDelete(path)` | Requête DELETE |
| `apiUpload<T>(path, file, onProgress?)` | Upload fichier avec progression |
| `apiDownload(path, filename)` | Téléchargement de fichier |

Toutes les méthodes lèvent une `ApiError` en cas d'échec, avec `code` et `details`.

## Tests

```bash
pnpm test        # Lancer les tests
pnpm test:watch  # Mode watch
```

Les composants ont des fichiers de test dans des sous-dossiers `__tests__/` adjacents.

## Liens

- [Référence API REST](../../docs/API.md)
- [Architecture technique](../../docs/ARCHITECTURE.md)
- [Backend API](../api/README.md)
- [CV Service](../cv-service/README.md)
