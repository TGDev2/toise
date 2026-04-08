import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkTypesAndProjectWorkItems1711468800003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "work_types" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(50) NOT NULL,
        "label_fr" varchar(100) NOT NULL,
        "category" varchar(30) NOT NULL,
        "surface_target" varchar(20) NOT NULL,
        "waste_factor_base" numeric(4,2) NOT NULL DEFAULT 1.10,
        "required_materials" jsonb NOT NULL DEFAULT '[]',
        "contextual_questions" jsonb NOT NULL DEFAULT '[]',
        "display_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_types" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_work_types_code" UNIQUE ("code")
      );
    `);

    // Contextual questions JSON for floor_tiling
    const floorTilingQuestions = JSON.stringify([
      {
        key: 'tile_format',
        type: 'select',
        label_fr: 'Format du carreau',
        options: [
          { value: '20x20', label_fr: '20 x 20 cm' },
          { value: '30x30', label_fr: '30 x 30 cm' },
          { value: '45x45', label_fr: '45 x 45 cm' },
          { value: '60x60', label_fr: '60 x 60 cm' },
          { value: '30x60', label_fr: '30 x 60 cm' },
        ],
        required: true,
      },
      {
        key: 'laying_pattern',
        type: 'select',
        label_fr: 'Type de pose',
        options: [
          { value: 'straight', label_fr: 'Pose droite' },
          { value: 'diagonal', label_fr: 'Pose diagonale' },
        ],
        required: true,
      },
    ]);

    await queryRunner.query(
      `INSERT INTO "work_types" ("code", "label_fr", "category", "surface_target", "waste_factor_base", "required_materials", "contextual_questions", "display_order") VALUES
        ('wall_painting', 'Peinture murale', 'painting', 'wall', 1.10, '[]', '[]', 1),
        ('ceiling_painting', 'Peinture plafond', 'painting', 'ceiling', 1.10, '[]', '[]', 2),
        ('floor_tiling', 'Carrelage sol', 'tiling', 'floor', 1.10, '[]', $1, 3),
        ('wall_tiling', 'Carrelage mural', 'tiling', 'wall', 1.10, '[]', '[]', 4),
        ('parquet_flooring', 'Parquet ou stratifie', 'flooring', 'floor', 1.10, '[]', '[]', 5),
        ('drywall', 'Cloison seche', 'partition', 'wall', 1.05, '[]', '[]', 6),
        ('wall_covering', 'Revetement mural', 'wall_covering', 'wall', 1.10, '[]', '[]', 7);`,
      [floorTilingQuestions],
    );

    await queryRunner.query(`
      CREATE TABLE "project_work_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "work_type_id" uuid NOT NULL,
        "skill_level" varchar(20) NOT NULL,
        "custom_params" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_work_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_project_work_items_project_type" UNIQUE ("project_id", "work_type_id"),
        CONSTRAINT "FK_project_work_items_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_work_items_work_type" FOREIGN KEY ("work_type_id") REFERENCES "work_types"("id") ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_project_work_items_project_id" ON "project_work_items" ("project_id");
    `);

    await queryRunner.query(`
      ALTER TABLE "projects" ALTER COLUMN "work_type" DROP NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "projects" ALTER COLUMN "work_type" SET DEFAULT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects" ALTER COLUMN "work_type" SET DEFAULT 'painting';
    `);

    await queryRunner.query(`
      UPDATE "projects" SET "work_type" = 'painting' WHERE "work_type" IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "projects" ALTER COLUMN "work_type" SET NOT NULL;
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_project_work_items_project_id";
    `);

    await queryRunner.query(`
      DROP TABLE "project_work_items";
    `);

    await queryRunner.query(`
      DROP TABLE "work_types";
    `);
  }
}
