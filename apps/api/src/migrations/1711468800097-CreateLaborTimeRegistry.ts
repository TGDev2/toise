import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedLaborTimes } from '../projects/labor-times.data';

/**
 * E2-1 (BACKLOG_V1) — le registre sourcé des temps de pose par ouvrage.
 *
 * `work_types.labor_minutes_per_m2` (E2-3, `…072`) reste en place et continue
 * d'alimenter `GET /quotes/labor-proposal` : le câblage du devis sur ce
 * registre est E2-2. Ici, seulement la donnée : une table `labor_times` où
 * chaque ligne porte un temps en heures par unité, sa fourchette quand les
 * sources divergent, ses conditions, et sa source complète — document
 * librement consultable, jamais un bordereau commercial (le spec
 * `labor-sources-catalogue.spec.ts` le vérifie).
 *
 * L'index unique passe par `COALESCE(skill_level, '*')` : `skill_level` NULL
 * signifie « tous niveaux », et deux NULL seraient distincts pour un index
 * unique ordinaire — deux lignes « tous niveaux » de la même pose pourraient
 * coexister en silence.
 *
 * Le seed résout chaque code d'ouvrage au moment de l'INSERT ; zéro ligne
 * retournée = ouvrage fantôme, et la migration lève avec le code fautif
 * (patron `…092`). Pas de ON CONFLICT : la table vient d'être créée dans la
 * même transaction. Le down supprime exactement le delta : la table.
 */
export class CreateLaborTimeRegistry1711468800097 implements MigrationInterface {
  name = 'CreateLaborTimeRegistry1711468800097';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "labor_times" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "work_type_id" uuid NOT NULL,
        "pose_type" varchar(50) NOT NULL,
        "skill_level" varchar(20),
        "unit_basis" varchar(10) NOT NULL DEFAULT 'm2',
        "hours_per_unit" numeric(6,3) NOT NULL,
        "hours_low" numeric(6,3),
        "hours_high" numeric(6,3),
        "conditions_fr" text NOT NULL,
        "source_org" varchar(120) NOT NULL,
        "source_document" varchar(255) NOT NULL,
        "source_url" varchar(500) NOT NULL,
        "source_consulted_on" date NOT NULL,
        "source_basis_fr" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_labor_times" PRIMARY KEY ("id"),
        CONSTRAINT "FK_labor_times_work_type" FOREIGN KEY ("work_type_id")
          REFERENCES "work_types"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_labor_times_work_pose_skill"
        ON "labor_times" ("work_type_id", "pose_type", (COALESCE("skill_level", '*')))
    `);

    for (const time of seedLaborTimes) {
      const result = (await queryRunner.query(
        `INSERT INTO "labor_times"
           ("work_type_id", "pose_type", "skill_level", "unit_basis",
            "hours_per_unit", "hours_low", "hours_high", "conditions_fr",
            "source_org", "source_document", "source_url",
            "source_consulted_on", "source_basis_fr")
         SELECT wt."id", $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
           FROM "work_types" wt
          WHERE wt."code" = $13
         RETURNING "id"`,
        [
          time.pose_type,
          time.skill_level ?? null,
          time.unit_basis,
          time.hours_per_unit,
          time.hours_low ?? null,
          time.hours_high ?? null,
          time.conditions_fr,
          time.source_org,
          time.source_document,
          time.source_url,
          time.source_consulted_on,
          time.source_basis_fr,
          time.work_type_code,
        ],
      )) as unknown[];

      if (result.length === 0) {
        throw new Error(
          `Temps de pose E2-1 non résolu : ouvrage ${time.work_type_code} ` +
            `(pose ${time.pose_type}) introuvable dans work_types`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "labor_times"`);
  }
}
