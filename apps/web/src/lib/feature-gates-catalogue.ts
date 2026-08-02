/**
 * Miroir côté web des gates réellement seedées en base par les migrations de
 * `apps/api/src/migrations/`.
 *
 * Pourquoi un miroir plutôt qu'un appel API : `GET /feature-gates` est derrière
 * `FirebaseAuthGuard` (apps/api/src/feature-gates/feature-gates.controller.ts) et
 * les pages d'offre (`/`, `/artisans`, `/pricing`) sont publiques et statiques.
 * Les faire dépendre d'un endpoint authentifié dégraderait le SEO pour supprimer
 * un fichier.
 *
 * Ce que ce fichier achète : avant lui, l'offre était décrite en prose libre,
 * réécrite page par page, sans lien avec ce que la base applique réellement — le
 * palier Standard vendait ainsi deux fonctionnalités qui n'ont jamais existé
 * pendant que `site_tracking` et `quote_reminders`, livrées et actives, restaient
 * invisibles. Le miroir ne supprime pas le risque de dérive, il le concentre en
 * **un seul endroit nommé**, et `src/__tests__/offer-catalogue.spec.ts` le rend
 * bruyant : toute gate ajoutée en base sans décision d'offre fait rougir la suite.
 *
 * ⚠️ À mettre à jour dans le même lot que toute migration touchant
 * `feature_gates` (cf. CONTRIBUTING.md).
 */

/** Paliers d'abonnement, alignés sur `SubscriptionTier` (apps/api/src/users/entities/user.entity.ts). */
export const TIER_ORDER = [
  'free',
  'pro',
  'contractor_essentiel',
  'contractor_standard',
  'contractor_premium',
  'enterprise',
] as const;

export type PlanTier = (typeof TIER_ORDER)[number];

export interface KnownFeatureGate {
  /** `feature_key` tel qu'inséré en base. */
  key: string;
  /** `label_fr` de la migration — sert de garde-fou de relecture, pas d'affichage. */
  label: string;
  minTier: PlanTier;
  /** Migration qui fixe l'état courant (`is_enabled`). */
  since: string;
}

/**
 * Les 17 gates existantes, dans l'ordre de leur migration d'insertion, avec le
 * `min_tier` **effectif** après toutes les migrations ultérieures.
 */
export const KNOWN_FEATURE_GATES: KnownFeatureGate[] = [
  // 1711468800017 — socle Pro
  { key: 'cv_analysis', label: 'Analyse photo automatique', minTier: 'pro', since: '017' },
  { key: 'advanced_loss_factors', label: 'Facteurs de perte avancés', minTier: 'pro', since: '017' },
  { key: 'unlimited_projects', label: 'Projets illimités', minTier: 'pro', since: '017' },
  { key: 'budget_tracking', label: 'Suivi budgétaire', minTier: 'pro', since: '017' },
  // 1711468800020, éteinte en 027 (adaptateurs mock), rallumée en 036 (ManoMano + Leroy Merlin réels)
  { key: 'price_comparison', label: 'Comparateur de prix', minTier: 'pro', since: '036' },
  // 1711468800023 — `contractor` à l'origine, recalé sur `contractor_essentiel` par 037
  { key: 'export_devis', label: 'Export de devis PDF', minTier: 'contractor_essentiel', since: '037' },
  { key: 'client_management', label: 'Gestion de clients', minTier: 'contractor_essentiel', since: '037' },
  // 1711468800026
  { key: 'community_gallery', label: 'Galerie communautaire', minTier: 'free', since: '026' },
  // 1711468800037 — différenciateurs Standard/Premium, allumés un par un avec leur code
  { key: 'site_tracking', label: 'Suivi de chantier', minTier: 'contractor_standard', since: '039' },
  { key: 'quote_reminders', label: 'Relances de devis', minTier: 'contractor_standard', since: '041' },
  { key: 'multi_user', label: 'Multi-utilisateurs', minTier: 'contractor_premium', since: '054' },
  { key: 'public_api', label: 'API publique', minTier: 'contractor_premium', since: '055' },
  // 1711468800045 / 049 / 053 / 056 / 060
  { key: 'invoicing', label: 'Facturation', minTier: 'contractor_essentiel', since: '045' },
  { key: 'logbook', label: 'Carnet du logement', minTier: 'pro', since: '049' },
  { key: 'eco_materials', label: 'Matériaux éco-responsables', minTier: 'pro', since: '053' },
  { key: 'enterprise_sso', label: 'Authentification SSO', minTier: 'enterprise', since: '056' },
  { key: 'cost_benchmark', label: 'Benchmark de coûts', minTier: 'pro', since: '060' },
];

export const KNOWN_FEATURE_GATE_KEYS = KNOWN_FEATURE_GATES.map((gate) => gate.key);

export type FeatureGateKey = string;

/**
 * Gates délibérément absentes des surfaces d'offre, avec leur raison. Une gate
 * qui n'est ni vendue par un plan ni listée ici fait échouer les tests : ne rien
 * décider devient impossible, décider de ne pas vendre reste possible.
 */
export const GATES_NOT_MARKETED: Record<string, string> = {
  community_gallery:
    "Gate `free` : la galerie est un canal d'acquisition ouvert à tous, pas un argument de palier. La vendre reviendrait à suggérer qu'elle se débloque.",
};

export function getKnownGate(key: string): KnownFeatureGate | undefined {
  return KNOWN_FEATURE_GATES.find((gate) => gate.key === key);
}

/** Rang du palier dans la ladder : sert à vérifier qu'un plan ne vend rien au-dessus de lui. */
export function tierRank(tier: PlanTier): number {
  return TIER_ORDER.indexOf(tier);
}
