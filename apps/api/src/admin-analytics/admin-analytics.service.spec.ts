import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import {
  monthlyEquivalentEuros,
  PLANS,
} from '../subscriptions/plans.constants';
import { User } from '../users/entities/user.entity';

/**
 * Les montants attendus se déduisent du catalogue de plans plutôt que d'être
 * recopiés : ce test porte sur la résolution `price_id` → palier, pas sur la
 * grille tarifaire. Recopiés, ils tombaient au premier réalignement de prix
 * (GTM-8 : 50/100/200 € → 19/29/49 €) sans rien signaler d'utile.
 *
 * **L'équivalent mensuel, pas le prix.** `plan.price` est un montant par
 * période, et la période est annuelle depuis E3-3 : le comparer directement à
 * un MRR publierait douze fois la réalité. Ce test l'a laissé passer une fois
 * — il portait sur la résolution du palier, jamais sur la grandeur.
 */
const planMonthlyRevenue = (key: string): number => {
  const plan = PLANS.find((candidate) => candidate.key === key);
  if (!plan) throw new Error(`Plan inconnu dans le test : ${key}`);
  return monthlyEquivalentEuros(plan);
};

const CONFIG_VALUES: Record<string, string> = {
  'stripe.contractorEssentielPriceId': 'price_contractor_essentiel',
};

const configServiceMock = {
  get: jest.fn((key: string) => CONFIG_VALUES[key]),
};

// `getDashboard` lance désormais plusieurs agrégations concurrentes sur le même
// repo d'événements (funnel DATA-1, entonnoir de revenu). Un mock unique et
// partagé leur servirait les mêmes lignes : chaque appel reçoit donc son
// propre builder, qui retient le(s) nom(s) d'événement passé(s) au `where` et
// répond depuis ce registre.
const rawRowsByEvent: Record<string, unknown[]> = {};

interface EventsQueryBuilderMock {
  select: jest.Mock<EventsQueryBuilderMock>;
  addSelect: jest.Mock<EventsQueryBuilderMock>;
  where: jest.Mock<EventsQueryBuilderMock>;
  andWhere: jest.Mock<EventsQueryBuilderMock>;
  groupBy: jest.Mock<EventsQueryBuilderMock>;
  addGroupBy: jest.Mock<EventsQueryBuilderMock>;
  getRawMany: jest.Mock<Promise<unknown[]>>;
}

function makeEventsQueryBuilder(): EventsQueryBuilderMock {
  const params: Record<string, unknown> = {};
  const capture = (
    _condition: string,
    values?: Record<string, unknown>,
  ): EventsQueryBuilderMock => {
    Object.assign(params, values ?? {});
    return builder;
  };
  const self = (): EventsQueryBuilderMock => builder;
  const builder: EventsQueryBuilderMock = {
    select: jest.fn(self),
    addSelect: jest.fn(self),
    where: jest.fn(capture),
    andWhere: jest.fn(capture),
    groupBy: jest.fn(self),
    addGroupBy: jest.fn(self),
    getRawMany: jest.fn((): Promise<unknown[]> => {
      const names = (params.eventNames as string[] | undefined) ?? [
        params.eventName as string,
      ];
      return Promise.resolve(rawRowsByEvent[names[0]] ?? []);
    }),
  };
  return builder;
}

// Idem pour les `count` : le funnel DATA-1 compte `calculator_viewed`, le
// funnel de revenu compte aussi `public_calculation_completed`.
const countsByEvent: Record<string, number> = {};

const subscriptionsQueryBuilderMock = {
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
};

