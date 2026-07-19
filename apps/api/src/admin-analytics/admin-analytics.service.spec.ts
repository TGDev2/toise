import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from '../users/entities/user.entity';

const CONFIG_VALUES: Record<string, string> = {
  'stripe.proPriceId': 'price_pro',
  'stripe.contractorEssentielPriceId': 'price_contractor_essentiel',
  'stripe.contractorStandardPriceId': 'price_contractor_standard',
  'stripe.contractorPremiumPriceId': 'price_contractor_premium',
};

const configServiceMock = {
  get: jest.fn((key: string) => CONFIG_VALUES[key]),
};

const eventsQueryBuilderMock = {
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
};

const subscriptionsQueryBuilderMock = {
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
};

const eventsRepoMock = {
  find: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(() => eventsQueryBuilderMock),
};

const subscriptionsRepoMock = {
  count: jest.fn(),
  createQueryBuilder: jest.fn(() => subscriptionsQueryBuilderMock),
};

const usersRepoMock = {
  count: jest.fn(),
};

describe('AdminAnalyticsService', () => {
  let service: AdminAnalyticsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    eventsQueryBuilderMock.getRawMany.mockResolvedValue([]);
    subscriptionsQueryBuilderMock.getRawMany.mockResolvedValue([]);
    eventsRepoMock.find.mockResolvedValue([]);
    eventsRepoMock.count.mockResolvedValue(0);
    subscriptionsRepoMock.count.mockResolvedValue(0);
    usersRepoMock.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAnalyticsService,
        {
          provide: getRepositoryToken(AnalyticsEvent),
          useValue: eventsRepoMock,
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionsRepoMock,
        },
        { provide: getRepositoryToken(User), useValue: usersRepoMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get(AdminAnalyticsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('weekly_shopping_lists', () => {
    it('zero-fills weeks with no events, including a gap in the middle of the series', async () => {
      // "now" = mercredi 2026-07-15 -> semaine en cours commence lundi 2026-07-13
      jest.useFakeTimers().setSystemTime(new Date('2026-07-15T12:00:00.000Z'));

      eventsRepoMock.find.mockResolvedValue([
        { created_at: new Date('2026-06-30T09:00:00.000Z') }, // semaine 0 (29 juin)
        { created_at: new Date('2026-07-14T09:00:00.000Z') }, // semaine 2 (13 juillet)
        { created_at: new Date('2026-07-14T18:00:00.000Z') }, // semaine 2 (13 juillet)
      ]);

      const result = await service.getDashboard(3, 30);

      expect(result.weekly_shopping_lists).toEqual({
        weeks: 3,
        series: [
          { week_start: '2026-06-29', count: 1 },
          { week_start: '2026-07-06', count: 0 },
          { week_start: '2026-07-13', count: 2 },
        ],
      });
    });
  });

  describe('funnel', () => {
    it('computes conversion from previous and from start, defaulting to 0 (never NaN) when a step has zero events', async () => {
      eventsRepoMock.count.mockResolvedValue(200); // calculator_viewed
      eventsQueryBuilderMock.getRawMany.mockResolvedValue([
        { event_name: 'account_created', count: '100' },
        // estimate_created, shopping_list_generated, checkout_started : aucune ligne (0 événement)
      ]);

      const result = await service.getDashboard(4, 30);

      expect(result.funnel.steps).toEqual([
        {
          event_name: 'calculator_viewed',
          count: 200,
          conversion_from_previous: null,
          conversion_from_start: 100,
        },
        {
          event_name: 'account_created',
          count: 100,
          conversion_from_previous: 50,
          conversion_from_start: 50,
        },
        {
          event_name: 'estimate_created',
          count: 0,
          conversion_from_previous: 0,
          conversion_from_start: 0,
        },
        {
          event_name: 'shopping_list_generated',
          count: 0,
          conversion_from_previous: 0, // 0/0 -> 0, jamais NaN
          conversion_from_start: 0,
        },
        {
          event_name: 'checkout_started',
          count: 0,
          conversion_from_previous: 0,
          conversion_from_start: 0,
        },
      ]);
    });
  });

  describe('mrr', () => {
    it('resolves price_id to tier/amount, aggregates the 3 contractor plans into one tier, and ignores an unknown price_id without throwing', async () => {
      subscriptionsQueryBuilderMock.getRawMany.mockResolvedValue([
        { price_id: 'price_pro', count: '3' },
        { price_id: 'price_contractor_essentiel', count: '2' },
        { price_id: 'price_contractor_standard', count: '1' },
        { price_id: 'price_unknown_legacy', count: '4' },
      ]);
      subscriptionsRepoMock.count.mockResolvedValue(8); // trialing
      usersRepoMock.count.mockResolvedValue(512); // free

      const result = await service.getDashboard(4, 30);

      expect(result.mrr).toEqual({
        statuses_included: ['active', 'past_due'],
        currency: 'EUR',
        total_mrr: 229.97,
        by_tier: [
          { tier: 'pro', subscriber_count: 3, mrr: 29.97 },
          { tier: 'contractor', subscriber_count: 3, mrr: 200 },
        ],
        free_users_count: 512,
        trialing_count: 8,
      });
    });
  });
});
