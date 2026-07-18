# Guide de contribution — Chiffréo

## Prérequis

- Node.js >= 20
- pnpm >= 9
- Python >= 3.11
- Docker et Docker Compose
- Un éditeur avec support TypeScript (VS Code recommandé)

## Setup de l'environnement

```bash
# 1. Cloner le repo
git clone <repository-url>
cd Chiffreo

# 2. Installer les dépendances
pnpm install

# 3. Configurer l'environnement
cp .env.example .env
# Remplir les variables requises

# 4. Lancer les services
docker compose up -d
pnpm db:migrate

# 5. Vérifier que tout fonctionne
pnpm dev:api &
pnpm dev:web &
```

## Conventions

### Branches git

| Préfixe | Usage | Exemple |
|---------|-------|---------|
| `feature/` | Nouvelle fonctionnalité | `feature/US-1.3-manual-dimension-input` |
| `fix/` | Correction de bug | `fix/US-2.1-waste-factor-calculation` |
| `spike/` | Investigation technique | `spike/cv-depth-model-comparison` |
| `docs/` | Documentation | `docs/api-reference` |
| `refactor/` | Refactoring | `refactor/shopping-list-service` |

### Commits

Format **conventionnel** :

```
type(scope): description courte

Corps optionnel avec détails.
```

**Types :**

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation |
| `refactor` | Refactoring sans changement fonctionnel |
| `test` | Ajout ou modification de tests |
| `chore` | Maintenance (deps, CI, config) |
| `perf` | Amélioration de performance |

**Exemples :**
```
feat(US-1.3): add manual dimension input form
fix(estimations): correct waste factor for diagonal tiling
docs(api): add shopping list endpoints reference
test(auth): add e2e tests for guest merge flow
```

### Nommage

| Contexte | Convention | Exemple |
|----------|-----------|---------|
| API endpoints | REST, snake_case | `/api/v1/shopping-list` |
| Tables DB | snake_case | `materials_catalog` |
| Colonnes DB | snake_case | `yield_per_unit` |
| Clés primaires | UUID | — |
| Composants React | PascalCase | `PhotoUploadPanel` |
| Hooks React | camelCase avec `use` | `usePhotoUpload` |
| Services NestJS | PascalCase avec `Service` | `EstimationsService` |
| Controllers NestJS | PascalCase avec `Controller` | `ProjectsController` |
| DTOs NestJS | PascalCase avec `Dto` | `CreateProjectDto` |
| Entités TypeORM | PascalCase | `MaterialCatalog` |

## Workflow de développement

### 1. Créer une branche

```bash
git checkout main
git pull origin main
git checkout -b feature/US-X.X-description
```

### 2. Développer

- Suivre les patterns existants dans le module le plus proche
- Ajouter les tests unitaires pour tout nouveau code
- S'assurer que les tests existants passent toujours

### 3. Vérifier localement

```bash
# Lint
pnpm lint

# Tests API
pnpm test:api

# Tests Web
pnpm test:web
```

### 4. Créer une Pull Request

- Titre court et descriptif (< 70 caractères)
- Description avec le contexte, les changements, et le plan de test
- Lier les issues/stories concernées
- Demander une review

### 5. Code review

- Au moins 1 approbation requise
- Répondre à tous les commentaires
- Les CI checks doivent passer

### 6. Merge

- Squash and merge vers `main`
- Supprimer la branche après merge

## Ajouter du code

### Nouveau module API

1. Créer le dossier dans `apps/api/src/<module-name>/`
2. Créer les fichiers : `*.module.ts`, `*.controller.ts`, `*.service.ts`
3. Créer les entités dans `entities/`
4. Créer les DTOs dans `dto/` avec les validations `class-validator`
5. Générer une migration : `pnpm --filter @chiffreo/api migration:generate -- ./migrations/NomMigration`
6. Importer le module dans `app.module.ts`
7. Écrire les tests

### Nouvelle page frontend

1. Créer le fichier `page.tsx` dans le bon groupe de routes (`(app)/`, `(auth)/`, `(admin)/`)
2. Créer les composants nécessaires dans `components/`
3. Si besoin d'état partagé, créer un hook dans `hooks/`
4. Utiliser le client API de `lib/api.ts` pour les appels backend
5. Si la fonctionnalité est payante, utiliser `useFeatureGate()` et `PaywallModal`

### Nouveau endpoint API

1. Ajouter la route dans le controller existant
2. Ajouter la méthode dans le service
3. Créer le DTO de requête avec validations
4. Ajouter les guards nécessaires (`FirebaseAuthGuard`, `AdminGuard`, `FeatureGateGuard`)
5. Mettre à jour la documentation API (`docs/API.md`)

## Tests

### API (Jest)

```bash
pnpm --filter @chiffreo/api test          # Unitaires
pnpm --filter @chiffreo/api test:cov      # Avec couverture
pnpm --filter @chiffreo/api test:e2e      # End-to-end
```

### Web (Jest)

```bash
pnpm --filter @chiffreo/web test
```

### Couverture minimale

**80%** de couverture sur le code modifié. Les tests e2e couvrent les chemins critiques.

## Definition of Done

Une User Story est considérée **Done** lorsque :

1. Le code est revu et approuvé (code review)
2. Les tests unitaires sont écrits et passants (couverture >= 80% sur le code modifié)
3. Les tests d'intégration passent pour les chemins critiques
4. Les critères d'acceptation sont vérifiés
5. Aucune régression sur la suite de tests existante
6. La documentation technique est mise à jour (nouveau service, endpoint, ou modèle)
7. Le feature flag est en place si nécessaire
8. Le code est déployable en staging sans intervention manuelle
9. Les métriques d'observabilité sont configurées (logs, analytics events)
10. La conformité RGPD/CCPA est vérifiée si la story manipule des données personnelles

## Ressources

- [README principal](README.md) — Quick start et vue d'ensemble
- [Architecture technique](docs/ARCHITECTURE.md) — Architecture détaillée
- [Référence API](docs/API.md) — Tous les endpoints
- [Contexte produit](docs/CONTEXT.md) — Brief produit, personas, epics
- [Backend API](apps/api/README.md) — Guide du backend
- [Frontend Web](apps/web/README.md) — Guide du frontend
- [CV Service](apps/cv-service/README.md) — Guide du microservice CV
