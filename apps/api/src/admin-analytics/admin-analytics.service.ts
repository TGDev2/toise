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
import {
  monthlyEquivalentEuros,
  PLANS,
  PlanDefinition,
} from '../subscriptions/plans.constants';

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

// Entonnoir de revenu V1 (BACKLOG_V1), dans l'ordre demandé. Superset de
// FUNNEL_STEPS (DATA-1) ci-dessus, pas un remplacement : l'ordre y diffère
// (account_created y arrive après estimate_created/shopping_list_generated,
// puisqu'il mesure une conversion invité → compte réel plutôt qu'une
// inscription immédiate). `checkout_started` existe et est déjà tracké
// (subscriptions.service.ts) mais n'a volontairement pas été inclus ici : la
// liste ci-dessous suit exactement les marches demandées ; il prendrait
// naturellement place entre quote_generated et trial_started.
const REVENUE_FUNNEL_STEPS = [
  AnalyticsEventName.CALCULATOR_VIEWED,
  AnalyticsEventName.PUBLIC_CALCULATION_COMPLETED,
  AnalyticsEventName.GUEST_SESSION_STARTED,
  AnalyticsEventName.DIMENSIONS_ENTERED,
  AnalyticsEventName.ESTIMATE_CREATED,
  AnalyticsEventName.SHOPPING_LIST_GENERATED,
  AnalyticsEventName.ACCOUNT_CREATED,
  AnalyticsEventName.QUOTE_GENERATED,
  AnalyticsEventName.TRIAL_STARTED,
  AnalyticsEventName.PAID_SUBSCRIPTION_ACTIVE,
  AnalyticsEventName.SUBSCRIPTION_CANCELED,
];

// Marches comptées en événements bruts (anonymes, sans user_id fiable) plutôt
// qu'en utilisateurs distincts — même logique que CALCULATOR_VIEWED dans
// getFunnel().
const REVENUE_FUNNEL_ANONYMOUS_STEPS = new Set<AnalyticsEventName>([
  AnalyticsEventName.CALCULATOR_VIEWED,
  AnalyticsEventName.PUBLIC_CALCULATION_COMPLETED,
]);

// Volume minimal de la marche précédente en dessous duquel un taux de
// conversion ne veut rien dire : ni les 200 sessions du PWA retiré, ni les 5
// échantillons de cv-accuracy.service.ts ne correspondent à l'échelle d'un
// funnel de revenu. Même garde-fou dans son principe (sufficient_data),
// seuil propre à cette marche.
const MIN_FUNNEL_STEP_SAMPLE = 30;

/**
 * Paliers rapportés dans le MRR : exactement ceux qu'un plan de `PLANS` peut
 * attribuer, dérivés et non recopiés. La liste était écrite à la main et
 * portait `pro` ; le plan retiré en E3-1, elle aurait publié indéfiniment une
 * ligne à zéro abonné — le genre de zéro qu'on finit par lire comme une
 * mesure plutôt que comme un vestige.
 *
 * La correspondance clé de plan → palier vivait ici, en double de celle du
 * constructeur de `SubscriptionsService` ; elle est portée par `plan.tier`
 * depuis E3-3, à un seul endroit.
 */
const REPORTED_TIERS: SubscriptionTier[] = PLANS.map((plan) => plan.tier);

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
    const [weekly_shopping_lists, funnel, revenue_funnel, mrr] =
      await Promise.all([
        this.getWeeklyShoppingLists(weeks),
        this.getFunnel(days),
        this.getRevenueFunnel(days),
        this.getMrr(),
      ]);

    return {
      generated_at: new Date().toISOString(),
      weekly_shopping_lists,
      funnel,
      revenue_funnel,
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

  /**
   * Entonnoir de revenu V1 (BACKLOG_V1) : volume et conversion de chaque
   * marche, de la visite du calculateur public à la résiliation.
   *
   * `sufficient_data` est calculé par marche sur le volume de la marche
   * **précédente** — c'est le dénominateur de `conversion_from_previous`, et
   * donc la donnée dont l'absence rend le taux trompeur. Sous le seuil, les
   * deux taux de la marche sont nullés plutôt qu'affichés (convention
   * cv-accuracy.service.ts) : un taux de conversion pilote une décision
   * produit, contrairement au simple drapeau du bloc PWA retiré. Les marches
   * basses (résiliation, abonnement payant actif) afficheront légitimement
   * `sufficient_data: false` sur une petite base — c'est le comportement
   * correct, pas un défaut.
   */
  private async getRevenueFunnel(days: number) {
    const since = new Date(Date.now() - days * DAY_MS);

    const anonymousEventNames = [...REVENUE_FUNNEL_ANONYMOUS_STEPS];
    const distinctEventNames = REVENUE_FUNNEL_STEPS.filter(
      (eventName) => !REVENUE_FUNNEL_ANONYMOUS_STEPS.has(eventName),
    );

    const [anonymousCounts, distinctRows] = await Promise.all([
      Promise.all(
        anonymousEventNames.map((eventName) =>
          this.eventsRepo.count({
            where: {
              event_name: eventName,
              created_at: MoreThanOrEqual(since),
            },
          }),
        ),
      ),
      this.eventsRepo
        .createQueryBuilder('e')
        .select('e.event_name', 'event_name')
        .addSelect('COUNT(DISTINCT e.user_id)', 'count')
        .where('e.event_name IN (:...eventNames)', {
          eventNames: distinctEventNames,
        })
        .andWhere('e.created_at >= :since', { since })
        .groupBy('e.event_name')
        .getRawMany<{ event_name: string; count: string }>(),
    ]);

    const countByEvent = new Map<string, number>([
      ...anonymousEventNames.map((eventName, i): [string, number] => [
        eventName,
        anonymousCounts[i],
      ]),
      ...distinctRows.map((row): [string, number] => [
        row.event_name,
        parseInt(row.count, 10),
      ]),
    ]);

    const counts = REVENUE_FUNNEL_STEPS.map(
      (eventName) => countByEvent.get(eventName) ?? 0,
    );

    return {
      since: since.toISOString(),
      days,
      min_sample_size: MIN_FUNNEL_STEP_SAMPLE,
      steps: REVENUE_FUNNEL_STEPS.map((eventName, i) => {
        const sufficientData =
          i === 0 || counts[i - 1] >= MIN_FUNNEL_STEP_SAMPLE;
        return {
          event_name: eventName,
          count: counts[i],
          sufficient_data: sufficientData,
          conversion_from_previous:
            i === 0 || !sufficientData
              ? null
              : toPercent(counts[i], counts[i - 1]),
          conversion_from_start: sufficientData
            ? toPercent(counts[i], counts[0])
            : null,
        };
      }),
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
      const count = parseInt(row.count, 10);
      const entry = totalsByTier.get(plan.tier) ?? {
        subscriber_count: 0,
        mrr: 0,
      };
      entry.subscriber_count += count;
      // `plan.price` est un montant **par période**, et la période est
      // annuelle depuis E3-3. L'ajouter tel quel publierait 279 € de revenu
      // mensuel récurrent par abonné, soit douze fois la réalité — un chiffre
      // faux qui n'aurait cassé aucun test, puisqu'ils vérifiaient la
      // cohérence avec `PLANS` et non la grandeur.
      entry.mrr += count * monthlyEquivalentEuros(plan);
      totalsByTier.set(plan.tier, entry);
    }

    const by_tier = REPORTED_TIERS.map((tier) => {
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
