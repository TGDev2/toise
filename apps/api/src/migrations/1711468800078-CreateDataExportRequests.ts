import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E6-2 : portabilité RGPD (art. 20). Une ligne par demande d'export, jamais
 * générée dans la requête HTTP qui la crée — `DataExportService.processExport`
 * tourne en tâche de fond et met à jour cette ligne à la fin.
 *
 * `expires_at` porte la fenêtre de téléchargement : l'archive contient IBAN/
 * BIC (`company_profiles`) et des coordonnées clients, elle ne doit pas
 * traîner sur le volume au-delà de `EXPORT_RETENTION_HOURS`. L'index est
 * partiel — la purge horaire (`DataExportService`) ne balaie que les lignes
 * `ready`, qui sont une poignée dans une table qui, sinon, grossit avec
 * l'historique des demandes.
 */
export class CreateDataExportRequests1711468800078 implements MigrationInterface {
  name = 'CreateDataExportRequests1711468800078';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "data_export_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "file_path" varchar(1024) DEFAULT NULL,
        "file_size_bytes" bigint DEFAULT NULL,
        "error_message" text DEFAULT NULL,
        "requested_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        CONSTRAINT "PK_data_export_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_data_export_requests_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_data_export_requests_user_id" ON "data_export_requests" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE INDEX "IDX_data_export_requests_expires_at"
      ON "data_export_requests" ("expires_at")
      WHERE "status" = 'ready'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_data_export_requests_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_data_export_requests_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "data_export_requests"`);
  }
}
