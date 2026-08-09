import { SubscriptionTier } from '../users/entities/user.entity';

export interface PlanDefinition {
  key: string;
  label: string;
  /** Montant facturé **par période**, dans `currency`. Voir `interval`. */
  price: number;
  currency: string;
  interval: 'year';
  /**
   * Palier accordé par ce plan. Porté ici plutôt que déduit à l'arrivée : la
   * correspondance clé → palier était écrite deux fois — dans le constructeur
   * de `SubscriptionsService` et dans `AdminAnalyticsService` — et deux copies
   * d'un même fait finissent par diverger (leçon 15).
   */
  tier: SubscriptionTier;
  trial_days: number;
  /** Chemin de la clé de config contenant le price ID Stripe. */
  priceIdConfigKey: string;
}

/**
 * Une offre payante, une seule, en **annuel uniquement** (ADR 0002 §D4).
 *
 * Le chiffrage est gratuit et illimité : il n'y a rien à facturer pour lui.
 * Ce qui se paie est la conformité — devis PDF opposable, fichier clients,
 * facturation numérotée. La périodicité annuelle est le levier contre le
 * churn : elle ne laisse la décision de partir se prendre qu'une fois par an,
 * ce qui fait passer la durée de vie moyenne d'environ 20 à environ 40 mois.
 *
 * Historique des retraits, pour que personne ne les recrée :
 * - `pro` (9,99 €/mois, particulier) — retiré par E3-1 avec la landing DIY ;
 * - `contractor_standard` (29 €/mois) et `contractor_premium` (49 €/mois) —
 *   retirés ici. Ils n'ont jamais été vendus, et les variables d'environnement
 *   qui les portaient ont disparu de `configuration.ts` et de `.env.example` ;
 * - la périodicité mensuelle elle-même. `interval` est typé sur le seul
 *   littéral `'year'` : rétablir du mensuel demande de toucher ce type, donc
 *   de relire tout ce qui en dépend, plutôt que de changer une valeur.
 */
export const PLANS: PlanDefinition[] = [
  {
    key: 'contractor_essentiel',
    label: 'Chiffréo Pro',
    price: 279,
    currency: 'EUR',
    interval: 'year',
    tier: SubscriptionTier.CONTRACTOR_ESSENTIEL,
    // Aucun essai, et c'est une décision, pas un oubli (E3-3).
    //
    // L'essai *existe déjà* : c'est le palier gratuit, dont l'ADR 0002 §D4 dit
    // qu'il est « le protocole de démonstration ». Un essai de sept jours ne
    // démontrerait rien de plus du calcul, et ce qu'il démontrerait — le devis
    // conforme — produit des documents opposables que l'artisan perdrait à
    // l'expiration.
    //
    // Surtout, un essai désarmerait la garantie qui le remplace : un essai ne
    // prélève rien, donc ne rembourse rien. Empiler « 7 jours d'essai » et
    // « 30 jours satisfait ou remboursé » annonce deux réponses à la même
    // objection, dont la première rend la seconde inapplicable au moment exact
    // où elle rassure.
    //
    // Le mécanisme, lui, reste en place : Stripe peut encore ouvrir un
    // abonnement en `trialing` (geste manuel au dashboard, coupon), et le code
    // continue de le traiter. Ce qui disparaît est la demande d'essai, pas la
    // capacité à en recevoir un.
    trial_days: 0,
    priceIdConfigKey: 'stripe.contractorEssentielPriceId',
  },
];

/**
 * Palier souscrit par défaut quand un checkout n'envoie aucun `price_id`, et
 * seul palier dont le prix sert de référence hors checkout (e-mails de cycle
 * de vie, crédit de parrainage).
 */
export const PLAN_DEFAULT_KEY = 'contractor_essentiel';

/**
 * Fenêtre du « satisfait ou remboursé », en jours (ADR 0002 §D4).
 *
 * Volontairement une constante et **pas** une variable d'environnement, à la
 * différence de `STRIPE_PAST_DUE_GRACE_DAYS` : ce délai est une promesse
 * publiée dans les CGV et sur la page tarifs. Une valeur réglable par
 * déploiement finirait par diverger du texte qui l'annonce, et c'est le genre
 * d'écart qu'on ne découvre qu'au premier litige.
 */
export const REFUND_WINDOW_DAYS = 30;

/**
 * Combien de jours avant l'échéance annuelle l'abonné est prévenu de la
 * reconduction. Sur un prélèvement unique de 279 €, un préavis n'est pas une
 * politesse : c'est ce qui évite qu'une reconduction tacite se transforme en
 * demande de remboursement, voire en contestation bancaire.
 */
export const RENEWAL_NOTICE_DAYS = 30;

/**
 * Le prix ramené au mois, pour les seules grandeurs qui se raisonnent au mois.
 *
 * `price` porte un montant **par période**, et la période est désormais
 * l'année. Deux consommateurs le lisaient comme un montant mensuel et se
 * seraient trompés d'un facteur douze en silence :
 *
 * - le MRR du tableau de bord d'administration, qui aurait affiché 279 € de
 *   revenu mensuel récurrent par abonné ;
 * - le crédit de parrainage, qui promet « 1 mois offert » et aurait offert
 *   l'année entière — 279 € rendus pour un filleul à 279 €.
 *
 * Aucun test ne pouvait le voir : tous vérifiaient la cohérence avec `PLANS`,
 * aucun la grandeur (leçon 18 — un champ qui porte deux sens).
 */
export function monthlyEquivalentEuros(plan: PlanDefinition): number {
  return plan.price / MONTHS_PER_INTERVAL[plan.interval];
}

/**
 * Périodicité en toutes lettres, pour tout texte qui affiche un montant.
 *
 * Un prix sans sa période n'est pas une information, c'est un piège : le modèle
 * d'e-mail de fin d'essai écrivait `/mois` en dur et aurait annoncé
 * « 279 €/mois » à quelqu'un sur le point d'être prélevé de 279 € par an.
 */
export function billingPeriodLabel(plan: PlanDefinition): string {
  return INTERVAL_LABELS[plan.interval];
}

/**
 * Les deux tables sont indexées sur `PlanDefinition['interval']` : rétablir une
 * périodicité mensuelle ne compilera pas tant que les deux ne l'auront pas.
 * C'est le contraire du défaut qu'on corrige ici — une périodicité changée dans
 * un fichier et devinée dans trois autres.
 */
const MONTHS_PER_INTERVAL: Record<PlanDefinition['interval'], number> = {
  year: 12,
};

const INTERVAL_LABELS: Record<PlanDefinition['interval'], string> = {
  year: 'par an',
};

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
