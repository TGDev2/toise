import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';
import { ProjectPhoto } from '../photos/entities/project-photo.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { PLANS } from '../subscriptions/plans.constants';
import { User } from '../users/entities/user.entity';

/**
 * Les montants attendus se déduisent du catalogue de plans plutôt que d'être
 * recopiés : ce test porte sur la résolution `price_id` → palier, pas sur la
 * grille tarifaire. Recopiés, ils tombaient au premier réalignement de prix
 * (GTM-8 : 50/100/200 € → 19/29/49 €) sans rien signaler d'utile.
 */
const planPrice = (key: string): number => {
  const plan = PLANS.find((candidate) => candidate.key === key);
  if (!plan) throw new Error(`Plan inconnu dans le test : ${key}`);
  return plan.price;
};

const CONFIG_VALUES: Record<string, string> = {
  'stripe.proPriceId': 'price_pro',
  'stripe.contractorEssentielPriceId': 'price_contractor_essentiel',
  'stripe.contractorStandardPriceId': 'price_contractor_standard',
  'stripe.contractorPremiumPriceId': 'price_contractor_premium',
};

const configServiceMock = {
  get: jest.fn((key: string) => CONFIG_VALUES[key]),
};

// `getDashboard` lance désormais plusieurs agrégations concurrentes sur le même
// repo d'événements (funnel, sessions PWA, entonnoir d'installation, rejets
// photo). Un mock unique et partagé leur servirait les mêmes lignes : chaque
// appel reçoit donc son propre builder, qui retient le(s) nom(s) d'événement
// passé(s) au `where` et répond depuis ce registre.
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

// Idem pour les `count` : le funnel compte `calculator_viewed`, le bloc PWA
// compte `pwa_offline_view`.
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

const photosRepoMock = {
  count: jest.fn(),
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
    photosRepoMock.count.mockResolvedValue(0);

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
        { provide: getRepositoryToken(ProjectPhoto), useValue: photosRepoMock },
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

  describe('pwa', () => {
    it('ventile les sessions par plateforme et calcule la part standalone (MOB-2)', async () => {
      rawRowsByEvent['pwa_session_start'] = [
        { display_mode: 'standalone', platform: 'android', count: '30' },
        { display_mode: 'browser', platform: 'android', count: '70' },
        { display_mode: 'browser', platform: 'ios', count: '150' },
      ];

      const { pwa } = await service.getDashboard(4, 30);

      expect(pwa.sessions.total).toBe(250);
      expect(pwa.sessions.standalone).toBe(30);
      expect(pwa.sessions.standalone_share).toBe(12);
      // Trié par volume décroissant.
      expect(pwa.sessions.by_platform).toEqual([
        {
          platform: 'ios',
          sessions: 150,
          session_share: 60,
          standalone: 0,
          // Aucune installation possible sur iOS (pas de beforeinstallprompt) :
          // c'est précisément le signal « le store est le seul canal » de MOB-2.
          standalone_share: 0,
        },
        {
          platform: 'android',
          sessions: 100,
          session_share: 40,
          standalone: 30,
          standalone_share: 30,
        },
      ]);
    });

    it("signale un échantillon insuffisant tant que le seuil de sessions n'est pas atteint", async () => {
      rawRowsByEvent['pwa_session_start'] = [
        { display_mode: 'standalone', platform: 'android', count: '199' },
      ];

      const { pwa } = await service.getDashboard(4, 30);

      expect(pwa.sufficient_data).toBe(false);
      expect(pwa.min_sample_size).toBe(200);
    });

    it('calcule le taux de rejet photo sur les tentatives, pas sur les seuls rejets', async () => {
      rawRowsByEvent['photo_quality_rejected'] = [
        { reason: 'too_blurry', count: '15' },
        { reason: 'too_dark', count: '5' },
      ];
      photosRepoMock.count.mockResolvedValue(80); // photos acceptées = stockées

      const { pwa } = await service.getDashboard(4, 30);

      expect(pwa.photo_quality).toEqual({
        upload_attempts: 100,
        accepted: 80,
        rejected: 20,
        rejection_rate: 20,
        by_reason: [
          { reason: 'too_blurry', count: 15 },
          { reason: 'too_dark', count: 5 },
        ],
      });
    });

    it("ne renvoie jamais NaN quand aucune photo n'a été envoyée", async () => {
      const { pwa } = await service.getDashboard(4, 30);

      expect(pwa.photo_quality.rejection_rate).toBe(0);
      expect(pwa.sessions.standalone_share).toBe(0);
    });

    it("chaîne l'entonnoir d'installation et compte les vues hors ligne", async () => {
      rawRowsByEvent['pwa_install_prompted'] = [
        { event_name: 'pwa_install_prompted', count: '40' },
        { event_name: 'pwa_install_accepted', count: '10' },
        { event_name: 'pwa_installed', count: '8' },
      ];
      countsByEvent['pwa_offline_view'] = 12;

      const { pwa } = await service.getDashboard(4, 30);

      expect(pwa.install_funnel).toEqual([
        {
          event_name: 'pwa_install_prompted',
          count: 40,
          conversion_from_previous: null,
        },
        {
          event_name: 'pwa_install_accepted',
          count: 10,
          conversion_from_previous: 25,
        },
        {
          event_name: 'pwa_installed',
          count: 8,
          conversion_from_previous: 80,
        },
      ]);
      expect(pwa.offline_views).toBe(12);
    });
  });

  describe('mrr', () => {
    it('resolves price_id to its own tier per contractor plan (BACKLOG PRO-1), and ignores an unknown price_id without throwing', async () => {
      subscriptionsQueryBuilderMock.getRawMany.mockResolvedValue([
        { price_id: 'price_pro', count: '3' },
        { price_id: 'price_contractor_essentiel', count: '2' },
        { price_id: 'price_contractor_standard', count: '1' },
        { price_id: 'price_unknown_legacy', count: '4' },
      ]);
      subscriptionsRepoMock.count.mockResolvedValue(8); // trialing
      usersRepoMock.count.mockResolvedValue(512); // free

      const result = await service.getDashboard(4, 30);

      const proMrr = 3 * planPrice('pro');
      const essentielMrr = 2 * planPrice('contractor_essentiel');
      const standardMrr = 1 * planPrice('contractor_standard');

      expect(result.mrr).toEqual({
        statuses_included: ['active', 'past_due'],
        currency: 'EUR',
        total_mrr: proMrr + essentielMrr + standardMrr,
        by_tier: [
          { tier: 'pro', subscriber_count: 3, mrr: proMrr },
          {
            tier: 'contractor_essentiel',
            subscriber_count: 2,
            mrr: essentielMrr,
          },
          {
            tier: 'contractor_standard',
            subscriber_count: 1,
            mrr: standardMrr,
          },
          { tier: 'contractor_premium', subscriber_count: 0, mrr: 0 },
        ],
        free_users_count: 512,
        trialing_count: 8,
      });
    });
  });
});
