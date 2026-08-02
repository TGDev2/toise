import {
  type FeatureGateKey,
  type PlanTier,
  TIER_ORDER,
} from './feature-gates-catalogue';

export type { PlanTier };
export { TIER_ORDER };

/**
 * À qui s'adresse une offre. C'est la donnée qui manquait : sans elle, chaque
 * page réécrivait son propre découpage et la landing finissait par parler au
 * particulier dans son hero et à l'artisan dans sa section suivante.
 */
export const AUDIENCES = ['diy', 'artisan', 'enterprise'] as const;
export type Audience = (typeof AUDIENCES)[number];

export interface AudienceDefinition {
  /** Surface qui porte le récit de cette audience, et une seule. */
  landingPath: string;
  /** Intitulé de la strate sur /pricing. */
  title: string;
  /** Une phrase : à qui, pour quoi. */
  tagline: string;
  /** Libellé du lien de bascule affiché aux autres audiences. */
  switchLabel: string;
}

/**
 * Traduction en architecture de l'information de PRODUCT_STRATEGY §4.2
 * (« DIY en acquisition, artisan en revenu ») : une audience, une surface.
 * Tant que cette table n'existait pas, chaque page réinventait son découpage —
 * `/` ouvrait sur le bricoleur (« votre niveau de bricolage ») puis basculait
 * sans transition sur le tunnel artisan (« Devis PDF envoyé sur place »).
 */
export const AUDIENCE_DEFINITIONS: Record<Audience, AudienceDefinition> = {
  diy: {
    landingPath: '/',
    title: 'Vous rénovez chez vous',
    tagline:
      'Estimez vos matériaux au juste besoin et arrêtez de remplir la cave.',
    switchLabel: 'Vous rénovez chez vous ?',
  },
  artisan: {
    landingPath: '/artisans',
    title: 'Vous êtes du métier',
    tagline:
      'Chiffrez et envoyez un devis conforme depuis le chantier, pas le soir au bureau.',
    switchLabel: 'Vous êtes artisan ?',
  },
  enterprise: {
    landingPath: '/pricing#enterprise',
    title: 'Enseignes et grands comptes',
    tagline:
      'Intégrez l’estimation Chiffréo à vos propres outils, sous contrat annuel.',
    switchLabel: 'Vous êtes une enseigne ?',
  },
};

/**
 * Pourquoi une ligne d'offre n'est pas adossée à une gate. Ensemble fermé
 * volontairement : sans lui, `gateKey: null` redeviendrait la porte par laquelle
 * une fonctionnalité inexistante entre dans une carte tarifaire.
 */
export type NonGateReason =
  /** Volume autorisé, pas une capacité (« 2 projets actifs »). */
  | 'quota'
  /** Socle produit disponible à tous les paliers, jamais gaté. */
  | 'socle'
  /** Renvoi au palier inférieur (« Tout Essentiel + »). */
  | 'heritage'
  /** Engagement humain (support prioritaire, accompagnement). */
  | 'support'
  /** Clause contractuelle (SLA, environnement dédié, facturation annuelle). */
  | 'contrat';

export interface PlanFeature {
  label: string;
  /** Gate de `feature_gates` derrière la promesse, ou `null` si ce n'en est pas une. */
  gateKey: FeatureGateKey | null;
  /** Obligatoire dès lors que `gateKey` vaut `null`. */
  nonGateReason?: NonGateReason;
}

export interface OfferPlan {
  key:
    | 'free'
    | 'pro'
    | 'contractor_essentiel'
    | 'contractor_standard'
    | 'contractor_premium'
    | 'enterprise';
  /**
   * Clé correspondante dans GET /subscriptions/plans (résolue en price_id
   * Stripe à l'exécution pour un utilisateur connecté). Absente pour le plan
   * gratuit et pour l'enterprise (contrat annuel, hors Stripe). Les prix
   * affichés ici sont indicatifs : le checkout n'envoie jamais un montant,
   * uniquement un price_id fourni par l'API.
   */
  apiPlanKey?:
    | 'pro'
    | 'contractor_essentiel'
    | 'contractor_standard'
    | 'contractor_premium';
  tier: PlanTier;
  audience: Audience;
  name: string;
  priceLabel: string;
  /** `null` pour une offre sur devis : exclue des agrégats de prix (JSON-LD). */
  priceNumber: number | null;
  period: '' | '/mois';
  description: string;
  features: PlanFeature[];
  highlighted?: boolean;
  trialDays?: number;
  ctaLabel: string;
}

