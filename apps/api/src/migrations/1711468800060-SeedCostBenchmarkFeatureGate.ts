import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG DATA-4 : gate `cost_benchmark` au palier Pro, seedée **activée** —
 * le module ship dans la même livraison que sa gate (précédents `invoicing`,
 * `eco_materials`), pas de fenêtre de gate-avant-code à gérer.
 *
 * Palier Pro comme `budget_tracking`, dont le benchmark est la suite directe :
 * la comparaison n'a de sens qu'une fois les prix réels saisis, ce qui est déjà
 * une fonctionnalité Pro.
 */
export class SeedCostBenchmarkFeatureGate1711468800060 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "feature_gates" ("feature_key", "label_fr", "description_fr", "min_tier", "is_enabled") VALUES
        ('cost_benchmark', 'Benchmark de coûts', 'Situez le coût de votre chantier face à la médiane anonymisée des projets similaires', 'pro', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "feature_gates" WHERE "feature_key" = 'cost_benchmark'`,
    );
  }
}
