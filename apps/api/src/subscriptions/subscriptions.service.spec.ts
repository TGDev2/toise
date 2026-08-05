import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import {
  Subscription,
  SubscriptionStatus,
} from './entities/subscription.entity';
import { StripeEvent } from './entities/stripe-event.entity';
import { UsersService } from '../users/users.service';
import { SubscriptionTier } from '../users/entities/user.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import { ReferralsService } from '../referrals/referrals.service';

// Mirrors the sharp mock pattern in photos.service.spec.ts: a fake instance
// exposing the Stripe SDK surface this service actually calls, returned by
// the mocked constructor. Variable must be prefixed with "mock" so Jest lets
// the hoisted jest.mock() factory reference it.
const mockStripeInstance = {
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  subscriptions: { retrieve: jest.fn(), cancel: jest.fn() },
};

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => mockStripeInstance),
);

const CONFIG_VALUES: Record<string, string | number> = {
  'stripe.secretKey': 'sk_test_123',
  'stripe.webhookSecret': 'whsec_test',
  'stripe.proPriceId': 'price_pro',
  publicUrl: 'https://chiffreo.fr',
  'stripe.contractorEssentielPriceId': 'price_contractor_essentiel',
  'stripe.contractorStandardPriceId': 'price_contractor_standard',
  'stripe.contractorPremiumPriceId': 'price_contractor_premium',
};

const configServiceMock = {
  get: jest.fn((key: string) => CONFIG_VALUES[key]),
};

const subscriptionsRepoMock = {
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  upsert: jest.fn(),
  createQueryBuilder: jest.fn(),
};

/**
 * Chaîne minimale de l'`UpdateQueryBuilder` employée par `applyEventState`, avec
 * le nombre de lignes que l'UPDATE conditionnel dit avoir touchées.
 *
 * Ce que ce mock **ne** prouve **pas** : que la condition SQL écarte bien un
 * événement périmé — elle vit dans un `WHERE`, seul PostgreSQL peut en juger.
 * C'est l'objet de `test/integration/persistence.int-spec.ts`. Ici on vérifie
 * la conséquence côté service : `affected = 0` ne doit synchroniser aucun
 * palier ni émettre aucun événement analytique.
 *
 * `pastDueSince` est ce que le `RETURNING` de l'UPDATE rapporte : l'état de
 * l'horodatage de grâce **après** écriture, donc après le `COALESCE`. C'est
 * cette valeur, et non la ligne relue avant l'UPDATE, qui décide du palier.
 */
function mockUpdateAffecting(
  affected: number,
  pastDueSince: Date | null = null,
) {
  const builder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({
      affected,
      raw: affected > 0 ? [{ past_due_since: pastDueSince }] : [],
    }),
  };
  subscriptionsRepoMock.createQueryBuilder.mockReturnValue(builder);
  return builder;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const stripeEventsRepoMock = {};

const usersServiceMock = {
  updateSubscriptionTier: jest.fn(),
  downgradeToFreeIfNeeded: jest.fn(),
};

const analyticsServiceMock = {
  track: jest.fn(),
};

const referralsServiceMock = {
  handleReferredUserConverted: jest.fn(),
  applyPendingCreditsForNewCustomer: jest.fn(),
};

