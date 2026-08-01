import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionTier } from '../users/entities/user.entity';
import { ApiUsageCounter } from './entities/api-usage-counter.entity';

/**
 * Quota mensuel d'appels à l'API publique, par palier (BACKLOG PLAT-5).
 *
 * La gate `public_api` est arbitrée à `contractor_premium` depuis PRO-1 : les
 * paliers inférieurs sont donc déjà refusés en amont par `FeatureGateGuard`, et
 * leur quota nul n'est qu'une seconde barrière. La table reste indexée par
 * palier parce que c'est le point d'extension de PLAT-6 (offre Enterprise) : y
 * ajouter un palier ne demandera pas de refondre le comptage.
 */
export const MONTHLY_QUOTA_BY_TIER: Record<SubscriptionTier, number> = {
  [SubscriptionTier.FREE]: 0,
  [SubscriptionTier.PRO]: 0,
  [SubscriptionTier.CONTRACTOR_ESSENTIEL]: 0,
  [SubscriptionTier.CONTRACTOR_STANDARD]: 0,
  [SubscriptionTier.CONTRACTOR_PREMIUM]: 10_000,
  [SubscriptionTier.ENTERPRISE]: 100_000,
};

export function monthlyQuotaFor(tier: SubscriptionTier): number {
  return MONTHLY_QUOTA_BY_TIER[tier] ?? 0;
}

export interface UsageSnapshot {
  period: string;
  count: number;
  limit: number;
  reset_at: Date;
}

/**
 * `period` et `reset_at` sont calculés **en SQL**, en Europe/Paris. Les calculer
 * en Node les exposerait au fuseau du process : deux instances mal configurées
 * scinderaient le quota d'un même client entre deux lignes.
 */
const PERIOD_SQL = `to_char((now() AT TIME ZONE 'Europe/Paris'), 'YYYY-MM')`;
const RESET_AT_SQL = `(date_trunc('month', (now() AT TIME ZONE 'Europe/Paris')) + interval '1 month') AT TIME ZONE 'Europe/Paris'`;

interface CounterRow {
  period: string;
  request_count: string | number;
  reset_at: Date;
}

@Injectable()
export class ApiUsageService {
  constructor(
    @InjectRepository(ApiUsageCounter)
    private readonly countersRepo: Repository<ApiUsageCounter>,
  ) {}

  /**
   * Incrémente et renvoie le compteur du mois courant en **une seule**
   * instruction : le comptage et la valeur sur laquelle on décide sont ainsi la
   * même opération, donc insensibles à la concurrence. Sous READ COMMITTED, une
   * requête concurrente se bloque sur le verrou de ligne puis relit le tuple
   * mis à jour — même garantie que l'allocation de numéro de facture (PRO-4).
   *
   * Volontairement hors transaction applicative : le décompte doit être commité
   * indépendamment du traitement de la requête.
   */
  async consume(organizationId: string): Promise<Omit<UsageSnapshot, 'limit'>> {
    const rows = await this.countersRepo.query<CounterRow[]>(
      `
      INSERT INTO "api_usage_counters" ("organization_id", "period", "request_count", "updated_at")
      VALUES ($1, ${PERIOD_SQL}, 1, now())
      ON CONFLICT ("organization_id", "period") DO UPDATE
        SET "request_count" = "api_usage_counters"."request_count" + 1,
            "updated_at" = now()
      RETURNING "period", "request_count", ${RESET_AT_SQL} AS "reset_at"
      `,
      [organizationId],
    );

    return this.toSnapshot(rows);
  }

  /** Lecture seule : ne consomme pas de quota. */
  async peek(organizationId: string): Promise<Omit<UsageSnapshot, 'limit'>> {
    const rows = await this.countersRepo.query<CounterRow[]>(
      `
      SELECT ${PERIOD_SQL} AS "period",
             COALESCE((
               SELECT "request_count" FROM "api_usage_counters"
               WHERE "organization_id" = $1 AND "period" = ${PERIOD_SQL}
             ), 0) AS "request_count",
             ${RESET_AT_SQL} AS "reset_at"
      `,
      [organizationId],
    );

    return this.toSnapshot(rows);
  }

  private toSnapshot(rows: CounterRow[]): Omit<UsageSnapshot, 'limit'> {
    const row = rows[0];
    return {
      period: row.period,
      count: Number(row.request_count),
      reset_at: row.reset_at,
    };
  }
}
