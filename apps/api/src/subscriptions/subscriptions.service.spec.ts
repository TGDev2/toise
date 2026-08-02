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
};

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
    subscriptionsRepoMock.findOne.mockResolvedValue({
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
