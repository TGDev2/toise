import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import { ProjectPhoto } from '../photos/entities/project-photo.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../subscriptions/entities/subscription.entity';
import { User, SubscriptionTier } from '../users/entities/user.entity';
import { PLANS, PlanDefinition } from '../subscriptions/plans.constants';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Marches du funnel dans l'ordre — voir DATA-1 (analytics-event-name.enum.ts).
// calculator_viewed peut être anonyme (user_id null), les 4 suivantes sont
// toujours attribuées à un utilisateur authentifié.
const FUNNEL_STEPS = [
  AnalyticsEventName.CALCULATOR_VIEWED,
  AnalyticsEventName.ACCOUNT_CREATED,
  AnalyticsEventName.ESTIMATE_CREATED,
  AnalyticsEventName.SHOPPING_LIST_GENERATED,
  AnalyticsEventName.CHECKOUT_STARTED,
];

// Revenu effectivement facturé/en cours de facturation. `trialing` n'a encore
// rien payé (exposé à part via trialing_count, hors MRR).
const MRR_STATUSES = [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE];

// Entonnoir d'installation PWA (MOB-1), dans l'ordre.
const PWA_INSTALL_STEPS = [
  AnalyticsEventName.PWA_INSTALL_PROMPTED,
  AnalyticsEventName.PWA_INSTALL_ACCEPTED,
  AnalyticsEventName.PWA_INSTALLED,
];

// Volume minimal de sessions en dessous duquel on refuse de conclure : la
// décision MOB-2 (app native, XL) ne doit pas se prendre sur une poignée de
// sessions. Même garde-fou que `sufficient_data` dans cv-accuracy.service.ts.
const MIN_PWA_SESSIONS = 200;

// Correspondance entre la clé de plan (plans.constants.ts) et le tier utilisateur
// qu'elle attribue (cf. subscriptions.service.ts syncSubscriptionTier).
const PLAN_KEY_TO_TIER: Record<string, SubscriptionTier> = {
  pro: SubscriptionTier.PRO,
  contractor_essentiel: SubscriptionTier.CONTRACTOR_ESSENTIEL,
  contractor_standard: SubscriptionTier.CONTRACTOR_STANDARD,
  contractor_premium: SubscriptionTier.CONTRACTOR_PREMIUM,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toPercent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 10000) / 100 : 0;
}

