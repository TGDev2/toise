import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PRO-2 : suivi de chantier + timeline. Un jalon porte à la fois son
 * statut d'avancement et ses dates prévue/réelle — pas de champ de statut
 * global séparé sur `projects` (cf. tasks/todo.md §PRO-2 pour la décision).
 */
export class CreateSiteMilestones1711468800038 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "site_milestones" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "label" varchar(255) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "planned_date" date DEFAULT NULL,
        "actual_date" date DEFAULT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_site_milestones" PRIMARY KEY ("id"),
        CONSTRAINT "FK_site_milestones_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_site_milestones_project_id" ON "site_milestones" ("project_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "site_milestones"`);
  }
}
