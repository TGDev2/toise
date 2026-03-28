import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEstimationResults1711468800007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "estimation_results" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "skill_level" varchar(20) NOT NULL,
        "items_json" jsonb NOT NULL,
        "total_items" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_estimation_results" PRIMARY KEY ("id"),
        CONSTRAINT "FK_estimation_results_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_estimation_results_project_created"
        ON "estimation_results" ("project_id", "created_at" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_estimation_results_project_created";`);
    await queryRunner.query(`DROP TABLE "estimation_results";`);
  }
}
