import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOpenings1711468800002 implements MigrationInterface {
  name = 'CreateOpenings1711468800002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "openings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "type" varchar(10) NOT NULL,
        "width_cm" integer NOT NULL,
        "height_cm" integer NOT NULL,
        "count" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_openings" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_openings_project_id" ON "openings" ("project_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_openings_project_id"`);
    await queryRunner.query(`DROP TABLE "openings"`);
  }
}
