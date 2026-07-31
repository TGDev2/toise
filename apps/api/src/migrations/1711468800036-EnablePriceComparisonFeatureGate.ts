import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The `price_comparison` feature gate was disabled in migration 1711468800027
 * because only mock adapters existed (fabricated CAD prices). BACKLOG BUY-1
 * has since wired a real adapter (ManoMano) and removed the mocks entirely —
 * the reason the gate was dark no longer holds.
 *
 * BACKLOG BUY-2 : re-enable the gate now that a real adapter is in place.
 */
export class EnablePriceComparisonFeatureGate1711468800036 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "feature_gates" SET "is_enabled" = true WHERE "feature_key" = 'price_comparison'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "feature_gates" SET "is_enabled" = false WHERE "feature_key" = 'price_comparison'`,
    );
  }
}
