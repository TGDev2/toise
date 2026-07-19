import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
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
    private readonly config: ConfigService,
  ) {
    for (const plan of PLANS) {
      const priceId = this.config.get<string>(plan.priceIdConfigKey);
      if (priceId) this.priceIdToPlan.set(priceId, plan);
    }
  }

  async getDashboard(weeks: number, days: number) {
    const [weekly_shopping_lists, funnel, mrr] = await Promise.all([
      this.getWeeklyShoppingLists(weeks),
      this.getFunnel(days),
      this.getMrr(),
    ]);

    return {
      generated_at: new Date().toISOString(),
      weekly_shopping_lists,
      funnel,
      mrr,
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
      const tier =
        plan.key === 'pro' ? SubscriptionTier.PRO : SubscriptionTier.CONTRACTOR;
      const count = parseInt(row.count, 10);
      const entry = totalsByTier.get(tier) ?? { subscriber_count: 0, mrr: 0 };
      entry.subscriber_count += count;
      entry.mrr += count * plan.price;
      totalsByTier.set(tier, entry);
    }

    const by_tier = [SubscriptionTier.PRO, SubscriptionTier.CONTRACTOR].map(
      (tier) => {
        const entry = totalsByTier.get(tier) ?? { subscriber_count: 0, mrr: 0 };
        return {
          tier,
          subscriber_count: entry.subscriber_count,
          mrr: round2(entry.mrr),
        };
      },
    );

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
