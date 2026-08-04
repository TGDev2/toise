import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG_V1 E3-4 (ADR 0001 D4) — l'offre Contractor redescend à un palier
 * payant unique, `contractor_essentiel` (19 €/mois). `contractor_standard`
 * (29 €) et `contractor_premium` (49 €) disparaissent des surfaces de vente
 * (voir `apps/web/src/lib/pricing.ts`), mais restent des rangs valides de
 * `SubscriptionTier` : des comptes existants peuvent encore les porter.
 *
 * Les trois gates que ces paliers différenciaient — `site_tracking` et
 * `quote_reminders` (`contractor_standard`), `multi_user`
 * (`contractor_premium`) — sont gelées depuis #065 (ADR 0001 D3) et le
 * restent : rien ici ne les revend, `is_enabled` n'est pas touché. Seul leur
 * `min_tier` change, pour ne plus pointer vers un palier qu'aucune offre ne
 * vend : `contractor_essentiel`, plancher et plafond du seul palier payant
 * restant.
 *
 * Le miroir `apps/web/src/lib/feature-gates-catalogue.ts` est mis à jour dans
 * le même lot, comme l'exige CONTRIBUTING.md.
 */
const RECALIBRATED_GATES: Record<string, { from: string; to: string }> = {
  site_tracking: { from: 'contractor_standard', to: 'contractor_essentiel' },
  quote_reminders: { from: 'contractor_standard', to: 'contractor_essentiel' },
  multi_user: { from: 'contractor_premium', to: 'contractor_essentiel' },
};

export class RecalibrateContractorDifferentiatorGates1711468800075 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [key, { from, to }] of Object.entries(RECALIBRATED_GATES)) {
      await queryRunner.query(
        `UPDATE "feature_gates" SET "min_tier" = $1 WHERE "feature_key" = $2 AND "min_tier" = $3`,
        [to, key, from],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [key, { from, to }] of Object.entries(RECALIBRATED_GATES)) {
      await queryRunner.query(
        `UPDATE "feature_gates" SET "min_tier" = $1 WHERE "feature_key" = $2 AND "min_tier" = $3`,
        [from, key, to],
      );
    }
  }
}
