import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedWorkTypes } from '../projects/work-types.data';

/**
 * E1-10 (BACKLOG_V1) — ragréage et primaire entrent au chiffrage, déclenchés
 * par la planéité du support.
 *
 * Les NF DTU 52.2 et 51.11 tolèrent 5 mm sous la règle de 2 m ; au-delà,
 * ragréage. La planéité est un diagnostic que l'artisan fait réellement à la
 * règle : question `floor_flatness` sur `floor_tiling` et `parquet_flooring`
 * (défaut `flat`, même arbitrage et même garde-fou d'exclusion motivée que
 * `water_exposure`, `…087`). Le primaire suit le ragréage — prescrit par la
 * fiche du ragréage, même déclencheur, porté par la colonne `substrate_prep`
 * et jamais par le code de l'ouvrage.
 *
 * Recalibrations sourcées du même geste (registre, lignes PRB, 2026-08-08) :
 *
 *  - Ragréages : 1,5 kg/m²/mm (PRB PLANIDUR PRO / PLANIFIBRE), épaisseur
 *    retenue 3 mm → 4,5 kg/m², soit 0,2222 m²/kg (0,2 supposait 3,33 mm
 *    qu'aucune fiche ne nomme).
 *  - Primaires : ré-exprimés en kg (PRB ACCROSOL PLUS, 150-300 g/m²,
 *    jerricans pesés, densité 1,05) — valeur 5 inchangée, l'unité passe du
 *    litre au kilo. Anciens bidons recopiés en dur pour le down.
 */

const PREP_WORK_TYPES = ['floor_tiling', 'parquet_flooring'] as const;

const COMPOUNDS: { name: string; category: string }[] = [
  { name: 'Ragréage autolissant', category: 'tiling' },
  { name: 'Ragréage fibré sol', category: 'flooring' },
];

const PRIMERS: { name: string; category: string }[] = [
  { name: "Primaire d'accrochage carrelage", category: 'tiling' },
  { name: "Primaire d'accrochage sol", category: 'flooring' },
];

/** Conditionnements des primaires avant ce lot, en dur pour le down. */
const LEGACY_PRIMER_PACKAGINGS = [
  { label: 'Bidon 1 L', quantity_per_unit: 1, unit: 'L' },
  { label: 'Bidon 5 L', quantity_per_unit: 5, unit: 'L' },
];

const NEW_PRIMER_PACKAGINGS = [
  { label: 'Jerrican 1 kg', quantity_per_unit: 1, unit: 'kg' },
  { label: 'Jerrican 5 kg', quantity_per_unit: 5, unit: 'kg' },
];

/** « Après » = le seed ; « avant » = le seed moins `floor_flatness`. */
const questionsAfter = (code: string) =>
  seedWorkTypes.find((wt) => wt.code === code)!.contextual_questions;

const questionsBefore = (code: string) =>
  questionsAfter(code).filter((q) => q.key !== 'floor_flatness');

