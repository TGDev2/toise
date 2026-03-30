import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnalysisJobsAndCvOutput1711468800014
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add raw_cv_output_json to room_dimensions
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" ADD "raw_cv_output_json" jsonb DEFAULT NULL`,
    );

    // Create analysis_jobs table
    await queryRunner.query(`
      CREATE TABLE "analysis_jobs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "progress_pct" smallint NOT NULL DEFAULT 0,
        "result_json" jsonb DEFAULT NULL,
        "error_message" text DEFAULT NULL,
        "started_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "completed_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_analysis_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_analysis_jobs_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_analysis_jobs_project_id" ON "analysis_jobs" ("project_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_analysis_jobs_project_id"`);
    await queryRunner.query(`DROP TABLE "analysis_jobs"`);
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" DROP COLUMN "raw_cv_output_json"`,
    );
  }
}
