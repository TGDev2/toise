# Chiffréo — Contexte projet

> **ARCHIVE** — décrit un produit non lancé, conservé pour l'historique, ne pas utiliser comme source. Voir [ADR 0001](../adr/0001-cible-et-perimetre-v1.md), [ADR 0002](../adr/0002-modele-economique-facturation-distribution.md) et [BACKLOG_V1.md](../BACKLOG_V1.md).

> **Dernière mise à jour :** 26 mars 2026
> **Statut :** Phase de cadrage / Pré-développement
> **Document de référence complémentaire :** `EstiMate_Product_Backlog.docx`

---

## 1. Pourquoi ce projet existe

Les particuliers qui rénovent leur habitat achètent systématiquement trop ou pas assez de matériaux. Le surplus génère un coût mort et du gaspillage. La rupture de stock provoque des arrêts de chantier, des frais de livraison supplémentaires et une frustration élevée.

Les outils existants sont soit trop génériques (formules manuelles, tableurs trouvés en ligne), soit réservés aux professionnels équipés de logiciels coûteux. Aucune solution grand public ne combine aujourd'hui vision par ordinateur, intelligence matériaux et liste d'achat actionnable dans un seul flux mobile-first.

**Chiffréo** résout ce problème en permettant à n'importe quel propriétaire de scanner sa pièce (ou d'en saisir les dimensions), de sélectionner ses travaux, et d'obtenir en quelques minutes une base de commande chiffrée — pertes, découpes et niveau de compétence compris — qu'il valide avant d'acheter.

---

## 2. À qui s'adresse le produit

| Segment | Description | Phase |
|---------|-------------|-------|
| **DIYers individuels** (segment primaire) | Propriétaires réalisant eux-mêmes leurs travaux de rénovation : peinture, carrelage, parquet, cloisons, revêtement de sol. | MVP |
| **Petits artisans / entrepreneurs** | Artisans ayant besoin d'estimations rapides pour établir des devis clients. | Post-MVP v2 |
| **Entreprises de construction** | Entreprises de taille moyenne nécessitant une solution SaaS intégrée à leur chaîne d'approvisionnement. | Vision long terme |

Le persona principal pour le MVP est le **DIYer individuel** : une personne entre 25 et 55 ans, propriétaire, qui se lance dans un projet de rénovation pour la première fois ou de façon occasionnelle. Il ne dispose pas d'outils de mesure professionnels et cherche à éviter les erreurs de quantité.

---

## 3. Proposition de valeur

- **Moins de surplus et moins de ruptures**, en partant de la géométrie réelle de la pièce plutôt que d'un forfait au mètre carré. Aucun taux de réduction n'est promis : le gain dépend du chantier, et une promesse chiffrée ferait du calcul juste l'obligation essentielle du contrat (art. 1170 C. civ. — voir `docs/PROMESSE_PRODUIT.md`).
- **Le chiffrage tient dans la visite** au lieu de se faire le soir au bureau.
- **Traçabilité** : le moteur applique des facteurs de perte par type de matériau, type de pose et niveau de compétence (débutant / intermédiaire / confirmé), et affiche la source de chaque ratio appliqué.

---

## 4. Modèle économique

> **⚠ Le modèle en vigueur n'est plus celui de cette section.**
> Depuis l'[ADR 0002 §D4](../adr/0002-modele-economique-facturation-distribution.md)
> du 7 août 2026 :
>
> | Palier | Prix | Contenu |
> |---|---|---|
> | **Gratuit** | 0 € | **Tout le chiffrage, sans limite de chantiers** : métré, quantités, facteurs de perte, liste d'achat en conditionnements |
> | **Conformité** | **279 € par an**, annuel uniquement, 30 jours satisfait ou remboursé | tout le gratuit, plus devis PDF conforme, fichier clients, historique de prix, facturation |
>
> Les paliers Pro (DIY 9,99 €), Contractor différenciés et Enterprise sont
> **supprimés**. Le tableau ci-dessous est conservé pour l'historique du
> cadrage ; il ne fait pas foi.

Le produit reposait, au cadrage, sur un modèle **freemium à paliers progressifs** :

