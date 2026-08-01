# Référence API REST — Chiffréo

**Base URL :** `http://localhost:3001/api/v1`

**Authentification :** Firebase ID Token dans le header `Authorization: Bearer <token>`

**Rate limiting :**
- Général : 100 requêtes/minute
- Auth (register, forgot-password) : 5 requêtes/15 minutes

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

**Auth :** Non requise | **Rate limit :** 5 req/15min

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

**Réponses :** `200 OK` | `403 Forbidden`

---

### `POST /projects/:id/shopping-list/budget-summary/finalize`

Finaliser le suivi budgétaire (marquer les prix réels).

**Auth :** Requise (propriétaire uniquement) | **Feature gate :** `budget_tracking` (Pro+)

**Réponses :** `201 Created` | `403 Forbidden`

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
    ]
  },
  "error_message": null
}
```

**Status possibles :** `pending`, `processing`, `completed`, `failed`

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
  "labor_type": "hourly",
  "labor_hourly_rate": 45,
  "labor_estimated_hours": 16,
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
| `labor_type` | enum | oui | `hourly`, `flat` |
| `labor_hourly_rate` | number | non | Min 0 (requis si `hourly`) |
| `labor_estimated_hours` | number | non | Min 0 (requis si `hourly`) |
| `labor_flat_amount` | number | non | Min 0 (requis si `flat`) |
| `material_margin_percent` | number | oui | 0-100 |
| `discount_percent` | number | non | 0-100 |
| `payment_terms` | string | non | — |
| `validity_days` | number | non | 1-365 |
| `tva_rate` | number | non | 0-100 |
| `notes` | string | non | — |

**Réponses :** `201 Created` | `403 Forbidden`

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

## Codes d'erreur communs

| Code | Description |
|------|-------------|
| `400` | Requête invalide (validation échouée, propriétés inconnues) |
| `401` | Non authentifié (token Firebase manquant ou invalide) |
| `403` | Non autorisé (pas propriétaire, pas admin, feature gate bloquée) |
| `404` | Ressource non trouvée |
| `409` | Conflit (email déjà utilisé, ressource dupliquée) |
| `429` | Rate limit dépassé |
| `500` | Erreur interne du serveur |
