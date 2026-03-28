import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMaterialsCatalog1711468800005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "materials_catalog" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "category" varchar(30) NOT NULL,
        "unit" varchar(20) NOT NULL,
        "yield_per_unit" numeric(10,4) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "modified_by" uuid NULL,
        "modified_at" TIMESTAMP WITH TIME ZONE NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_materials_catalog" PRIMARY KEY ("id"),
        CONSTRAINT "FK_materials_catalog_modified_by" FOREIGN KEY ("modified_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_materials_catalog_category" ON "materials_catalog" ("category");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_materials_catalog_is_active" ON "materials_catalog" ("is_active");
    `);

    await queryRunner.query(`
      CREATE TABLE "material_packaging" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "material_id" uuid NOT NULL,
        "label" varchar(255) NOT NULL,
        "quantity_per_unit" numeric(10,4) NOT NULL,
        "unit" varchar(20) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_material_packaging" PRIMARY KEY ("id"),
        CONSTRAINT "FK_material_packaging_material" FOREIGN KEY ("material_id")
          REFERENCES "materials_catalog"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_material_packaging_material_id" ON "material_packaging" ("material_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "waste_factors" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "material_id" uuid NOT NULL,
        "pose_type" varchar(50) NOT NULL,
        "skill_level" varchar(20) NOT NULL,
        "factor_percent" numeric(5,2) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_waste_factors" PRIMARY KEY ("id"),
        CONSTRAINT "FK_waste_factors_material" FOREIGN KEY ("material_id")
          REFERENCES "materials_catalog"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_waste_factors_material_pose_skill"
          UNIQUE ("material_id", "pose_type", "skill_level")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_waste_factors_material_id" ON "waste_factors" ("material_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "waste_factors";`);
    await queryRunner.query(`DROP TABLE "material_packaging";`);
    await queryRunner.query(`DROP TABLE "materials_catalog";`);
  }
}
