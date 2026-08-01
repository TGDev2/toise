import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PLAT-3 : marque un matériau du catalogue comme éco-responsable
 * (`is_eco`) avec une justification affichée aux utilisateurs (`eco_label_fr`).
 *
 * `is_eco` par défaut `false` : les matériaux existants restent inchangés, et
 * tout nouveau matériau créé sans le préciser reste hors du périmètre éco.
 */
export class AddEcoFieldsToMaterialsCatalog1711468800051 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "materials_catalog" ADD COLUMN "is_eco" boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      ALTER TABLE "materials_catalog" ADD COLUMN "eco_label_fr" varchar(255) NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_materials_catalog_is_eco" ON "materials_catalog" ("is_eco");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_materials_catalog_is_eco";`);
    await queryRunner.query(
      `ALTER TABLE "materials_catalog" DROP COLUMN "eco_label_fr";`,
    );
    await queryRunner.query(
      `ALTER TABLE "materials_catalog" DROP COLUMN "is_eco";`,
    );
  }
}
