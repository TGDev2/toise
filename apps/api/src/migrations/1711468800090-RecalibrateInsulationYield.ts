import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E1-10 (BACKLOG_V1) — le rendement de la laine de verre suit le quantitatif
 * Placo.
 *
 * La fiche solution Placostil® 72/48 (39 dB) compte **1,05 m² d'isolant par
 * m² de cloison** (ligne « M2 — 1,05 » du quantitatif, isolant « Laine de
 * verre, 45 mm ») : le rendement passe de 1 (définitionnel) à 1/1,05 =
 * 0,9524. La laine se pose entre les montants, une seule trame quel que soit
 * le nombre de faces — l'assiette reste `work_surface`. Registre mis à jour,
 * décision `corriger (1 → 0.9524)`, consulté le 2026-08-08.
 *
 * Même modèle que `…070` : UPDATE gardé sur l'ancienne valeur, down exact.
 */
export class RecalibrateInsulationYield1711468800090 implements MigrationInterface {
  name = 'RecalibrateInsulationYield1711468800090';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "materials_catalog"
          SET "yield_per_unit" = 0.9524
        WHERE "name" = 'Laine de verre 45mm' AND "category" = 'partition'
          AND "yield_per_unit" = 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "materials_catalog"
          SET "yield_per_unit" = 1
        WHERE "name" = 'Laine de verre 45mm' AND "category" = 'partition'
          AND "yield_per_unit" = 0.9524`,
    );
  }
}
