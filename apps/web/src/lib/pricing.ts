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
    // « Vous êtes du métier » laissait entendre tous les métiers. Le moteur ne
    // chiffre que la finition (voir COVERED_TRADES) : l'accroche doit le dire
    // avant le prix, pas après la souscription.
    title: 'Vous êtes des métiers de finition',
    tagline:
      'Peintre, carreleur, plaquiste, solier : chiffrez et envoyez un devis conforme depuis le chantier, pas le soir au bureau.',
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
  /**
   * `contractor_premium` a existé ici jusqu'au gel de l'ADR 0001 (D3) : ses deux
   * lignes — multi-utilisateurs et API publique — étaient ses seuls
   * différenciateurs, et le palier ne justifiait plus 49 € sans elles. Le rang
   * reste dans `TIER_ORDER` : des comptes peuvent le porter en base.
   */
  key:
    | 'free'
    | 'pro'
    | 'contractor_essentiel'
    | 'contractor_standard'
    | 'enterprise';
  /**
   * Clé correspondante dans GET /subscriptions/plans (résolue en price_id
   * Stripe à l'exécution pour un utilisateur connecté). Absente pour le plan
   * gratuit et pour l'enterprise (contrat annuel, hors Stripe). Les prix
   * affichés ici sont indicatifs : le checkout n'envoie jamais un montant,
   * uniquement un price_id fourni par l'API.
   */
  apiPlanKey?: 'pro' | 'contractor_essentiel' | 'contractor_standard';
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

/**
 * Plafond du marché français du devis-facture artisan, relevé en août 2026 :
 * Boby 14,99 €, Tolteck 19 €, Obat 29 €, EBP Bâtiment 29,25 €, Costructor gratuit,
 * BatiChiffrage 30 €+ (et 80 000 travaux unitaires en bibliothèque).
 *
 * Chiffréo couvre sept ouvrages de finition et un bloc de main-d'œuvre : une
 * couverture partielle n'autorise pas un premium de prix. Le palier d'entrée doit
 * rester sous ce plafond ; il valait 50 € avant GTM-8. Les paliers supérieurs
 * peuvent le dépasser, mais seulement en portant des capacités que ces outils ne
 * vendent pas à ce prix (multi-utilisateurs, API, widget).
 *
 * Ces trois capacités étant gelées par l'ADR 0001 (D3), plus aucun palier
 * artisan ne peut aujourd'hui dépasser le plafond : le palier Premium à 49 € a
 * été retiré avec elles.
 */
export const GENERALIST_MARKET_CEILING_EUR = 30;

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
      {
        label: 'Clôture de chantier : vos restes et ce qui se rend encore',
        gateKey: 'project_closeout',
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
        label: 'Carnet du logement : l’historique de vos pièces',
        gateKey: 'logbook',
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
    priceLabel: '19 €',
    priceNumber: 19,
    period: '/mois',
    description:
      'Les indispensables du devis professionnel, sur les ouvrages de finition.',
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
    priceLabel: '29 €',
    priceNumber: 29,
    period: '/mois',
    description: 'Le quotidien d’un artisan organisé.',
    // Le suivi de chantier et les relances de devis, ses deux différenciateurs,
    // sont gelés par l'ADR 0001 (D3) : le palier ne tient plus que par son
    // engagement de support en attendant sa fusion avec Essentiel (D4, E3-4).
    features: [
      { label: 'Tout Essentiel +', gateKey: null, nonGateReason: 'heritage' },
      { label: 'Support prioritaire', gateKey: null, nonGateReason: 'support' },
    ],
    highlighted: true,
    ctaLabel: 'Choisir Standard',
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
    // Le SSO, seule capacité propre de ce palier, est gelé par l'ADR 0001 (D3) :
    // ne restent que des clauses de contrat. Le palier lui-même disparaît des
    // surfaces en E3-4.
    features: [
      { label: 'Tout Standard +', gateKey: null, nonGateReason: 'heritage' },
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
