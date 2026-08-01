import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Consommation de l'API publique, agrégée par organisation et par mois
 * (BACKLOG PLAT-5).
 *
 * Un compteur, pas un journal : l'incrément et la décision d'autoriser sont la
 * même instruction SQL atomique (`ON CONFLICT … DO UPDATE … RETURNING`), patron
 * déjà éprouvé sur `invoice_sequences`/`quote_sequences`. Une table
 * ligne-à-ligne croîtrait sans borne et ralentirait à mesure que l'API réussit.
 *
 * Le compteur est porté par l'organisation et non par la clé : le quota suit le
 * palier, et le palier suit l'organisation (PLAT-4 D3). Plusieurs clés d'une même
 * organisation partagent donc leur quota, ce qui est le comportement voulu — une
 * organisation ne doit pas pouvoir multiplier son quota en multipliant ses clés.
 */
@Entity('api_usage_counters')
export class ApiUsageCounter {
  @PrimaryColumn({ type: 'uuid' })
  organization_id!: string;

  /** Mois calendaire « YYYY-MM », calculé en Europe/Paris côté SQL. */
  @PrimaryColumn({ type: 'varchar', length: 7 })
  period!: string;

  @Column({ type: 'integer', default: 0 })
  request_count!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
