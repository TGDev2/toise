import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E1-10 (BACKLOG_V1) — le linéaire et le comptage deviennent des assiettes.
 *
 * E1-7 avait posé « pas de rendement surfacique, pas de ligne » et sorti du
 * chiffrage plinthes, barres de seuil et silicone. E1-10 remplace la règle
 * (`docs/MATERIAUX_OUVRAGES.md`) : le moteur connaît désormais le périmètre au
 * sol portes déduites (`floor_perimeter`) et le nombre de passages de porte
 * (`door_count`), et cette migration re-métre les matériaux existants sur ces
 * assiettes. Aucune colonne à créer : `quantity_driver` est un varchar(20) nu
 * (`…080`), l'extension est purement donnée.
 *
 * Trois gestes :
 *
 * **1. Les plinthes et la bande d'étanchéité passent à `floor_perimeter`.**
 * Rendement 1 inchangé — un mètre couvre un mètre, définitionnel.
 *
 * **2. Les barres de seuil passent à `door_count`, et leur perte à 0/0/0.**
 * Une barre par passage de porte : un pourcentage sur une unité comptée en
 * achèterait deux par arrondi (registre, « Assiettes linéaires et comptées »).
 *
 * **3. Le silicone est ré-exprimé en mètres de joint périphérique.** La fiche
 * Sika Sanisil publie « 3,0 m de joint 10 × 10 mm » par cartouche de 300 ml —
 * la section la plus défavorable publiée, sens sûr. 6 → 3, assiette
 * `floor_perimeter`.
 *
 * La bande d'étanchéité perd aussi son « Rouleau 50 m », qu'aucune fiche ne
 * confirme (le rouleau réel est le 10 m, Cermix AR12) — le down() le
 * réinsère à l'identique.
 *
 * Additive (leçon 29) : aucune contrainte, aucun retrait de ligne servie. Les
 * UPDATE portent leur garde `AND ... = <ancien>` — rejouables, et une retouche
 * admin survit.
 */

/** Matériaux re-métrés sur le périmètre au sol, rendement inchangé. */
const PERIMETER_MATERIALS: { name: string; category: string }[] = [
  { name: 'Plinthe carrelage 8x30 cm', category: 'tiling' },
  { name: 'Plinthe MDF 60mm 2.4m', category: 'flooring' },
  { name: 'Plinthe MDF 80mm 2.4m', category: 'flooring' },
  { name: 'Plinthe chêne 70mm 2.4m', category: 'flooring' },
  { name: "Bande d'étanchéité 120mm", category: 'tiling' },
];

const THRESHOLD_MATERIALS: { name: string; category: string }[] = [
  { name: 'Barre de seuil alu 93cm', category: 'flooring' },
  { name: 'Barre de seuil alu 180cm', category: 'flooring' },
];

/** Perte d'accessoire que les seuils portaient avant ce lot — pour le down. */
const LEGACY_THRESHOLD_WASTE: Record<string, number> = {
  beginner: 10,
  intermediate: 5,
  expert: 2,
};

const REMOVED_BAND_PACKAGING = {
  label: 'Rouleau 50 m',
  quantity_per_unit: 50,
  unit: 'm',
};

export class MeterLinearAndCountedBases1711468800086 implements MigrationInterface {
  name = 'MeterLinearAndCountedBases1711468800086';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const m of PERIMETER_MATERIALS) {
      await queryRunner.query(
        `UPDATE "materials_catalog"
            SET "quantity_driver" = 'floor_perimeter'
          WHERE "name" = $1 AND "category" = $2
            AND "quantity_driver" = 'work_surface'`,
        [m.name, m.category],
      );
    }

    for (const m of THRESHOLD_MATERIALS) {
      await queryRunner.query(
        `UPDATE "materials_catalog"
            SET "quantity_driver" = 'door_count'
          WHERE "name" = $1 AND "category" = $2
            AND "quantity_driver" = 'work_surface'`,
        [m.name, m.category],
      );
      for (const [skill, legacy] of Object.entries(LEGACY_THRESHOLD_WASTE)) {
        await queryRunner.query(
          `UPDATE "waste_factors" wf
              SET "factor_percent" = 0
             FROM "materials_catalog" m
            WHERE wf."material_id" = m."id"
              AND m."name" = $1 AND m."category" = $2
              AND wf."pose_type" = 'standard' AND wf."skill_level" = $3
              AND wf."factor_percent" = $4`,
          [m.name, m.category, skill, legacy],
        );
      }
    }

    await queryRunner.query(
      `UPDATE "materials_catalog"
          SET "quantity_driver" = 'floor_perimeter', "yield_per_unit" = 3
        WHERE "name" = 'Joint souple silicone' AND "category" = 'tiling'
          AND "quantity_driver" = 'work_surface' AND "yield_per_unit" = 6`,
    );

    await queryRunner.query(
      `DELETE FROM "material_packaging" mp
        USING "materials_catalog" m
        WHERE mp."material_id" = m."id"
          AND m."name" = 'Bande d''étanchéité 120mm' AND m."category" = 'tiling'
          AND mp."label" = $1`,
      [REMOVED_BAND_PACKAGING.label],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "material_packaging" ("material_id", "label", "quantity_per_unit", "unit")
       SELECT m."id", $1, $2, $3
         FROM "materials_catalog" m
        WHERE m."name" = 'Bande d''étanchéité 120mm' AND m."category" = 'tiling'`,
      [
        REMOVED_BAND_PACKAGING.label,
        REMOVED_BAND_PACKAGING.quantity_per_unit,
        REMOVED_BAND_PACKAGING.unit,
      ],
    );

    await queryRunner.query(
      `UPDATE "materials_catalog"
          SET "quantity_driver" = 'work_surface', "yield_per_unit" = 6
        WHERE "name" = 'Joint souple silicone' AND "category" = 'tiling'
          AND "quantity_driver" = 'floor_perimeter' AND "yield_per_unit" = 3`,
    );

    for (const m of THRESHOLD_MATERIALS) {
      for (const [skill, legacy] of Object.entries(LEGACY_THRESHOLD_WASTE)) {
        await queryRunner.query(
          `UPDATE "waste_factors" wf
              SET "factor_percent" = $4
             FROM "materials_catalog" m
            WHERE wf."material_id" = m."id"
              AND m."name" = $1 AND m."category" = $2
              AND wf."pose_type" = 'standard' AND wf."skill_level" = $3
              AND wf."factor_percent" = 0`,
          [m.name, m.category, skill, legacy],
        );
      }
      await queryRunner.query(
        `UPDATE "materials_catalog"
            SET "quantity_driver" = 'work_surface'
          WHERE "name" = $1 AND "category" = $2
            AND "quantity_driver" = 'door_count'`,
        [m.name, m.category],
      );
    }

    for (const m of PERIMETER_MATERIALS) {
      await queryRunner.query(
        `UPDATE "materials_catalog"
            SET "quantity_driver" = 'work_surface'
          WHERE "name" = $1 AND "category" = $2
            AND "quantity_driver" = 'floor_perimeter'`,
        [m.name, m.category],
      );
    }
  }
}
