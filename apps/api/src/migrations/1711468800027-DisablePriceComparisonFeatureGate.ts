import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The `price_comparison` feature gate was seeded as active in migration
 * 1711468800020, but no real supplier adapter is wired yet (only mock
 * adapters exist under `price-comparison/adapters`). Leaving the gate
 * enabled means paying Pro users can reach the endpoint and receive
 * fabricated CAD prices from `MockSupplierAdapter`.
 *
 * This migration disables the gate so the feature stays dark until a
 * real adapter (Home Depot, Lowes, …) is integrated. Admins can flip
 * `is_enabled` back to true through the feature-gates admin API once
 * a real supplier is live.
 */
export class DisablePriceComparisonFeatureGate1711468800027
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "feature_gates" SET "is_enabled" = false WHERE "feature_key" = 'price_comparison'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "feature_gates" SET "is_enabled" = true WHERE "feature_key" = 'price_comparison'`,
    );
  }
}