export const OFFER_PLANS: OfferPlan[] = [
  {
    key: 'free',
    tier: 'free',
    audience: 'diy',
    name: 'Gratuit',
    priceLabel: '0 €',
    priceNumber: 0,
    period: '',
    description: 'Pour estimer vos premiers chantiers sans engagement.',
    features: [
      { label: '2 projets actifs', gateKey: null, nonGateReason: 'quota' },
      {
        label: 'Estimation complète des quantités',
        gateKey: null,
        nonGateReason: 'socle',
      },
      {
        label: 'Liste d’achats avec export PDF',
        gateKey: null,
        nonGateReason: 'socle',
      },
    ],
    ctaLabel: 'Commencer gratuitement',
  },
  {
    key: 'pro',
    apiPlanKey: 'pro',
    tier: 'pro',
    audience: 'diy',
    name: 'Pro',
    priceLabel: '9,99 €',
    priceNumber: 9.99,
    period: '/mois',
    description: 'Pour les particuliers qui enchaînent les projets.',
    features: [
      { label: 'Projets illimités', gateKey: 'unlimited_projects' },
      {
        label: 'Analyse photo automatique des dimensions',
        gateKey: 'cv_analysis',
      },
      {
        label: 'Facteurs de perte avancés pour plus de précision',
        gateKey: 'advanced_loss_factors',
      },
      { label: 'Suivi budgétaire', gateKey: 'budget_tracking' },
      {
        // Volontairement sans nom d'enseigne : les adaptateurs ManoMano et
        // Leroy Merlin existent mais sont derrière `MANOMANO_ENABLED` /
        // `LEROY_MERLIN_ENABLED`, à `false` par défaut et sans flux configuré
        // (.env.example). Citer les marques promettrait ce qu'un déploiement
        // non provisionné ne tient pas.
        label: 'Comparateur de prix entre enseignes',
        gateKey: 'price_comparison',
      },
      {
        label: 'Repérage des matériaux éco-responsables',
        gateKey: 'eco_materials',
      },
      {
        label: 'Carnet du logement : l’historique de vos pièces',
        gateKey: 'logbook',
      },
      {
        label: 'Votre budget situé face aux chantiers comparables',
        gateKey: 'cost_benchmark',
      },
    ],
    highlighted: true,
    trialDays: 7,
    ctaLabel: 'Essayer 7 jours gratuits',
  },
  {
    key: 'contractor_essentiel',
    apiPlanKey: 'contractor_essentiel',
    tier: 'contractor_essentiel',
    audience: 'artisan',
    name: 'Essentiel',
    priceLabel: '50 €',
    priceNumber: 50,
    period: '/mois',
    description: 'Les indispensables du devis professionnel.',
    features: [
      {
        label: 'Tout Pro, projets illimités compris',
        gateKey: null,
        nonGateReason: 'heritage',
      },
      {
        label: 'Devis PDF conformes (TVA, HT/TTC, mentions)',
        gateKey: 'export_devis',
      },
      {
        label: 'Fichier clients et historique de chantiers',
        gateKey: 'client_management',
      },
      {
        label: 'Facturation : du devis accepté à la facture numérotée',
        gateKey: 'invoicing',
      },
    ],
    ctaLabel: 'Choisir Essentiel',
  },
  {
    key: 'contractor_standard',
    apiPlanKey: 'contractor_standard',
    tier: 'contractor_standard',
    audience: 'artisan',
    name: 'Standard',
    priceLabel: '100 €',
    priceNumber: 100,
    period: '/mois',
    description: 'Le quotidien d’un artisan organisé.',
    features: [
      { label: 'Tout Essentiel +', gateKey: null, nonGateReason: 'heritage' },
      {
        label: 'Suivi de chantier : jalons, statuts et dates',
        gateKey: 'site_tracking',
      },
      {
        label: 'Relances automatiques des devis sans réponse',
        gateKey: 'quote_reminders',
      },
      { label: 'Support prioritaire', gateKey: null, nonGateReason: 'support' },
    ],
    highlighted: true,
    ctaLabel: 'Choisir Standard',
  },
  {
    key: 'contractor_premium',
    apiPlanKey: 'contractor_premium',
    tier: 'contractor_premium',
    audience: 'artisan',
    name: 'Premium',
    priceLabel: '200 €',
    priceNumber: 200,
    period: '/mois',
    description: 'Pour les équipes et les gros volumes.',
    features: [
      { label: 'Tout Standard +', gateKey: null, nonGateReason: 'heritage' },
      {
        label: 'Multi-utilisateurs : votre équipe sur le même compte',
        gateKey: 'multi_user',
      },
      {
        // La gate `public_api` couvre aussi le widget embarquable : c'est elle
        // que `widget-config.controller.ts` exige via `PUBLIC_API_FEATURE_KEY`.
        // Le widget n'est donc pas une exclusivité enterprise, et le vendre
        // comme telle serait faux.
        label: 'API publique et widget d’estimation embarquable',
        gateKey: 'public_api',
      },
      {
        label: 'Accompagnement dédié',
        gateKey: null,
        nonGateReason: 'support',
      },
    ],
    ctaLabel: 'Choisir Premium',
  },
  {
    key: 'enterprise',
    tier: 'enterprise',
    audience: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'Sur devis',
    // Aucun prix public : l'offre est portée par `enterprise_agreements`
    // (contrat annuel rattaché à l'organisation), pas par un abonnement Stripe.
    // `null` la tient hors des agrégats de prix du JSON-LD.
    priceNumber: null,
    period: '',
    description:
      'Pour les enseignes et les réseaux qui intègrent Chiffréo à leur propre système.',
    features: [
      { label: 'Tout Premium +', gateKey: null, nonGateReason: 'heritage' },
      {
        label: 'SSO SAML ou OIDC avec votre annuaire d’entreprise',
        gateKey: 'enterprise_sso',
      },
      {
        label: 'Contrat annuel et engagements de SLA',
        gateKey: null,
        nonGateReason: 'contrat',
      },
      {
        label: 'Environnement dédié',
        gateKey: null,
        nonGateReason: 'contrat',
      },
    ],
    ctaLabel: 'Nous contacter',
  },
];

/** Destinataire du CTA enterprise : adresse déjà publiée en mentions légales et CGV. */
export const ENTERPRISE_CONTACT_EMAIL = 'contact@chiffreo.fr';

export function plansForAudience(audience: Audience): OfferPlan[] {
  return OFFER_PLANS.filter((plan) => plan.audience === audience);
}

export function getPlan(key: OfferPlan['key']): OfferPlan {
  const plan = OFFER_PLANS.find((candidate) => candidate.key === key);
  if (!plan) throw new Error(`Plan inconnu : ${key}`);
  return plan;
}