const eventsRepoMock = {
  find: jest.fn(),
  count: jest.fn(({ where }: { where: { event_name: string } }) =>
    Promise.resolve(countsByEvent[where.event_name] ?? 0),
  ),
  createQueryBuilder: jest.fn(() => makeEventsQueryBuilder()),
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
    for (const key of Object.keys(rawRowsByEvent)) delete rawRowsByEvent[key];
    for (const key of Object.keys(countsByEvent)) delete countsByEvent[key];
    subscriptionsQueryBuilderMock.getRawMany.mockResolvedValue([]);
    eventsRepoMock.find.mockResolvedValue([]);
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
      countsByEvent['calculator_viewed'] = 200;
      rawRowsByEvent['account_created'] = [
        { event_name: 'account_created', count: '100' },
        // estimate_created, shopping_list_generated, checkout_started : aucune ligne (0 événement)
      ];

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

  describe('revenue_funnel', () => {
    it('computes conversion from previous and from start across all 11 steps when every step clears the minimum sample', async () => {
      countsByEvent['calculator_viewed'] = 500;
      countsByEvent['public_calculation_completed'] = 400;
      rawRowsByEvent['guest_session_started'] = [
        { event_name: 'guest_session_started', count: '300' },
        { event_name: 'dimensions_entered', count: '150' },
        { event_name: 'estimate_created', count: '100' },
        { event_name: 'shopping_list_generated', count: '80' },
        { event_name: 'account_created', count: '40' },
        { event_name: 'quote_generated', count: '35' },
        { event_name: 'trial_started', count: '32' },
        { event_name: 'paid_subscription_active', count: '31' },
        { event_name: 'subscription_canceled', count: '5' },
      ];

      const result = await service.getDashboard(4, 30);

      expect(result.revenue_funnel.min_sample_size).toBe(30);
      expect(result.revenue_funnel.steps).toEqual([
        {
          event_name: 'calculator_viewed',
          count: 500,
          sufficient_data: true,
          conversion_from_previous: null,
          conversion_from_start: 100,
        },
        {
          event_name: 'public_calculation_completed',
          count: 400,
          sufficient_data: true,
          conversion_from_previous: 80,
          conversion_from_start: 80,
        },
        {
          event_name: 'guest_session_started',
          count: 300,
          sufficient_data: true,
          conversion_from_previous: 75,
          conversion_from_start: 60,
        },
        {
          event_name: 'dimensions_entered',
          count: 150,
          sufficient_data: true,
          conversion_from_previous: 50,
          conversion_from_start: 30,
        },
        {
          event_name: 'estimate_created',
          count: 100,
          sufficient_data: true,
          conversion_from_previous: 66.67,
          conversion_from_start: 20,
        },
        {
          event_name: 'shopping_list_generated',
          count: 80,
          sufficient_data: true,
          conversion_from_previous: 80,
          conversion_from_start: 16,
        },
        {
          event_name: 'account_created',
          count: 40,
          sufficient_data: true,
          conversion_from_previous: 50,
          conversion_from_start: 8,
        },
        {
          event_name: 'quote_generated',
          count: 35,
          sufficient_data: true,
          conversion_from_previous: 87.5,
          conversion_from_start: 7,
        },
        {
          event_name: 'trial_started',
          count: 32,
          sufficient_data: true,
          conversion_from_previous: 91.43,
          conversion_from_start: 6.4,
        },
        {
          event_name: 'paid_subscription_active',
          count: 31,
          sufficient_data: true,
          conversion_from_previous: 96.88,
          conversion_from_start: 6.2,
        },
        {
          event_name: 'subscription_canceled',
          count: 5,
          sufficient_data: true,
          conversion_from_previous: 16.13,
          conversion_from_start: 1,
        },
      ]);
    });

    it('defaults to 0, never NaN, when a step has zero events but the previous one clears the threshold', async () => {
      countsByEvent['calculator_viewed'] = 50;
      countsByEvent['public_calculation_completed'] = 0;

      const result = await service.getDashboard(4, 30);

      expect(result.revenue_funnel.steps[1]).toEqual({
        event_name: 'public_calculation_completed',
        count: 0,
        sufficient_data: true,
        conversion_from_previous: 0,
        conversion_from_start: 0,
      });
    });

    it('flags sufficient_data as false and nulls both rates once the previous step falls below the minimum sample', async () => {
      countsByEvent['calculator_viewed'] = 500;
      countsByEvent['public_calculation_completed'] = 400;
      rawRowsByEvent['guest_session_started'] = [
        { event_name: 'guest_session_started', count: '10' }, // < 30 : sous le seuil
      ];

      const result = await service.getDashboard(4, 30);

      // dimensions_entered arrive juste après guest_session_started (10 < 30) :
      // son taux serait trompeur, il est nullé plutôt qu'affiché.
      expect(result.revenue_funnel.steps[3]).toEqual({
        event_name: 'dimensions_entered',
        count: 0,
        sufficient_data: false,
        conversion_from_previous: null,
        conversion_from_start: null,
      });
    });

    it("n'expose plus de bloc pwa", async () => {
      const result = await service.getDashboard(4, 30);

      expect((result as Record<string, unknown>).pwa).toBeUndefined();
    });
  });

  describe('mrr', () => {
    it('résout un price_id vers son palier et ignore un price_id inconnu sans lever', async () => {
      subscriptionsQueryBuilderMock.getRawMany.mockResolvedValue([
        { price_id: 'price_contractor_essentiel', count: '2' },
        // Palier retiré en E3-3 : plus aucune variable ne porte son price_id,
        // il tombe donc dans le même cas qu'un identifiant périmé.
        { price_id: 'price_contractor_standard', count: '1' },
        { price_id: 'price_unknown_legacy', count: '4' },
      ]);
      subscriptionsRepoMock.count.mockResolvedValue(8); // trialing
      usersRepoMock.count.mockResolvedValue(512); // free

      const result = await service.getDashboard(4, 30);

      const essentielMrr = 2 * planMonthlyRevenue('contractor_essentiel');

      expect(result.mrr).toEqual({
        statuses_included: ['active', 'past_due'],
        currency: 'EUR',
        total_mrr: essentielMrr,
        by_tier: [
          {
            tier: 'contractor_essentiel',
            subscriber_count: 2,
            mrr: essentielMrr,
          },
        ],
        free_users_count: 512,
        trialing_count: 8,
      });
    });

    /**
     * Le chiffre lui-même, énoncé plutôt que dérivé : 279 € par an font
     * 23,25 € de revenu mensuel récurrent par abonné. Un test qui ne fait que
     * dériver de `PLANS` reste vert si `getMrr` se remet un jour à additionner
     * `plan.price` — c'est exactement ce qui est arrivé.
     */
    it('ramène un abonnement annuel à son équivalent mensuel', async () => {
      subscriptionsQueryBuilderMock.getRawMany.mockResolvedValue([
        { price_id: 'price_contractor_essentiel', count: '4' },
      ]);
      subscriptionsRepoMock.count.mockResolvedValue(0);
      usersRepoMock.count.mockResolvedValue(0);

      const result = await service.getDashboard(4, 30);

      expect(result.mrr.total_mrr).toBe(93); // 4 × 279 / 12
      expect(result.mrr.by_tier[0].mrr).toBe(93);
    });

    it('ne publie aucune ligne pour un palier retiré de l’offre', async () => {
      // `pro` a été retiré en E3-1. La liste des paliers rapportés est dérivée
      // de `PLANS` : un palier supprimé disparaît du tableau de bord au lieu
      // d'y publier indéfiniment un zéro qui finirait par se lire comme une
      // mesure.
      subscriptionsQueryBuilderMock.getRawMany.mockResolvedValue([]);
      subscriptionsRepoMock.count.mockResolvedValue(0);
      usersRepoMock.count.mockResolvedValue(0);

      const result = await service.getDashboard(4, 30);

      expect(result.mrr.by_tier.map((row) => row.tier)).toEqual(
        PLANS.map((plan) => plan.key),
      );
    });
  });
});
