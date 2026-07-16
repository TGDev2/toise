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
    price: 50,
    currency: 'EUR',
    interval: 'month',
    trial_days: 0,
    priceIdConfigKey: 'stripe.contractorEssentielPriceId',
  },
  {
    key: 'contractor_standard',
    label: 'Contractor Standard',
    price: 100,
    currency: 'EUR',
    interval: 'month',
    trial_days: 0,
    priceIdConfigKey: 'stripe.contractorStandardPriceId',
  },
  {
    key: 'contractor_premium',
    label: 'Contractor Premium',
    price: 200,
    currency: 'EUR',
    interval: 'month',
    trial_days: 0,
    priceIdConfigKey: 'stripe.contractorPremiumPriceId',
  },
];