describe('SubscriptionsService.createCheckoutSession', () => {
  let service: SubscriptionsService;

  const testUser = { id: 'user-1', email: 'client@example.fr' };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionsRepoMock,
        },
        {
          provide: getRepositoryToken(StripeEvent),
          useValue: stripeEventsRepoMock,
        },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
        { provide: ReferralsService, useValue: referralsServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get(SubscriptionsService);
  });

  it('rejects an unknown price id', async () => {
    await expect(
      service.createCheckoutSession(testUser, 'price_unknown'),
    ).rejects.toThrow(BadRequestException);

    expect(mockStripeInstance.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('rejects when the user already has an active subscription', async () => {
    subscriptionsRepoMock.findOne.mockResolvedValue({
      status: SubscriptionStatus.ACTIVE,
      stripe_customer_id: 'cus_existing',
    });

    await expect(service.createCheckoutSession(testUser)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('creates a Stripe checkout session for a new customer', async () => {
    subscriptionsRepoMock.findOne.mockResolvedValue(null);
    mockStripeInstance.customers.create.mockResolvedValue({ id: 'cus_new' });
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/session',
    });

    const result = await service.createCheckoutSession(testUser);

    expect(result).toEqual({ url: 'https://checkout.stripe.com/session' });
    expect(mockStripeInstance.customers.create).toHaveBeenCalledWith({
      email: testUser.email,
      metadata: { user_id: testUser.id },
    });
  });

  it('tracks a checkout_started analytics event with the resolved plan', async () => {
    subscriptionsRepoMock.findOne.mockResolvedValue(null);
    mockStripeInstance.customers.create.mockResolvedValue({ id: 'cus_new' });
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/session',
    });

    await service.createCheckoutSession(testUser);

    expect(analyticsServiceMock.track).toHaveBeenCalledWith(
      AnalyticsEventName.CHECKOUT_STARTED,
      testUser.id,
      { plan: 'pro', price_id: 'price_pro' },
    );
  });

  it('resolves the precise Contractor sub-tier for analytics, not a generic "contractor" (BACKLOG PRO-1)', async () => {
    subscriptionsRepoMock.findOne.mockResolvedValue(null);
    mockStripeInstance.customers.create.mockResolvedValue({ id: 'cus_new' });
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/session',
    });

    await service.createCheckoutSession(testUser, 'price_contractor_standard');

    expect(analyticsServiceMock.track).toHaveBeenCalledWith(
      AnalyticsEventName.CHECKOUT_STARTED,
      testUser.id,
      { plan: 'contractor_standard', price_id: 'price_contractor_standard' },
    );
  });

  /**
   * L'essai se lit dans `PLANS` et nulle part ailleurs. Il était auparavant
   * déduit de « ce prix est-il un prix contractor ? », si bien que le palier
   * artisan déclarait `trial_days` sans que le checkout ne le regarde jamais.
   */
  it('accorde au palier artisan les 7 jours d’essai déclarés dans PLANS', async () => {
    subscriptionsRepoMock.findOne.mockResolvedValue(null);
    mockStripeInstance.customers.create.mockResolvedValue({ id: 'cus_new' });
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/session',
    });

    await service.createCheckoutSession(testUser, 'price_contractor_essentiel');

    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_contractor_essentiel', quantity: 1 }],
        subscription_data: { trial_period_days: 7 },
      }),
    );
  });

  it('n’attache aucun essai à un palier dont PLANS déclare trial_days: 0', async () => {
    subscriptionsRepoMock.findOne.mockResolvedValue(null);
    mockStripeInstance.customers.create.mockResolvedValue({ id: 'cus_new' });
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/session',
    });

    await service.createCheckoutSession(testUser, 'price_contractor_standard');

    const [payload] = mockStripeInstance.checkout.sessions.create.mock
      .calls[0] as [Record<string, unknown>];
    expect(payload.subscription_data).toBeUndefined();
  });

  it('applies pending referral credits when a new Stripe customer is created (BACKLOG COM-3)', async () => {
    subscriptionsRepoMock.findOne.mockResolvedValue(null);
    mockStripeInstance.customers.create.mockResolvedValue({ id: 'cus_new' });
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/session',
    });

    await service.createCheckoutSession(testUser);

    expect(
      referralsServiceMock.applyPendingCreditsForNewCustomer,
    ).toHaveBeenCalledWith(testUser.id, 'cus_new');
  });

  it('does not fail checkout when applying pending referral credits throws (BACKLOG COM-3)', async () => {
    subscriptionsRepoMock.findOne.mockResolvedValue(null);
    mockStripeInstance.customers.create.mockResolvedValue({ id: 'cus_new' });
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/session',
    });
    referralsServiceMock.applyPendingCreditsForNewCustomer.mockRejectedValue(
      new Error('stripe down'),
    );

    const result = await service.createCheckoutSession(testUser);

    expect(result).toEqual({ url: 'https://checkout.stripe.com/session' });
  });

  it('does not create Stripe customer side effects for an existing customer (no referral credit flush)', async () => {
    subscriptionsRepoMock.findOne.mockResolvedValue({
      status: SubscriptionStatus.CANCELED,
      stripe_customer_id: 'cus_existing',
    });
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/session',
    });

    await service.createCheckoutSession(testUser);

    expect(mockStripeInstance.customers.create).not.toHaveBeenCalled();
    expect(
      referralsServiceMock.applyPendingCreditsForNewCustomer,
    ).not.toHaveBeenCalled();
  });
});

