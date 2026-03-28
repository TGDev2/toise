import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateShoppingListTables1711468800008
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "complementary_materials" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "category" varchar(30) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description_fr" varchar(500) NOT NULL DEFAULT '',
        "default_quantity" integer NOT NULL DEFAULT 1,
        "unit_label" varchar(50) NOT NULL,
        "display_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_complementary_materials" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_complementary_materials_category"
        ON "complementary_materials" ("category");
    `);

    await queryRunner.query(`
      CREATE TABLE "shopping_lists" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "estimation_id" uuid NOT NULL,
        "items_json" jsonb NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shopping_lists" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_shopping_lists_project" UNIQUE ("project_id"),
        CONSTRAINT "FK_shopping_lists_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_shopping_lists_estimation" FOREIGN KEY ("estimation_id")
          REFERENCES "estimation_results"("id") ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "shopping_lists";`);
    await queryRunner.query(
      `DROP INDEX "IDX_complementary_materials_category";`,
    );
    await queryRunner.query(`DROP TABLE "complementary_materials";`);
  }
}
