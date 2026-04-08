import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStripePriceIdToSubscriptions1711468800021 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN "stripe_price_id" varchar(255) DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN "stripe_price_id"`,
    );
  }
}
