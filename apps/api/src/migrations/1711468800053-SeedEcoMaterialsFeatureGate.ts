import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PLAT-3 : gate `eco_materials` au palier Pro — stratégie §4.4,
 * différenciateur du tier existant plutôt qu'add-on payant séparé.
 *
 * Seedée **activée**, comme `invoicing` (PRO-4) : le module éco-matériaux
 * ship dans la même livraison que sa gate, pas de fenêtre de gate-avant-code
 * à gérer.
 */
export class SeedEcoMaterialsFeatureGate1711468800053 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "feature_gates" ("feature_key", "label_fr", "description_fr", "min_tier", "is_enabled") VALUES
        ('eco_materials', 'Matériaux éco-responsables', 'Repérez les matériaux éco-responsables et leurs équivalences dans votre liste de courses', 'pro', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "feature_gates" WHERE "feature_key" = 'eco_materials'`,
    );
  }
}
