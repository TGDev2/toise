import * as dotenv from 'dotenv';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { ConsoleLogger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import Stripe from 'stripe';
import { AppModule } from '../app.module';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { FeatureGatesService } from '../feature-gates/feature-gates.service';
import { OrgContextService } from '../organizations/org-context.service';
import { PLANS } from '../subscriptions/plans.constants';
import { User } from '../users/entities/user.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';

/**
 * Déroule le cycle de vie complet d'un abonnement contre un **vrai** Stripe en
 * mode test, et vérifie après chaque étape l'état en base **et** le palier
 * effectif rendu par les feature gates.
 *
 * ```bash
 * # depuis apps/api, avec STRIPE_SECRET_KEY=sk_test_… dans le .env de la racine
 * pnpm verify:stripe
 * ```
 *
 * Ce que ce script apporte que les tests ne peuvent pas : les charges utiles
 * sont celles de Stripe, pas les nôtres. Les objets `Subscription` et `Invoice`
 * changent de forme au fil des versions d'API — `current_period_end` est passé
 * de l'abonnement à ses `items` — et une fixture recopiée à la main continue de
 * passer au vert longtemps après que la production a cessé de fonctionner.
 *
 * Les événements ne sont donc **pas fabriqués** : ils sont relus avec
 * `events.list`, triés par date d'émission et repassés par le trio exact du
 * contrôleur de webhook (`claimWebhookEvent` → `handleWebhookEvent` →
 * `markWebhookEventProcessed`).
 *
 * Seule exception, et elle est signalée là où elle a lieu : l'enveloppe de
 * `checkout.session.completed`. La page de paiement hébergée par Stripe ne peut
 * pas être validée sans navigateur, donc aucun événement de ce type n'est
 * jamais émis ici. L'objet que porte l'enveloppe reste la vraie session relue
 * chez Stripe ; seul le lien vers l'abonnement est posé par le script.
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
];

/** Carte de test Stripe toujours acceptée, en mode test uniquement. */
const TEST_PAYMENT_METHOD = 'pm_card_visa';

/** Au-delà, on considère que Stripe n'émettra pas l'événement attendu. */
const EVENT_POLL_TIMEOUT_MS = 60_000;
const EVENT_POLL_INTERVAL_MS = 2_000;

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

  return false;
}

