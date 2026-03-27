import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectsAndRoomDimensions1711468800001 implements MigrationInterface {
  name = 'CreateProjectsAndRoomDimensions1711468800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "room_name" varchar(255) NOT NULL DEFAULT '',
        "work_type" varchar(50) NOT NULL DEFAULT 'painting',
        "status" varchar(20) NOT NULL DEFAULT 'draft',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_projects" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_projects_user_id" ON "projects" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "room_dimensions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "length_cm" integer NOT NULL,
        "width_cm" integer NOT NULL,
        "height_cm" integer NOT NULL,
        "confidence_score" varchar(10) NOT NULL DEFAULT 'high',
        "source" varchar(10) NOT NULL DEFAULT 'manual',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_dimensions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_room_dimensions_project_id" UNIQUE ("project_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "room_dimensions"`);
    await queryRunner.query(`DROP INDEX "IDX_projects_user_id"`);
    await queryRunner.query(`DROP TABLE "projects"`);
  }
}