export class GateFloorPrepOnFlatness1711468800088 implements MigrationInterface {
  name = 'GateFloorPrepOnFlatness1711468800088';

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
        ADD COLUMN IF NOT EXISTS "substrate_prep" character varying(20);
    `);

    // The `substrate_prep` backfill must not depend on the yield/unit still
    // holding their pre-recalibration value: `seed-catalog.data.ts` is a
    // living array (see `…067`'s own note on this), so on a database that
    // migrates from scratch `…006` already inserts the recalibrated
    // `yield_per_unit`/`unit` straight from that file. A guard coupling
    // `substrate_prep IS NULL` to the legacy value never matches there,
    // leaving `substrate_prep` permanently unset and the floor-flatness gate
    // silently inert — every quote always includes the levelling compound
    // and primer, regardless of the answer. Same fix already applied by
    // `…087` for `wet_room_system`: back the new column on its own IS NULL
    // guard, and keep the value recalibration as an independent, harmless
    // no-op once the seed already carries the new figure.
    for (const m of COMPOUNDS) {
      await queryRunner.query(
        `UPDATE "materials_catalog"
            SET "substrate_prep" = 'leveling_compound'
          WHERE "name" = $1 AND "category" = $2 AND "substrate_prep" IS NULL`,
        [m.name, m.category],
      );
      await queryRunner.query(
        `UPDATE "materials_catalog"
            SET "yield_per_unit" = 0.2222
          WHERE "name" = $1 AND "category" = $2 AND "yield_per_unit" = 0.2`,
        [m.name, m.category],
      );
    }

    for (const m of PRIMERS) {
      await queryRunner.query(
        `UPDATE "materials_catalog"
            SET "substrate_prep" = 'leveling_primer'
          WHERE "name" = $1 AND "category" = $2 AND "substrate_prep" IS NULL`,
        [m.name, m.category],
      );
      await queryRunner.query(
        `UPDATE "materials_catalog"
            SET "unit" = 'kg'
          WHERE "name" = $1 AND "category" = $2 AND "unit" = 'L'`,
        [m.name, m.category],
      );
      for (const pkg of LEGACY_PRIMER_PACKAGINGS) {
        await queryRunner.query(
          `DELETE FROM "material_packaging" mp
            USING "materials_catalog" m
            WHERE mp."material_id" = m."id"
              AND m."name" = $1 AND m."category" = $2 AND mp."label" = $3`,
          [m.name, m.category, pkg.label],
        );
      }
      for (const pkg of NEW_PRIMER_PACKAGINGS) {
        // `$3` sert deux fois (valeur insérée et comparaison NOT EXISTS) :
        // sans cast, Postgres refuse de lui déduire un type (42P08).
        await queryRunner.query(
          `INSERT INTO "material_packaging" ("material_id", "label", "quantity_per_unit", "unit")
           SELECT m."id", $3::varchar, $4::numeric, $5::varchar
             FROM "materials_catalog" m
            WHERE m."name" = $1 AND m."category" = $2
              AND NOT EXISTS (
                SELECT 1 FROM "material_packaging" p
                 WHERE p."material_id" = m."id" AND p."label" = $3::varchar)`,
          [m.name, m.category, pkg.label, pkg.quantity_per_unit, pkg.unit],
        );
      }
    }

    for (const code of PREP_WORK_TYPES) {
      await this.setQuestions(queryRunner, code, questionsAfter(code));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const code of PREP_WORK_TYPES) {
      await this.setQuestions(queryRunner, code, questionsBefore(code));
    }

    for (const m of PRIMERS) {
      for (const pkg of NEW_PRIMER_PACKAGINGS) {
        await queryRunner.query(
          `DELETE FROM "material_packaging" mp
            USING "materials_catalog" m
            WHERE mp."material_id" = m."id"
              AND m."name" = $1 AND m."category" = $2 AND mp."label" = $3`,
          [m.name, m.category, pkg.label],
        );
      }
      for (const pkg of LEGACY_PRIMER_PACKAGINGS) {
        await queryRunner.query(
          `INSERT INTO "material_packaging" ("material_id", "label", "quantity_per_unit", "unit")
           SELECT m."id", $3, $4, $5
             FROM "materials_catalog" m
            WHERE m."name" = $1 AND m."category" = $2`,
          [m.name, m.category, pkg.label, pkg.quantity_per_unit, pkg.unit],
        );
      }
      await queryRunner.query(
        `UPDATE "materials_catalog"
            SET "unit" = 'L'
          WHERE "name" = $1 AND "category" = $2
            AND "substrate_prep" = 'leveling_primer' AND "unit" = 'kg'`,
        [m.name, m.category],
      );
    }

    for (const m of COMPOUNDS) {
      await queryRunner.query(
        `UPDATE "materials_catalog"
            SET "yield_per_unit" = 0.2
          WHERE "name" = $1 AND "category" = $2
            AND "substrate_prep" = 'leveling_compound'
            AND "yield_per_unit" = 0.2222`,
        [m.name, m.category],
      );
    }

    await queryRunner.query(`
      ALTER TABLE "materials_catalog" DROP COLUMN IF EXISTS "substrate_prep";
    `);
  }
}
