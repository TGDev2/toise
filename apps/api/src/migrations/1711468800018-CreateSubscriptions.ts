import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptions1711468800018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "stripe_customer_id" varchar(255) NOT NULL,
        "stripe_subscription_id" varchar(255) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'trialing',
        "current_period_start" TIMESTAMP WITH TIME ZONE,
        "current_period_end" TIMESTAMP WITH TIME ZONE,
        "trial_end" TIMESTAMP WITH TIME ZONE,
        "cancel_at_period_end" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subscriptions_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_subscriptions_stripe_sub" UNIQUE ("stripe_subscription_id"),
        CONSTRAINT "UQ_subscriptions_user" UNIQUE ("user_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_sub_stripe_customer" ON "subscriptions" ("stripe_customer_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_sub_status" ON "subscriptions" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_sub_status"`);
    await queryRunner.query(`DROP INDEX "IDX_sub_stripe_customer"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
  }
}
