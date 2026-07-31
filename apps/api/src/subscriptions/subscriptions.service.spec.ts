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

// Mirrors the sharp mock pattern in photos.service.spec.ts: a fake instance
// exposing the Stripe SDK surface this service actually calls, returned by
// the mocked constructor. Variable must be prefixed with "mock" so Jest lets
// the hoisted jest.mock() factory reference it.
const mockStripeInstance = {
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
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
};

const stripeEventsRepoMock = {};

const usersServiceMock = {
  updateSubscriptionTier: jest.fn(),
};

const analyticsServiceMock = {
  track: jest.fn(),
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
});