async function main(): Promise<void> {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  // Première barrière, avant toute connexion : ce script crée des produits,
  // souscrit et résilie. Sur une clé live, il facturerait un vrai client.
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
  const runId = `e5-1-${startedAt}`;

  // ---------------------------------------------------------------------
  // Prix : ceux du .env s'ils existent et sont lisibles avec cette clé de
  // test — c'est la configuration réelle qu'on veut éprouver. Sinon des prix
  // éphémères, archivés en fin de course.
  // ---------------------------------------------------------------------
  step('Préparation des prix Stripe (mode test)');

  async function resolvePrice(
    envVar: string,
    label: string,
    unitAmount: number,
  ): Promise<{ id: string; ephemeral: boolean }> {
    const configured = process.env[envVar];
    if (configured) {
      try {
        const price = await stripe.prices.retrieve(configured);
        console.log(`    ${envVar} = ${price.id} (configuré, lisible)`);
        return { id: price.id, ephemeral: false };
      } catch {
        console.log(
          `    ${envVar} = ${configured} illisible avec cette clé de test — prix éphémère créé à la place`,
        );
      }
    }
    const price = await stripe.prices.create({
      currency: 'eur',
      unit_amount: unitAmount,
      recurring: { interval: 'month' },
      product_data: { name: `${label} (vérification ${runId})` },
    });
    console.log(`    ${envVar} = ${price.id} (éphémère)`);
    return { id: price.id, ephemeral: true };
  }

  const artisanPrice = await resolvePrice(
    'STRIPE_CONTRACTOR_ESSENTIEL_PRICE_ID',
    'Chiffréo Artisan',
    1900,
  );
  const proPrice = await resolvePrice(
    'STRIPE_PRO_PRICE_ID',
    'Chiffréo Pro',
    999,
  );

  // Les maps price_id → palier et price_id → durée d'essai sont construites
  // dans le constructeur du service : renseigner l'environnement **avant** de
  // monter le contexte Nest, sinon le palier retomberait sur `pro`.
  process.env.STRIPE_CONTRACTOR_ESSENTIEL_PRICE_ID = artisanPrice.id;
  process.env.STRIPE_PRO_PRICE_ID = proPrice.id;

  const artisanPlan = PLANS.find(
    (plan) => plan.key === 'contractor_essentiel',
  )!;

  // ---------------------------------------------------------------------
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: new ConsoleLogger({ logLevels: ['error', 'warn'] }),
  });

  const subscriptions = app.get(SubscriptionsService);
  const featureGates = app.get(FeatureGatesService);
  const orgContext = app.get(OrgContextService);
  const dataSource = app.get(DataSource);
  const usersRepo = dataSource.getRepository(User);
  const subscriptionsRepo = dataSource.getRepository(Subscription);

  // Deux gates représentatives, lues dans le catalogue plutôt que codées en
  // dur : ce que vend chaque palier bouge, la mécanique testée ici non.
  const gates = await featureGates.getAllGates();
  const artisanGate = gates.find(
    (gate) => gate.is_enabled && gate.min_tier === 'contractor_essentiel',
  );
  const proGate = gates.find(
    (gate) => gate.is_enabled && gate.min_tier === 'pro',
  );
  if (!artisanGate || !proGate) {
    console.error(
      'Catalogue de gates incomplet : il faut au moins une gate active par palier payant.',
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

  let stripeSubscriptionId: string | null = null;
  let stripeCustomerId: string | null = null;
  /** Événements déjà rejoués, pour ne pas les repasser à chaque tour. */
  const replayed = new Set<string>();
  /** Le `customer.subscription.updated` du changement de palier, rejoué périmé en fin de course. */
  let tierChangeEvent: Stripe.Event | null = null;

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
            concernsSubscription(event, stripeSubscriptionId),
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

  /** État en base + palier effectif tel que le voit une feature gate. */
  async function assertState(expected: {
    status: string;
    priceId: string | null;
    tier: string;
    artisanGateAllowed: boolean;
    proGateAllowed: boolean;
  }): Promise<void> {
    const row = await subscriptionsRepo.findOne({
      where: { user_id: user.id },
    });
    check('ligne subscriptions présente', row !== null, true);
    check('status en base', row?.status, expected.status);
    check('stripe_price_id en base', row?.stripe_price_id, expected.priceId);

    // Le palier effectif passe par le même chemin que le guard de production :
    // organisation active → palier de son propriétaire → décision de la gate.
    const fresh = await usersRepo.findOneOrFail({ where: { id: user.id } });
    const scope = await orgContext.resolveForUser(fresh);
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
      `gate ${proGate!.feature_key} (palier pro)`,
      await featureGates.isFeatureAllowed(
        proGate!.feature_key,
        scope.effectiveTier,
      ),
      expected.proGateAllowed,
    );
  }

  try {
    // -------------------------------------------------------------------
    step('1. Checkout — session créée puis abonnement en essai');

    const { url } = await subscriptions.createCheckoutSession(
      { id: user.id, email: user.email },
      artisanPrice.id,
    );
    check('URL de checkout renvoyée', url.startsWith('https://'), true);

    const customer = (
      await stripe.customers.list({ email: user.email!, limit: 1 })
    ).data[0];
    stripeCustomerId = customer.id;
    check('customer Stripe créé', typeof customer.id, 'string');
    check('user_id porté par le customer', customer.metadata.user_id, user.id);

    const session = (
      await stripe.checkout.sessions.list({ customer: customer.id, limit: 1 })
    ).data[0];
    check('mode de la session', session.mode, 'subscription');
    check('user_id porté par la session', session.metadata?.user_id, user.id);

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 1,
    });
    check(
      'prix vendu par la session',
      lineItems.data[0]?.price?.id,
      artisanPrice.id,
    );

    // `subscription_data.trial_period_days` est en écriture seule : l'objet
    // Session ne le rend pas. Ce que le service y met est couvert par le test
    // unitaire « accorde au palier artisan les 7 jours d'essai déclarés dans
    // PLANS » ; ici on souscrit avec la même valeur, lue au même endroit, et on
    // vérifie que Stripe ouvre bien une période d'essai de cette durée.
    await stripe.paymentMethods.attach(TEST_PAYMENT_METHOD, {
      customer: customer.id,
    });
    const stripeSub = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: artisanPrice.id }],
      trial_period_days: artisanPlan.trial_days,
      default_payment_method: TEST_PAYMENT_METHOD,
    });
    stripeSubscriptionId = stripeSub.id;

    check('abonnement ouvert en essai', stripeSub.status, 'trialing');
    const trialDays = Math.round(
      (stripeSub.trial_end! - stripeSub.start_date) / 86_400,
    );
    check('durée d’essai accordée (jours)', trialDays, artisanPlan.trial_days);

    // Unique enveloppe fabriquée du script : la page hébergée ne peut pas être
    // validée sans navigateur, donc Stripe n'émet jamais cet événement ici.
    // L'objet porté est la vraie session, avec le lien vers l'abonnement réel.
    await deliver({
      id: `evt_checkout_${runId}`,
      type: 'checkout.session.completed',
      created: startedAt,
      data: { object: { ...session, subscription: stripeSub.id } },
    } as unknown as Stripe.Event);

    await assertState({
      status: 'trialing',
      priceId: artisanPrice.id,
      tier: 'contractor_essentiel',
      artisanGateAllowed: true,
      proGateAllowed: true,
    });

    // -------------------------------------------------------------------
    step('2. Fin de l’essai — abonnement actif et première facture payée');

    await stripe.subscriptions.update(stripeSub.id, { trial_end: 'now' });
    await drainEvents(['customer.subscription.updated', 'invoice.paid']);

    await assertState({
      status: 'active',
      priceId: artisanPrice.id,
      tier: 'contractor_essentiel',
      artisanGateAllowed: true,
      proGateAllowed: true,
    });

    // -------------------------------------------------------------------
    step('3. Changement de palier — artisan vers Pro');

    const current = await stripe.subscriptions.retrieve(stripeSub.id);
    await stripe.subscriptions.update(stripeSub.id, {
      items: [{ id: current.items.data[0].id, price: proPrice.id }],
      proration_behavior: 'none',
    });
    const tierChangeEvents = await drainEvents([
      'customer.subscription.updated',
    ]);
    tierChangeEvent =
      tierChangeEvents
        .filter((event) => event.type === 'customer.subscription.updated')
        .pop() ?? null;

    await assertState({
      status: 'active',
      priceId: proPrice.id,
      tier: 'pro',
      // Le déclassement doit se voir immédiatement là où il compte : la
      // capacité vendue au seul palier artisan se referme.
      artisanGateAllowed: false,
      proGateAllowed: true,
    });

    // -------------------------------------------------------------------
    step('4. Annulation');

    await stripe.subscriptions.cancel(stripeSub.id);
    await drainEvents(['customer.subscription.deleted']);

    await assertState({
      status: 'canceled',
      priceId: proPrice.id,
      tier: 'free',
      artisanGateAllowed: false,
      proGateAllowed: false,
    });

    // -------------------------------------------------------------------
    step('5. Événement retardé — la garde d’ordonnancement, sur charge réelle');

    if (!tierChangeEvent) {
      failures += 1;
      console.error(
        "    ✗ pas d'événement de changement de palier à rejouer — étape non concluante",
      );
    } else {
      console.log(
        `    rejeu de ${tierChangeEvent.type} émis le ` +
          `${new Date(tierChangeEvent.created * 1000).toISOString()}, ` +
          'soit avant l’annulation',
      );
      // `force` : on simule une première livraison tardive, pas un retry — la
      // déduplication par event_id écarterait un retry avant toute décision.
      await deliver(tierChangeEvent, true);

      // Le défaut corrigé : cet événement remettait `status = active` et
      // rendait un palier payant à un compte résilié.
      await assertState({
        status: 'canceled',
        priceId: proPrice.id,
        tier: 'free',
        artisanGateAllowed: false,
        proGateAllowed: false,
      });
    }
  } finally {
    step('Nettoyage');

    if (stripeSubscriptionId) {
      await stripe.subscriptions
        .cancel(stripeSubscriptionId)
        .catch(() => undefined);
    }
    if (stripeCustomerId) {
      await stripe.customers.del(stripeCustomerId).catch(() => undefined);
    }
    // Les prix Stripe ne se suppriment pas ; ceux créés pour ce run sont
    // désactivés pour ne pas polluer le catalogue de test.
    for (const price of [artisanPrice, proPrice]) {
      if (price.ephemeral) {
        await stripe.prices
          .update(price.id, { active: false })
          .catch(() => undefined);
      }
    }

    await dataSource.query('DELETE FROM subscriptions WHERE user_id = $1', [
      user.id,
    ]);
    await dataSource.query(
      'DELETE FROM organizations WHERE owner_user_id = $1',
      [user.id],
    );
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
      ? '\n✓ Cycle complet vérifié : aucune divergence.'
      : `\n✗ ${failures} vérification(s) en échec.`,
  );
  process.exit(failures === 0 ? 0 : EXIT_ASSERTION_FAILED);
}

main().catch((error: unknown) => {
  console.error('\nÉchec du script de vérification :');
  console.error(error);
  process.exit(EXIT_ASSERTION_FAILED);
});
