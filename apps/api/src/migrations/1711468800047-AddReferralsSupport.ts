import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG COM-3 : parrainage (« 1 mois Pro offert par filleul abonné »).
 *
 * `users.referral_code` est généré paresseusement (pas de backfill des comptes
 * existants — cf. ReferralsService.getOrCreateReferralCode), `referred_by_user_id`
 * est posé une seule fois à l'inscription, `referral_converted_at` une seule fois
 * au premier paiement réel du filleul (invoice.paid, jamais un simple essai).
 *
 * `referral_credits` est un ledger local du crédit Stripe (balance transaction
 * négative sur le compte du parrain) : `UNIQUE (referred_user_id)` garantit qu'un
 * filleul ne génère jamais plus d'un crédit, y compris sur ses renouvellements
 * mensuels suivants. Statut `pending` tant que le parrain n'a pas encore de
 * `stripe_customer_id` (jamais souscrit lui-même) ; appliqué dès son premier
 * checkout (cf. SubscriptionsService.createCheckoutSession).
 */
export class AddReferralsSupport1711468800047 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "referral_code" varchar(10) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_referral_code" UNIQUE ("referral_code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "referred_by_user_id" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_referred_by_user_id" FOREIGN KEY ("referred_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_referred_by_user_id" ON "users" ("referred_by_user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "referral_converted_at" timestamptz NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "referral_credits" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "referrer_user_id" uuid NOT NULL,
        "referred_user_id" uuid NOT NULL,
        "amount_cents" integer NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'eur',
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "stripe_balance_transaction_id" varchar(255) NULL,
        "applied_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_referral_credits" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_referral_credits_referred_user_id" UNIQUE ("referred_user_id"),
        CONSTRAINT "FK_referral_credits_referrer_user_id" FOREIGN KEY ("referrer_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_referral_credits_referred_user_id" FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_referral_credits_referrer_user_id" ON "referral_credits" ("referrer_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "referral_credits"`);

    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "referral_converted_at"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_users_referred_by_user_id"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_users_referred_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "referred_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_users_referral_code"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "referral_code"`);
  }
}
