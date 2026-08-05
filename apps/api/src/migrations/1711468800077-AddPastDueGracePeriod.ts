import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Délai de grâce sur impayé (E5-2).
 *
 * `past_due` comptait jusqu'ici comme un statut actif : un abonné dont le
 * paiement échoue gardait toutes ses capacités jusqu'à la résiliation par
 * Stripe, soit toute la durée des relances — plusieurs semaines de service
 * gratuit à chaque incident.
 *
 * Cette colonne porte la date de la **première** entrée en `past_due` de
 * l'épisode en cours. C'est elle, et non `updated_at`, qui fait courir le délai
 * (`STRIPE_PAST_DUE_GRACE_DAYS`, 14 jours par défaut) : Stripe rejoue
 * `invoice.payment_failed` à chaque relance, et un horodatage réécrit à chaque
 * passage redémarrerait le compte à rebours indéfiniment. L'invariant est tenu
 * par un `COALESCE` dans `applyEventState` — posée à l'entrée, effacée à la
 * sortie, jamais réécrite entre les deux.
 *
 * L'index est partiel : le balayage horaire ne lit que les lignes `past_due`,
 * qui sont une poignée dans une table qui, elle, grossit.
 *
 * Rattrapage des lignes déjà `past_due` : `now()`, et non une date passée. On
 * ignore depuis quand elles le sont — Stripe le sait, pas nous — et les
 * déclasser au premier balayage sur une date devinée couperait sans préavis des
 * abonnés qui n'ont jamais vu le moindre bandeau. Elles repartent donc avec un
 * délai plein, ce qui coûte au plus 14 jours une seule fois.
 */
export class AddPastDueGracePeriod1711468800077 implements MigrationInterface {
  name = 'AddPastDueGracePeriod1711468800077';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN "past_due_since" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      UPDATE "subscriptions"
      SET "past_due_since" = now()
      WHERE "status" = 'past_due'
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_subscriptions_past_due_since"
      ON "subscriptions" ("past_due_since")
      WHERE "status" = 'past_due'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_subscriptions_past_due_since"
    `);
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP COLUMN "past_due_since"
    `);
  }
}
