export type PlanTier = 'free' | 'pro' | 'contractor';

export interface PricingPlan {
  key:
    | 'free'
    | 'pro'
    | 'contractor_essentiel'
    | 'contractor_standard'
    | 'contractor_premium';
  /**
   * Clé correspondante dans GET /subscriptions/plans (résolue en price_id
   * Stripe à l'exécution pour un utilisateur connecté). Absente pour le plan
   * gratuit. Les prix affichés ici sont indicatifs : le checkout n'envoie
   * jamais un montant, uniquement un price_id fourni par l'API.
   */
  apiPlanKey?:
    | 'pro'
    | 'contractor_essentiel'
    | 'contractor_standard'
    | 'contractor_premium';
  tier: PlanTier;
  name: string;
  priceLabel: string;
  priceNumber: number;
  period: '' | '/mois';
  description: string;
  features: string[];
  highlighted?: boolean;
  trialDays?: number;
  ctaLabel: string;
}

export const FREE_PLAN: PricingPlan = {
  key: 'free',
  tier: 'free',
  name: 'Gratuit',
  priceLabel: '0 €',
  priceNumber: 0,
  period: '',
  description: 'Pour estimer vos premiers chantiers sans engagement.',
  features: [
    '2 projets actifs',
    'Estimation complète des quantités',
    'Liste d’achats avec export PDF',
  ],
  ctaLabel: 'Commencer gratuitement',
};

export const PRO_PLAN: PricingPlan = {
  key: 'pro',
  apiPlanKey: 'pro',
  tier: 'pro',
  name: 'Pro',
  priceLabel: '9,99 €',
  priceNumber: 9.99,
  period: '/mois',
  description: 'Pour les particuliers qui enchaînent les projets.',
  features: [
    'Projets illimités',
    'Analyse photo automatique des dimensions',
    'Facteurs de perte avancés pour plus de précision',
    'Suivi budgétaire',
  ],
  highlighted: true,
  trialDays: 7,
  ctaLabel: 'Essayer 7 jours gratuits',
};

export const CONTRACTOR_PLANS: PricingPlan[] = [
  {
    key: 'contractor_essentiel',
    apiPlanKey: 'contractor_essentiel',
    tier: 'contractor',
    name: 'Essentiel',
    priceLabel: '50 €',
    priceNumber: 50,
    period: '/mois',
    description: 'Les indispensables du devis professionnel.',
    features: [
      'Projets illimités',
      'Export de devis PDF',
      'Gestion de clients',
      'Toutes les fonctionnalités Pro',
    ],
    ctaLabel: 'Choisir Essentiel',
  },
  {
    key: 'contractor_standard',
    apiPlanKey: 'contractor_standard',
    tier: 'contractor',
    name: 'Standard',
    priceLabel: '100 €',
    priceNumber: 100,
    period: '/mois',
    description: 'Le quotidien d’un artisan organisé.',
    features: [
      'Tout Essentiel +',
      'Modèles de devis personnalisés',
      'Historique clients avancé',
      'Support prioritaire',
    ],
    highlighted: true,
    ctaLabel: 'Choisir Standard',
  },
  {
    key: 'contractor_premium',
    apiPlanKey: 'contractor_premium',
    tier: 'contractor',
    name: 'Premium',
    priceLabel: '200 €',
    priceNumber: 200,
    period: '/mois',
    description: 'Pour les équipes et les gros volumes.',
    features: [
      'Tout Standard +',
      'Multi-utilisateurs',
      "API d'intégration",
      'Accompagnement dédié',
    ],
    ctaLabel: 'Choisir Premium',
  },
];

export const ALL_PAID_PLANS: PricingPlan[] = [PRO_PLAN, ...CONTRACTOR_PLANS];

/** Aperçu 3 cartes affiché sur la landing (déplacé depuis app/page.tsx). */
export const LANDING_PLANS = [
  {
    name: 'Gratuit',
    price: '0 €',
    period: '',
    features: [
      '2 projets actifs',
      'Estimation complète des quantités',
      'Liste d’achats avec export PDF',
    ],
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '9,99 €',
    period: '/mois',
    features: [
      'Projets illimités',
      'Analyse photo et suivi de budget',
      'Essai gratuit de 7 jours',
    ],
    highlighted: true,
  },
  {
    name: 'Contractor',
    price: 'dès 50 €',
    period: '/mois',
    features: [
      'Devis PDF conformes (TVA, mentions)',
      'Fichier clients intégré',
      'Pensé pour chiffrer chez le client',
    ],
    highlighted: false,
  },
];
