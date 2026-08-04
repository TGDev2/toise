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
  /**
   * `is_enabled` en base. Une gate à `false` est **gelée** : son code reste,
   * mais `FeatureGatesService.isFeatureAllowed` la refuse à tous les paliers,
   * palier maximal compris. Une gate gelée ne peut donc pas être vendue — c'est
   * l'invariant que garde `offer-catalogue.spec.ts`.
   */
  enabled: boolean;
  /** Migration qui fixe l'état courant (`is_enabled`). */
  since: string;
}

/**
 * Les 17 gates existantes, dans l'ordre de leur migration d'insertion, avec le
 * `min_tier` **effectif** après toutes les migrations ultérieures.
 */
export const KNOWN_FEATURE_GATES: KnownFeatureGate[] = [
  // 1711468800017 — socle Pro
  { key: 'cv_analysis', label: 'Analyse photo automatique', minTier: 'pro', enabled: false, since: '065' },
  { key: 'advanced_loss_factors', label: 'Facteurs de perte avancés', minTier: 'pro', enabled: true, since: '017' },
  { key: 'unlimited_projects', label: 'Projets illimités', minTier: 'pro', enabled: true, since: '017' },
  { key: 'budget_tracking', label: 'Suivi budgétaire', minTier: 'pro', enabled: true, since: '017' },
  // 1711468800020, éteinte en 027 (adaptateurs mock), rallumée en 036 (ManoMano + Leroy Merlin réels)
  { key: 'price_comparison', label: 'Comparateur de prix', minTier: 'pro', enabled: true, since: '036' },
  // 1711468800023 — `contractor` à l'origine, recalé sur `contractor_essentiel` par 037
  { key: 'export_devis', label: 'Export de devis PDF', minTier: 'contractor_essentiel', enabled: true, since: '037' },
  { key: 'client_management', label: 'Gestion de clients', minTier: 'contractor_essentiel', enabled: true, since: '037' },
  // 1711468800026
  { key: 'community_gallery', label: 'Galerie communautaire', minTier: 'free', enabled: true, since: '026' },
  // 1711468800037 — différenciateurs Standard/Premium, allumés un par un avec
  // leur code (039, 041, 054, 055), puis tous gelés par 065 (ADR 0001 D3)
  { key: 'site_tracking', label: 'Suivi de chantier', minTier: 'contractor_standard', enabled: false, since: '065' },
  { key: 'quote_reminders', label: 'Relances de devis', minTier: 'contractor_standard', enabled: false, since: '065' },
  { key: 'multi_user', label: 'Multi-utilisateurs', minTier: 'contractor_premium', enabled: false, since: '065' },
  // 1711468800045 / 049 / 053 / 056 / 060
  { key: 'invoicing', label: 'Facturation', minTier: 'contractor_essentiel', enabled: true, since: '045' },
  { key: 'logbook', label: 'Carnet du logement', minTier: 'pro', enabled: true, since: '049' },
  { key: 'eco_materials', label: 'Matériaux éco-responsables', minTier: 'pro', enabled: false, since: '065' },
  { key: 'cost_benchmark', label: 'Benchmark de coûts', minTier: 'pro', enabled: false, since: '065' },
  // 1711468800064 — DATA-5. Seule gate `free` en dehors de la galerie : la
  // clôture est l'unique source de DATA-3, DATA-4, COM-1 et PLAT-1, et un
  // volant de données qui ne tourne que sur les abonnés n'apprend rien des
  // chantiers qu'il cherche à décrire.
  { key: 'project_closeout', label: 'Clôture de chantier', minTier: 'free', enabled: true, since: '064' },
];

export const KNOWN_FEATURE_GATE_KEYS = KNOWN_FEATURE_GATES.map((gate) => gate.key);

/**
 * Les gates gelées par la migration 1711468800065 (ADR 0001 D2 et D3). Dérivé
 * de `enabled`, jamais redéclaré : une gate dégelée en base disparaît d'ici
 * dès que le miroir suit, et redevient vendable sans autre geste.
 */
export const FROZEN_FEATURE_GATE_KEYS = KNOWN_FEATURE_GATES.filter(
  (gate) => !gate.enabled,
).map((gate) => gate.key);

export type FeatureGateKey = string;

/**
 * Gates délibérément absentes des surfaces d'offre, avec leur raison. Une gate
 * qui n'est ni vendue par un plan ni listée ici fait échouer les tests : ne rien
 * décider devient impossible, décider de ne pas vendre reste possible.
 */
export const GATES_NOT_MARKETED: Record<string, string> = {
  community_gallery:
    "Gate `free` : la galerie est un canal d'acquisition ouvert à tous, pas un argument de palier. La vendre reviendrait à suggérer qu'elle se débloque.",

  // ── Gelées par 1711468800065 (ADR 0001) ────────────────────────────────
  // Le gel est un état, pas une étape : ces gates restent en base, leur code
  // reste dans git, et aucune surface ne les annonce tant qu'elles sont à
  // `is_enabled = false`. Les critères de dégel sont écrits à l'ADR §5.
  cv_analysis:
    "Gelée (ADR 0001 D2) : la précision de l'analyse photo n'a jamais été mesurée sur une seule photo réelle, et le service sort de la production. Dégel : erreur médiane sous 5 % sur 50 à 100 photos relevées au télémètre.",
  multi_user:
    "Gelée (ADR 0001 D3) : le multi-utilisateurs était vendu au palier Premium sans qu'aucun écran ne permette d'inviter qui que ce soit. Le modèle `organizations` reste en base, l'interface reste gelée.",
  cost_benchmark:
    "Gelée (ADR 0001 D3) : sans signal avant plusieurs centaines de chantiers clôturés, et aujourd'hui structurellement faussée — le benchmark exclut tout projet mêlant peinture murale et peinture plafond.",
  eco_materials:
    "Gelée (ADR 0001 D3, §3.1) : argument destiné au particulier, hors de la cible artisan de la V1. Le catalogue d'équivalences reste en base.",
  site_tracking:
    "Gelée (ADR 0001 D3) : différenciateur du palier Standard, que la réduction à un palier payant unique (D4) fait disparaître. Rien du parcours V1 — chiffrer, acheter, devis — n'en dépend.",
  quote_reminders:
    "Gelée (ADR 0001 D3) : même raison que `site_tracking`, et une relance automatique suppose un volume de devis envoyés qu'aucun compte n'a encore.",
};

export function getKnownGate(key: string): KnownFeatureGate | undefined {
  return KNOWN_FEATURE_GATES.find((gate) => gate.key === key);
}

/** Rang du palier dans la ladder : sert à vérifier qu'un plan ne vend rien au-dessus de lui. */
export function tierRank(tier: PlanTier): number {
  return TIER_ORDER.indexOf(tier);
}
