import * as dotenv from 'dotenv';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { ConsoleLogger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import Stripe from 'stripe';
import { AppModule } from '../app.module';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { FeatureGatesService } from '../feature-gates/feature-gates.service';
import { UserContextService } from '../users/user-context.service';
import {
  getDefaultPlan,
  REFUND_WINDOW_DAYS,
} from '../subscriptions/plans.constants';
import { User } from '../users/entities/user.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionRefund } from '../subscriptions/entities/subscription-refund.entity';

/**
 * Déroule le cycle de vie complet d'un abonnement **annuel** contre un vrai
 * Stripe en mode test, et vérifie après chaque étape l'état en base **et** le
 * palier effectif rendu par les feature gates.
 *
 * ```bash
 * # depuis apps/api, avec STRIPE_SECRET_KEY=sk_test_… dans le .env de la racine
 * pnpm verify:stripe
 * ```
 *
 * Ce que ce script apporte que les tests ne peuvent pas : les charges utiles
 * sont celles de Stripe, pas les nôtres. Les objets `Subscription`, `Invoice` et
 * `Charge` changent de forme au fil des versions d'API — `current_period_end`
 * est passé de l'abonnement à ses `items`, `Invoice.charge` a disparu au profit
 * de `invoice.payments`, `Charge.invoice` n'existe plus — et une fixture
 * recopiée à la main continue de passer au vert longtemps après que la
 * production a cessé de fonctionner.
 *
 * **L'horloge de test est ce qui rend l'annuel vérifiable.** Un renouvellement
 * annuel ne s'attend pas : le client Stripe est créé sur un `test_clock` qu'on
 * avance, et Stripe émet les mêmes événements qu'il émettrait un an plus tard.
 *
 * Deux exceptions, signalées là où elles ont lieu :
 *
 * 1. l'enveloppe de `checkout.session.completed`. La page de paiement hébergée
 *    ne peut pas être validée sans navigateur, donc aucun événement de ce type
 *    n'est jamais émis ici. L'objet porté reste une vraie session relue chez
 *    Stripe ; seul le lien vers l'abonnement est posé par le script ;
 * 2. l'expiration du **délai de grâce** sur impayé. Ce compte à rebours est le
 *    nôtre (`STRIPE_PAST_DUE_GRACE_DAYS`, comparé à `Date.now()`), pas celui de
 *    Stripe : une horloge de test ne l'avance pas. L'étape recule donc
 *    `past_due_since` en base et appelle le balayage, ce qui est exactement ce
 *    que le temps aurait fait.
 *
 * Les événements ne sont pas fabriqués ailleurs : ils sont relus avec
 * `events.list`, triés par date d'émission et repassés par le trio exact du
 * contrôleur de webhook (`claimWebhookEvent` → `handleWebhookEvent` →
 * `markWebhookEventProcessed`).
 */

/** Chargé avant tout accès à la configuration — cf. `config/data-source.ts`. */
dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

/** Une assertion a échoué : la chaîne de paiement ne se comporte pas comme attendu. */
const EXIT_ASSERTION_FAILED = 1;
/** Le script n'a pas pu se mettre en état de vérifier quoi que ce soit. */
const EXIT_MISCONFIGURED = 2;

/**
 * Doit refléter exactement le `switch` de `SubscriptionsService.handleWebhookEvent`.
 * C'est aussi la liste à souscrire sur l'endpoint webhook (cf. `docs/DEPLOY.md` §4).
 */
const HANDLED_EVENT_TYPES: Stripe.Event['type'][] = [
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'charge.refunded',
];

/** Carte de test Stripe toujours acceptée, en mode test uniquement. */
const TEST_PAYMENT_METHOD = 'pm_card_visa';
/** Carte de test dont le prélèvement échoue — pour l'étape « impayé ». */
const FAILING_PAYMENT_METHOD = 'pm_card_chargeCustomerFail';

/** Au-delà, on considère que Stripe n'émettra pas l'événement attendu. */
const EVENT_POLL_TIMEOUT_MS = 120_000;
const EVENT_POLL_INTERVAL_MS = 2_000;
/** Une avance d'horloge sur un an prend plusieurs dizaines de secondes. */
const CLOCK_READY_TIMEOUT_MS = 180_000;
const CLOCK_POLL_INTERVAL_MS = 2_000;

const DAY_SECONDS = 24 * 60 * 60;
/**
 * Stripe refuse les bonds d'horloge trop longs. On avance par paliers plutôt
 * que de découvrir la borne en production du script.
 */
const MAX_CLOCK_STEP_SECONDS = 60 * DAY_SECONDS;

let failures = 0;

function format(value: unknown): string {
  return value instanceof Date ? value.toISOString() : JSON.stringify(value);
}

function check(label: string, actual: unknown, expected: unknown): void {
  if (Object.is(actual, expected)) {
    console.log(`    ✓ ${label}`);
    return;
  }
  failures += 1;
  console.error(
    `    ✗ ${label} — attendu ${format(expected)}, obtenu ${format(actual)}`,
  );
}

function step(title: string): void {
  console.log(`\n▸ ${title}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Un événement Stripe porte-t-il sur l'abonnement que nous suivons ? */
function concernsSubscription(
  event: Stripe.Event,
  subscriptionId: string,
  customerId: string | null,
): boolean {
  const object = event.data.object as unknown as Record<string, unknown>;

  if (event.type.startsWith('customer.subscription.')) {
    return object.id === subscriptionId;
  }

  if (event.type.startsWith('invoice.')) {
    const parent = object.parent as
      | { subscription_details?: { subscription?: string | { id: string } } }
      | undefined;
    const subscription = parent?.subscription_details?.subscription;
    const id =
      typeof subscription === 'string' ? subscription : subscription?.id;
    return id === subscriptionId;
  }

  // Une charge remboursée ne porte plus de lien vers la facture depuis
  // l'API 2025 : le rattachement se fait par le client, ce qui est aussi la
  // route que suit `handleChargeRefunded`.
  if (event.type === 'charge.refunded') {
    const charge = object.customer;
    const id = typeof charge === 'string' ? charge : null;
    return customerId !== null && id === customerId;
  }

  return false;
}

async function main(): Promise<void> {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  // Première barrière, avant toute connexion : ce script crée des produits,
  // souscrit, rembourse et résilie. Sur une clé live, il facturerait un vrai
  // client — et le rembourserait, ce qui laisse une trace comptable réelle.
  if (!secretKey?.startsWith('sk_test_')) {
    console.error(
      'STRIPE_SECRET_KEY doit être une clé de **test** (`sk_test_…`).\n' +
        (secretKey
          ? 'La clé fournie ne commence pas par `sk_test_` — refus de continuer.'
          : 'Aucune clé trouvée dans le .env de la racine.'),
    );
    process.exit(EXIT_MISCONFIGURED);
  }

  const stripe = new Stripe(secretKey);
  const startedAt = Math.floor(Date.now() / 1000);
  const runId = `e3-3-${startedAt}`;
  const plan = getDefaultPlan();

  // ---------------------------------------------------------------------
  // Prix : celui du .env s'il existe et est lisible avec cette clé de test —
  // c'est la configuration réelle qu'on veut éprouver. Sinon un prix éphémère,
  // archivé en fin de course. La périodicité vient de `PLANS`, comme en
  // production : un prix mensuel créé ici masquerait exactement le défaut que
  // ce script existe pour attraper.
  // ---------------------------------------------------------------------
  step('Préparation du prix Stripe (mode test)');

  async function resolvePrice(): Promise<{ id: string; ephemeral: boolean }> {
    const envVar = 'STRIPE_CONTRACTOR_ESSENTIEL_PRICE_ID';
    const configured = process.env[envVar];
    if (configured) {
      try {
        const price = await stripe.prices.retrieve(configured);
        console.log(`    ${envVar} = ${price.id} (configuré, lisible)`);
        check(
          'périodicité du prix configuré',
          price.recurring?.interval,
          'year',
        );
        return { id: price.id, ephemeral: false };
      } catch {
        console.log(
          `    ${envVar} = ${configured} illisible avec cette clé de test — prix éphémère créé à la place`,
        );
      }
    }
    const price = await stripe.prices.create({
      currency: plan.currency.toLowerCase(),
      unit_amount: plan.price * 100,
      recurring: { interval: plan.interval },
      product_data: { name: `${plan.label} (vérification ${runId})` },
    });
    console.log(`    ${envVar} = ${price.id} (éphémère, ${plan.price} € / an)`);
    return { id: price.id, ephemeral: true };
  }

  const offerPrice = await resolvePrice();
  // La carte price_id → palier est construite dans le constructeur du service :
  // renseigner l'environnement **avant** de monter le contexte Nest, sinon
  // aucun prix ne résoudrait de palier.
  process.env.STRIPE_CONTRACTOR_ESSENTIEL_PRICE_ID = offerPrice.id;

  // ---------------------------------------------------------------------
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: new ConsoleLogger({ logLevels: ['error', 'warn'] }),
  });

  const subscriptions = app.get(SubscriptionsService);
  const featureGates = app.get(FeatureGatesService);
  const userContext = app.get(UserContextService);
  const dataSource = app.get(DataSource);
  const usersRepo = dataSource.getRepository(User);
  const subscriptionsRepo = dataSource.getRepository(Subscription);
  const refundsRepo = dataSource.getRepository(SubscriptionRefund);

  // Deux gates représentatives, lues dans le catalogue plutôt que codées en
  // dur : ce que vend chaque palier bouge, la mécanique testée ici non.
  // Depuis que le chiffrage est gratuit, la gate `free` doit rester ouverte à
  // **toutes** les étapes du cycle — remboursement et résiliation compris.
  const gates = await featureGates.getAllGates();
  const artisanGate = gates.find(
    (gate) => gate.is_enabled && gate.min_tier === 'contractor_essentiel',
  );
  const freeGate = gates.find(
    (gate) => gate.is_enabled && gate.min_tier === 'free',
  );
  if (!artisanGate || !freeGate) {
    console.error(
      'Catalogue de gates incomplet : il faut au moins une gate active au palier gratuit et une au palier payant.',
    );
    await app.close();
    process.exit(EXIT_MISCONFIGURED);
  }

  const user = await usersRepo.save(
    usersRepo.create({
      email: `${runId}@chiffreo.test`,
      firebase_uid: `firebase-${runId}`,
    }),
  );

  let testClockId: string | null = null;
  let stripeCustomerId: string | null = null;
  let stripeSubscriptionId: string | null = null;
  /** Événements déjà rejoués, pour ne pas les repasser à chaque tour. */
  const replayed = new Set<string>();
  /** Un `customer.subscription.updated` conservé pour le rejeu périmé final. */
  let staleCandidate: Stripe.Event | null = null;
  /** Temps simulé courant, en secondes. */
  let clockNow = startedAt;

  /**
   * Reproduit le contrôleur de webhook sur un événement : réservation,
   * traitement, marquage. `force` supprime d'abord la réservation existante —
   * c'est ce qui permet de rejouer un événement *ancien* comme s'il venait
   * seulement d'être livré, sans que la déduplication ne l'écarte.
   */
  async function deliver(event: Stripe.Event, force = false): Promise<void> {
    if (force) await subscriptions.releaseWebhookEvent(event.id);
    const claimed = await subscriptions.claimWebhookEvent(event);
    if (!claimed) return;
    await subscriptions.handleWebhookEvent(event);
    await subscriptions.markWebhookEventProcessed(event.id);
    replayed.add(event.id);
  }

  /**
   * Attend que Stripe ait émis les types demandés pour notre abonnement, puis
   * les rejoue **dans l'ordre d'émission** — pas dans celui de la liste, que
   * l'API rend du plus récent au plus ancien.
   */
  async function drainEvents(
    expectedTypes: Stripe.Event['type'][],
  ): Promise<Stripe.Event[]> {
    const deadline = Date.now() + EVENT_POLL_TIMEOUT_MS;
    const collected: Stripe.Event[] = [];

    while (Date.now() < deadline) {
      const page = await stripe.events.list({
        created: { gte: startedAt },
        limit: 100,
      });

      const fresh = page.data
        .filter(
          (event) =>
            !replayed.has(event.id) &&
            HANDLED_EVENT_TYPES.includes(event.type) &&
            stripeSubscriptionId !== null &&
            concernsSubscription(event, stripeSubscriptionId, stripeCustomerId),
        )
        .sort((a, b) => a.created - b.created);

      for (const event of fresh) {
        await deliver(event);
        collected.push(event);
        console.log(
          `    → ${event.type} (émis ${new Date(event.created * 1000).toISOString()})`,
        );
      }

      const seenTypes = new Set(collected.map((event) => event.type));
      if (expectedTypes.every((type) => seenTypes.has(type))) return collected;

      await sleep(EVENT_POLL_INTERVAL_MS);
    }

    failures += 1;
    console.error(
      `    ✗ événements attendus non reçus dans le délai : ${expectedTypes.join(', ')}`,
    );
    return collected;
  }

  /** Avance l'horloge de test par paliers, et attend qu'elle soit prête. */
  async function advanceClock(bySeconds: number): Promise<void> {
    if (!testClockId) throw new Error('Aucune horloge de test à avancer.');
    const target = clockNow + bySeconds;

    while (clockNow < target) {
      const next = Math.min(target, clockNow + MAX_CLOCK_STEP_SECONDS);
      await stripe.testHelpers.testClocks.advance(testClockId, {
        frozen_time: next,
      });

      const deadline = Date.now() + CLOCK_READY_TIMEOUT_MS;
      let status = 'advancing';
      while (Date.now() < deadline) {
        const clock = await stripe.testHelpers.testClocks.retrieve(testClockId);
        status = clock.status;
        if (status !== 'advancing') break;
        await sleep(CLOCK_POLL_INTERVAL_MS);
      }
      if (status !== 'ready') {
        failures += 1;
        console.error(
          `    ✗ horloge de test bloquée en statut « ${status} » — étapes suivantes non concluantes`,
        );
        return;
      }
      clockNow = next;
    }

    console.log(
      `    horloge avancée à ${new Date(clockNow * 1000).toISOString()}`,
    );
  }

  /** État en base + palier effectif tel que le voit une feature gate. */
  async function assertState(
    expected: {
      status: string;
      priceId: string | null;
      tier: string;
      artisanGateAllowed: boolean;
      freeGateAllowed: boolean;
    },
    options: { expectRow?: boolean } = {},
  ): Promise<void> {
    const row = await subscriptionsRepo.findOne({
      where: { user_id: user.id },
    });
    check(
      'ligne subscriptions présente',
      row !== null,
      options.expectRow ?? true,
    );
    check('status en base', row?.status, expected.status);
    check('stripe_price_id en base', row?.stripe_price_id, expected.priceId);

    // Le palier effectif passe par le même chemin que le guard de production :
    // palier du compte → décision de la gate.
    const fresh = await usersRepo.findOneOrFail({ where: { id: user.id } });
    const scope = userContext.resolveForUser(fresh);
    check('palier effectif', scope.effectiveTier, expected.tier);

    check(
      `gate ${artisanGate!.feature_key} (palier artisan)`,
      await featureGates.isFeatureAllowed(
        artisanGate!.feature_key,
        scope.effectiveTier,
      ),
      expected.artisanGateAllowed,
    );
    check(
      `gate ${freeGate!.feature_key} (palier gratuit)`,
      await featureGates.isFeatureAllowed(
        freeGate!.feature_key,
        scope.effectiveTier,
      ),
      expected.freeGateAllowed,
    );
  }

  /**
   * Ouvre un abonnement sur le client lié à l'horloge, et pose la ligne locale
   * par l'enveloppe `checkout.session.completed` (cf. exception 1 en tête).
   */
  async function subscribe(
    session: Stripe.Checkout.Session | null,
  ): Promise<void> {
    const stripeSub = await stripe.subscriptions.create({
      customer: stripeCustomerId!,
      items: [{ price: offerPrice.id }],
      default_payment_method: TEST_PAYMENT_METHOD,
    });
    stripeSubscriptionId = stripeSub.id;

    check('abonnement ouvert directement actif', stripeSub.status, 'active');
    check("aucune période d'essai ouverte", stripeSub.trial_end, null);

    const item = stripeSub.items.data[0];
    const periodDays = Math.round(
      (item.current_period_end - item.current_period_start) / DAY_SECONDS,
    );
    check(
      'période facturée d’environ un an',
      periodDays >= 364 && periodDays <= 366,
      true,
    );

    const envelope = session
      ? { ...session, subscription: stripeSub.id }
      : {
          id: `cs_${runId}_${stripeSub.id}`,
          object: 'checkout.session',
          customer: stripeCustomerId,
          subscription: stripeSub.id,
          mode: 'subscription',
          metadata: { user_id: user.id },
        };

    await deliver({
      id: `evt_checkout_${stripeSub.id}`,
      type: 'checkout.session.completed',
      created: clockNow,
      data: { object: envelope },
    } as unknown as Stripe.Event);
  }

  try {
    // -------------------------------------------------------------------
    step('0. Horloge de test et client Stripe');

    const clock = await stripe.testHelpers.testClocks.create({
      frozen_time: startedAt,
      name: `Cycle annuel ${runId}`,
    });
    testClockId = clock.id;
    console.log(
      `    horloge ${clock.id} figée à ${new Date(startedAt * 1000).toISOString()}`,
    );

    // Le client est créé ici, et non par `createCheckoutSession`, parce qu'un
    // client ne peut être rattaché à une horloge de test qu'à sa création.
    // `createCheckoutSession` est exercé plus loin, à l'étape 3 : il réutilise
    // alors ce client via la ligne locale, ce qui est le chemin de production
    // d'un abonné qui revient.
    const customer = await stripe.customers.create({
      email: user.email!,
      metadata: { user_id: user.id },
      test_clock: clock.id,
    });
    stripeCustomerId = customer.id;
    await stripe.paymentMethods.attach(TEST_PAYMENT_METHOD, {
      customer: customer.id,
    });
    check('client rattaché à l’horloge', customer.test_clock, clock.id);

    // -------------------------------------------------------------------
    step('1. Souscription annuelle — l’accès s’ouvre immédiatement');

    await subscribe(null);

    await assertState({
      status: 'active',
      priceId: offerPrice.id,
      tier: 'contractor_essentiel',
      artisanGateAllowed: true,
      freeGateAllowed: true,
    });

    // -------------------------------------------------------------------
    step(`2. Remboursement à J+10 (fenêtre de ${REFUND_WINDOW_DAYS} jours)`);

    await advanceClock(10 * DAY_SECONDS);

    const eligibility = await subscriptions.getRefundEligibility(user.id);
    check('éligible au remboursement', eligibility.eligible, true);
    check('montant remboursable', eligibility.amount_cents, plan.price * 100);

    const receipt = await subscriptions.requestRefund(
      user.id,
      'Vérification du cycle annuel',
    );
    check('remboursement émis', receipt.amount_cents, plan.price * 100);
    check('pas un rejeu', receipt.already_refunded, false);

    const trace = await refundsRepo.findOne({
      where: { stripe_refund_id: receipt.refund_id },
    });
    check('trace écrite en base', trace !== null, true);
    check('origine tracée', trace?.origin, 'self_service');

    // L'accès tombe **sans attendre le webhook** : c'est la propriété que la
    // politique doit tenir, sans quoi l'argent serait rendu et l'accès resterait.
    const afterRefund = await usersRepo.findOneOrFail({
      where: { id: user.id },
    });
    check('palier fermé immédiatement', afterRefund.subscription_tier, 'free');

    await drainEvents(['charge.refunded', 'customer.subscription.deleted']);

    await assertState({
      status: 'canceled',
      priceId: offerPrice.id,
      tier: 'free',
      artisanGateAllowed: false,
      // Le chiffrage est gratuit : un remboursement ferme le devis conforme,
      // jamais le calcul.
      freeGateAllowed: true,
    });

    // Idempotence de la politique : rejouée, elle ne rembourse pas deux fois.
    const replay = await subscriptions.requestRefund(user.id);
    check('rejeu reconnu comme déjà remboursé', replay.already_refunded, true);
    check('même remboursement rendu', replay.refund_id, receipt.refund_id);
    check(
      'une seule ligne de trace',
      await refundsRepo.count({ where: { user_id: user.id } }),
      1,
    );

    // -------------------------------------------------------------------
    step('3. Re-souscription — le checkout réel, sans essai');

    const { url } = await subscriptions.createCheckoutSession(
      { id: user.id, email: user.email },
      offerPrice.id,
    );
    check('URL de checkout renvoyée', url.startsWith('https://'), true);

    const session = (
      await stripe.checkout.sessions.list({
        customer: stripeCustomerId,
        limit: 1,
      })
    ).data[0];
    check('mode de la session', session.mode, 'subscription');
    check('user_id porté par la session', session.metadata?.user_id, user.id);

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 1,
    });
    check(
      'prix vendu par la session',
      lineItems.data[0]?.price?.id,
      offerPrice.id,
    );

    await subscribe(session);
    await drainEvents(['invoice.paid']);

    await assertState({
      status: 'active',
      priceId: offerPrice.id,
      tier: 'contractor_essentiel',
      artisanGateAllowed: true,
      freeGateAllowed: true,
    });

    const beforeRenewal = await subscriptionsRepo.findOneOrFail({
      where: { user_id: user.id },
    });

    // -------------------------------------------------------------------
    step('4. Renouvellement annuel — l’accès ne bouge pas');

    await advanceClock(366 * DAY_SECONDS);
    const renewalEvents = await drainEvents(['invoice.paid']);
    staleCandidate =
      renewalEvents
        .filter((event) => event.type === 'customer.subscription.updated')
        .pop() ?? staleCandidate;

    const afterRenewal = await subscriptionsRepo.findOneOrFail({
      where: { user_id: user.id },
    });
    check(
      'période avancée d’un an',
      (afterRenewal.current_period_end?.getTime() ?? 0) >
        (beforeRenewal.current_period_end?.getTime() ?? 0),
      true,
    );

    await assertState({
      status: 'active',
      priceId: offerPrice.id,
      tier: 'contractor_essentiel',
      artisanGateAllowed: true,
      freeGateAllowed: true,
    });

    // -------------------------------------------------------------------
    step('5. Échec de paiement — l’accès tient pendant le délai de grâce');

    await stripe.paymentMethods.attach(FAILING_PAYMENT_METHOD, {
      customer: stripeCustomerId,
    });
    await stripe.subscriptions.update(stripeSubscriptionId!, {
      default_payment_method: FAILING_PAYMENT_METHOD,
    });

    await advanceClock(366 * DAY_SECONDS);
    await drainEvents(['invoice.payment_failed']);

    // `past_due` reste actif : un échec de prélèvement n'est pas un défaut de
    // paiement, et couper immédiatement ferait payer à un abonné de bonne foi
    // le calendrier d'expiration de sa banque.
    await assertState({
      status: 'past_due',
      priceId: offerPrice.id,
      tier: 'contractor_essentiel',
      artisanGateAllowed: true,
      freeGateAllowed: true,
    });

    // -------------------------------------------------------------------
    step(
      '6. Expiration du délai de grâce — notre horloge, pas celle de Stripe',
    );

    // Exception 2 (cf. en-tête) : le compte à rebours est comparé à
    // `Date.now()`. Une horloge de test Stripe ne l'avance pas ; on recule
    // l'horodatage, ce qui est exactement ce que le temps aurait fait.
    await dataSource.query(
      `UPDATE subscriptions SET past_due_since = now() - interval '400 days' WHERE user_id = $1`,
      [user.id],
    );
    await subscriptions.sweepExpiredGracePeriods();

    await assertState({
      status: 'past_due',
      priceId: offerPrice.id,
      tier: 'free',
      artisanGateAllowed: false,
      freeGateAllowed: true,
    });

    // -------------------------------------------------------------------
    step('7. Annulation');

    await stripe.subscriptions.cancel(stripeSubscriptionId!);
    await drainEvents(['customer.subscription.deleted']);

    await assertState({
      status: 'canceled',
      priceId: offerPrice.id,
      tier: 'free',
      artisanGateAllowed: false,
      freeGateAllowed: true,
    });

    // -------------------------------------------------------------------
    step('8. Événement retardé — la garde d’ordonnancement, sur charge réelle');

    if (!staleCandidate) {
      console.log(
        '    aucun `customer.subscription.updated` antérieur à rejouer — étape sautée',
      );
    } else {
      console.log(
        `    rejeu de ${staleCandidate.type} émis le ` +
          `${new Date(staleCandidate.created * 1000).toISOString()}, ` +
          'soit avant l’annulation',
      );
      // `force` : on simule une première livraison tardive, pas un retry — la
      // déduplication par event_id écarterait un retry avant toute décision.
      await deliver(staleCandidate, true);

      // Le défaut corrigé : cet événement remettait `status = active` et
      // rendait un palier payant à un compte résilié.
      await assertState({
        status: 'canceled',
        priceId: offerPrice.id,
        tier: 'free',
        artisanGateAllowed: false,
        freeGateAllowed: true,
      });
    }
  } finally {
    step('Nettoyage');

    // Supprimer l'horloge emporte ses clients, abonnements et factures : c'est
    // la seule opération de nettoyage qui ne laisse rien derrière elle.
    if (testClockId) {
      await stripe.testHelpers.testClocks
        .del(testClockId)
        .catch(() => undefined);
    } else if (stripeCustomerId) {
      await stripe.customers.del(stripeCustomerId).catch(() => undefined);
    }
    // Les prix Stripe ne se suppriment pas ; celui créé pour ce run est
    // désactivé pour ne pas polluer le catalogue de test.
    if (offerPrice.ephemeral) {
      await stripe.prices
        .update(offerPrice.id, { active: false })
        .catch(() => undefined);
    }

    await dataSource.query(
      'DELETE FROM subscription_refunds WHERE user_id = $1',
      [user.id],
    );
    await dataSource.query('DELETE FROM subscriptions WHERE user_id = $1', [
      user.id,
    ]);
    await dataSource.query('DELETE FROM users WHERE id = $1', [user.id]);
    await dataSource.query(
      `DELETE FROM stripe_events WHERE event_id = ANY($1::varchar[])`,
      [[...replayed]],
    );
    console.log('    base et Stripe remis en état');

    await app.close();
  }

  console.log(
    failures === 0
      ? '\n✓ Cycle annuel complet vérifié : aucune divergence.'
      : `\n✗ ${failures} vérification(s) en échec.`,
  );
  process.exit(failures === 0 ? 0 : EXIT_ASSERTION_FAILED);
}

main().catch((error: unknown) => {
  console.error('\nÉchec du script de vérification :');
  console.error(error);
  process.exit(EXIT_ASSERTION_FAILED);
});
