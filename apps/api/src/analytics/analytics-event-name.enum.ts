// Source unique de vérité pour les noms d'événements analytics : évite les
// typos silencieuses entre les call sites internes et les événements envoyés
// par le front (React) via POST /analytics/events ou /public/analytics/events.
export enum AnalyticsEventName {
  // Funnel DATA-1 : visite calculateur → compte → 1re estimation → liste → checkout
  CALCULATOR_VIEWED = 'calculator_viewed',
  // GTM-10 : visite du contrôle de devis. Distinct de `calculator_viewed` — les
  // deux surfaces partagent le moteur mais pas l'intention (préparer un achat vs
  // contrôler une affirmation), et c'est justement l'écart entre les deux taux de
  // conversion qui dira si l'hypothèse « le demandeur de devis bascule vers le
  // parcours DIY » tient. Les confondre rendrait la question indécidable.
  QUOTE_CHECK_VIEWED = 'quote_check_viewed',
  // Entonnoir de revenu V1 (BACKLOG_V1) : visite calculateur → calcul public →
  // session invité → dimensions → estimation → liste d'achat → compte → devis →
  // essai → abonnement payant → résiliation. Superset de DATA-1 ci-dessus, pas
  // un remplacement : l'ordre y diffère (account_created y arrive après
  // estimate_created/shopping_list_generated). Voir revenue_funnel dans
  // admin-analytics.service.ts.
  PUBLIC_CALCULATION_COMPLETED = 'public_calculation_completed',
  GUEST_SESSION_STARTED = 'guest_session_started',
  DIMENSIONS_ENTERED = 'dimensions_entered',
  QUOTE_GENERATED = 'quote_generated',
  TRIAL_STARTED = 'trial_started',
  PAID_SUBSCRIPTION_ACTIVE = 'paid_subscription_active',
  ACCOUNT_CREATED = 'account_created',
  ESTIMATE_CREATED = 'estimate_created',
  SHOPPING_LIST_GENERATED = 'shopping_list_generated',
  CHECKOUT_STARTED = 'checkout_started',

  // Événements existants (call sites internes)
  EMAIL_CAPTURE = 'email_capture',
  SUBSCRIPTION_STARTED = 'subscription_started',
  PAYMENT_FAILED = 'payment_failed',
  // E5-2 : le délai de grâce s'est écoulé sans régularisation, le palier est
  // retombé sur gratuit. Distinct de `payment_failed`, qui n'est que le premier
  // incident : c'est l'écart entre les deux qui donne le taux de récupération
  // des impayés, donc la seule mesure qui dira si 14 jours est le bon délai.
  SUBSCRIPTION_GRACE_EXPIRED = 'subscription_grace_expired',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',
  BUDGET_TRACKED = 'budget_tracked',
  // DATA-5 : clôture par les quantités réellement achetées. Distinct de
  // `budget_tracked`, qui ne dit rien du taux de déclaration — or c'est ce taux,
  // et non le nombre de budgets figés, qui décide si DATA-3 et DATA-4 auront un
  // jour de quoi tourner.
  PROJECT_CLOSED_OUT = 'project_closed_out',
  REFERRAL_REDEEMED = 'referral_redeemed',
  REFERRAL_CREDIT_GRANTED = 'referral_credit_granted',

  // PLAT-2 : e-mails de cycle de vie
  ONBOARDING_D1_EMAIL_SENT = 'onboarding_d1_email_sent',
  ONBOARDING_D3_EMAIL_SENT = 'onboarding_d3_email_sent',
  PROJECT_ABANDONED_EMAIL_SENT = 'project_abandoned_email_sent',
  TRIAL_ENDING_EMAIL_SENT = 'trial_ending_email_sent',
  // DATA-5 : relance de clôture. Rapproché de `project_closed_out`, il donne le
  // taux de conversion de la relance — la mesure qui décide si l'hypothèse
  // « l'utilisateur revient » tient.
  CLOSEOUT_DUE_EMAIL_SENT = 'closeout_due_email_sent',

  // MOB-1 : mesure de l'adoption PWA, préalable à l'arbitrage MOB-2 (app native).
  // `pwa_session_start` porte à lui seul la part de sessions standalone et la
  // répartition par plateforme : sur iOS `beforeinstallprompt` n'existe pas, donc
  // sans cet événement les utilisateurs iOS seraient absents des mesures au lieu
  // d'être comptés comme non-promptables — ce qui est précisément le signal qui
  // ferait pencher MOB-2 vers les stores.
  PWA_SESSION_START = 'pwa_session_start',
  PWA_INSTALL_PROMPTED = 'pwa_install_prompted',
  PWA_INSTALL_ACCEPTED = 'pwa_install_accepted',
  PWA_INSTALL_DISMISSED = 'pwa_install_dismissed',
  PWA_INSTALLED = 'pwa_installed',
  PWA_OFFLINE_VIEW = 'pwa_offline_view',

  // Rejet qualité CV-4 (photos.service.ts) : mesure le plafond réel de la capture
  // web, seul argument « caméra » recevable pour MOB-2. Émis côté serveur uniquement.
  PHOTO_QUALITY_REJECTED = 'photo_quality_rejected',

  // Événements existants (envoyés uniquement depuis le client, en l'état authentifié)
  PAYWALL_SHOWN = 'paywall_shown',
  PAYWALL_CLICKED = 'paywall_clicked',
  PRICING_CTA_CLICKED = 'pricing_cta_clicked',
  CONTRACTOR_PLAN_CLICKED = 'contractor_plan_clicked',
}
