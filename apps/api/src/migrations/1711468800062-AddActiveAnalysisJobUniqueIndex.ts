import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Une seule analyse CV active par projet, garantie par la base.
 *
 * Le service se contentait d'un `SELECT` d'absence suivi d'un `INSERT` : deux
 * appels simultanés franchissent le premier avant que l'un ait fait le second,
 * et deux analyses écrivent alors le même projet en concurrence. L'index est
 * partiel : seuls `pending` et `processing` sont exclusifs, l'historique des
 * analyses terminées reste libre.
 */
export class AddActiveAnalysisJobUniqueIndex1711468800062 implements MigrationInterface {
  name = 'AddActiveAnalysisJobUniqueIndex1711468800062';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Doublons déjà en base : ils empêcheraient la création de l'index. On
    // garde le plus récent par projet et on marque les autres en échec — ils
    // n'ont de toute façon plus de traitement derrière eux (le pipeline vit
    // dans une promesse en mémoire, aucun redémarrage ne le reprend).
    await queryRunner.query(`
      UPDATE "analysis_jobs" SET
        "status" = 'failed',
        "error_message" = COALESCE("error_message", 'Analyse abandonnee: une autre analyse etait active sur ce projet'),
        "completed_at" = COALESCE("completed_at", now()),
        "progress_pct" = 100
      WHERE "status" IN ('pending', 'processing')
        AND "id" NOT IN (
          SELECT DISTINCT ON ("project_id") "id"
          FROM "analysis_jobs"
          WHERE "status" IN ('pending', 'processing')
          ORDER BY "project_id", "created_at" DESC, "id" DESC
        )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_analysis_jobs_active_per_project"
      ON "analysis_jobs" ("project_id")
      WHERE "status" IN ('pending', 'processing')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_analysis_jobs_active_per_project"`);
  }
}
