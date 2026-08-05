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

const CONFIG_VALUES: Record<string, string> = {
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
 */
function mockUpdateAffecting(affected: number) {
  const builder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected }),
  };
  subscriptionsRepoMock.createQueryBuilder.mockReturnValue(builder);
  return builder;
}

const stripeEventsRepoMock = {};

const usersServiceMock = {
  updateSubscriptionTier: jest.fn(),
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
