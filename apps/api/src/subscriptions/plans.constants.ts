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
 *
 * Le palier `pro` (9,99 €/mois, particulier) a été retiré par E3-1 (ADR 0002
 * §D4) avec la landing DIY : le chiffrage est gratuit, seule la conformité est
 * payante. `PLAN_DEFAULT_KEY` ci-dessous désigne le seul palier qu'un checkout
 * sans `price_id` explicite peut souscrire — c'est `pro` qui tenait ce rôle.
 */
export const PLANS: PlanDefinition[] = [
  {
    key: 'contractor_essentiel',
    label: 'Contractor Essentiel',
    price: 19,
    currency: 'EUR',
    interval: 'month',
    // Palier payant unique de la V1 (ADR 0001 §D4). Les paliers contractor
    // n'avaient aucun essai quand ils étaient trois à 50/100/200 € — un essai
    // n'a de sens que sur l'offre qu'on demande vraiment à un artisan
    // d'essayer sur un chantier.
    trial_days: 7,
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

/**
 * Palier souscrit par défaut quand un checkout n'envoie aucun `price_id`, et
 * seul palier dont le prix sert de référence hors checkout (e-mails de fin
 * d'essai, crédit de parrainage).
 *
 * Ce rôle revenait à `pro` : c'était le palier d'entrée du particulier. Il n'y
 * a plus qu'une audience et qu'un palier payant.
 */
export const PLAN_DEFAULT_KEY = 'contractor_essentiel';

/**
 * Le palier par défaut doit exister : un `PLANS.find(...)!` sur une clé absente
 * n'échoue pas à la compilation, il jette à la construction du module — donc au
 * démarrage de l'API, et sur tous les modules qui en dépendent à la fois.
 */
export function getDefaultPlan(): PlanDefinition {
  const plan = PLANS.find((candidate) => candidate.key === PLAN_DEFAULT_KEY);
  if (!plan) {
    throw new Error(
      `Palier par défaut absent de PLANS : ${PLAN_DEFAULT_KEY}. Une offre a été retirée sans recaler PLAN_DEFAULT_KEY.`,
    );
  }
  return plan;
}