| Palier | Prix | Cible | Fonctionnalités clés |
|--------|------|-------|---------------------|
| **Free** | Gratuit | Acquisition / découverte | 2 projets actifs, saisie manuelle uniquement, estimation basique, export PDF |
| **Pro** | 9,99 €/mois | DIYers engagés | Projets illimités, analyse CV des photos, facteurs de perte avancés, suivi budgétaire |
| **Contractor** | 19–49 €/mois | Artisans des métiers de finition | Gestion de clients, génération de devis, outils de chiffrage professionnel |
| **Enterprise** | 10 000+ €/an | Entreprises de construction | Solution SaaS sur mesure, intégration supply chain (vision long terme) |

Des modules complémentaires (recommandations éco-responsables, conseils d'experts) sont envisagés à 4,99 € par module pour augmenter la LTV.

> **Révision (août 2026)** — le palier Contractor était cadré à 50–200 €/mois. Confronté au marché français du devis-facture artisan (15–30 €) et au périmètre réellement chiffrable (sept ouvrages de finition, un bloc de main-d'œuvre), il a été ramené à 19/29/49 € et recentré sur les métiers de finition. Voir [PRODUCT_STRATEGY.md §4.5](PRODUCT_STRATEGY.md) (archivé).

---

## 5. Fonctionnement du produit (flux utilisateur principal)

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐
│  Créer un   │───▶│  Décrire la      │───▶│  Choisir le     │───▶│  Obtenir        │───▶│  Liste       │
│  projet     │    │  pièce           │    │  type de        │    │  l'estimation   │    │  d'achat     │
│             │    │  (photos ou      │    │  travaux +      │    │  matériaux      │    │  exportable  │
│             │    │  saisie manuelle)│    │  niveau skill   │    │                 │    │              │
└─────────────┘    └──────────────────┘    └─────────────────┘    └─────────────────┘    └──────────────┘
```

1. L'utilisateur crée un projet (il peut commencer en mode invité).
2. Il décrit sa pièce soit en uploadant 3 à 5 photos (analyse par vision par ordinateur), soit en saisissant manuellement les dimensions (longueur, largeur, hauteur, ouvertures).
3. Il sélectionne le type de travaux (peinture, carrelage, parquet, cloison…) et son niveau de compétence.
4. Le moteur d'estimation calcule la quantité proposée pour chaque matériau en tenant compte des surfaces nettes, des facteurs de perte, du type de pose et du conditionnement commercial.
5. Une liste d'achat structurée est générée, que l'utilisateur valide avant d'acheter ; elle est exportable en PDF et partageable.

---

## 6. Architecture technique envisagée

> ⚠️ Les choix ci-dessous sont des orientations à valider lors du Sprint 0. Ils ne constituent pas des décisions définitives.

### Stack pressentie

| Couche | Technologie envisagée | Justification |
|--------|----------------------|---------------|
| **Frontend mobile** | React Native ou Flutter | Application mobile-first, cross-platform iOS/Android |
| **Frontend web** | React (Next.js) | Version web compagnon, SEO pour l'acquisition |
| **Backend API** | Node.js (NestJS) ou Python (FastAPI) | API REST, gestion des projets et des calculs |
| **Pipeline CV** | Python (FastAPI), modèle de depth estimation (MiDaS / Depth Anything) | Microservice dédié à l'analyse d'images |
| **Base de données** | PostgreSQL | Données relationnelles, projets, utilisateurs, référentiel matériaux |
| **Stockage fichiers** | AWS S3 ou GCS | Photos uploadées, PDFs générés |
| **File d'attente** | RabbitMQ ou Cloud Tasks | Traitement asynchrone du pipeline CV |
| **Paiement** | Stripe (Checkout + Webhooks) | Abonnements, essais gratuits, gestion de facturation |
| **Auth** | Firebase Auth ou Auth0 | Inscription email, OAuth Google/Apple |
| **CI/CD** | GitHub Actions | Tests automatisés, déploiement staging/prod |
| **Monitoring** | Datadog ou Sentry + PostHog (analytics) | Observabilité, logs, événements produit |

### Schéma d'architecture simplifié

```
                    ┌──────────────┐
                    │   Client     │
                    │  (Mobile /   │
                    │   Web)       │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   API        │
                    │   Gateway    │
                    └──┬───────┬───┘
                       │       │
              ┌────────▼──┐ ┌──▼──────────┐
              │  Main API │ │  CV Service │
              │  (CRUD,   │ │  (Python,   │
              │  Calcul,  │ │  ML models) │
              │  Auth)    │ │             │
              └─────┬─────┘ └──────┬──────┘
                    │              │
              ┌─────▼──────────────▼─────┐
              │      PostgreSQL          │
              │  + S3 (photos/PDFs)      │
              └──────────────────────────┘
```

---

## 7. Hypothèses structurantes

Ces hypothèses doivent être validées au plus tôt. Elles conditionnent des décisions produit et techniques majeures.

| ID | Hypothèse | Impact si invalidée | Plan de validation |
|----|-----------|--------------------|--------------------|
| **H1** | Les modèles de vision par ordinateur permettent d'extraire des dimensions de pièce exploitables (±5 %) à partir de 3-5 photos smartphone. | Le flux photo devient un gadget ; le produit se rabat sur la saisie manuelle seule (différenciation réduite). | Spike CV en Sprint 0 : tester 2-3 modèles sur 50 photos avec dimensions connues. |
| **H2** | Un objet de référence visible (porte standard, carte bancaire) suffit pour calibrer l'échelle sans capteur LiDAR. | Le pipeline CV nécessite un capteur LiDAR, limitant les appareils compatibles. | Inclus dans le spike CV. |
| **H3** | ~~Les DIYers sont prêts à payer 9,99 €/mois si l'estimation leur fait économiser au moins 30 € par projet.~~ **Abandonnée** : le particulier n'est pas monétisé ([ADR 0001 D1](../adr/0001-cible-et-perimetre-v1.md)) et le palier DIY est supprimé ([ADR 0002 D4](../adr/0002-modele-economique-facturation-distribution.md)). | — | — |
| **H4** | Les APIs Home Depot / Lowe's (ou scraping légal) permettent de récupérer prix et disponibilité en temps réel. | L'Epic 7 (comparaison fournisseurs) est bloquée ou fortement dégradée. | Spike API fournisseurs avant le développement de l'Epic 7. |
| **H5** | Les facteurs de perte matériau peuvent être modélisés avec une base initiale de ~500 projets réels. | La précision de l'estimation est insuffisante et érode la confiance utilisateur. | Atelier métier avec 2-3 artisans + validation sur projets pilotes. |
| **H6** | Le marché des petits artisans est atteignable via un positionnement « devis rapide » sans ERP complet. | Le segment Contractor nécessite un investissement produit beaucoup plus lourd que prévu. | Interviews utilisateurs avec 10 artisans cibles avant de lancer l'Epic 8. |

---

## 8. Périmètre du MVP

Le MVP couvre **5 Epics et 13 User Stories** pour un total estimé de **69 Story Points**.

### Epics MVP

| # | Epic | Ce qu'il délivre |
|---|------|-----------------|
| E1 | **Onboarding & Capture de pièce** | Upload de photos, analyse CV, saisie manuelle, sélection du type de projet et du niveau de compétence |
| E2 | **Moteur d'estimation matériaux** | Calcul des quantités avec facteurs de perte, référentiel matériaux, déduction des ouvertures |
| E3 | **Liste d'achat & export** | Génération de la liste structurée, export PDF, partage |
| E4 | **Comptes utilisateur & gestion de projets** | Inscription/connexion (email + OAuth), dashboard de projets |
| E5 | **Freemium & abonnement Pro** | Feature gating par tier, paiement Stripe, essai gratuit 7 jours |

### Ce qui est explicitement hors MVP

- Suivi budgétaire et comparaison estimé/réel (Post-MVP v1)
- Intégration fournisseurs et comparaison de prix (Post-MVP v1)
- Outils Contractor : comptes pro, génération de devis (Post-MVP v2)
- Communauté et galerie de projets (Post-MVP v2)
- Solution Enterprise SaaS (Post-MVP v3+)
- Modules Sustainability et recommandations éco-responsables (Post-MVP v3+)

---

## 9. Séquencement de livraison prévu

Le développement est planifié en **sprints de 2 semaines**, précédés d'un Sprint 0 de setup.

| Sprint | Objectif | Stories principales | Livrable |
|--------|----------|-------------------|----------|
| **Sprint 0** | Socle technique | Infra, CI/CD, design system, spikes CV et waste factors | Environnements prêts, ADR posées |
| **Sprint 1** | Parcours saisie manuelle complet | US-4.1, US-1.3, US-1.4 | Un utilisateur peut créer un compte, saisir une pièce et choisir ses travaux |
| **Sprint 2** | Moteur d'estimation opérationnel | US-2.2, US-2.1 | Le calcul de matériaux fonctionne end-to-end |
| **Sprint 3** | Liste d'achat générée | US-2.3, US-3.1, US-4.2 | MVP interne démontrable (saisie → estimation → liste) |
| **Sprint 4** | Upload photos + export | US-1.1, US-3.2 | Flux complet avec export PDF |
| **Sprint 5** | Pipeline CV alpha | US-1.2 (itération 1) | Analyse automatique des dimensions (version basique) |
| **Sprint 6** | CV affiné + freemium | US-1.2 (itération 2), US-5.1 | Feature gating actif, CV avec score de confiance |
| **Sprint 7** | Paiement intégré | US-5.2 | **MVP complet prêt au lancement** |

---

## 10. Modèle de données principal (simplifié)

```
users
├── id (UUID)
├── email
├── password_hash
├── auth_provider (email | google | apple)
├── subscription_tier (free | pro | contractor)
├── email_verified (boolean)
├── created_at
└── updated_at

projects
├── id (UUID)
├── user_id → users.id
├── name
├── status (draft | estimated | in_progress | completed)
├── created_at
├── updated_at
└── deleted_at (soft delete)

room_dimensions
├── id (UUID)
├── project_id → projects.id
├── length_cm
├── width_cm
├── height_cm
├── confidence_score (high | medium | low)
├── source (cv | manual)
└── raw_cv_output_json

project_photos
├── id (UUID)
├── project_id → projects.id
├── storage_url
├── original_filename
├── size_bytes
├── status (uploading | uploaded | analyzed | failed)
└── created_at

project_work_items
├── id (UUID)
├── project_id → projects.id
├── work_type_id → work_types.id
├── skill_level (beginner | intermediate | advanced)
└── custom_params_json

openings (portes, fenêtres)
├── id (UUID)
├── project_id → projects.id
├── type (door | window)
├── width_cm
├── height_cm
└── count

materials_catalog
├── id (UUID)
├── name
├── category
├── unit (m² | litre | piece | kg)
├── yield_per_unit (ex: 10 m²/litre)
├── is_active (boolean)
└── updated_at

material_packaging
├── id (UUID)
├── material_id → materials_catalog.id
├── label (ex: "Pot de 2,5L")
├── quantity_per_unit
└── unit

waste_factors
├── id (UUID)
├── material_id → materials_catalog.id
├── pose_type (straight | diagonal | herringbone)
├── skill_level (beginner | intermediate | advanced)
└── factor_percent

shopping_lists
├── id (UUID)
├── project_id → projects.id
├── items_json
├── created_at
└── updated_at

subscriptions
├── id (UUID)
├── user_id → users.id
├── stripe_subscription_id
├── status (trialing | active | past_due | canceled)
├── current_period_start
├── current_period_end
└── trial_end
```

---

## 11. Conventions et standards de l'équipe

### Conventions de nommage

- **Branches git** : `feature/US-X.X-description-courte`, `fix/US-X.X-description`, `spike/sujet`
- **Commits** : format conventionnel — `feat(US-1.3): add manual dimension input form`
- **API endpoints** : REST, snake_case pour les noms de ressources, versionnage `/api/v1/...`
- **Base de données** : snake_case pour les tables et colonnes, UUID comme clé primaire

### Definition of Done (globale)

Une User Story est considérée Done **uniquement** lorsque :

1. Le code est développé, revu par un pair (code review approuvée) et fusionné dans la branche principale.
2. Les tests unitaires sont écrits et passants (couverture minimale 80 % sur le code modifié).
3. Les tests d'intégration automatisés passent pour les chemins critiques.
4. Les critères d'acceptation sont vérifiés par le QA.
5. Aucune régression détectée sur la suite de tests existante.
6. La documentation technique est mise à jour si un nouveau service, endpoint ou modèle de données est introduit.
7. Le feature flag est en place si la fonctionnalité nécessite un déploiement progressif.
8. Le code est déployable en environnement de staging sans intervention manuelle.
9. Les métriques d'observabilité (logs structurés, événements analytics) sont configurées.
10. La conformité RGPD/CCPA est vérifiée si la story manipule des données personnelles.

### Événements analytics à instrumenter (MVP)

| Événement | Déclencheur | Données |
|-----------|-------------|---------|
| `project_created` | Création d'un projet | `project_id`, `source` (guest/logged_in) |
| `photos_uploaded` | Upload terminé | `count`, `total_size`, `project_id` |
| `cv_analysis_completed` | Fin du pipeline CV | `project_id`, `confidence_score`, `duration_ms` |
| `dimensions_entered` | Saisie manuelle validée | `project_id`, `source` (manual/cv_corrected) |
| `work_type_selected` | Choix du type de travaux | `type`, `skill_level` |
| `estimation_generated` | Calcul terminé | `project_id`, `item_count`, `total_waste_percent` |
| `shopping_list_generated` | Liste d'achat créée | `project_id`, `item_count` |
| `shopping_list_exported` | Export PDF / partage | `project_id`, `format` (pdf/email/sms) |
| `paywall_shown` | Affichage du paywall | `trigger_feature`, `user_tier` |
| `paywall_clicked` | Clic sur CTA upgrade | `trigger_feature` |
| `subscription_started` | Abonnement activé | `plan`, `trial` (boolean) |
| `subscription_canceled` | Annulation | `plan`, `reason` (si collectée) |

---

## 12. Risques principaux à garder en tête

| Risque | Impact | Ce qu'on fait pour le mitiger |
|--------|--------|------------------------------|
| **Précision insuffisante du pipeline CV** | Élevé — le produit perd sa différenciation clé | Spike CV en Sprint 0, fallback saisie manuelle toujours disponible, amélioration progressive avec données réelles |
| **APIs fournisseurs indisponibles** | Élevé — bloque l'Epic 7 (comparaison de prix) | Spike dédié avant toute implémentation, plan B via saisie manuelle des prix |
| **Référentiel matériaux incomplet** | Moyen — estimations imprécises pour certains types de travaux | Prioriser les 5 types les plus fréquents au MVP, enrichir itérativement |
| **Taux de conversion freemium trop faible** | Élevé — modèle économique non viable | A/B test sur le paywall, ajustement des limites du tier gratuit après 3 mois de données |
| **Performance CV sur smartphones entrée de gamme** | Moyen — mauvaise expérience utilisateur | Traitement côté serveur (pas on-device), compression des images avant upload |

---

## 13. Glossaire

| Terme | Définition |
|-------|-----------|
| **CV (Computer Vision)** | Pipeline de vision par ordinateur qui analyse les photos pour extraire les dimensions de la pièce. |
| **Waste factor / Facteur de perte** | Pourcentage de matériau supplémentaire à prévoir pour couvrir les pertes liées aux découpes, à la casse et au gaspillage. Varie selon le matériau, le type de pose et le niveau de compétence. |
| **Conditionnement commercial** | Unité de vente en magasin (ex : pot de 2,5L, carton de 12 carreaux). L'estimation est arrondie au conditionnement supérieur. |
| **Surface nette** | Surface réelle à couvrir après déduction des ouvertures (portes, fenêtres). |
| **Tier** | Niveau d'abonnement de l'utilisateur (Free, Pro, Contractor). |
| **Paywall** | Écran présenté à un utilisateur gratuit lorsqu'il tente d'accéder à une fonctionnalité réservée au tier Pro. |
| **Spike technique** | Investigation technique timeboxée (2-5 jours) visant à réduire l'incertitude sur un sujet précis avant de s'engager dans l'implémentation. |
| **Vertical slice** | Incrément fonctionnel qui traverse toutes les couches techniques nécessaires (frontend, backend, BDD) pour délivrer une capacité réellement utilisable. |
| **Feature flag** | Mécanisme permettant d'activer ou désactiver une fonctionnalité en production sans redéploiement. |

---

## 14. Contacts et ressources

| Rôle | Responsabilité sur le projet |
|------|------------------------------|
| **Product Manager** | Vision produit, priorisation du backlog, arbitrages de périmètre |
| **Product Designer** | UX/UI, recherche utilisateur, design system |
| **Tech Lead** | Architecture technique, ADR, choix de stack |
| **Développeurs Backend** | API, moteur de calcul, pipeline CV, intégrations |
| **Développeurs Frontend** | Application mobile et web, composants UI |
| **QA** | Stratégie de test, recette, automatisation |
| **DevOps** | Infrastructure, CI/CD, monitoring |

### Documents de référence

- `EstiMate_Product_Backlog.docx` — Backlog complet avec Epics, User Stories, critères d'acceptation et checklists techniques
- Ce fichier (`context.md`) — Contexte projet pour l'onboarding de tout nouveau membre de l'équipe

---

*Ce document est vivant. Il doit être mis à jour à chaque décision structurante (choix de stack validé, hypothèse confirmée ou invalidée, pivot de périmètre).*
