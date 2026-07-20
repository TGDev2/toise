import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ENG-2 multi-pièces. Introduit la table `rooms` et re-parente la géométrie
 * (room_dimensions, openings, project_work_items) de `project_id` vers
 * `room_id`, en backfillant une pièce par défaut par projet existant. Ajoute
 * `estimation_results.aggregated_json` (plan d'achat mutualisé).
 *
 * Réversibilité : `down()` restaure fidèlement le schéma d'origine pour tout
 * projet resté mono-pièce (aucune donnée perdue). Les pièces ajoutées APRÈS
 * cette migration s'effondrent sur la 1re pièce (leur géométrie est supprimée)
 * — limite inhérente au retour d'un modèle N-pièces vers 1-pièce.
 */
export class CreateRoomsAndReparentGeometry1711468800031 implements MigrationInterface {
  name = 'CreateRoomsAndReparentGeometry1711468800031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Table des pièces
    await queryRunner.query(`
      CREATE TABLE "rooms" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL DEFAULT '',
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rooms" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rooms_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_rooms_project_id" ON "rooms" ("project_id")`,
    );

    // 2. Backfill : une pièce par défaut par projet existant
    await queryRunner.query(`
      INSERT INTO "rooms" ("project_id", "name", "sort_order")
      SELECT "id", COALESCE(NULLIF("room_name", ''), 'Pièce 1'), 0
      FROM "projects"
    `);

    // 3. Re-parentage de chaque table géométrique : project_id -> room_id
    // room_dimensions (1:1 avec la pièce)
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" ADD COLUMN "room_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "room_dimensions" rd SET "room_id" = r."id"
      FROM "rooms" r WHERE r."project_id" = rd."project_id"
    `);
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" ALTER COLUMN "room_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" ADD CONSTRAINT "UQ_room_dimensions_room_id" UNIQUE ("room_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" ADD CONSTRAINT "FK_room_dimensions_room" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE`,
    );
    // DROP COLUMN cascade la contrainte UNIQUE(project_id) et la FK vers projects
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" DROP COLUMN "project_id"`,
    );

    // openings (N par pièce)
    await queryRunner.query(`ALTER TABLE "openings" ADD COLUMN "room_id" uuid`);
    await queryRunner.query(`
      UPDATE "openings" o SET "room_id" = r."id"
      FROM "rooms" r WHERE r."project_id" = o."project_id"
    `);
    await queryRunner.query(
      `ALTER TABLE "openings" ALTER COLUMN "room_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "openings" ADD CONSTRAINT "FK_openings_room" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_openings_room_id" ON "openings" ("room_id")`,
    );
    // DROP COLUMN cascade la FK vers projects et l'index IDX_openings_project_id
    await queryRunner.query(`ALTER TABLE "openings" DROP COLUMN "project_id"`);

    // project_work_items (N par pièce, unicité (room_id, work_type_id))
    await queryRunner.query(
      `ALTER TABLE "project_work_items" ADD COLUMN "room_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "project_work_items" wi SET "room_id" = r."id"
      FROM "rooms" r WHERE r."project_id" = wi."project_id"
    `);
    await queryRunner.query(
      `ALTER TABLE "project_work_items" ALTER COLUMN "room_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_work_items" ADD CONSTRAINT "UQ_project_work_items_room_type" UNIQUE ("room_id", "work_type_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_work_items" ADD CONSTRAINT "FK_project_work_items_room" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_work_items_room_id" ON "project_work_items" ("room_id")`,
    );
    // DROP COLUMN cascade UQ_project_work_items_project_type, la FK projet et l'index
    await queryRunner.query(
      `ALTER TABLE "project_work_items" DROP COLUMN "project_id"`,
    );

    // 4. Plan d'achat mutualisé sur l'estimation
    await queryRunner.query(
      `ALTER TABLE "estimation_results" ADD COLUMN "aggregated_json" jsonb DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 4'. Retirer le plan d'achat mutualisé
    await queryRunner.query(
      `ALTER TABLE "estimation_results" DROP COLUMN "aggregated_json"`,
    );

    // Ensemble des pièces par défaut (1re par sort_order/ancienneté), pour
    // restaurer les contraintes d'unicité au niveau projet.
    const defaultRoomsSubquery = `
      SELECT DISTINCT ON ("project_id") "id" FROM "rooms"
      ORDER BY "project_id", "sort_order" ASC, "created_at" ASC
    `;

    // 3'. project_work_items : room_id -> project_id
    await queryRunner.query(
      `ALTER TABLE "project_work_items" ADD COLUMN "project_id" uuid`,
    );
    await queryRunner.query(
      `DELETE FROM "project_work_items" WHERE "room_id" NOT IN (${defaultRoomsSubquery})`,
    );
    await queryRunner.query(`
      UPDATE "project_work_items" wi SET "project_id" = r."project_id"
      FROM "rooms" r WHERE r."id" = wi."room_id"
    `);
    await queryRunner.query(
      `ALTER TABLE "project_work_items" ALTER COLUMN "project_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_work_items" ADD CONSTRAINT "UQ_project_work_items_project_type" UNIQUE ("project_id", "work_type_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_work_items" ADD CONSTRAINT "FK_project_work_items_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_work_items_project_id" ON "project_work_items" ("project_id")`,
    );
    // DROP COLUMN cascade UQ_project_work_items_room_type, FK_project_work_items_room et l'index room_id
    await queryRunner.query(
      `ALTER TABLE "project_work_items" DROP COLUMN "room_id"`,
    );

    // 3'. openings : room_id -> project_id
    await queryRunner.query(
      `ALTER TABLE "openings" ADD COLUMN "project_id" uuid`,
    );
    await queryRunner.query(
      `DELETE FROM "openings" WHERE "room_id" NOT IN (${defaultRoomsSubquery})`,
    );
    await queryRunner.query(`
      UPDATE "openings" o SET "project_id" = r."project_id"
      FROM "rooms" r WHERE r."id" = o."room_id"
    `);
    await queryRunner.query(
      `ALTER TABLE "openings" ALTER COLUMN "project_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "openings" ADD CONSTRAINT "openings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_openings_project_id" ON "openings" ("project_id")`,
    );
    await queryRunner.query(`ALTER TABLE "openings" DROP COLUMN "room_id"`);

    // 3'. room_dimensions : room_id -> project_id
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" ADD COLUMN "project_id" uuid`,
    );
    await queryRunner.query(
      `DELETE FROM "room_dimensions" WHERE "room_id" NOT IN (${defaultRoomsSubquery})`,
    );
    await queryRunner.query(`
      UPDATE "room_dimensions" rd SET "project_id" = r."project_id"
      FROM "rooms" r WHERE r."id" = rd."room_id"
    `);
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" ALTER COLUMN "project_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" ADD CONSTRAINT "UQ_room_dimensions_project_id" UNIQUE ("project_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" ADD CONSTRAINT "room_dimensions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" DROP COLUMN "room_id"`,
    );

    // 1'. Suppression de la table des pièces
    await queryRunner.query(`DROP INDEX "IDX_rooms_project_id"`);
    await queryRunner.query(`DROP TABLE "rooms"`);
  }
}
