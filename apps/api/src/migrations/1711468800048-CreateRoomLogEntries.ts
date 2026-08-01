import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PLAT-1 : carnet du logement. Snapshot immuable, pris à chaque
 * chantier terminé (`ShoppingListsService.finalizeBudgetSummary`, même point
 * d'ancrage que le partage communauté COM-1/COM-2), des dimensions validées
 * et des matériaux réellement achetés pour chaque pièce. `project_id`/
 * `room_id` en `ON DELETE SET NULL` (comme `invoices.project_id`/`quote_id`) :
 * le carnet doit survivre à la suppression du projet source, c'est tout
 * l'intérêt du « historique persistant » — d'où aussi les colonnes
 * `project_name`/`room_name` qui figent le libellé au moment du chantier.
 */
export class CreateRoomLogEntries1711468800048 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "room_log_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "project_id" uuid DEFAULT NULL,
        "project_name" varchar(255) NOT NULL,
        "room_id" uuid DEFAULT NULL,
        "room_name" varchar(255) NOT NULL,
        "dimensions_snapshot" jsonb NOT NULL,
        "materials_snapshot" jsonb NOT NULL DEFAULT '[]',
        "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_log_entries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_room_log_entries_project_room" UNIQUE ("project_id", "room_id"),
        CONSTRAINT "FK_room_log_entries_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_room_log_entries_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_room_log_entries_room" FOREIGN KEY ("room_id")
          REFERENCES "rooms"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_room_log_entries_user_id" ON "room_log_entries" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_room_log_entries_user_id"`);
    await queryRunner.query(`DROP TABLE "room_log_entries"`);
  }
}
