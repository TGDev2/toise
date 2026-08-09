import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG_V1 E3-3 (ADR 0002 §D4) — trace du « 30 jours satisfait ou remboursé ».
 *
 * La garantie était jusqu'ici une phrase dans les CGV et un geste manuel dans le
 * tableau de bord Stripe. Un geste manuel ne porte ni condition vérifiable, ni
 * effet sur l'accès, ni compte : l'ADR §3.2 fait pourtant du **taux de
 * remboursement** le seul signal précoce sur la qualité de la promesse, et
 * §5.1 en fixe le seuil d'alerte à 20 % des 25 premières ventes. Un signal que
 * personne ne compte n'est pas un signal (leçon 28).
 *
 * Trois propriétés portées par le schéma lui-même, et non par du code :
 *
 * - **`UQ_subscription_refunds_stripe_refund`** rend la politique idempotente
 *   par construction. Deux demandes concurrentes, un retry après une coupure
 *   réseau, ou le webhook `charge.refunded` qui suit notre propre appel :
 *   aucun de ces chemins ne peut produire deux lignes, donc deux
 *   remboursements comptés.
 * - **`IDX_subscription_refunds_invoice`** sert la condition « cette facture
 *   a-t-elle déjà été remboursée ? », qui se tranche en base plutôt qu'en
 *   re-listant Stripe.
 * - **`FK … ON DELETE CASCADE`** vers `users` : la trace est une donnée
 *   personnelle (montant, date, motif), elle part avec le compte. Les
 *   identifiants Stripe restent en revanche du **texte** et non des clés
 *   étrangères vers `subscriptions` — cette ligne-là est supprimée à la
 *   résiliation d'un compte (`cancelForAccountDeletion`), et une trace
 *   financière qui disparaîtrait avec elle ne serait plus une trace.
 *
 * Purement additive : le code de la version précédente tourne sans la voir
 * (leçon 29), et `down()` la retire exactement.
 */
export class CreateSubscriptionRefunds1711468800101 implements MigrationInterface {
  name = 'CreateSubscriptionRefunds1711468800101';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subscription_refunds" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "stripe_subscription_id" character varying(255) NOT NULL,
        "stripe_invoice_id" character varying(255),
        "stripe_charge_id" character varying(255),
        "stripe_refund_id" character varying(255) NOT NULL,
        "amount_cents" integer NOT NULL,
        "currency" character varying(10) NOT NULL,
        "origin" character varying(20) NOT NULL,
        "reason" text,
        "invoice_paid_at" TIMESTAMP WITH TIME ZONE,
        "eligible_until" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_refunds" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_subscription_refunds_stripe_refund" UNIQUE ("stripe_refund_id"),
        CONSTRAINT "FK_subscription_refunds_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_subscription_refunds_invoice"
      ON "subscription_refunds" ("stripe_invoice_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_subscription_refunds_user"
      ON "subscription_refunds" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_subscription_refunds_user"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_subscription_refunds_invoice"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_refunds"`);
  }
}
