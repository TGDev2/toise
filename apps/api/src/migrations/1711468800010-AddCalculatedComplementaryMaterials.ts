import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCalculatedComplementaryMaterials1711468800010
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add formula_code column
    await queryRunner.query(
      `ALTER TABLE "complementary_materials" ADD "formula_code" varchar(50) NULL`,
    );

    // Insert calculated tiling complementary materials
    await queryRunner.query(
      `INSERT INTO "complementary_materials"
         ("category", "name", "description_fr", "default_quantity", "unit_label", "display_order", "formula_code")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        'tiling',
        'Colle a carrelage',
        'Colle flexible tous supports, sac 25kg',
        1,
        'sac 25kg',
        0,
        'tiling_adhesive',
      ],
    );

    await queryRunner.query(
      `INSERT INTO "complementary_materials"
         ("category", "name", "description_fr", "default_quantity", "unit_label", "display_order", "formula_code")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        'tiling',
        'Joint de carrelage',
        'Joint fin ciment, sac 5kg',
        1,
        'sac 5kg',
        4,
        'tiling_grout',
      ],
    );

    // Update existing Croisillons with formula_code
    await queryRunner.query(
      `UPDATE "complementary_materials" SET "formula_code" = $1 WHERE "name" = $2 AND "category" = $3`,
      ['tiling_spacers', 'Croisillons', 'tiling'],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove seeded calculated materials
    await queryRunner.query(
      `DELETE FROM "complementary_materials" WHERE "formula_code" IN ($1, $2)`,
      ['tiling_adhesive', 'tiling_grout'],
    );

    // Clear formula_code from croisillons
    await queryRunner.query(
      `UPDATE "complementary_materials" SET "formula_code" = NULL WHERE "formula_code" = $1`,
      ['tiling_spacers'],
    );

    // Drop the column
    await queryRunner.query(
      `ALTER TABLE "complementary_materials" DROP COLUMN "formula_code"`,
    );
  }
}
