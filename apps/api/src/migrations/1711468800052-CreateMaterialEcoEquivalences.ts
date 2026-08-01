import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PLAT-3 : lie un matériau standard à un ou plusieurs matériaux éco
 * de substitution (`is_eco = true`, même catégorie — imposé côté service, pas
 * en contrainte SQL). Table de jointure dédiée plutôt qu'un champ sur
 * `materials_catalog` : un matériau standard peut avoir plusieurs alternatives
 * éco (ex. plusieurs peintures sans COV pour une peinture standard donnée).
 */
export class CreateMaterialEcoEquivalences1711468800052 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "material_eco_equivalences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "standard_material_id" uuid NOT NULL,
        "eco_material_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_material_eco_equivalences" PRIMARY KEY ("id"),
        CONSTRAINT "FK_material_eco_equivalences_standard" FOREIGN KEY ("standard_material_id")
          REFERENCES "materials_catalog"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_material_eco_equivalences_eco" FOREIGN KEY ("eco_material_id")
          REFERENCES "materials_catalog"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_material_eco_equivalences_pair"
          UNIQUE ("standard_material_id", "eco_material_id"),
        CONSTRAINT "CK_material_eco_equivalences_distinct"
          CHECK ("standard_material_id" <> "eco_material_id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_material_eco_equivalences_standard" ON "material_eco_equivalences" ("standard_material_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_material_eco_equivalences_eco" ON "material_eco_equivalences" ("eco_material_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "material_eco_equivalences";`);
  }
}
