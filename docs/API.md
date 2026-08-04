# Référence API REST — Chiffréo

**Base URL :** `http://localhost:3001/api/v1`

**Authentification :** Firebase ID Token dans le header `Authorization: Bearer <token>`.
Les routes `/partner/*` s'authentifient à la place avec une **clé d'API**
(`Authorization: Bearer chf_…`), cf. [API publique (clés)](#api-publique-clés). Les routes
`/widget/:widgetKey/*` s'authentifient par une clé non secrète dans l'URL, restreinte par
origine (en-tête `Origin`), cf. [Widget marque blanche](#widget-marque-blanche).

**Rate limiting :**
- Général : 100 requêtes/minute
- Auth (register, forgot-password) : 5 requêtes/15 minutes
- API publique : 60 requêtes/minute **par clé**, plus un quota mensuel par organisation

**Validation :** Toutes les requêtes sont validées via `class-validator`. Les propriétés inconnues sont rejetées (HTTP 400).

---

## Table des matières

- [Auth](#auth)
- [Projects](#projects)
- [Dimensions & Openings](#dimensions--openings)
- [Work Items](#work-items)
- [Materials (Admin)](#materials-admin)
- [Estimations](#estimations)
- [Shopping Lists](#shopping-lists)
- [Shopping List Export & Partage](#shopping-list-export--partage)
- [Photos](#photos)
- [Analysis (CV)](#analysis-cv)
- [Subscriptions](#subscriptions)
- [Feature Gates](#feature-gates)
- [Analytics](#analytics)
- [Price Comparison](#price-comparison)
- [Company Profiles](#company-profiles)
- [Clients](#clients)
- [Quotes](#quotes)
- [Invoices](#invoices)
- [Suivi de chantier](#suivi-de-chantier)
- [Community](#community)
- [Organisations](#organisations)
- [API publique (clés)](#api-publique-clés)
- [Clés d'API (gestion)](#clés-dapi-gestion)
- [Widget marque blanche](#widget-marque-blanche)
- [Enterprise — SSO](#enterprise--sso)
- [Enterprise — contrat et SLA](#enterprise--contrat-et-sla)
- [Facteurs de perte appris (Admin)](#facteurs-de-perte-appris-admin)

---

## Auth

### `POST /auth/register`

Créer un compte utilisateur.

**Auth :** Non requise | **Rate limit :** 5 req/15min

**Body :**
```json
{
  "email": "user@example.com",
  "password": "minimum8chars",
  "display_name": "Jean Dupont",
  "company_profile": {
    "raison_sociale": "Dupont SARL",
    "siret": "12345678901234",
    "address_line1": "1 rue de Paris",
    "postal_code": "75001",
    "city": "Paris"
  }
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `email` | string | oui | Format email valide |
| `password` | string | oui | 8-128 caractères |
| `display_name` | string | non | Max 100 caractères |
| `company_profile` | object | non | Voir [CreateCompanyProfileDto](#post-company-profiles) |

**Réponses :** `201 Created` | `400 Bad Request` | `409 Conflict`

---

### `POST /auth/sync`

Synchroniser l'utilisateur Firebase avec la base locale. Appelé après connexion côté frontend.

**Auth :** Requise

**Réponses :** `201 Created` — retourne le profil utilisateur local

---

### `GET /auth/me`

Récupérer le profil de l'utilisateur connecté.

**Auth :** Requise

**Réponses :** `200 OK`

---

### `DELETE /auth/me`

Supprimer le compte utilisateur et toutes ses données.

**Auth :** Requise

**Réponses :** `200 OK`

---

### `POST /auth/forgot-password`

Envoyer un email de réinitialisation de mot de passe.

**Auth :** Non requise | **Rate limit :** 3 req/h

**Body :**
```json
{
  "email": "user@example.com"
}
```

**Réponses :** `201 Created`

---

### `POST /auth/merge-guest`

Fusionner un compte invité (anonymous) avec le compte authentifié courant.

**Auth :** Requise

**Body :**
```json
{
  "anonymous_firebase_uid": "firebase-uid-of-guest"
}
```

**Réponses :** `201 Created`

---

## Projects

### `POST /projects`

Créer un nouveau projet.

**Auth :** Requise

**Body :**
```json
{
  "name": "Salon",
  "room_name": "Séjour principal",
  "work_type": "painting"
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `name` | string | oui | Max 255 caractères |
| `room_name` | string | non | Max 255 caractères |
| `work_type` | enum | non | `painting`, `tiling`, `flooring`, `partition`, `wall_covering` |

**Réponses :** `201 Created` | `403 Forbidden` (limite de projets atteinte pour le tier free)

---

### `GET /projects`

Lister les projets de l'utilisateur (paginé).

**Auth :** Requise

**Query params :**

| Param | Type | Défaut | Validation |
|-------|------|--------|------------|
| `page` | number | 1 | Min 1 |
| `limit` | number | 10 | Min 1, Max 100 |

**Réponses :** `200 OK` — retourne `{ data: Project[], meta: { page, limit, total, totalPages } }`

---

### `GET /projects/:id`

Récupérer un projet par ID.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `200 OK` | `404 Not Found`

---

### `DELETE /projects/:id`

Supprimer un projet (soft delete).

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `204 No Content` | `404 Not Found`

---

### `GET /projects/work-types`

Lister les types de travaux disponibles.

**Auth :** Requise

**Réponses :** `200 OK` — retourne la liste des `WorkType`

---

## Dimensions & Openings

### `PUT /projects/:id/dimensions`

Saisir ou mettre à jour les dimensions de la pièce.

**Auth :** Requise (propriétaire uniquement)

**Body :**
```json
{
  "length_cm": 450,
  "width_cm": 350,
  "height_cm": 250
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `length_cm` | integer | oui | Min 0 |
| `width_cm` | integer | oui | Min 0 |
| `height_cm` | integer | oui | Min 0 |

**Réponses :** `200 OK`

---

### `GET /projects/:id/dimensions`

Récupérer les dimensions de la pièce.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `200 OK` | `404 Not Found`

---

### `POST /projects/:id/openings`

Ajouter une ouverture (porte ou fenêtre).

**Auth :** Requise (propriétaire uniquement)

**Body :**
```json
{
  "type": "door",
  "width_cm": 90,
  "height_cm": 204,
  "count": 1
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `type` | enum | oui | `door`, `window` |
| `width_cm` | integer | oui | Min 0 |
| `height_cm` | integer | oui | Min 0 |
| `count` | integer | oui | Min 1 |

**Réponses :** `201 Created`

---

### `GET /projects/:id/openings`

Lister les ouvertures d'un projet.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `200 OK`

---

### `PUT /projects/:id/openings/:openingId`

Mettre à jour une ouverture.

**Auth :** Requise (propriétaire uniquement)

**Body :** Identique à `POST /projects/:id/openings`

**Réponses :** `200 OK` | `404 Not Found`

---

### `DELETE /projects/:id/openings/:openingId`

Supprimer une ouverture.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `204 No Content` | `404 Not Found`

---

## Work Items

### `POST /projects/:id/work-items`

Sauvegarder les types de travaux sélectionnés pour un projet.

**Auth :** Requise (propriétaire uniquement)

**Body :**
```json
{
  "items": [
    {
      "work_type_id": "uuid",
      "skill_level": "beginner",
      "custom_params": {}
    }
  ]
}
```

**Réponses :** `201 Created`

---

### `GET /projects/:id/work-items`

Récupérer les types de travaux d'un projet.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `200 OK`

---

## Materials (Admin)

> Toutes les routes matériaux nécessitent le rôle **admin**.

### `POST /admin/materials`

Créer un matériau dans le catalogue.

**Auth :** Requise (admin) | **Guard :** `AdminGuard`

**Body :**
```json
{
  "name": "Peinture acrylique blanche",
  "category": "painting",
  "unit": "litre",
  "yield_per_unit": 10,
  "packagings": [
    { "label": "Pot de 2,5L", "quantity_per_unit": 2.5, "unit": "litre" },
    { "label": "Pot de 10L", "quantity_per_unit": 10, "unit": "litre" }
  ],
  "waste_factors": [
    { "pose_type": "straight", "skill_level": "beginner", "factor_percent": 15 },
    { "pose_type": "straight", "skill_level": "intermediate", "factor_percent": 10 },
    { "pose_type": "straight", "skill_level": "advanced", "factor_percent": 5 }
  ]
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `name` | string | oui | Max 255 caractères |
| `category` | enum | oui | `painting`, `tiling`, `flooring`, `partition`, `wall_covering` |
| `unit` | string | oui | Max 20 caractères |
| `yield_per_unit` | number | oui | Min 0.0001 |
| `applies_coats` | boolean | non | Défaut `false`. À `true`, la quantité est multipliée par le nombre de couches demandé (peintures, lasures, vernis) ; à `false`, elle n'en dépend pas — accessoires, consommables, sous-couches |
| `packagings` | array | oui | Au moins 1 élément |
| `packagings[].label` | string | oui | Max 255 caractères |
| `packagings[].quantity_per_unit` | number | oui | Min 0.0001 |
| `packagings[].unit` | string | oui | Max 20 caractères |
| `waste_factors` | array | non | — |
| `waste_factors[].pose_type` | string | oui | Max 50 caractères |
| `waste_factors[].skill_level` | enum | oui | `beginner`, `intermediate`, `advanced` |
| `waste_factors[].factor_percent` | number | oui | 0-100 |

**Réponses :** `201 Created`

---

### `GET /admin/materials`

Lister les matériaux (paginé, filtrable).

**Auth :** Requise (admin)

**Query params :**

| Param | Type | Description |
|-------|------|-------------|
| `category` | string | Filtrer par catégorie |
| `isActive` | boolean | Filtrer par statut actif |
| `page` | number | Page (défaut: 1) |
| `limit` | number | Éléments par page |

**Réponses :** `200 OK`

---

### `GET /admin/materials/:id`

Récupérer un matériau par ID.

**Auth :** Requise (admin)

**Réponses :** `200 OK` | `404 Not Found`

---

### `PUT /admin/materials/:id`

Mettre à jour un matériau.

**Auth :** Requise (admin)

**Body :** Identique à `POST /admin/materials`

**Réponses :** `200 OK` | `404 Not Found`

---

### `PATCH /admin/materials/:id/deactivate`

Désactiver un matériau (ne le supprime pas).

**Auth :** Requise (admin)

**Réponses :** `200 OK` | `404 Not Found`

---

## Estimations

### `POST /projects/:id/estimate`

Lancer le calcul d'estimation matériaux pour un projet.

**Auth :** Requise (propriétaire uniquement)

**Body :**
```json
{
  "skill_level": "beginner"
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `skill_level` | enum | non | `beginner`, `intermediate`, `advanced` |

**Réponses :** `201 Created` — retourne l'estimation avec les lignes de matériaux

---

### `GET /projects/:id/estimates/latest`

Récupérer la dernière estimation d'un projet.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `200 OK` | `404 Not Found`

---

### `GET /projects/:id/estimates`

Récupérer l'historique des estimations d'un projet.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `200 OK`

---

## Shopping Lists

### `GET /projects/:id/shopping-list`

Récupérer ou générer la liste d'achat d'un projet.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `200 OK`

---

### `PATCH /projects/:id/shopping-list`

Mettre à jour la liste d'achat (quantités, prix manuels).

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `200 OK`

---

### `POST /projects/:id/shopping-list/regenerate`

Régénérer la liste d'achat à partir de la dernière estimation.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `201 Created`

---

### `GET /projects/:id/shopping-list/budget-summary`

Récupérer le résumé budgétaire.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `budget_tracking` (Pro+)

| Champ | Sens |
|---|---|
| `total_real_cost` | Prix réel × quantité **déclarée** quand elle existe, × quantité prévue sinon. Seule définition du « coût réel » : le benchmark de coûts valorise la même quantité, en refusant seulement le repli sur la quantité prévue |
| `total_brute_cost` | Ce que le même achat aurait coûté **pièce par pièce**, à facteur de perte, format et prix identiques. Vaut toujours `total_real_cost + savings_amount` |
| `savings_amount` | Économie de mutualisation : l'arrondi au conditionnement payé une fois pour tout le chantier plutôt qu'à chaque pièce. Jamais négative, et indépendante du niveau de compétence — celui-ci est une posture de risque choisie par l'utilisateur, pas un gain produit par l'outil. Nulle sur un chantier d'une seule pièce |
| `items_priced` / `items_total` | Lignes tarifées sur lignes retenues ; `is_complete` en découle |

**Réponses :** `200 OK` | `403 Forbidden`

---

### `POST /projects/:id/shopping-list/budget-summary/finalize`

Finaliser le suivi budgétaire et déclarer le chantier terminé, sans déclaration
d'achats. Chemin historique conservé pour les clients de l'API ; l'écran produit
passe par `POST /projects/:id/shopping-list/closeout`.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `budget_tracking` (Pro+)

**Réponses :** `201 Created` | `403 Forbidden`

> **Changement DATA-5 (02/08/2026)** — l'endpoint ne renvoie plus `400` quand
> des articles n'ont pas de prix réel. Les quantités ferment la boucle, les prix
> sont facultatifs. `is_complete` continue de dire la vérité sur le tarifage, et
> reste exigé par `POST /community` avant toute publication d'un total.

---

## Clôture de chantier (DATA-5)

### `GET /projects/:id/shopping-list/closeout`

Écran de clôture : une ligne par article, pré-remplie de la quantité estimée,
plus ce que la déclaration en cours permet déjà de dire (surplus, reprenabilité,
échéance, écart estimé/réel).

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `project_closeout` (**free**)

**Réponses :** `200 OK` | `403 Forbidden` | `404 Not Found`

---

### `POST /projects/:id/shopping-list/closeout`

Enregistrer les quantités réellement achetées et clôturer le chantier
(passage `completed`, instantané carnet du logement, résumé budgétaire figé).

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `project_closeout` (**free**)

**Corps :**

```json
{
  "purchased_on": "2026-07-15",
  "material_items": [{ "material_id": "uuid", "purchased_units": 21 }],
  "complementary_items": [
    { "complementary_material_id": "uuid", "purchased_quantity": 3 }
  ]
}
```

Une seule correction par ligne. Ni prix ni enseigne : ils existent déjà sur la
ligne d'achat et restent facultatifs.

**Réponse `201 Created` :** `{ closeout, budget_summary, is_finalized }`.

`closeout` partitionne le surplus chiffré en trois montants disjoints dont la
somme vaut `surplus_value_total` :

| Champ | Sens |
|---|---|
| `recoverable_amount` | Enseigne connue **et** catégorie sans restriction publiée |
| `restricted_amount` | Catégorie couramment exclue (peinture teintée, conditionnement descellé) |
| `unknown_amount` | Enseigne absente du catalogue : aucune reprise n'est affirmée |

Les échéances proviennent de `apps/api/src/shopping-lists/return-policies.ts` —
trois enseignes relevées sur leur page officielle, chacune portant `source_url`
et `verified_on`. Une enseigne absente ne produit **aucun** délai : la valeur
« 30 jours » couramment admise est fausse pour les deux leaders (Castorama
annonce 365 jours, Leroy Merlin 6 mois), et une valeur par défaut annoncerait un
délai dépassé à un client qui dispose encore de plusieurs mois.

**Réponses :** `201 Created` | `400 Bad Request` | `403 Forbidden` | `404 Not Found`

---

## Shopping List Export & Partage

### `GET /projects/:id/shopping-list/export/pdf`

Exporter la liste d'achat en PDF.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `200 OK` — `Content-Type: application/pdf`

---

### `POST /projects/:id/shopping-list/share`

Créer un lien de partage pour la liste d'achat.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `201 Created` — retourne `{ token, url }`

---

### `DELETE /projects/:id/shopping-list/share`

Révoquer le lien de partage.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `204 No Content`

---

### `GET /shared/shopping-list/:token`

Accéder à une liste d'achat partagée (route publique).

**Auth :** Non requise

**Réponses :** `200 OK` | `404 Not Found`

---

### `GET /shared/shopping-list/:token/pdf`

Télécharger le PDF d'une liste partagée (route publique).

**Auth :** Non requise

**Réponses :** `200 OK` — `Content-Type: application/pdf` | `404 Not Found`

---

## Photos

### `POST /projects/:id/photos`

Uploader une photo de projet.

**Auth :** Requise (propriétaire uniquement)

**Body :** `multipart/form-data` avec champ `file`

**Contraintes :**
- Formats acceptés : JPEG, PNG, HEIC, HEIF
- Taille max : 20 MB

**Réponses :** `201 Created` — retourne les métadonnées de la photo

---

### `GET /projects/:id/photos`

Lister les photos d'un projet.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `200 OK`

---

### `DELETE /projects/:id/photos/:photoId`

Supprimer une photo.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `204 No Content` | `404 Not Found`

---

### `GET /projects/:projectId/photos/:photoId/file`

Servir le fichier image original.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `200 OK` — stream du fichier image

---

### `GET /projects/:projectId/photos/:photoId/thumbnail`

Servir la miniature de la photo.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `200 OK` — stream de la miniature

---

## Analysis (CV)

### `POST /projects/:id/analyze`

Lancer l'analyse par vision par ordinateur des photos du projet.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `cv_analysis` (Pro+)

**Réponses :** `201 Created` — retourne `{ jobId }` | `403 Forbidden`

---

### `GET /projects/:id/analyze/:jobId/status`

Vérifier le statut d'un job d'analyse.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `200 OK`

```json
{
  "id": "uuid",
  "status": "completed",
  "progress_pct": 100,
  "result_json": {
    "dimensions": { "length_cm": 450, "width_cm": 350, "height_cm": 250 },
    "confidence": "high",
    "confidence_score": 0.92,
    "openings": [
      { "type": "door", "width_cm": 90, "height_cm": 204, "confidence": 0.95, "count": 1 }
    ],
    "opening_detector": "yolo"
  },
  "error_message": null
}
```

**Status possibles :** `pending`, `processing`, `completed`, `failed`

**`opening_detector` :** `yolo` (modèle entraîné), `heuristic` (repli OpenCV en
l'absence des poids — dimensions approximatives, à faire vérifier), `none`.
Le `confidence` de chaque ouverture est sur la même échelle 0-1 dans les deux
modes : ce champ est la seule façon de les distinguer.

---

## Subscriptions

### `POST /subscriptions/checkout`

Créer une session Stripe Checkout pour un abonnement.

**Auth :** Requise

**Body :**
```json
{
  "priceId": "price_xxxxx"
}
```

> Le `priceId` est validé contre une liste de Stripe Price IDs autorisés.

**Réponses :** `201 Created` — retourne `{ url }` (URL de redirection Stripe)

---

### `POST /subscriptions/portal`

Créer une session du portail client Stripe (gestion de l'abonnement).

**Auth :** Requise

**Réponses :** `201 Created` — retourne `{ url }`

---

### `GET /subscriptions/current`

Récupérer l'abonnement actuel de l'utilisateur.

**Auth :** Requise

**Réponses :** `200 OK` — retourne les détails de l'abonnement ou `null`

---

### `GET /subscriptions/plans`

Lister les plans d'abonnement disponibles.

**Auth :** Requise

**Réponses :** `200 OK`

---

### `POST /subscriptions/webhook`

Endpoint pour les webhooks Stripe.

**Auth :** Signature Stripe (pas de Firebase auth)

**Headers requis :** `stripe-signature`

**Événements gérés :**
- `checkout.session.completed`
- `invoice.paid`
- `customer.subscription.updated`
- `customer.subscription.deleted`

**Réponses :** `200 OK`

---

## Feature Gates

### `GET /feature-gates`

Récupérer les feature gates pour l'utilisateur courant.

**Auth :** Requise

**Réponses :** `200 OK` — retourne la liste des features avec leur statut d'accès

---

### `GET /admin/feature-gates`

Lister toutes les feature gates (admin).

**Auth :** Requise (admin)

**Réponses :** `200 OK`

---

### `PUT /admin/feature-gates/:key`

Créer ou mettre à jour une feature gate.

**Auth :** Requise (admin)

**Body :**
```json
{
  "label_fr": "Analyse CV",
  "description_fr": "Analyse des photos par vision par ordinateur",
  "min_tier": "pro",
  "is_enabled": true
}
```

**Réponses :** `200 OK`

---

### `DELETE /admin/feature-gates/:key`

Supprimer une feature gate.

**Auth :** Requise (admin)

**Réponses :** `204 No Content`

---

## Analytics

Noms d'événements typés (`AnalyticsEventName`, [apps/api/src/analytics/analytics-event-name.enum.ts](../apps/api/src/analytics/analytics-event-name.enum.ts)) — funnel DATA-1 : `calculator_viewed` → `account_created` → `estimate_created` → `shopping_list_generated` → `checkout_started` (puis `subscription_started`). Autres événements : `email_capture`, `payment_failed`, `subscription_canceled`, `budget_tracked`, `paywall_shown`, `paywall_clicked`, `pricing_cta_clicked`, `contractor_plan_clicked`.

### `POST /analytics/events`

Enregistrer un événement analytics authentifié.

**Auth :** Requise

**Body :**
```json
{
  "event_name": "pricing_cta_clicked",
  "properties": {
    "plan": "pro"
  }
}
```

**Réponses :** `201 Created`

### `POST /public/analytics/events`

Enregistrer un événement analytics anonyme (ex. visite d'un calculateur public, avant toute création de compte). Auth optionnelle : si un Bearer token valide est fourni (session invitée ou compte existant), l'événement est attribué au `user_id` correspondant ; sinon `user_id` est `null`. Restreint à une allow-list volontairement étroite (aujourd'hui : `calculator_viewed` uniquement) — jamais le plein enum, pour qu'un appelant anonyme ne puisse pas injecter un événement réservé aux call sites internes.

**Auth :** Optionnelle

**Body :**
```json
{
  "event_name": "calculator_viewed",
  "properties": {
    "slug": "peinture"
  }
}
```

**Réponses :** `201 Created`

---

## Admin Analytics

### `GET /admin/analytics/dashboard`

Tableau de bord North Star (DATA-2) : listes générées par semaine, conversion
par marche du funnel DATA-1, MRR par tier. Lecture seule, agrège
`analytics_events`, `subscriptions` et `users` — aucune écriture.

**Auth :** Requise (admin) | **Guard :** `AdminGuard`

**Query params :**

| Param | Type | Défaut | Description |
|-------|------|--------|-------------|
| `weeks` | number | `8` | Nombre de semaines glissantes pour le graphique de listes générées (1-52) |
| `days` | number | `30` | Fenêtre glissante du funnel (1-365) |

**Réponse :** `200 OK`
```json
{
  "generated_at": "2026-07-19T14:32:00.000Z",
  "weekly_shopping_lists": {
    "weeks": 8,
    "series": [{ "week_start": "2026-06-01", "count": 2 }]
  },
  "funnel": {
    "since": "2026-06-19T00:00:00.000Z",
    "days": 30,
    "steps": [
      {
        "event_name": "calculator_viewed",
        "count": 420,
        "conversion_from_previous": null,
        "conversion_from_start": 100
      },
      {
        "event_name": "checkout_started",
        "count": 12,
        "conversion_from_previous": 26.67,
        "conversion_from_start": 2.86
      }
    ]
  },
  "mrr": {
    "statuses_included": ["active", "past_due"],
    "currency": "EUR",
    "total_mrr": 849.7,
    "by_tier": [
      { "tier": "pro", "subscriber_count": 30, "mrr": 299.7 },
      { "tier": "contractor", "subscriber_count": 5, "mrr": 550 }
    ],
    "free_users_count": 512,
    "trialing_count": 8
  }
}
```

`funnel.steps` liste les 5 marches du funnel DATA-1 dans l'ordre
(`calculator_viewed` → `account_created` → `estimate_created` →
`shopping_list_generated` → `checkout_started`) : la 1ʳᵉ marche compte les
événements bruts (visite anonyme possible), les 4 suivantes comptent les
utilisateurs distincts ayant déclenché l'événement pendant la fenêtre.
`mrr` ne compte que les abonnements `active`/`past_due` (revenu facturé) —
`trialing` est exposé à part via `trialing_count`, hors du montant.

---

## Admin CV Retraining

> Endpoints de la boucle de ré-entraînement CV-6, consommés par
> `apps/cv-service/training/export_client.py` depuis la machine
> d'entraînement. Compte admin dédié recommandé.

### `GET /admin/cv-retraining/export`

Export des jobs d'analyse complétés dont le `raw_output` contient les
détections par image (bbox), avec les corrections d'ouvertures
(`cv_correction_logs`, `entity_type='opening'`) et les compteurs
d'engagement du projet. Les jobs antérieurs à la capture des bbox sont
exclus. Lecture seule.

**Auth :** Requise (admin) | **Guard :** `AdminGuard`

**Query params :**

| Param | Type | Défaut | Description |
|-------|------|--------|-------------|
| `since` | ISO 8601 | — | Ne retourne que les jobs complétés après cette date |
| `limit` | number | `100` | Taille de page (1-500) |

**Réponse :** `200 OK` — `{ generated_at, since, next_since, job_count,
jobs: [{ job_id, project_id, completed_at, opening_detector,
openings_detail, per_image, corrections, project_correction_counts }] }`.
`next_since` non nul = page suivante (curseur de pagination).

---

### `GET /admin/cv-retraining/photo?path=...`

Stream d'une photo par `storage_url` exact (cross-projet, pour la
constitution du dataset). Le chemin résolu vient toujours de la ligne
`project_photos` retrouvée en base — jamais du paramètre brut.

**Auth :** Requise (admin)

**Réponses :** `200 OK` — stream image | `404 Not Found`

---

## Price Comparison

> **Fournisseurs.** Le seul adaptateur réel est **ManoMano** (`manomano`), alimenté par le
> flux produits du programme d'affiliation (BACKLOG BUY-1). Il n'est enregistré que si
> `MANOMANO_ENABLED=true` et `MANOMANO_FEED_URL` est renseigné ; sinon la comparaison ne
> renvoie aucun prix. Les adaptateurs mock (prix fabriqués en CAD) ont été supprimés.
> La feature gate `price_comparison` est réactivée depuis BUY-2 (migration 036).
>
> Les prix sont en **EUR**. `unit_price` est le prix d'**un conditionnement du devis** :
> quand le conditionnement marchand diffère (bidon de 10 L pour un devis en pots de 2,5 L),
> le prix réel est ramené au prorata, et le rapprochement est refusé au-delà d'un rapport
> de 1 à 4. Sans rapprochement exploitable, l'article ressort en `availability: "not_found"`
> — jamais avec un prix approché. `product_url` porte le lien affilié.
>
> **BUY-3.** `GET .../buy-links` expose ce même lien affilié, un par ligne de la liste
> d'achats, **sans feature gate** (tier Free inclus) — contrairement aux deux endpoints
> `compare-prices*` ci-dessous qui restent Pro+.

### `GET /projects/:id/shopping-list/buy-links`

Lien d'achat affilié par ligne de la liste d'achats (BACKLOG BUY-3). Un seul lien par
matériau : le fournisseur disponible le moins cher (même critère que `best_supplier_key`
de `compare-prices`), généré depuis le même adaptateur/cache que BUY-1/BUY-2.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** aucune (disponible à
tous les tiers, y compris Free)

**Réponses :** `200 OK`
```json
{
  "links": [
    {
      "material_id": "material_id_1",
      "supplier_key": "manomano",
      "supplier_name": "ManoMano",
      "url": "https://www.manomano.fr/p/..."
    }
  ]
}
```

Un matériau sans rapprochement marchand exploitable (`not_found`) n'apparaît pas dans
`links` — pas de lien approché.

---

### `POST /projects/:id/shopping-list/compare-prices`

Comparer les prix des matériaux auprès de fournisseurs.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `price_comparison` (Pro+)

**Body :**
```json
{
  "postal_code": "75001"
}
```

`postal_code` est optionnel et sans effet sur ManoMano (vente en ligne, prix national).

**Réponses :** `201 Created` — retourne les prix par fournisseur | `403 Forbidden`

---

### `POST /projects/:id/shopping-list/compare-prices/apply`

Appliquer les sélections de prix fournisseurs à la liste d'achat.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `price_comparison` (Pro+)

**Body :**
```json
{
  "selections": [
    { "material_id": "material_id_1", "supplier_key": "manomano" },
    { "material_id": "material_id_2", "supplier_key": "manomano" }
  ]
}
```

**Réponses :** `201 Created` | `403 Forbidden`

---

## Company Profiles

### `POST /company-profiles`

Créer un profil entreprise.

**Auth :** Requise

**Body :**
```json
{
  "raison_sociale": "Dupont Rénovation SARL",
  "siret": "12345678901234",
  "address_line1": "1 rue de Paris",
  "address_line2": "Bâtiment A",
  "postal_code": "75001",
  "city": "Paris",
  "phone": "+33612345678",
  "specialties": ["peinture", "carrelage"]
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `raison_sociale` | string | oui | 1-255 caractères |
| `siret` | string | oui | Exactement 14 chiffres |
| `address_line1` | string | oui | Min 1 caractère |
| `address_line2` | string | non | — |
| `postal_code` | string | oui | 1-10 caractères |
| `city` | string | oui | Min 1 caractère |
| `phone` | string | non | Max 20 caractères |
| `specialties` | string[] | non | — |

**Mentions légales de facturation** (toutes facultatives ; requises seulement à l'émission d'une facture — cf. [Invoices](#invoices) et [CONFORMITE_FACTURATION.md](CONFORMITE_FACTURATION.md)) :

| Champ | Type | Validation |
|-------|------|------------|
| `legal_form` | string | Max 50 caractères |
| `capital_social` | number | Min 0 |
| `vat_number` | string | Format `FRxx999999999` |
| `vat_exempt` | boolean | Franchise en base, art. 293 B du CGI |
| `rcs_city` | string | Max 100 caractères |
| `rm_department` | string | Max 100 caractères |
| `insurance_name` | string | Assureur décennale, max 255 |
| `insurance_policy` | string | Max 100 caractères |
| `insurance_coverage` | string | Couverture géographique, max 255 |
| `iban` | string | Format IBAN |
| `bic` | string | Format BIC (8 ou 11) |
| `email` | string | Format email valide |
| `late_penalty_rate` | number | 0-100 |
| `default_payment_terms_days` | number | Entier 0-90 |

> Le SIREN et le numéro RCS ne sont pas stockés : ils se dérivent du SIRET (9 premiers chiffres).

**Réponses :** `201 Created`

---

### `GET /company-profiles/me`

Récupérer le profil entreprise de l'utilisateur.

**Auth :** Requise

**Réponses :** `200 OK` | `404 Not Found`

---

### `PUT /company-profiles/me`

Mettre à jour le profil entreprise.

**Auth :** Requise

**Body :** Identique à `POST /company-profiles`

**Réponses :** `200 OK`

---

## Clients

> Toutes les routes clients nécessitent la feature gate `client_management` (tier Contractor).

### `POST /clients`

Créer un client.

**Auth :** Requise | **Feature gate :** `client_management`

**Body :**
```json
{
  "name": "Marie Martin",
  "email": "marie@example.com",
  "phone": "+33612345678",
  "address_line1": "5 avenue des Champs",
  "postal_code": "75008",
  "city": "Paris"
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `name` | string | oui | 1-255 caractères |
| `email` | string | non | Format email valide |
| `phone` | string | non | Max 20 caractères |
| `address_line1` | string | non | Max 255 caractères |
| `address_line2` | string | non | — |
| `postal_code` | string | non | Max 10 caractères |
| `city` | string | non | Max 100 caractères |
| `is_company` | boolean | non | Client professionnel |
| `siret` | string | non | Exactement 14 chiffres |
| `vat_number` | string | non | Max 20 caractères |
| `country` | string | non | Code ISO 2 lettres (défaut `FR`) |

> `is_company` + `siret` alimentent la mention « SIREN du client », obligatoire sur les factures B2B au 1er septembre 2026.

**Réponses :** `201 Created` | `403 Forbidden`

---

### `GET /clients`

Lister les clients de l'utilisateur.

**Auth :** Requise | **Feature gate :** `client_management`

**Réponses :** `200 OK` | `403 Forbidden`

---

### `GET /clients/:id`

Récupérer un client par ID.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `client_management`

**Réponses :** `200 OK` | `404 Not Found` | `403 Forbidden`

---

### `PATCH /clients/:id`

Mettre à jour un client.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `client_management`

**Body :** Identique à `POST /clients`

**Réponses :** `200 OK` | `404 Not Found` | `403 Forbidden`

---

### `DELETE /clients/:id`

Supprimer un client.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `client_management`

**Réponses :** `204 No Content` | `404 Not Found` | `403 Forbidden`

---

## Quotes

> Toutes les routes devis nécessitent la feature gate `export_devis` (tier Contractor).

### `POST /quotes`

Créer un devis.

**Auth :** Requise | **Feature gate :** `export_devis`

**Body :**
```json
{
  "project_id": "uuid",
  "estimation_id": "uuid",
  "client_id": "uuid",
  "labor_items": [
    {
      "work_item_id": "uuid",
      "work_type_code": "wall_painting",
      "label": "Peinture murale — Salon",
      "room_name": "Salon",
      "kind": "hourly",
      "surface_m2": 25,
      "quantity": 5,
      "unit_price_ht": 45
    }
  ],
  "material_margin_percent": 10,
  "discount_percent": 5,
  "payment_terms": "30% à la commande, solde à la livraison",
  "validity_days": 30,
  "tva_rate": 20,
  "notes": "Devis valable 30 jours"
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `project_id` | UUID | oui | — |
| `estimation_id` | UUID | oui | — |
| `client_id` | UUID | non | — |
| `labor_items` | array | non | Max 50 éléments — une ligne de MO par ouvrage (E2-3) |
| `labor_items[].work_item_id` | string \| null | non | Chaîne opaque, jamais un UUID garanti |
| `labor_items[].work_type_code` | string \| null | non | — |
| `labor_items[].label` | string | oui | Max 255 caractères |
| `labor_items[].room_name` | string \| null | non | — |
| `labor_items[].kind` | enum | oui | `hourly`, `flat` — `flat` force `quantity` à 1 |
| `labor_items[].surface_m2` | number \| null | non | Min 0 — descriptif, ne détermine jamais `quantity` |
| `labor_items[].quantity` | number | oui | Min 0 — heures (`hourly`) ou 1 (`flat`) |
| `labor_items[].unit_price_ht` | number | oui | Min 0 — taux horaire ou montant du forfait |
| `labor_items[].line_total_ht` | number | non | Accepté puis **ignoré** : toujours recalculé serveur |
| `material_margin_percent` | number | oui | 0-100 |
| `discount_percent` | number | non | 0-100 |
| `payment_terms` | string | non | — |
| `validity_days` | number | non | 1-365 |
| `tva_rate` | number | non | 0-100 |
| `notes` | string | non | — |

`labor_items` absent ou `[]` ⇒ devis sans main-d'œuvre (`subtotal_labor_ht = 0`) : le serveur
n'invente jamais de ligne à l'écriture. Pour proposer des lignes à partir des ouvrages du projet,
appeler `GET /quotes/labor-proposal` avant de construire ce corps.

**Réponses :** `201 Created` | `403 Forbidden`

---

### `GET /quotes/labor-proposal`

Proposer des lignes de MO à partir des ouvrages d'une estimation — un temps unitaire indicatif par
ouvrage (`work_types.labor_minutes_per_m2`) multiplié par sa surface, au taux horaire par défaut du
profil d'entreprise (`0` si non renseigné). Lecture pure : n'écrit rien, à appeler avant
`POST /quotes` ou `PATCH /quotes/:id`.

**Auth :** Requise | **Feature gate :** `export_devis`

**Query params :**

| Param | Type | Requis |
|-------|------|--------|
| `project_id` | UUID | oui |
| `estimation_id` | UUID | oui |

**Réponses :** `200 OK` — tableau de lignes (même forme que `labor_items[]` ci-dessus, avec
`line_total_ht`) | `404 Not Found` (estimation hors du projet) | `403 Forbidden`

---

### `GET /quotes`

Lister les devis de l'utilisateur.

**Auth :** Requise | **Feature gate :** `export_devis`

**Query params :**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filtrer par statut (`draft`, `sent`, `accepted`, `refused`, `negotiation`) |

**Réponses :** `200 OK` | `403 Forbidden`

---

### `GET /quotes/:id`

Récupérer un devis par ID.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `export_devis`

**Réponses :** `200 OK` | `404 Not Found` | `403 Forbidden`

---

### `PATCH /quotes/:id`

Mettre à jour un devis.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `export_devis`

**Body :** Identique à `POST /quotes`

**Réponses :** `200 OK` | `404 Not Found` | `403 Forbidden`

---

### `PATCH /quotes/:id/status`

Changer le statut d'un devis.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `export_devis`

**Body :**
```json
{
  "status": "sent"
}
```

**Statuts possibles :** `draft`, `sent`, `accepted`, `refused`, `negotiation`

**Réponses :** `200 OK` | `404 Not Found` | `403 Forbidden`

---

### `GET /quotes/:id/export/pdf`

Exporter un devis en PDF.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `export_devis`

**Réponses :** `200 OK` — `Content-Type: application/pdf` | `404 Not Found` | `403 Forbidden`

---

### `DELETE /quotes/:id`

Supprimer un devis.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `export_devis`

**Réponses :** `204 No Content` | `404 Not Found` | `403 Forbidden`

---

## Invoices

> Toutes les routes factures nécessitent la feature gate `invoicing` (tier Contractor Essentiel).
>
> **Une facture émise est immuable** : il n'existe ni route de modification de contenu, ni route de suppression. Seul l'état de règlement évolue. Voir [CONFORMITE_FACTURATION.md](CONFORMITE_FACTURATION.md).

### `POST /invoices`

Convertir un devis **accepté** en facture. Le numéro est alloué dans une séquence continue par artisan et par année (`F-AAAA-NNNN`).

**Auth :** Requise | **Feature gate :** `invoicing`

**Body :**
```json
{
  "quote_id": "uuid",
  "issued_on": "2026-08-01",
  "supply_date": "2026-07-28",
  "due_on": "2026-08-31",
  "payment_terms": "30 % à la commande, solde à la livraison",
  "delivery_address": "12 rue du Chantier, 75011 Paris",
  "operation_category": "mixte",
  "vat_on_debits": false,
  "notes": "Merci de votre confiance"
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `quote_id` | UUID | oui | Le devis doit être au statut `accepted` |
| `issued_on` | date | non | Défaut : aujourd'hui (`Europe/Paris`) |
| `supply_date` | date | non | Date de prestation. Défaut : `issued_on` |
| `due_on` | date | non | Défaut : `issued_on` + délai du profil, ou 30 jours |
| `payment_terms` | string | non | Défaut : conditions du devis |
| `delivery_address` | string | non | Max 500. Mention 2026 si ≠ adresse de facturation |
| `operation_category` | enum | non | `biens`, `services`, `mixte` (défaut `mixte`) |
| `vat_on_debits` | boolean | non | Option TVA d'après les débits (mention 2026) |
| `notes` | string | non | — |

**Réponses :** `201 Created` | `400 Bad Request` | `403 Forbidden` | `404 Not Found` | `409 Conflict`

`400` lorsque le profil entreprise est incomplet :
```json
{
  "statusCode": 400,
  "error": "MISSING_LEGAL_MENTIONS",
  "message": "Mentions legales manquantes sur le profil entreprise, facture non emise",
  "missing_fields": ["vat_number", "registration", "insurance"]
}
```

Valeurs possibles de `missing_fields` : `company_profile`, `siret`, `address`, `vat_number`, `registration`, `insurance`.

`409` lorsqu'une facture de solde existe déjà pour ce devis :
```json
{
  "statusCode": 409,
  "error": "INVOICE_ALREADY_EXISTS",
  "message": "Une facture existe deja pour ce devis",
  "invoice_id": "uuid",
  "invoice_number": "F-2026-0001"
}
```

`400` simple lorsque le devis n'est pas au statut `accepted`.

---

### `GET /invoices`

Lister les factures de l'utilisateur.

**Auth :** Requise | **Feature gate :** `invoicing`

**Query params :**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filtrer par statut (`issued`, `paid`) |
| `quote_id` | UUID | Factures issues d'un devis donné (liste vide si non facturé) |

**Réponses :** `200 OK` | `403 Forbidden`

---

### `GET /invoices/:id`

Récupérer une facture par ID. Le corps contient les identités figées à l'émission (`seller_snapshot`, `buyer_snapshot`), les lignes (`items_json`) et la ventilation de TVA (`vat_breakdown`).

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `invoicing`

**Réponses :** `200 OK` | `404 Not Found` | `403 Forbidden`

---

### `GET /invoices/:id/export/pdf`

Exporter une facture en PDF, avec toutes les mentions légales françaises.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `invoicing`

**Réponses :** `200 OK` — `Content-Type: application/pdf` | `404 Not Found` | `403 Forbidden`

---

### `PATCH /invoices/:id/status`

Changer l'état de règlement. C'est la **seule** mutation autorisée sur une facture émise.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `invoicing`

**Body :**
```json
{
  "status": "paid",
  "paid_at": "2026-08-20"
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `status` | enum | oui | `issued`, `paid` |
| `paid_at` | date | non | Date réelle du règlement. Défaut : maintenant |

> Repasser à `issued` efface `paid_at` — c'est l'annulation d'un marquage erroné, pas l'annulation de la facture, qui exigerait un avoir (non implémenté).

**Réponses :** `200 OK` | `400 Bad Request` | `404 Not Found` | `403 Forbidden`

---

## Suivi de chantier

> Toutes les routes de suivi de chantier nécessitent la feature gate `site_tracking` (tier Contractor Standard+).

### `GET /projects/:id/milestones`

Lister les jalons d'un projet, triés par `sort_order`.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `site_tracking`

**Réponses :** `200 OK` | `404 Not Found` | `403 Forbidden`

---

### `POST /projects/:id/milestones`

Créer un jalon.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `site_tracking`

**Body :**
```json
{
  "label": "Démolition",
  "planned_date": "2026-08-15"
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `label` | string | oui | 1-255 caractères |
| `planned_date` | date (ISO) | non | — |
| `sort_order` | integer | non | ≥ 0, défaut = nombre de jalons existants |

**Réponses :** `201 Created` | `404 Not Found` | `403 Forbidden`

---

### `PATCH /projects/:id/milestones/:milestoneId`

Mettre à jour un jalon (libellé, statut, dates, ordre).

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `site_tracking`

**Body :**
```json
{
  "status": "done"
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `label` | string | non | 1-255 caractères |
| `status` | enum | non | `pending`, `in_progress`, `done` |
| `planned_date` | date (ISO) | non | — |
| `actual_date` | date (ISO) | non | — |
| `sort_order` | integer | non | ≥ 0 |

Un jalon dont le statut passe à `done` sans `actual_date` fournie reçoit automatiquement la date du jour.

**Réponses :** `200 OK` | `404 Not Found` | `403 Forbidden`

---

### `DELETE /projects/:id/milestones/:milestoneId`

Supprimer un jalon.

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `site_tracking`

**Réponses :** `204 No Content` | `404 Not Found` | `403 Forbidden`

---

## Community

### `GET /community`

Lister les projets communautaires approuvés (paginé).

**Auth :** Optionnelle (enrichit avec les likes de l'utilisateur)

**Query params :**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page |
| `limit` | number | Éléments par page |
| `work_type` | string | Filtrer par type de travaux |

**Réponses :** `200 OK`

---

### `GET /community/:id`

Détail d'un projet communautaire.

**Auth :** Optionnelle

**Réponses :** `200 OK` | `404 Not Found`

---

### `POST /community`

Soumettre un projet à la galerie communautaire.

**Auth :** Requise | **Feature gate :** `community_gallery` (Pro+)

**Body :**
```json
{
  "project_id": "uuid",
  "title": "Rénovation salon",
  "description": "Peinture complète du salon...",
  "materials_list": [
    { "name": "Peinture blanche", "quantity": 3, "unit": "pots" }
  ],
  "total_cost_cents": 45000,
  "duration_days": 3,
  "before_photo_ids": ["uuid1", "uuid2"],
  "after_photo_ids": ["uuid3", "uuid4"],
  "gdpr_consent": true
}
```

**Réponses :** `201 Created` | `403 Forbidden`

---

### `DELETE /community/:id`

Retirer son projet de la galerie.

**Auth :** Requise (propriétaire uniquement)

**Réponses :** `204 No Content` | `404 Not Found`

---

### `POST /community/:id/like`

Toggle like/unlike sur un projet communautaire.

**Auth :** Requise

**Réponses :** `201 Created` — retourne `{ liked: boolean, likes_count: number }`

---

### `GET /community/:id/comments`

Lister les commentaires d'un projet communautaire.

**Auth :** Optionnelle

**Réponses :** `200 OK`

---

### `POST /community/:id/comments`

Ajouter un commentaire.

**Auth :** Requise

**Réponses :** `201 Created`

---

### `DELETE /community/comments/:commentId`

Supprimer un commentaire (propriétaire ou admin).

**Auth :** Requise

**Réponses :** `204 No Content` | `404 Not Found`

---

### `GET /community/:id/photos/:photoId/file`

Servir une photo d'un projet communautaire.

**Auth :** Non requise

**Réponses :** `200 OK` — stream image

---

### `GET /community/:id/photos/:photoId/thumbnail`

Servir la miniature d'une photo communautaire.

**Auth :** Non requise

**Réponses :** `200 OK` — stream miniature

---

### Routes Admin Community

### `GET /community/admin/pending`

Lister les projets en attente de modération.

**Auth :** Requise (admin)

**Réponses :** `200 OK`

---

### `PUT /community/admin/:id/moderate`

Approuver ou rejeter un projet communautaire.

**Auth :** Requise (admin)

**Body :**
```json
{
  "status": "approved",
  "rejection_reason": null
}
```

**Réponses :** `200 OK` | `404 Not Found`

---

## Organisations

BACKLOG PLAT-4. La propriété des projets, clients, devis et factures appartient à
l'**organisation**, pas à l'utilisateur. Tout compte possède une organisation
personnelle (créée d'office) ; les paliers Contractor Premium peuvent en plus
inviter des membres.

L'organisation active est résolue **côté serveur** à partir du compte
authentifié — aucune route n'accepte d'identifiant d'organisation fourni par le
client, hormis `POST /organizations/:id/activate` qui revérifie l'adhésion.

Le palier appliqué par les feature gates est celui du **propriétaire de
l'organisation active** : un membre au palier `free` invité chez un Contractor
Premium travaille avec les capacités Premium tant qu'il est dans cette
organisation, et retrouve son propre palier dans son espace personnel.

Rôles : `owner` (porte le palier, ni rétrogradable ni retirable), `admin` (gère
les membres non-`owner`), `member` (travaille sur les données de l'organisation).

### `GET /organizations/current`

Organisation active, rôle de l'appelant et palier effectif.

**Réponse :** `200 OK`
```json
{
  "id": "uuid",
  "name": "Peinture Dupont SARL",
  "is_personal": false,
  "role": "owner",
  "effective_tier": "contractor_premium"
}
```

### `GET /organizations/mine`

Liste des organisations dont l'appelant est membre, avec son rôle et laquelle est active.

**Réponse :** `200 OK`

### `PATCH /organizations/current`

Renomme l'organisation active. Réservé à `owner`/`admin`.

**Body :** `{ "name": "Peinture Dupont SARL" }`

**Réponses :** `200 OK` | `403 Forbidden`

### `POST /organizations/:id/activate`

Bascule l'organisation active. L'adhésion est revérifiée : un membre retiré est refusé.

**Réponses :** `204 No Content` | `403 Forbidden`

### `GET /organizations/current/members`

**Réponse :** `200 OK` — `[{ "user_id", "email", "role", "joined_at" }]`

### `PATCH /organizations/current/members/:userId`

Change le rôle d'un membre (`admin` ou `member`). Réservé à `owner`/`admin`.
Le propriétaire ne peut pas être modifié.

**Réponses :** `200 OK` | `403 Forbidden` | `404 Not Found`

### `DELETE /organizations/current/members/:userId`

Retire un membre. Son organisation active est réinitialisée sur son espace personnel.

**Réponses :** `204 No Content` | `403 Forbidden` | `404 Not Found`

### `POST /organizations/current/invitations`

**Feature gate :** `multi_user` (Contractor Premium). Réservé à `owner`/`admin`.

Crée une invitation valable 7 jours et envoie le lien par e-mail. Seul le SHA-256
du jeton est stocké : le secret ne vit que dans l'e-mail. Un renvoi sur la même
adresse remplace l'invitation en attente.

**Body :** `{ "email": "salarie@example.com", "role": "member" }`

**Réponses :** `201 Created` | `403 Forbidden` | `409 Conflict` (déjà membre)

### `GET /organizations/current/invitations`

Invitations en attente. **Feature gate :** `multi_user`.

### `DELETE /organizations/current/invitations/:id`

Révoque une invitation. **Feature gate :** `multi_user`.

**Réponses :** `204 No Content`

### `POST /organizations/invitations/accept`

Accepte une invitation. Non gatée : le membre invité peut être au palier `free`.
Exige d'être authentifié **avec l'adresse e-mail invitée** — un jeton intercepté
ne permet pas d'entrer avec un autre compte.

**Body :** `{ "token": "..." }`

**Réponses :** `201 Created` | `400 Bad Request` (expirée) | `403 Forbidden` (e-mail non concordant) | `404 Not Found` (jeton inconnu ou déjà utilisé)

---

## API publique (clés)

API destinée aux intégrations tierces, authentifiée par **clé d'API** et non par jeton Firebase.
Elle calcule des estimations **sans rien persister** : ni projet, ni pièce, ni estimation
enregistrée. Elle n'expose aucune donnée métier de l'organisation.

**Base :** `http://localhost:3001/api/v1/partner`

**Authentification :** `Authorization: Bearer chf_<64 caractères>`. La clé est créée depuis
[Clés d'API (gestion)](#clés-dapi-gestion) et n'est affichée **qu'une seule fois** — elle n'est
stockée que hachée et n'est jamais relisible. Une clé appartient à une **organisation**, pas à
une personne : elle survit au départ de son créateur.

> **Ne jamais exposer une clé dans un navigateur ni dans une application mobile.** Elle porte
> toute la portée de l'organisation. Les appels sont conçus pour être faits de serveur à serveur.

**Feature gate :** `public_api` (Contractor Premium). Le palier est réévalué **à chaque
requête** : une rétrogradation d'abonnement désactive immédiatement toutes les clés de
l'organisation.

**Limites :**

| Limite | Valeur | Portée |
|--------|--------|--------|
| Rafale | 60 requêtes/minute | par clé |
| Quota mensuel | 10 000 requêtes | par organisation, mois calendaire Europe/Paris |

Seul `POST /partner/estimate` est décompté du quota mensuel ; `work-types` et `usage` ne le sont
pas. Les deux rejets renvoient `429` avec un en-tête `Retry-After` (secondes) et se distinguent
par leur champ `error` : `RATE_LIMIT_EXCEEDED` (rafale) ou `QUOTA_EXCEEDED` (quota mensuel).

**Erreurs d'authentification (`401`) :** `INVALID_API_KEY_FORMAT` (en-tête absent ou préfixe
`chf_` manquant), `INVALID_API_KEY` (clé inconnue), `API_KEY_REVOKED`,
`API_KEY_ROTATION_EXPIRED` (ancienne clé présentée après la fin de la période de grâce).

---

### `POST /partner/estimate`

Estimer les matériaux d'un ou plusieurs espaces. Aucune donnée n'est enregistrée.

**Auth :** Clé API | **Quota :** décompté | **Feature gate :** `public_api` (Contractor Premium)

**Body :**
```json
{
  "rooms": [
    {
      "name": "Salon",
      "length_cm": 500,
      "width_cm": 400,
      "height_cm": 250,
      "openings": [{ "width_cm": 90, "height_cm": 210, "count": 1 }],
      "work_items": [
        { "work_type_code": "wall_painting", "custom_params": { "number_of_coats": 2 } }
      ]
    }
  ],
  "skill_level": "intermediate"
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `rooms` | array | oui | 1 à 20 éléments |
| `rooms[].name` | string | non | 1 à 100 caractères ; défaut « Pièce N » |
| `rooms[].length_cm` | int | oui | 50 à 10000 |
| `rooms[].width_cm` | int | oui | 50 à 10000 |
| `rooms[].height_cm` | int | oui | 50 à 10000 |
| `rooms[].openings` | array | non | max 20 ; `width_cm`/`height_cm` 1-1000, `count` 1-20 |
| `rooms[].segments` | array | non | max 10 ; décomposition d'une pièce non rectangulaire (L, T, U…) |
| `rooms[].work_items` | array | oui | 1 à 7 éléments |
| `rooms[].work_items[].work_type_code` | string | oui | code issu de `GET /partner/work-types` |
| `rooms[].work_items[].skill_level` | enum | non | `beginner`, `intermediate`, `expert` |
| `rooms[].work_items[].custom_params` | object | non | `number_of_coats` (1-4), `tile_format`, `laying_pattern` |
| `skill_level` | enum | non | niveau par défaut des ouvrages qui n'en précisent pas |

**Réponses :** `200 OK` — `{ rooms_count, total_items, items[], aggregated[] }`. `items` détaille
chaque ligne (surface, quantité théorique, perte, quantité ajustée, conditionnement) avec
`room_id` = `room-1`, `room-2`… dans l'ordre des pièces envoyées ; `aggregated` mutualise les
achats par matériau sur l'ensemble des pièces. | `400 Bad Request` (bornes dépassées ou
propriété inconnue) | `401` | `403` `FEATURE_GATED` | `404 Not Found` (`work_type_code`
inconnu) | `429`

---

### `GET /partner/work-types`

Lister les types de travaux disponibles et leurs questions contextuelles.

**Auth :** Clé API | **Quota :** non décompté

**Réponses :** `200 OK` — tableau de `{ code, label_fr, category, surface_target, contextual_questions }`

---

### `GET /partner/usage`

Consulter sa consommation du mois en cours. Volontairement non décomptée, pour rester
consultable une fois le quota atteint.

**Auth :** Clé API | **Quota :** non décompté

**Réponses :** `200 OK` — `{ period, count, limit, reset_at }`

---

## Clés d'API (gestion)

Surface d'administration des clés, authentifiée par **jeton Firebase**. Réservée au
propriétaire et aux administrateurs de l'organisation — créer une clé, c'est créer un
credential qui porte toute la portée de l'organisation.

**Feature gate :** `public_api` (Contractor Premium) sur toutes les routes.
Maximum **10 clés actives** par organisation.

---

### `GET /api-keys`

Lister les clés de l'organisation. Les empreintes ne sont **jamais** renvoyées.

**Auth :** Requise (propriétaire ou administrateur) | **Feature gate :** `public_api`

**Réponses :** `200 OK` — tableau de `{ id, name, key_prefix, created_at, last_used_at, revoked_at, rotation_grace_until }`

---

### `GET /api-keys/usage`

Consommation de l'organisation pour le mois en cours.

**Auth :** Requise (propriétaire ou administrateur) | **Feature gate :** `public_api`

**Réponses :** `200 OK` — `{ period, count, limit, reset_at }`

---

### `POST /api-keys`

Créer une clé. **Le secret n'est renvoyé qu'ici, une seule fois** : il n'est stocké que haché et
ne peut plus être relu ensuite.

**Auth :** Requise (propriétaire ou administrateur) | **Feature gate :** `public_api`

**Body :**
```json
{ "name": "Intégration ERP" }
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `name` | string | oui | 1 à 100 caractères |

**Réponses :** `201 Created` — `{ secret, key }` | `403 Forbidden` (membre simple) | `409 Conflict` `API_KEY_LIMIT_REACHED`

---

### `POST /api-keys/:id/rotate`

Faire tourner une clé **sans coupure** : un nouveau secret est émis et l'ancien reste accepté
pendant **24 heures**, le temps de redéployer. L'identifiant, le nom et l'historique de la clé
sont conservés. Une seconde rotation pendant la période de grâce est refusée — elle tuerait
sans signal une clé encore déployée. En cas de fuite, utiliser la révocation, immédiate.

**Auth :** Requise (propriétaire ou administrateur) | **Feature gate :** `public_api`

**Réponses :** `200 OK` — `{ secret, key }` (secret affiché une seule fois) | `404 Not Found`
(clé inexistante, révoquée, ou appartenant à une autre organisation) |
`409 Conflict` `ROTATION_IN_PROGRESS`

---

### `DELETE /api-keys/:id`

Révoquer une clé, immédiatement et sans période de grâce. Toute empreinte de rotation encore
valide est effacée en même temps.

**Auth :** Requise (propriétaire ou administrateur) | **Feature gate :** `public_api`

**Réponses :** `204 No Content` | `404 Not Found`

---

## Widget marque blanche

Calculateur embarquable chez des médias bricolage ou des marchands, brandé « Propulsé par
Chiffréo » (BACKLOG PLAT-7). Il s'appuie sur le même moteur d'estimation que
[l'API publique (clés)](#api-publique-clés), mais avec un modèle de credential différent :
la clé de widget (`wgt_...`) **n'est pas un secret**. Elle est faite pour être collée dans le
HTML statique d'un site tiers, donc visible de quiconque ouvre les outils de développement de
son navigateur. Son autorisation repose sur une liste blanche d'origines (`allowed_origins`)
configurée par l'organisation, pas sur la confidentialité de la clé.

> **`Origin` n'est vérifié qu'au sens du navigateur.** Un appelant scripté qui détient déjà la
> clé peut forger cet en-tête et appeler l'API directement — la liste blanche empêche une page
> non autorisée d'utiliser la clé d'une autre organisation, pas un script qui la possède déjà.
> Acceptable ici : l'endpoint ne fait que du calcul de quantités, sans persistance ni prix.

**Base publique :** `http://localhost:3001/api/v1/widget/:widgetKey`
**Base d'administration :** `http://localhost:3001/api/v1/widget-config`

**Feature gate :** `public_api` (Contractor Premium) — la même que l'API partenaire. Le quota
mensuel est également **le même compteur** que celui de l'API partenaire : un widget très
fréquenté et des appels directs à `/partner` consomment un seul budget par organisation.

**Limites (surface publique) :**

| Limite | Valeur | Portée |
|--------|--------|--------|
| Rafale | 120 requêtes/minute | par widget (plus haute que les 60/min de l'API partenaire : un widget est appelé par de nombreux visiteurs indépendants, pas par une seule intégration serveur-à-serveur) |
| Quota mensuel | partagé avec l'API partenaire | par organisation, mois calendaire Europe/Paris |

Seul `POST /widget/:widgetKey/estimate` est décompté du quota. Erreurs propres à cette surface
(en plus des codes communs) : `WIDGET_NOT_FOUND` (404, clé inconnue ou widget désactivé),
`ORIGIN_REQUIRED` / `ORIGIN_NOT_ALLOWED` (403, en-tête `Origin` absent ou hors liste blanche).

### Intégration

```html
<div data-chiffreo-widget
     data-widget-key="wgt_..."
     data-api-base="https://api.votre-domaine.example"></div>
<script src="https://votre-site-chiffreo.example/chiffreo-widget.js" defer></script>
```

Le script scanne la page à son chargement pour tout conteneur `[data-chiffreo-widget]`, et
monte le formulaire dans une **Shadow DOM** (`attachShadow`) : les styles de la page hôte ne
peuvent pas entrer, ceux du widget ne peuvent pas en sortir — aucune feuille de style ni
aucune variable JS partagée avec la page qui l'embarque. Le widget ne prend qu'une seule pièce
et un seul ouvrage par estimation en v1 ; le multi-pièces reste porté par l'API partenaire.

### `GET /widget/:widgetKey/branding`

Informations de marque affichées dans le widget.

**Auth :** clé de widget + origine autorisée | **Quota :** non décompté

**Réponses :** `200 OK` — `{ display_name, accent_color, powered_by: "Chiffréo" }`

---

### `GET /widget/:widgetKey/work-types`

Identique à [`GET /partner/work-types`](#get-partnerwork-types).

**Auth :** clé de widget + origine autorisée | **Quota :** non décompté

---

### `POST /widget/:widgetKey/estimate`

Identique à [`POST /partner/estimate`](#post-partnerestimate) (même DTO, mêmes bornes), mais
authentifié par clé de widget + origine plutôt que par clé secrète.

**Auth :** clé de widget + origine autorisée | **Quota :** décompté (partagé avec l'API partenaire)

**Réponses :** `200 OK` — `{ rooms_count, total_items, items[], aggregated[] }` | `400 Bad Request`
| `403` `ORIGIN_REQUIRED` / `ORIGIN_NOT_ALLOWED` / `FEATURE_GATED` | `404 Not Found`
(`WIDGET_NOT_FOUND` ou `work_type_code` inconnu) | `429`

---

### Configuration (gestion)

Authentifiée par jeton Firebase — surface *administrative*, pas le widget lui-même. Une seule
configuration par organisation. Pas d'écran de tableau de bord dédié pour l'instant, même choix
que pour [les clés d'API](#clés-dapi-gestion) : cette surface s'utilise directement.

#### `GET /widget-config`

Récupère la configuration de l'organisation, la crée si elle n'existe pas encore
(`widget_key` générée à la volée, `allowed_origins` vide, `enabled: true`).

**Auth :** Requise (propriétaire ou administrateur) | **Feature gate :** `public_api`

**Réponses :** `200 OK` — `{ widget_key, allowed_origins, enabled, display_name, accent_color }`

#### `PATCH /widget-config`

Met à jour uniquement les champs fournis : `allowed_origins` (origines exactes
`scheme://host[:port]`, sans chemin ni slash final, max 10), `display_name`, `accent_color`
(hex `#rrggbb`), `enabled`.

**Auth :** Requise (propriétaire ou administrateur) | **Feature gate :** `public_api`

#### `POST /widget-config/regenerate-key`

Régénère `widget_key` **immédiatement, sans fenêtre de grâce** (contrairement à la rotation des
clés d'API) : la clé n'étant pas secrète, régénérer répond à un widget compromis ou mal
configuré, pas à une fuite à couvrir en douceur. Toute page qui embarque déjà l'ancienne clé
cesse de fonctionner aussitôt.

**Auth :** Requise (propriétaire ou administrateur) | **Feature gate :** `public_api`

---

## Enterprise — SSO

Fédération d'identité SAML / OIDC par organisation (BACKLOG PLAT-6).

> **Le rattachement d'une session à une organisation se fait par `provider_id`, jamais par le
> domaine de l'adresse affirmée.** `provider_id` est émis par Chiffréo au moment où le
> fournisseur est créé chez Google Cloud Identity Platform : un jeton qui le porte prouve que
> l'assertion vient de l'IdP de cette organisation-là. Les domaines ne servent qu'à la
> **découverte**, et doivent être prouvés par DNS avant de router quoi que ce soit.

**Feature gate :** `enterprise_sso` (palier `enterprise`, ouvert par un contrat annuel actif —
cf. [Enterprise — contrat et SLA](#enterprise--contrat-et-sla)).

**Aucun secret d'IdP n'est stocké.** Certificat X.509, `client_secret` et URL de SSO transitent
vers GCIP et ne sont jamais persistés par Chiffréo.

| Limite | Valeur | Portée |
|--------|--------|--------|
| Découverte | 20 req/minute | par IP |
| Surface organisation | 30 req/minute | par IP |
| Domaines vérifiés | 1 organisation par domaine | global |
| Connexions | 1 par organisation | global |

Codes `error` propres à cette section : `SSO_REQUIRED`, `SSO_DOMAIN_NOT_VERIFIED`,
`SSO_CONNECTION_EXISTS`, `SSO_CONNECTION_NOT_ACTIVE`, `SSO_PROVIDER_DELETION_FAILED`,
`DOMAIN_ALREADY_VERIFIED`, `PUBLIC_EMAIL_DOMAIN_REFUSED`.

---

### `GET /sso/discover`

Résout l'adresse professionnelle d'un utilisateur vers le fournisseur d'identité de son
organisation. Première étape du flux SP-initiated, appelée avant toute authentification.

**Auth :** Aucune | **Rate limit :** 20 req/min par IP

| Paramètre | Type | Requis | Validation |
|-----------|------|--------|------------|
| `email` | string | oui | adresse dont le domaine est vérifié |

**Réponses :** `200 OK` — `{ provider_id, protocol }` | `400 Bad Request` (adresse absente ou inexploitable) | `404 Not Found` (aucune connexion SSO active pour ce domaine)

---

### `GET /enterprise/sso/connection`

Rend la connexion SSO de l'organisation active et l'état de ses domaines.

**Auth :** Requise | **Feature gate :** `enterprise_sso`

**Réponses :** `200 OK` — `{ id, provider_id, protocol, display_name, status, enforced, default_role, provisioning_error, domains[] }` | `404 Not Found` (aucune connexion)

---

### `PATCH /enterprise/sso/connection`

Bascule l'application obligatoire du SSO. Une fois `enforced`, tout membre dont la session ne
vient pas de l'IdP reçoit `403 SSO_REQUIRED` — **sauf le propriétaire de l'organisation**,
délibérément exempté pour qu'un IdP mal configuré ne rende jamais l'organisation inaccessible.
Restent également accessibles : `POST /auth/sync`, `GET /auth/me`, `GET /organizations/mine` et
`POST /organizations/:id/activate`, sans quoi un membre bloqué n'aurait aucune sortie.

**Auth :** Requise (propriétaire ou administrateur) | **Feature gate :** `enterprise_sso`

**Body :**
```json
{ "enforced": true }
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `enforced` | boolean | non | — |

**Réponses :** `200 OK` | `403 Forbidden` (membre simple) | `409 Conflict` `SSO_CONNECTION_NOT_ACTIVE`

---

### `POST /enterprise/sso/domains`

Déclare un domaine de découverte. Le domaine n'oriente aucune connexion tant qu'il n'est pas
prouvé. Les domaines de messagerie grand public sont refusés.

**Auth :** Requise (propriétaire ou administrateur) | **Feature gate :** `enterprise_sso`

**Body :**
```json
{ "domain": "acme.com" }
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `domain` | string | oui | domaine valide, 1 à 255 caractères, non public |

**Réponses :** `201 Created` — `{ id, domain, verified, expected_dns_record }` | `400 Bad Request` `PUBLIC_EMAIL_DOMAIN_REFUSED` | `409 Conflict` `DOMAIN_ALREADY_VERIFIED`

---

### `POST /enterprise/sso/domains/:id/verify`

Vérifie la possession du domaine via l'enregistrement TXT
`chiffreo-verification=<jeton>` publié sur `_chiffreo.<domaine>` ou sur le domaine lui-même.
Rejouable : la propagation DNS n'est pas instantanée et le jeton n'est jamais regénéré.

**Auth :** Requise (propriétaire ou administrateur) | **Feature gate :** `enterprise_sso`

**Réponses :** `200 OK` | `400 Bad Request` `SSO_DOMAIN_NOT_VERIFIED` | `404 Not Found` | `409 Conflict` `DOMAIN_ALREADY_VERIFIED`

---

### `DELETE /enterprise/sso/domains/:id`

**Auth :** Requise (propriétaire ou administrateur) | **Feature gate :** `enterprise_sso`

**Réponses :** `204 No Content` | `404 Not Found`

---

### `GET /admin/enterprise/sso/connections`

**Auth :** Requise (administrateur plateforme)

**Réponses :** `200 OK` — liste des connexions et de leurs domaines

---

### `POST /admin/enterprise/sso/connections`

Crée le fournisseur d'identité chez GCIP et la connexion qui le rattache à l'organisation.
Réservé aux administrateurs plateforme : la requête transporte le certificat ou le
`client_secret` du client. La ligne est écrite avant l'appel à GCIP ; si celui-ci échoue, la
connexion reste en `failed` avec le motif dans `provisioning_error`.

**Auth :** Requise (administrateur plateforme)

**Body (SAML) :**
```json
{
  "organization_id": "uuid",
  "protocol": "saml",
  "display_name": "Acme SSO",
  "idp_entity_id": "https://idp.acme.com/entity",
  "sso_url": "https://idp.acme.com/sso",
  "x509_certificate": "-----BEGIN CERTIFICATE-----…"
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `organization_id` | uuid | oui | — |
| `protocol` | string | oui | `saml` ou `oidc` |
| `display_name` | string | oui | 1 à 100 caractères |
| `default_role` | string | non | `admin` ou `member` (jamais `owner`) |
| `idp_entity_id` | string | si `saml` | 1 à 1024 caractères |
| `sso_url` | string | si `saml` | URL **https** |
| `x509_certificate` | string | si `saml` | 1 à 8192 caractères |
| `issuer` | string | si `oidc` | URL **https** |
| `client_id` | string | si `oidc` | 1 à 512 caractères |
| `client_secret` | string | si `oidc` | 1 à 512 caractères |

**Réponses :** `201 Created` | `400 Bad Request` (paramètres d'IdP incomplets) | `409 Conflict` `SSO_CONNECTION_EXISTS`

---

### `DELETE /admin/enterprise/sso/connections/:id`

Supprime le fournisseur chez GCIP **puis** la connexion. Si GCIP refuse, la ligne est conservée
et l'erreur remonte, pour ne jamais perdre la trace d'un fournisseur encore vivant.

**Auth :** Requise (administrateur plateforme)

**Réponses :** `204 No Content` | `404 Not Found` | `409 Conflict` `SSO_PROVIDER_DELETION_FAILED`

---

## Enterprise — contrat et SLA

Le palier `enterprise` n'est pas achetable en libre-service : il est porté par un **contrat
annuel négocié sur devis**, rattaché à l'organisation et non à une personne. Tant qu'un contrat
`active` couvre la date du jour, l'organisation résout le palier `enterprise` — indépendamment
du plan Stripe de son propriétaire. Les documents comptables (devis signé, facture annuelle)
sont émis hors produit et référencés par `quote_reference` / `purchase_order_reference`.

**Feature gate :** aucune sur la lecture — une organisation dont le contrat vient d'expirer doit
pouvoir constater pourquoi elle a perdu ses capacités.

Codes `error` propres à cette section : `ENTERPRISE_AGREEMENT_OVERLAP`.

---

### `GET /enterprise/agreement`

Contrat courant de l'organisation active, engagements de service compris.

**Auth :** Requise

**Réponses :** `200 OK` — `{ id, status, starts_at, ends_at, is_current, days_until_expiry, annual_amount_cents, currency, quote_reference, purchase_order_reference, billing_contact_email, sla: { uptime_target, support_response_hours, support_email }, dedicated_environment, dedicated_environment_region }` | `404 Not Found` (aucun contrat)

---

### `GET /admin/enterprise/agreements`

**Auth :** Requise (administrateur plateforme)

| Paramètre | Type | Requis | Validation |
|-----------|------|--------|------------|
| `expiring_within_days` | integer | non | restreint aux contrats actifs arrivant à échéance dans ce délai |

**Réponses :** `200 OK`

---

### `POST /admin/enterprise/agreements`

Crée un contrat en `draft` : il n'habilite rien tant qu'il n'est pas passé en `active`.

**Auth :** Requise (administrateur plateforme)

**Body :**
```json
{
  "organization_id": "uuid",
  "starts_at": "2026-09-01T00:00:00.000Z",
  "ends_at": "2027-08-31T00:00:00.000Z",
  "annual_amount_cents": 1200000,
  "quote_reference": "DEV-2026-014",
  "billing_contact_email": "compta@acme.com",
  "sla_uptime_target": 99.9,
  "sla_support_response_hours": 4
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| `organization_id` | uuid | oui | — |
| `starts_at` / `ends_at` | string | oui | ISO 8601 ; `ends_at` strictement postérieure |
| `annual_amount_cents` | integer | oui | ≥ 0 |
| `currency` | string | non | 3 lettres, `EUR` par défaut |
| `quote_reference` | string | oui | 1 à 100 caractères |
| `purchase_order_reference` | string | non | 1 à 100 caractères |
| `billing_contact_email` | string | oui | e-mail |
| `sla_uptime_target` | number | non | 0 à 100, 2 décimales |
| `sla_support_response_hours` | integer | non | 1 à 720 |
| `sla_support_email` | string | non | e-mail |
| `dedicated_environment` | boolean | non | déclaratif — aucune infrastructure n'est provisionnée |
| `dedicated_environment_region` | string | non | 1 à 50 caractères |
| `notes` | string | non | 1 à 2000 caractères, jamais rendues à l'organisation |

**Réponses :** `201 Created` | `400 Bad Request` (période inversée) | `409 Conflict` `ENTERPRISE_AGREEMENT_OVERLAP`

---

### `PATCH /admin/enterprise/agreements/:id`

Mêmes champs que la création, tous optionnels, plus `status` (`draft` / `active` /
`terminated`). `organization_id` est volontairement absent : un contrat ne se déplace pas d'une
organisation à l'autre. **Le renouvellement se fait en repoussant `ends_at`**, pas en créant un
second contrat — une organisation ne peut avoir qu'un seul contrat `active`.

**Auth :** Requise (administrateur plateforme)

**Réponses :** `200 OK` | `400 Bad Request` | `404 Not Found` | `409 Conflict` `ENTERPRISE_AGREEMENT_OVERLAP`

---

### `POST /admin/enterprise/agreements/:id/terminate`

Passe le contrat en `terminated` ; le palier retombe au prochain appel. La ligne est conservée —
l'historique contractuel ne se supprime pas.

**Auth :** Requise (administrateur plateforme)

**Réponses :** `200 OK` | `404 Not Found`

---

## Facteurs de perte appris (Admin)

DATA-3 : les facteurs de perte du catalogue sont réajustés à partir des écarts
entre quantité estimée et quantité réellement achetée, relevés sur les
chantiers dont le budget a été finalisé, par matériau × pose × niveau.

Le catalogue de pertes (`waste_factors`) porte des valeurs d'usage métier, sans
référence normative — aucun DTU ne fixe de pourcentage de perte (E1-7).
Étalonné par ENG-5, il n'est **jamais** réécrit :
les valeurs apprises vivent dans `learned_waste_factors` et sont superposées au
chargement du catalogue. Une ligne d'estimation issue d'une valeur apprise porte
`waste_factor_source: "learned"` (au lieu de `"catalog"` ou `"default"`).

Le recalcul tourne chaque semaine (cron). Garde-fous appliqués par cellule :
minimum 8 observations, maximum 5 par organisation, médiane robuste, rejet
au-delà d'un écart absolu médian de 15 points, rapprochement par crédibilité
`n / (n + 12)`, écart borné à ±10 points de la valeur catalogue et à
l'intervalle `[0 %, 30 %]`.

### `GET /admin/waste-learning`

Facteurs actuellement appris, avec leur référence catalogue et les statistiques
qui les justifient.

**Auth :** Requise (admin) | **Guard :** `AdminGuard`

**Réponse :** `200 OK`
```json
{
  "factors": [
    {
      "material_id": "0253530f-f92a-470c-b201-4e0a46b0f50c",
      "pose_type": "diagonal",
      "skill_level": "intermediate",
      "factor_percent": 18.25,
      "baseline_percent": 15,
      "observed_percent": 23.42,
      "sample_size": 15,
      "computed_at": "2026-08-02T02:00:00.000Z"
    }
  ]
}
```

### `POST /admin/waste-learning/run`

Relance le calcul immédiatement (idempotent). Les cellules qui ne remplissent
plus les critères sont retirées.

**Auth :** Requise (admin) | **Guard :** `AdminGuard`

**Réponse :** `201 Created`
```json
{
  "observations": 412,
  "cells": 37,
  "by_status": {
    "learned": 6,
    "insufficient_volume": 28,
    "too_dispersed": 1,
    "no_change": 2
  },
  "removed": 1,
  "pending": [
    {
      "material_id": "0253530f-f92a-470c-b201-4e0a46b0f50c",
      "pose_type": "diagonal",
      "skill_level": "intermediate",
      "status": "insufficient_volume",
      "sample_size": 6,
      "raw_sample_size": 14,
      "organization_count": 2,
      "missing_observations": 2,
      "missing_organizations": 1
    }
  ],
  "computed_at": "2026-08-02T02:00:00.000Z"
}
```

`pending` liste les cellules qui n'ont **rien** publié, les plus proches du seuil
en tête. Elle n'est persistée nulle part : seules les cellules apprises entrent
en base. `raw_sample_size` est le volume collecté avant plafonnement par
organisation, `sample_size` ce qui pèse réellement. Un `missing_organizations`
non nul signifie qu'**aucun chantier supplémentaire des organisations déjà
présentes ne débloquera la cellule** : le plafond par organisation borne
l'échantillon.

---

## Codes d'erreur communs

| Code | Description |
|------|-------------|
| `400` | Requête invalide (validation échouée, propriétés inconnues) |
| `401` | Non authentifié (token Firebase manquant ou invalide, clé d'API invalide ou révoquée) |
| `403` | Non autorisé (pas propriétaire, pas admin, feature gate bloquée, SSO exigé — `SSO_REQUIRED`) |
| `404` | Ressource non trouvée |
| `409` | Conflit (email déjà utilisé, ressource dupliquée, rotation de clé en cours, contrat Enterprise déjà actif) |
| `429` | Rate limit dépassé (`RATE_LIMIT_EXCEEDED`) ou quota mensuel d'API atteint (`QUOTA_EXCEEDED`) — voir l'en-tête `Retry-After` |
| `500` | Erreur interne du serveur |
