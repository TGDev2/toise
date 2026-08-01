import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PRO-4 : gate `invoicing` au palier Contractor Essentiel, aux côtés de
 * `export_devis` et `client_management` — PRO-1 a posé « Essentiel = devis +
 * clients », et la facture ferme cette boucle de base plutôt qu'elle ne
 * différencie un palier supérieur.
 *
 * Seedée **activée**, contrairement au patron seed-éteint-puis-allumé de
 * PRO-1/PRO-2/PRO-3 : celui-ci n'existait que parce que la gate précédait la
 * fonctionnalité de plusieurs lots. Ici le module invoices ship dans la même
 * livraison. Une gate dédiée (plutôt que réutiliser `export_devis`) permet de
 * couper la facturation seule en cas d'incident, sans couper les devis.
 */
export class SeedInvoicingFeatureGate1711468800045 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "feature_gates" ("feature_key", "label_fr", "description_fr", "min_tier", "is_enabled") VALUES
        ('invoicing', 'Facturation', 'Transformez vos devis acceptés en factures conformes, numérotées et exportables en PDF', 'contractor_essentiel', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "feature_gates" WHERE "feature_key" = 'invoicing'`,
    );
  }
}
