import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCvCorrectionLogs1711468800016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cv_correction_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "analysis_job_id" uuid NOT NULL,
        "entity_type" varchar(20) NOT NULL,
        "field" varchar(30) DEFAULT NULL,
        "cv_value" jsonb NOT NULL,
        "user_value" jsonb NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cv_correction_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cv_correction_logs_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cv_correction_logs_job" FOREIGN KEY ("analysis_job_id")
          REFERENCES "analysis_jobs"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_cv_correction_logs_project_id" ON "cv_correction_logs" ("project_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_cv_correction_logs_project_id"`,
    );
    await queryRunner.query(`DROP TABLE "cv_correction_logs"`);
  }
}