describe('SubscriptionsService.handleWebhookEvent (invoice.paid)', () => {
  let service: SubscriptionsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionsRepoMock,
        },
        {
          provide: getRepositoryToken(StripeEvent),
          useValue: stripeEventsRepoMock,
        },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
        { provide: ReferralsService, useValue: referralsServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get(SubscriptionsService);
  });

  function buildInvoicePaidEvent(stripeSubscriptionId: string) {
    return {
      type: 'invoice.paid',
      created: 1_700_000_000,
      data: {
        object: {
          parent: {
            subscription_details: { subscription: stripeSubscriptionId },
          },
        },
      },
    } as unknown as Parameters<SubscriptionsService['handleWebhookEvent']>[0];
  }

  it('triggers referral conversion handling for the now-paying user (BACKLOG COM-3)', async () => {
    mockUpdateAffecting(1);
    subscriptionsRepoMock.findOne.mockResolvedValue({
      id: 'row-1',
      user_id: 'user-1',
      stripe_subscription_id: 'sub_123',
    });
    mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
      status: 'active',
      trial_end: null,
      cancel_at_period_end: false,
      items: {
        data: [
          {
            price: { id: 'price_pro' },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
          },
        ],
      },
    });

    await service.handleWebhookEvent(buildInvoicePaidEvent('sub_123'));

    expect(
      referralsServiceMock.handleReferredUserConverted,
    ).toHaveBeenCalledWith('user-1');
  });

  it('does nothing when the invoice does not match a known subscription', async () => {
    subscriptionsRepoMock.findOne.mockResolvedValue(null);

    await service.handleWebhookEvent(buildInvoicePaidEvent('sub_unknown'));

    expect(
      referralsServiceMock.handleReferredUserConverted,
    ).not.toHaveBeenCalled();
  });
});

/**
 * Ordre de livraison des webhooks Stripe.
 *
 * Stripe garantit la livraison, jamais l'ordre. Les handlers appliquaient le
 * dernier événement **arrivé** : un `customer.subscription.updated` émis avant
 * une résiliation mais livré après elle rendait à l'abonné un palier qu'il ne
 * payait plus. `applyEventState` écarte désormais l'écriture périmée — et donc
 * la synchronisation de palier qui la suivait.
 */
