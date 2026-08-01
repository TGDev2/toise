// Source unique de vérité pour les noms d'événements analytics : évite les
// typos silencieuses entre les call sites internes et les événements envoyés
// par le front (React) via POST /analytics/events ou /public/analytics/events.
export enum AnalyticsEventName {
  // Funnel DATA-1 : visite calculateur → compte → 1re estimation → liste → checkout
  CALCULATOR_VIEWED = 'calculator_viewed',
  ACCOUNT_CREATED = 'account_created',
  ESTIMATE_CREATED = 'estimate_created',
  SHOPPING_LIST_GENERATED = 'shopping_list_generated',
  CHECKOUT_STARTED = 'checkout_started',

  // Événements existants (call sites internes)
  EMAIL_CAPTURE = 'email_capture',
  SUBSCRIPTION_STARTED = 'subscription_started',
  PAYMENT_FAILED = 'payment_failed',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',
  BUDGET_TRACKED = 'budget_tracked',
  REFERRAL_REDEEMED = 'referral_redeemed',
  REFERRAL_CREDIT_GRANTED = 'referral_credit_granted',

  // Événements existants (envoyés uniquement depuis le client, en l'état authentifié)
  PAYWALL_SHOWN = 'paywall_shown',
  PAYWALL_CLICKED = 'paywall_clicked',
  PRICING_CTA_CLICKED = 'pricing_cta_clicked',
  CONTRACTOR_PLAN_CLICKED = 'contractor_plan_clicked',
}
