export interface PlanDefinition {
  key: string;
  label: string;
  price: number;
  currency: string;
  interval: 'month';
  trial_days: number;
  /** Chemin de la clé de config contenant le price ID Stripe. */
  priceIdConfigKey: string;
}

/**
 * Grille artisan alignée sur le marché français du devis-facture (GTM-8, août 2026) :
 * Boby 14,99 €, Tolteck 19 €, Obat 29 €, EBP Bâtiment 29,25 €, BatiChiffrage 30 €+.
 * Les paliers valaient 50/100/200 € — 2 à 10× le marché — pour une couverture de sept
 * ouvrages de finition et un seul bloc de main-d'œuvre. Toute hausse doit être précédée
 * d'une extension réelle du périmètre chiffrable, pas l'inverse.
 */
export const PLANS: PlanDefinition[] = [
  {
    key: 'pro',
    label: 'Pro',
    price: 9.99,
    currency: 'EUR',
    interval: 'month',
    trial_days: 7,
    priceIdConfigKey: 'stripe.proPriceId',
  },
  {
    key: 'contractor_essentiel',
    label: 'Contractor Essentiel',
    price: 19,
    currency: 'EUR',
    interval: 'month',
    trial_days: 0,
    priceIdConfigKey: 'stripe.contractorEssentielPriceId',
  },
  {
    key: 'contractor_standard',
    label: 'Contractor Standard',
    price: 29,
    currency: 'EUR',
    interval: 'month',
    trial_days: 0,
    priceIdConfigKey: 'stripe.contractorStandardPriceId',
  },
  {
    key: 'contractor_premium',
    label: 'Contractor Premium',
    price: 49,
    currency: 'EUR',
    interval: 'month',
    trial_days: 0,
    priceIdConfigKey: 'stripe.contractorPremiumPriceId',
  },
];
