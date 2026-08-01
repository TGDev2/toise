import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The `quote_reminders` feature gate was seeded disabled in migration
 * 1711468800037 (PRO-1), pending the real feature (PRO-3). The quote
 * reminders module (cron sweep + e-mails) now exists — re-enable the gate.
 */
export class EnableQuoteRemindersFeatureGate1711468800041 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "feature_gates" SET "is_enabled" = true WHERE "feature_key" = 'quote_reminders'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "feature_gates" SET "is_enabled" = false WHERE "feature_key" = 'quote_reminders'`,
    );
  }
}
