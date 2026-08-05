import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Filigrane d'ordonnancement des événements Stripe.
 *
 * Les handlers de webhook appliquaient le dernier événement **arrivé**. Stripe
 * ne garantit aucun ordre de livraison : un `customer.subscription.updated`
 * retardé, émis avant une annulation déjà traitée, remettait `status = active`
 * et rappelait la synchronisation de palier — l'utilisateur retrouvait des
 * capacités qu'il ne payait plus, jusqu'au prochain événement.
 *
 * Cette colonne porte la date d'émission (`event.created`) du dernier événement
 * effectivement appliqué à la ligne. L'écriture d'état devient conditionnelle :
 * un événement plus ancien est écarté. Cf. `applyEventState`.
 *
 * Nullable, sans valeur par défaut : une ligne antérieure à cette migration n'a
 * pas de filigrane et accepte donc le premier événement qui la touche, quel
 * qu'il soit. Rétro-remplir avec `updated_at` mentirait — cette date est celle
 * de la dernière écriture locale, pas celle de l'émission chez Stripe, et
 * écarterait à tort des événements légitimes émis avant le déploiement.
 */
export class GuardStripeEventOrdering1711468800076 implements MigrationInterface {
  name = 'GuardStripeEventOrdering1711468800076';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN "last_stripe_event_at" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP COLUMN "last_stripe_event_at"
    `);
  }
}