describe('SubscriptionsService.handleWebhookEvent — ordre de livraison', () => {
  let service: SubscriptionsService;

  /** Émission chez Stripe : T1 précède T2 d'une minute. */
  const T1 = 1_700_000_000;
  const T2 = T1 + 60;

  const localRow = {
    id: 'row-1',
    user_id: 'user-1',
    stripe_subscription_id: 'sub_1',
    stripe_price_id: 'price_contractor_essentiel',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionsRepoMock,
        },
        {
          provide: getRepositoryToken(StripeEvent),
          useValue: stripeEventsRepoMock,
        },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
        { provide: ReferralsService, useValue: referralsServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get(SubscriptionsService);
    subscriptionsRepoMock.findOne.mockResolvedValue(localRow);
  });

  /** `customer.subscription.updated` portant un abonnement actif au prix donné. */
  function subscriptionUpdatedEvent(created: number, priceId: string) {
    return {
      type: 'customer.subscription.updated',
      created,
      data: {
        object: {
          id: 'sub_1',
          status: 'active',
          cancel_at_period_end: false,
          trial_end: null,
          items: {
            data: [
              {
                price: { id: priceId },
                current_period_start: created,
                current_period_end: created + 2_592_000,
              },
            ],
          },
        },
      },
    } as unknown as Parameters<SubscriptionsService['handleWebhookEvent']>[0];
  }

  function subscriptionDeletedEvent(created: number) {
    return {
      type: 'customer.subscription.deleted',
      created,
      data: { object: { id: 'sub_1', status: 'canceled' } },
    } as unknown as Parameters<SubscriptionsService['handleWebhookEvent']>[0];
  }

  it('date la garde sur l’émission de l’événement, pas sur sa réception', async () => {
    const builder = mockUpdateAffecting(1);

    await service.handleWebhookEvent(
      subscriptionUpdatedEvent(T1, 'price_contractor_essentiel'),
    );

    expect(builder.set).toHaveBeenCalledWith(
      expect.objectContaining({ last_stripe_event_at: new Date(T1 * 1000) }),
    );
  });

  it('ne restaure aucun palier depuis un customer.subscription.updated périmé', async () => {
    // La résiliation (T2) a déjà été appliquée : l'UPDATE conditionnel de
    // l'événement retardé (T1) ne touche aucune ligne.
    mockUpdateAffecting(0);

    await service.handleWebhookEvent(
      subscriptionUpdatedEvent(T1, 'price_contractor_essentiel'),
    );

    // Le symptôme exact du défaut : un palier payant rendu à un compte résilié.
    expect(usersServiceMock.updateSubscriptionTier).not.toHaveBeenCalled();
  });

  it('applique ce même événement quand il est le plus récent (témoin)', async () => {
    mockUpdateAffecting(1);

    await service.handleWebhookEvent(
      subscriptionUpdatedEvent(T2, 'price_contractor_essentiel'),
    );

    // La garde écarte le périmé, pas tout : sans ce témoin, un handler cassé
    // passerait le test précédent.
    expect(usersServiceMock.updateSubscriptionTier).toHaveBeenCalledWith(
      'user-1',
      SubscriptionTier.CONTRACTOR_ESSENTIEL,
    );
  });

  it('n’annule pas un abonnement depuis un customer.subscription.deleted périmé', async () => {
    mockUpdateAffecting(0);

    await service.handleWebhookEvent(subscriptionDeletedEvent(T1));

    expect(usersServiceMock.updateSubscriptionTier).not.toHaveBeenCalled();
    // Pas d'écriture, pas d'événement analytique : une résiliation périmée
    // comptée dans le funnel ferait voir un départ qui n'a pas eu lieu.
    expect(analyticsServiceMock.track).not.toHaveBeenCalled();
  });
});

/**
 * Non-régression de la facturation lors d'une suppression de compte.
 *
 * `FK_subscriptions_user` était en `ON DELETE CASCADE` : effacer l'utilisateur
 * emportait la ligne — donc le `stripe_subscription_id` et le
 * `stripe_customer_id` — sans qu'aucune requête ne parte chez Stripe.
 * L'abonnement continuait de prélever et plus rien en local ne permettait
 * d'ouvrir le portail. Cf. migration 1711468800061.
 */
describe('SubscriptionsService.cancelForAccountDeletion', () => {
  let service: SubscriptionsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionsRepoMock,
        },
        {
          provide: getRepositoryToken(StripeEvent),
          useValue: stripeEventsRepoMock,
        },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
        { provide: ReferralsService, useValue: referralsServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get(SubscriptionsService);
  });

  const subscription = {
    id: 'row-1',
    user_id: 'user-1',
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: 'sub_1',
    status: SubscriptionStatus.ACTIVE,
  };

  it('résilie chez Stripe avant de supprimer la ligne locale', async () => {
    subscriptionsRepoMock.findOne.mockResolvedValue(subscription);

    await service.cancelForAccountDeletion('user-1');

    expect(mockStripeInstance.subscriptions.cancel).toHaveBeenCalledWith(
      'sub_1',
    );
    expect(subscriptionsRepoMock.delete).toHaveBeenCalledWith({ id: 'row-1' });
  });

  it.each([
    SubscriptionStatus.TRIALING,
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.INCOMPLETE,
  ])('résilie aussi un abonnement %s', async (status) => {
    subscriptionsRepoMock.findOne.mockResolvedValue({
      ...subscription,
      status,
    });

    await service.cancelForAccountDeletion('user-1');

    expect(mockStripeInstance.subscriptions.cancel).toHaveBeenCalledWith(
      'sub_1',
    );
  });

  it('conserve la ligne locale si Stripe refuse la résiliation', async () => {
    subscriptionsRepoMock.findOne.mockResolvedValue(subscription);
    mockStripeInstance.subscriptions.cancel.mockRejectedValue(
      new Error('stripe unavailable'),
    );

    await expect(service.cancelForAccountDeletion('user-1')).rejects.toThrow(
      'stripe unavailable',
    );

    // Le cœur du constat : ne jamais effacer le lien local tant que
    // l'abonnement externe peut encore prélever.
    expect(subscriptionsRepoMock.delete).not.toHaveBeenCalled();
  });

  it('reste idempotent si Stripe ne connaît plus cet abonnement', async () => {
    subscriptionsRepoMock.findOne.mockResolvedValue(subscription);
    mockStripeInstance.subscriptions.cancel.mockRejectedValue(
      Object.assign(new Error('No such subscription'), {
        type: 'StripeInvalidRequestError',
        code: 'resource_missing',
      }),
    );

    await service.cancelForAccountDeletion('user-1');

    expect(subscriptionsRepoMock.delete).toHaveBeenCalledWith({ id: 'row-1' });
  });

  it("n'appelle pas Stripe pour un abonnement déjà résilié", async () => {
    subscriptionsRepoMock.findOne.mockResolvedValue({
      ...subscription,
      status: SubscriptionStatus.CANCELED,
    });

    await service.cancelForAccountDeletion('user-1');

    expect(mockStripeInstance.subscriptions.cancel).not.toHaveBeenCalled();
    expect(subscriptionsRepoMock.delete).toHaveBeenCalledWith({ id: 'row-1' });
  });

  it("ne fait rien pour un compte qui n'a jamais souscrit", async () => {
    subscriptionsRepoMock.findOne.mockResolvedValue(null);

    await service.cancelForAccountDeletion('user-1');

    expect(mockStripeInstance.subscriptions.cancel).not.toHaveBeenCalled();
    expect(subscriptionsRepoMock.delete).not.toHaveBeenCalled();
  });
});

