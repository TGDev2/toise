import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PLAT-1 : gate `logbook` au palier Pro — raison de rester abonné
 * entre deux chantiers (cf. stratégie §7.5). Seedée activée, comme
 * `invoicing` (PRO-4) : le module carnet ship dans la même livraison.
 */
export class SeedLogbookFeatureGate1711468800049 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "feature_gates" ("feature_key", "label_fr", "description_fr", "min_tier", "is_enabled") VALUES
        ('logbook', 'Carnet du logement', 'Historique persistant de vos pièces : dimensions validées et matériaux utilisés à chaque chantier terminé', 'pro', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "feature_gates" WHERE "feature_key" = 'logbook'`,
    );
  }
}
