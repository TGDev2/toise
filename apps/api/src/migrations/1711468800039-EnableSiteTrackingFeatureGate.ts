import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The `site_tracking` feature gate was seeded disabled in migration
 * 1711468800037 (PRO-1), pending the real feature (PRO-2). The site
 * tracking module (milestones CRUD) now exists — re-enable the gate.
 */
export class EnableSiteTrackingFeatureGate1711468800039 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "feature_gates" SET "is_enabled" = true WHERE "feature_key" = 'site_tracking'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "feature_gates" SET "is_enabled" = false WHERE "feature_key" = 'site_tracking'`,
    );
  }
}
