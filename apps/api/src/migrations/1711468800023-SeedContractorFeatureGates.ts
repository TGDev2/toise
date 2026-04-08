import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedContractorFeatureGates1711468800023 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "feature_gates" ("feature_key", "label_fr", "description_fr", "min_tier") VALUES
        ('export_devis', 'Export de devis PDF', 'Générez et exportez des devis professionnels en PDF', 'contractor'),
        ('client_management', 'Gestion de clients', 'Gérez votre portefeuille de clients et chantiers', 'contractor')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "feature_gates" WHERE "feature_key" IN ('export_devis', 'client_management')`,
    );
  }
}