function startOfIsoWeekUtc(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayOfWeek = d.getUTCDay(); // 0 = dimanche .. 6 = samedi
  const diffToMonday = (dayOfWeek + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d;
}

function toIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class AdminAnalyticsService {
  private readonly priceIdToPlan = new Map<string, PlanDefinition>();

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly eventsRepo: Repository<AnalyticsEvent>,
    @InjectRepository(Subscription)
    private readonly subscriptionsRepo: Repository<Subscription>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(ProjectPhoto)
    private readonly photosRepo: Repository<ProjectPhoto>,
    private readonly config: ConfigService,
  ) {
    for (const plan of PLANS) {
      const priceId = this.config.get<string>(plan.priceIdConfigKey);
      if (priceId) this.priceIdToPlan.set(priceId, plan);
    }
  }

  async getDashboard(weeks: number, days: number) {
    const [weekly_shopping_lists, funnel, mrr, pwa] = await Promise.all([
      this.getWeeklyShoppingLists(weeks),
      this.getFunnel(days),
      this.getMrr(),
      this.getPwa(days),
    ]);

    return {
      generated_at: new Date().toISOString(),
      weekly_shopping_lists,
      funnel,
      mrr,
      pwa,
    };
  }

  private async getWeeklyShoppingLists(weeks: number) {
    const currentWeekStart = startOfIsoWeekUtc(new Date());
    const weekStarts = Array.from(
      { length: weeks },
      (_, i) =>
        new Date(currentWeekStart.getTime() - (weeks - 1 - i) * WEEK_MS),
    );
    const since = weekStarts[0];

    const events = await this.eventsRepo.find({
      where: {
        event_name: AnalyticsEventName.SHOPPING_LIST_GENERATED,
        created_at: MoreThanOrEqual(since),
      },
      select: ['created_at'],
    });

    const counts = new Array<number>(weeks).fill(0);
    for (const event of events) {
      const index = Math.floor(
        (event.created_at.getTime() - since.getTime()) / WEEK_MS,
      );
      if (index >= 0 && index < weeks) counts[index] += 1;
    }

    return {
      weeks,
      series: weekStarts.map((weekStart, i) => ({
        week_start: toIsoDateOnly(weekStart),
        count: counts[i],
      })),
    };
  }

  private async getFunnel(days: number) {
    const since = new Date(Date.now() - days * DAY_MS);

    const viewedCount = await this.eventsRepo.count({
      where: {
        event_name: AnalyticsEventName.CALCULATOR_VIEWED,
        created_at: MoreThanOrEqual(since),
      },
    });

    const distinctRows = await this.eventsRepo
      .createQueryBuilder('e')
      .select('e.event_name', 'event_name')
      .addSelect('COUNT(DISTINCT e.user_id)', 'count')
      .where('e.event_name IN (:...eventNames)', {
        eventNames: FUNNEL_STEPS.slice(1),
      })
      .andWhere('e.created_at >= :since', { since })
      .groupBy('e.event_name')
      .getRawMany<{ event_name: string; count: string }>();

    const countByEvent = new Map<string, number>([
      [AnalyticsEventName.CALCULATOR_VIEWED, viewedCount],
      ...distinctRows.map((row): [string, number] => [
        row.event_name,
        parseInt(row.count, 10),
      ]),
    ]);

    const counts = FUNNEL_STEPS.map(
      (eventName) => countByEvent.get(eventName) ?? 0,
    );

    return {
      since: since.toISOString(),
      days,
      steps: FUNNEL_STEPS.map((eventName, i) => ({
        event_name: eventName,
        count: counts[i],
        conversion_from_previous:
          i === 0 ? null : toPercent(counts[i], counts[i - 1]),
        conversion_from_start: toPercent(counts[i], counts[0]),
      })),
    };
  }

  // MOB-1 : mesure de l'adoption PWA. Sert exclusivement à trancher MOB-2 (app
  // native) sur des faits — voir la règle de décision inscrite dans BACKLOG.md.
  private async getPwa(days: number) {
    const since = new Date(Date.now() - days * DAY_MS);

    const [
      sessionRows,
      installRows,
      offlineViews,
      rejectionRows,
      acceptedPhotos,
    ] = await Promise.all([
      this.eventsRepo
        .createQueryBuilder('e')
        .select("e.properties->>'display_mode'", 'display_mode')
        .addSelect("e.properties->>'platform'", 'platform')
        .addSelect('COUNT(*)', 'count')
        .where('e.event_name = :eventName', {
          eventName: AnalyticsEventName.PWA_SESSION_START,
        })
        .andWhere('e.created_at >= :since', { since })
        .groupBy("e.properties->>'display_mode'")
        .addGroupBy("e.properties->>'platform'")
        .getRawMany<{
          display_mode: string | null;
          platform: string | null;
          count: string;
        }>(),
      this.eventsRepo
        .createQueryBuilder('e')
        .select('e.event_name', 'event_name')
        .addSelect('COUNT(*)', 'count')
        .where('e.event_name IN (:...eventNames)', {
          eventNames: PWA_INSTALL_STEPS,
        })
        .andWhere('e.created_at >= :since', { since })
        .groupBy('e.event_name')
        .getRawMany<{ event_name: string; count: string }>(),
      this.eventsRepo.count({
        where: {
          event_name: AnalyticsEventName.PWA_OFFLINE_VIEW,
          created_at: MoreThanOrEqual(since),
        },
      }),
      this.eventsRepo
        .createQueryBuilder('e')
        .select("e.properties->>'reason'", 'reason')
        .addSelect('COUNT(*)', 'count')
        .where('e.event_name = :eventName', {
          eventName: AnalyticsEventName.PHOTO_QUALITY_REJECTED,
        })
        .andWhere('e.created_at >= :since', { since })
        .groupBy("e.properties->>'reason'")
        .getRawMany<{ reason: string | null; count: string }>(),
      this.photosRepo.count({
        where: { created_at: MoreThanOrEqual(since) },
      }),
    ]);

    let totalSessions = 0;
    let standaloneSessions = 0;
    const byPlatform = new Map<
      string,
      { sessions: number; standalone: number }
    >();
    for (const row of sessionRows) {
      const count = parseInt(row.count, 10);
      const platform = row.platform ?? 'unknown';
      const isStandalone = row.display_mode === 'standalone';
      totalSessions += count;
      if (isStandalone) standaloneSessions += count;
      const entry = byPlatform.get(platform) ?? { sessions: 0, standalone: 0 };
      entry.sessions += count;
      if (isStandalone) entry.standalone += count;
      byPlatform.set(platform, entry);
    }

    const installCounts = new Map(
      installRows.map((row): [string, number] => [
        row.event_name,
        parseInt(row.count, 10),
      ]),
    );
    const installSteps = PWA_INSTALL_STEPS.map(
      (eventName) => installCounts.get(eventName) ?? 0,
    );

    const rejectionsByReason = rejectionRows.map((row) => ({
      reason: row.reason ?? 'unknown',
      count: parseInt(row.count, 10),
    }));
    const rejectedPhotos = rejectionsByReason.reduce(
      (sum, row) => sum + row.count,
      0,
    );
    const uploadAttempts = rejectedPhotos + acceptedPhotos;

    return {
      since: since.toISOString(),
      days,
      // En dessous du seuil, les parts ci-dessous ne veulent rien dire : ne pas
      // arbitrer MOB-2 tant que ce drapeau est faux.
      sufficient_data: totalSessions >= MIN_PWA_SESSIONS,
      min_sample_size: MIN_PWA_SESSIONS,
      sessions: {
        total: totalSessions,
        standalone: standaloneSessions,
        standalone_share: toPercent(standaloneSessions, totalSessions),
        by_platform: [...byPlatform.entries()]
          .map(([platform, entry]) => ({
            platform,
            sessions: entry.sessions,
            session_share: toPercent(entry.sessions, totalSessions),
            standalone: entry.standalone,
            standalone_share: toPercent(entry.standalone, entry.sessions),
          }))
          .sort((a, b) => b.sessions - a.sessions),
      },
      install_funnel: PWA_INSTALL_STEPS.map((eventName, i) => ({
        event_name: eventName,
        count: installSteps[i],
        conversion_from_previous:
          i === 0 ? null : toPercent(installSteps[i], installSteps[i - 1]),
      })),
      offline_views: offlineViews,
      photo_quality: {
        upload_attempts: uploadAttempts,
        accepted: acceptedPhotos,
        rejected: rejectedPhotos,
        rejection_rate: toPercent(rejectedPhotos, uploadAttempts),
        by_reason: rejectionsByReason.sort((a, b) => b.count - a.count),
      },
    };
  }

  private async getMrr() {
    const [rows, trialingCount, freeUsersCount] = await Promise.all([
      this.subscriptionsRepo
        .createQueryBuilder('s')
        .select('s.stripe_price_id', 'price_id')
        .addSelect('COUNT(*)', 'count')
        .where('s.status IN (:...statuses)', { statuses: MRR_STATUSES })
        .groupBy('s.stripe_price_id')
        .getRawMany<{ price_id: string | null; count: string }>(),
      this.subscriptionsRepo.count({
        where: { status: SubscriptionStatus.TRIALING },
      }),
      this.usersRepo.count({
        where: { subscription_tier: SubscriptionTier.FREE },
      }),
    ]);

    const totalsByTier = new Map<
      SubscriptionTier,
      { subscriber_count: number; mrr: number }
    >();
    for (const row of rows) {
      const plan = row.price_id
        ? this.priceIdToPlan.get(row.price_id)
        : undefined;
      if (!plan) continue; // price_id inconnu/obsolète : ignoré, pas d'erreur
      const tier = PLAN_KEY_TO_TIER[plan.key];
      if (!tier) continue; // clé de plan non mappée à un tier : ignorée
      const count = parseInt(row.count, 10);
      const entry = totalsByTier.get(tier) ?? { subscriber_count: 0, mrr: 0 };
      entry.subscriber_count += count;
      entry.mrr += count * plan.price;
      totalsByTier.set(tier, entry);
    }

    const by_tier = [
      SubscriptionTier.PRO,
      SubscriptionTier.CONTRACTOR_ESSENTIEL,
      SubscriptionTier.CONTRACTOR_STANDARD,
      SubscriptionTier.CONTRACTOR_PREMIUM,
    ].map((tier) => {
      const entry = totalsByTier.get(tier) ?? { subscriber_count: 0, mrr: 0 };
      return {
        tier,
        subscriber_count: entry.subscriber_count,
        mrr: round2(entry.mrr),
      };
    });

    return {
      statuses_included: MRR_STATUSES,
      currency: 'EUR',
      total_mrr: round2(by_tier.reduce((sum, t) => sum + t.mrr, 0)),
      by_tier,
      free_users_count: freeUsersCount,
      trialing_count: trialingCount,
    };
  }
}