/**
 * Délai de grâce sur impayé (E5-2).
 *
 * `past_due` comptait comme un statut actif sans réserve : un abonné dont le
 * paiement échouait gardait toutes ses capacités jusqu'à la résiliation par
 * Stripe, c'est-à-dire pendant toute la durée des relances — plusieurs semaines
 * de service gratuit par incident. Il reste actif, mais pour un délai borné.
 *
 * Ce que ces tests **ne** prouvent **pas** : que le `COALESCE` retient bien la
 * date de la première entrée en `past_due` malgré les relances. Il vit dans un
 * `SET` et seul PostgreSQL peut en juger — c'est l'objet de
 * `test/integration/persistence.int-spec.ts`. Ici on vérifie les conséquences
 * côté service : quel palier est écrit, et pour quelle échéance.
 */
describe('SubscriptionsService — délai de grâce past_due', () => {
  let service: SubscriptionsService;

  const NOW = 1_800_000_000_000;
  const localRow = {
    id: 'row-1',
    user_id: 'user-1',
    stripe_subscription_id: 'sub_1',
    stripe_price_id: 'price_contractor_essentiel',
  };

  async function buildService(graceDays?: number) {
    if (graceDays === undefined) {
      delete CONFIG_VALUES['stripe.pastDueGraceDays'];
    } else {
      CONFIG_VALUES['stripe.pastDueGraceDays'] = graceDays;
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionsRepoMock,
        },
        {
          provide: getRepositoryToken(StripeEvent),
          useValue: stripeEventsRepoMock,
        },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
        { provide: ReferralsService, useValue: referralsServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    return module.get<SubscriptionsService>(SubscriptionsService);
  }

  /** `customer.subscription.updated` portant le statut donné. */
  function subscriptionUpdatedEvent(status: string) {
    return {
      type: 'customer.subscription.updated',
      created: Math.floor(NOW / 1000),
      data: {
        object: {
          id: 'sub_1',
          status,
          cancel_at_period_end: false,
          trial_end: null,
          items: {
            data: [
              {
                price: { id: 'price_contractor_essentiel' },
                current_period_start: Math.floor(NOW / 1000),
                current_period_end: Math.floor(NOW / 1000) + 2_592_000,
              },
            ],
          },
        },
      },
    } as unknown as Parameters<SubscriptionsService['handleWebhookEvent']>[0];
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(NOW);
    subscriptionsRepoMock.findOne.mockResolvedValue(localRow);
    subscriptionsRepoMock.find.mockResolvedValue([]);
    service = await buildService();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete CONFIG_VALUES['stripe.pastDueGraceDays'];
  });

  describe('entrée en past_due', () => {
    it("horodate l'entrée sans jamais écraser un horodatage existant", async () => {
      const builder = mockUpdateAffecting(1, new Date(NOW));

      await service.handleWebhookEvent({
        type: 'invoice.payment_failed',
        created: Math.floor(NOW / 1000),
        data: {
          object: {
            parent: { subscription_details: { subscription: 'sub_1' } },
          },
        },
      } as unknown as Parameters<
        SubscriptionsService['handleWebhookEvent']
      >[0]);

      // Le `COALESCE` est ce qui empêche les relances Stripe — une bonne
      // dizaine sur trois semaines — de repousser l'échéance à chaque passage.
      const written = (
        builder.set.mock.calls as unknown as [
          { past_due_since: () => string },
        ][]
      )[0][0];
      expect(typeof written.past_due_since).toBe('function');
      expect(written.past_due_since()).toContain('COALESCE');
    });

    it('conserve le palier payant pendant le délai de grâce', async () => {
      mockUpdateAffecting(1, new Date(NOW - 1 * DAY_MS));

      await service.handleWebhookEvent(subscriptionUpdatedEvent('past_due'));

      expect(usersServiceMock.updateSubscriptionTier).toHaveBeenCalledWith(
        'user-1',
        SubscriptionTier.CONTRACTOR_ESSENTIEL,
      );
    });

    it("conserve encore le palier la veille de l'échéance (témoin)", async () => {
      mockUpdateAffecting(1, new Date(NOW - 13 * DAY_MS));

      await service.handleWebhookEvent(subscriptionUpdatedEvent('past_due'));

      // Sans ce témoin, une implémentation qui déclasserait tout `past_due`
      // passerait le test d'expiration ci-dessous.
      expect(usersServiceMock.updateSubscriptionTier).toHaveBeenCalledWith(
        'user-1',
        SubscriptionTier.CONTRACTOR_ESSENTIEL,
      );
    });
  });

  describe('sortie par un paiement réussi', () => {
    it("efface l'horodatage de grâce et rend le palier payant", async () => {
      const builder = mockUpdateAffecting(1, null);
      mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_1',
        status: 'active',
        items: {
          data: [
            {
              price: { id: 'price_contractor_essentiel' },
              current_period_start: Math.floor(NOW / 1000),
              current_period_end: Math.floor(NOW / 1000) + 2_592_000,
            },
          ],
        },
      });

      await service.handleWebhookEvent({
        type: 'invoice.paid',
        created: Math.floor(NOW / 1000),
        data: {
          object: {
            parent: { subscription_details: { subscription: 'sub_1' } },
          },
        },
      } as unknown as Parameters<
        SubscriptionsService['handleWebhookEvent']
      >[0]);

      // `null` littéral, pas une fonction : l'épisode d'impayé est clos, pas
      // prolongé.
      expect(builder.set).toHaveBeenCalledWith(
        expect.objectContaining({ past_due_since: null }),
      );
      expect(usersServiceMock.updateSubscriptionTier).toHaveBeenCalledWith(
        'user-1',
        SubscriptionTier.CONTRACTOR_ESSENTIEL,
      );
    });

    it('rend le palier même après expiration du délai (rattrapage)', async () => {
      mockUpdateAffecting(1, null);

      await service.handleWebhookEvent(subscriptionUpdatedEvent('active'));

      // Aucun code de « réactivation » n'est nécessaire : le statut redevenu
      // actif efface l'horodatage, et la synchronisation normale fait le reste.
      expect(usersServiceMock.updateSubscriptionTier).toHaveBeenCalledWith(
        'user-1',
        SubscriptionTier.CONTRACTOR_ESSENTIEL,
      );
    });
  });

  describe('expiration du délai', () => {
    it('déclasse en gratuit une fois le délai écoulé', async () => {
      mockUpdateAffecting(1, new Date(NOW - 15 * DAY_MS));

      await service.handleWebhookEvent(subscriptionUpdatedEvent('past_due'));

      // C'est le test qui échoue sur le code d'avant E5-2 : `past_due` y était
      // rangé parmi les statuts actifs sans réserve.
      expect(usersServiceMock.updateSubscriptionTier).toHaveBeenCalledWith(
        'user-1',
        SubscriptionTier.FREE,
      );
    });

    it('respecte STRIPE_PAST_DUE_GRACE_DAYS', async () => {
      service = await buildService(30);
      mockUpdateAffecting(1, new Date(NOW - 20 * DAY_MS));

      await service.handleWebhookEvent(subscriptionUpdatedEvent('past_due'));

      // 20 jours d'impayé, délai réglé à 30 : encore dans les temps.
      expect(usersServiceMock.updateSubscriptionTier).toHaveBeenCalledWith(
        'user-1',
        SubscriptionTier.CONTRACTOR_ESSENTIEL,
      );
    });
  });

  describe('balayage horaire', () => {
    const expiredRow = {
      ...localRow,
      status: SubscriptionStatus.PAST_DUE,
      past_due_since: new Date(NOW - 20 * DAY_MS),
    };

    it('déclasse les abonnés dont le délai est écoulé', async () => {
      subscriptionsRepoMock.find.mockResolvedValue([expiredRow]);
      usersServiceMock.downgradeToFreeIfNeeded.mockResolvedValue(true);

      await service.sweepExpiredGracePeriods();

      expect(usersServiceMock.downgradeToFreeIfNeeded).toHaveBeenCalledWith(
        'user-1',
      );
      expect(analyticsServiceMock.track).toHaveBeenCalledWith(
        AnalyticsEventName.SUBSCRIPTION_GRACE_EXPIRED,
        'user-1',
        expect.objectContaining({
          plan: SubscriptionTier.CONTRACTOR_ESSENTIEL,
        }),
      );
    });

    it("n'émet aucun événement analytique au passage suivant", async () => {
      subscriptionsRepoMock.find.mockResolvedValue([expiredRow]);
      usersServiceMock.downgradeToFreeIfNeeded.mockResolvedValue(false);

      await service.sweepExpiredGracePeriods();

      // Le balayage repasse toutes les heures sur les mêmes lignes tant que
      // l'impayé dure : sans cette garde, le funnel compterait une expiration
      // par heure et par abonné.
      expect(analyticsServiceMock.track).not.toHaveBeenCalled();
    });

    it("ne touche jamais au statut de l'abonnement", async () => {
      subscriptionsRepoMock.find.mockResolvedValue([expiredRow]);
      usersServiceMock.downgradeToFreeIfNeeded.mockResolvedValue(true);

      await service.sweepExpiredGracePeriods();

      // C'est cet invariant qui rend la reprise gratuite : la ligne reste
      // `past_due` avec son filigrane intact, et un `invoice.paid` la remet en
      // `active` par le chemin normal.
      expect(subscriptionsRepoMock.createQueryBuilder).not.toHaveBeenCalled();
      expect(subscriptionsRepoMock.save).not.toHaveBeenCalled();
      expect(subscriptionsRepoMock.upsert).not.toHaveBeenCalled();
    });

    it('poursuit le balayage quand un abonné échoue', async () => {
      subscriptionsRepoMock.find.mockResolvedValue([
        { ...expiredRow, id: 'row-1', user_id: 'user-1' },
        { ...expiredRow, id: 'row-2', user_id: 'user-2' },
      ]);
      usersServiceMock.downgradeToFreeIfNeeded
        .mockRejectedValueOnce(new Error('deadlock'))
        .mockResolvedValueOnce(true);

      await service.sweepExpiredGracePeriods();

      expect(usersServiceMock.downgradeToFreeIfNeeded).toHaveBeenCalledWith(
        'user-2',
      );
    });
  });

  describe('checkout pendant un impayé', () => {
    it('refuse un nouveau checkout et renvoie vers le portail', async () => {
      subscriptionsRepoMock.findOne.mockResolvedValue({
        status: SubscriptionStatus.PAST_DUE,
        stripe_customer_id: 'cus_existing',
      });

      await expect(
        service.createCheckoutSession(
          { id: 'user-1', email: 'client@example.fr' },
          'price_contractor_essentiel',
        ),
      ).rejects.toThrow(BadRequestException);

      // Le laisser passer créait une **seconde** souscription Stripe : la
      // première restait vivante et facturée, hors d'atteinte de la
      // suppression de compte, et l'essai gratuit était re-servi au passage.
      expect(
        mockStripeInstance.checkout.sessions.create,
      ).not.toHaveBeenCalled();
    });
  });
});
