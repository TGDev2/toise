import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedMaterials as materials } from '../materials/seed-catalog.data';

export class SeedMaterialsCatalog1711468800006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure a unique constraint on (name, category) exists for ON CONFLICT
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_materials_catalog_name_category"
        ON "materials_catalog" ("name", "category");
    `);

    for (const mat of materials) {
      // Insert material, get its id back
      const result = (await queryRunner.query(
        `INSERT INTO "materials_catalog" ("name", "category", "unit", "yield_per_unit")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("name", "category") DO NOTHING
         RETURNING "id"`,
        [mat.name, mat.category, mat.unit, mat.yield_per_unit],
      )) as { id: string }[];

      if (result.length === 0) continue; // already existed
      const materialId = result[0].id;

      for (const pkg of mat.packagings) {
        await queryRunner.query(
          `INSERT INTO "material_packaging" ("material_id", "label", "quantity_per_unit", "unit")
           VALUES ($1, $2, $3, $4)`,
          [materialId, pkg.label, pkg.quantity_per_unit, pkg.unit],
        );
      }

      for (const wf of mat.waste_factors) {
        await queryRunner.query(
          `INSERT INTO "waste_factors" ("material_id", "pose_type", "skill_level", "factor_percent")
           VALUES ($1, $2, $3, $4)
           ON CONFLICT ("material_id", "pose_type", "skill_level") DO NOTHING`,
          [materialId, wf.pose_type, wf.skill_level, wf.factor_percent],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE "waste_factors" CASCADE;`);
    await queryRunner.query(`TRUNCATE "material_packaging" CASCADE;`);
    await queryRunner.query(`TRUNCATE "materials_catalog" CASCADE;`);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_materials_catalog_name_category";
    `);
  }
}
