import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedWorkTypes } from '../projects/work-types.data';

/**
 * E1-10 (BACKLOG_V1) — le SEL entre au chiffrage, déclenché par l'exposition à
 * l'eau du local.
 *
 * Le NF DTU 52.2 impose une protection à l'eau sous carrelage dans les locaux
 * très exposés (zones de douche, locaux EB+) ; dans un séjour ou une cuisine,
 * le SEL est un bidon acheté pour rien. Le modèle de pièce n'a pas de type de
 * local : la condition est une question de l'ouvrage, comme `subfloor_type`
 * (`…084`), et la même architecture en trois pièces — question, colonne de
 * rôle produit, résolveur (`estimations/wet-room.ts`).
 *
 * **Le défaut est `dry` — inversion assumée de la doctrine « défaut = sens
 * sûr » d'E1-8**, arbitrée par l'utilisateur le 2026-08-08 : « sûr = exposé »
 * achèterait un kit de 32 kg sur tous les carrelages non répondus du chemin
 * public. Le garde-fou est l'exclusion motivée, visible à l'écran dans les
 * deux sens. Consigné au registre, section « Déclenchement du SEL (E1-10) ».
 *
 * Le SEL est aussi **ré-exprimé en kg de mélange** (0,7 m²/L → 0,3333 m²/kg,
 * kit de 32 kg PRB CEL CÉRAMIC) : les fiches publient en kg pour les 2
 * couches et les kits se pèsent — le litre seedé ne correspondait à aucun
 * conditionnement réel. Anciens bidons 6/12 L recopiés en dur pour le down.
 *
 * Additive (leçon 29) : colonne nullable, UPDATE gardés sur l'ancienne
 * valeur, aucune contrainte. L'application précédente ignore la colonne et
 * chiffre comme avant.
 */

const TILING_WORK_TYPES = ['floor_tiling', 'wall_tiling'] as const;

/** Rôles d'étanchéité posés par ce lot — les deux matériaux existent déjà. */
const WET_ROOM_ROLES: { name: string; category: string; role: string }[] = [
  {
    name: "SEL (Système d'Étanchéité Liquide)",
    category: 'tiling',
    role: 'sel',
  },
  {
    name: "Bande d'étanchéité 120mm",
    category: 'tiling',
    role: 'sealing_band',
  },
];

/** Conditionnements du SEL avant ce lot, recopiés en dur pour le down. */
const LEGACY_SEL_PACKAGINGS = [
  { label: 'Bidon 6 L', quantity_per_unit: 6, unit: 'L' },
  { label: 'Bidon 12 L', quantity_per_unit: 12, unit: 'L' },
];

const NEW_SEL_PACKAGING = {
  label: 'Kit 32 kg',
  quantity_per_unit: 32,
  unit: 'kg',
};

/**
 * Questions par ouvrage, avant et après. « Après » vient du seed ; « avant »
 * retire les deux clés d'E1-10 — `floor_flatness` compris, parce que `…088`
 * (qui la porte) descend **avant** cette migration : après son down, l'état
 * attendu est le seed moins les deux questions.
 */
const questionsAfter = (code: string) =>
  seedWorkTypes
    .find((wt) => wt.code === code)!
    .contextual_questions.filter((q) => q.key !== 'floor_flatness');

const questionsBefore = (code: string) =>
  questionsAfter(code).filter((q) => q.key !== 'water_exposure');

export class GateWetRoomSystemOnWaterExposure1711468800087 implements MigrationInterface {
  name = 'GateWetRoomSystemOnWaterExposure1711468800087';

  private async setQuestions(
    queryRunner: QueryRunner,
    code: string,
    questions: unknown,
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE "work_types" SET "contextual_questions" = $1 WHERE "code" = $2`,
      [JSON.stringify(questions), code],
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "materials_catalog"
        ADD COLUMN IF NOT EXISTS "wet_room_system" character varying(20);
    `);

    for (const m of WET_ROOM_ROLES) {
      await queryRunner.query(
        `UPDATE "materials_catalog"
            SET "wet_room_system" = $1
          WHERE "name" = $2 AND "category" = $3 AND "wet_room_system" IS NULL`,
        [m.role, m.name, m.category],
      );
    }

    await queryRunner.query(
      `UPDATE "materials_catalog"
          SET "unit" = 'kg', "yield_per_unit" = 0.3333
        WHERE "name" = 'SEL (Système d''Étanchéité Liquide)'
          AND "category" = 'tiling'
          AND "unit" = 'L' AND "yield_per_unit" = 0.7`,
    );
    for (const pkg of LEGACY_SEL_PACKAGINGS) {
      await queryRunner.query(
        `DELETE FROM "material_packaging" mp
          USING "materials_catalog" m
          WHERE mp."material_id" = m."id"
            AND m."name" = 'SEL (Système d''Étanchéité Liquide)'
            AND m."category" = 'tiling' AND mp."label" = $1`,
        [pkg.label],
      );
    }
    // `$1` sert deux fois (valeur insérée et comparaison NOT EXISTS) : sans
    // cast, Postgres refuse de lui déduire un type (42P08).
    await queryRunner.query(
      `INSERT INTO "material_packaging" ("material_id", "label", "quantity_per_unit", "unit")
       SELECT m."id", $1::varchar, $2::numeric, $3::varchar
         FROM "materials_catalog" m
        WHERE m."name" = 'SEL (Système d''Étanchéité Liquide)'
          AND m."category" = 'tiling'
          AND NOT EXISTS (
            SELECT 1 FROM "material_packaging" p
             WHERE p."material_id" = m."id" AND p."label" = $1::varchar)`,
      [
        NEW_SEL_PACKAGING.label,
        NEW_SEL_PACKAGING.quantity_per_unit,
        NEW_SEL_PACKAGING.unit,
      ],
    );

    for (const code of TILING_WORK_TYPES) {
      await this.setQuestions(queryRunner, code, questionsAfter(code));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const code of TILING_WORK_TYPES) {
      await this.setQuestions(queryRunner, code, questionsBefore(code));
    }

    await queryRunner.query(
      `DELETE FROM "material_packaging" mp
        USING "materials_catalog" m
        WHERE mp."material_id" = m."id"
          AND m."name" = 'SEL (Système d''Étanchéité Liquide)'
          AND m."category" = 'tiling' AND mp."label" = $1`,
      [NEW_SEL_PACKAGING.label],
    );
    for (const pkg of LEGACY_SEL_PACKAGINGS) {
      await queryRunner.query(
        `INSERT INTO "material_packaging" ("material_id", "label", "quantity_per_unit", "unit")
         SELECT m."id", $1, $2, $3
           FROM "materials_catalog" m
          WHERE m."name" = 'SEL (Système d''Étanchéité Liquide)'
            AND m."category" = 'tiling'`,
        [pkg.label, pkg.quantity_per_unit, pkg.unit],
      );
    }
    await queryRunner.query(
      `UPDATE "materials_catalog"
          SET "unit" = 'L', "yield_per_unit" = 0.7
        WHERE "name" = 'SEL (Système d''Étanchéité Liquide)'
          AND "category" = 'tiling'
          AND "unit" = 'kg' AND "yield_per_unit" = 0.3333`,
    );

    await queryRunner.query(`
      ALTER TABLE "materials_catalog" DROP COLUMN IF EXISTS "wet_room_system";
    `);
  }
}
