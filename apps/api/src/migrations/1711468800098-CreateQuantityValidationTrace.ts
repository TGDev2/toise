import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E2-4 : trace probatoire de la validation des quantités, troisième ligne de
 * défense après la reformulation de la promesse (E2-3) et l'assurance.
 *
 * **Deux tables et non une**, parce que les deux objets n'ont ni la même durée
 * de vie ni le même lecteur. `quantity_validations` est un acte : il est écrit
 * une fois, jamais modifié, et sert à répondre « qu'avez-vous validé, et
 * quand ». `quantity_corrections` est une observation : une ligne par écart
 * entre ce que le catalogue a calculé et ce que l'artisan a retenu, destinée à
 * l'agrégation par matériau et par ouvrage (E8-2, `BACKLOG_V1.md:1492`).
 * Les fondre aurait imposé au second de porter les colonnes du premier.
 *
 * `quantities_fingerprint` **et** `quantities_json`. L'empreinte seule prouve
 * « ces quantités-là » à condition de les avoir encore : sans l'instantané,
 * une liste régénérée rend l'empreinte invérifiable et la trace muette. Le
 * `sha256` est là pour la comparaison — `QuotesService` refuse d'émettre quand
 * l'empreinte de la liste courante ne correspond à aucune validation — et
 * l'instantané pour la preuve.
 *
 * `user_email` est figé à côté de `user_id`. Le `FK … ON DELETE SET NULL` est
 * ce qui permet de supprimer un compte sans détruire l'historique de son
 * organisation ; sans le libellé figé, il ne resterait rien de l'identité que
 * cette table existe pour établir. Même parti que le snapshot de parties d'une
 * facture. Nullable parce que `users.email` l'est — un compte invité n'en a
 * pas ; il ne peut pas non plus atteindre la gate `export_devis`, donc en
 * pratique la colonne est toujours renseignée. La déclarer `NOT NULL` aurait
 * obligé à y écrire une chaîne vide, c'est-à-dire une identité inventée.
 *
 * `computed_units` **et** `previous_units` sur les corrections : la première
 * est la quantité du catalogue, référence stable de l'écart relatif ; la
 * seconde est ce qu'affichait l'écran juste avant le geste. Une deuxième
 * correction sur la même ligne les fait diverger, et c'est la première qui
 * répond à la question d'E8 (« de combien le catalogue se trompe-t-il ? »).
 */
export class CreateQuantityValidationTrace1711468800098 implements MigrationInterface {
  name = 'CreateQuantityValidationTrace1711468800098';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "quantity_validations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "user_id" uuid DEFAULT NULL,
        "user_email" varchar(255) DEFAULT NULL,
        "quantities_fingerprint" char(64) NOT NULL,
        "quantities_json" jsonb NOT NULL,
        "line_count" integer NOT NULL,
        "validated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quantity_validations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quantity_validations_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quantity_validations_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // La garde d'émission lit « la validation la plus récente de ce projet dont
    // l'empreinte vaut X » : c'est exactement cet index.
    await queryRunner.query(`
      CREATE INDEX "IDX_quantity_validations_project_fingerprint"
      ON "quantity_validations" ("project_id", "quantities_fingerprint")
    `);

    await queryRunner.query(`
      CREATE TABLE "quantity_corrections" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "user_id" uuid DEFAULT NULL,
        "material_id" uuid NOT NULL,
        "material_name" varchar(255) NOT NULL,
        "material_unit" varchar(50) NOT NULL,
        "packaging_label" varchar(255) NOT NULL,
        "work_type_code" varchar(50) NOT NULL,
        "work_type_label" varchar(255) NOT NULL,
        "skill_level" varchar(20) DEFAULT NULL,
        "computed_units" numeric(12,3) NOT NULL,
        "previous_units" numeric(12,3) NOT NULL,
        "corrected_units" numeric(12,3) NOT NULL,
        "relative_deviation" numeric(10,4) DEFAULT NULL,
        "source" varchar(32) NOT NULL,
        "corrected_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quantity_corrections" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quantity_corrections_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quantity_corrections_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // E8-2 agrège « par matériau et par ouvrage », dans cet ordre.
    await queryRunner.query(`
      CREATE INDEX "IDX_quantity_corrections_material_work_type"
      ON "quantity_corrections" ("material_id", "work_type_code")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_quantity_corrections_project_id"
      ON "quantity_corrections" ("project_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quantity_corrections_project_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quantity_corrections_material_work_type"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "quantity_corrections"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quantity_validations_project_fingerprint"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "quantity_validations"`);
  }
}
