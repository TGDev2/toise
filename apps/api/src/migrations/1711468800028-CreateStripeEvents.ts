import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStripeEvents1711468800028 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "stripe_events" (
        "event_id" varchar(255) PRIMARY KEY,
        "event_type" varchar(100) NOT NULL,
        "processed_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "stripe_events"`);
  }
}
