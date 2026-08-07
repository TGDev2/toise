import { MigrationInterface, QueryRunner } from 'typeorm';
import { workTypeMaterialLinksE110 } from '../materials/work-type-materials.data';

/**
 * E1-10 (BACKLOG_V1) — la liste devient achetable : les liaisons.
 *
 * Les consommables qui bloquaient un chantier — croisillons, silicone
 * périphérique, plinthes, barres de seuil, SEL, ragréages, primaires, bande
 * résiliente — sont liés à leurs ouvrages, chacun au rendement sourcé ou
 * définitionnel (`docs/SOURCES_CATALOGUE.md`) et avec sa borne de
 * consommation (`materials/consumption-bounds.data.ts`).
 *
 * La **laine de verre 45 mm** passe d'alternative documentée à ligne
 * obligatoire : le quantitatif Placostil 72/48 (39 dB) l'inclut, une cloison
 * commandée sans elle n'atteint pas l'affaiblissement promis. Le tableau
 * vivant porte l'état FINAL (comme le 30x30 d'E1-3) ; cet UPDATE est le
 * rattrapage des bases déjà seedées.
 *
 * Même modèle que `…067` : le delta vit dans `work-type-materials.data.ts`
 * (`workTypeMaterialLinksE110`), concaténé au tableau complet — sur base
 * vierge, `…066` insère tout et ces INSERT sont des no-ops (ON CONFLICT DO
 * NOTHING). Le down supprime exactement le delta et restaure l'optionnalité.
 */

const INSULATION = { name: 'Laine de verre 45mm', category: 'partition' };

export class LinkBuyableConsumables1711468800092 implements MigrationInterface {
  name = 'LinkBuyableConsumables1711468800092';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const link of workTypeMaterialLinksE110) {
      const result = (await queryRunner.query(
        `INSERT INTO "work_type_materials"
           ("work_type_id", "material_id", "role", "is_optional", "display_order")
         SELECT wt."id", m."id", $1, $2, $3
           FROM "work_types" wt, "materials_catalog" m
          WHERE wt."code" = $4 AND m."name" = $5 AND m."category" = $6
         ON CONFLICT ("work_type_id", "material_id") DO NOTHING
         RETURNING "work_type_id"`,
        [
          link.role,
          link.is_optional,
          link.display_order,
          link.work_type_code,
          link.material_name,
          link.material_category,
        ],
      )) as unknown[];

      // Un SELECT qui ne résout rien est un lien vers un fantôme : le nom du
      // matériau ou de l'ouvrage a changé sans que ce delta suive. Le conflit
      // (liaison déjà en place) rend aussi zéro ligne — il se distingue par
      // une lecture directe.
      if (result.length === 0) {
        const existing = (await queryRunner.query(
          `SELECT 1
             FROM "work_type_materials" wtm
             JOIN "work_types" wt ON wt."id" = wtm."work_type_id"
             JOIN "materials_catalog" m ON m."id" = wtm."material_id"
            WHERE wt."code" = $1 AND m."name" = $2 AND m."category" = $3`,
          [link.work_type_code, link.material_name, link.material_category],
        )) as unknown[];
        if (existing.length === 0) {
          throw new Error(
            `Liaison E1-10 non résolue : ${link.work_type_code} → ` +
              `${link.material_category}/${link.material_name}`,
          );
        }
      }
    }

    await queryRunner.query(
      `UPDATE "work_type_materials" wtm
          SET "is_optional" = false
         FROM "work_types" wt, "materials_catalog" m
        WHERE wtm."work_type_id" = wt."id" AND wtm."material_id" = m."id"
          AND wt."code" = 'drywall'
          AND m."name" = $1 AND m."category" = $2
          AND wtm."is_optional" = true`,
      [INSULATION.name, INSULATION.category],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "work_type_materials" wtm
          SET "is_optional" = true
         FROM "work_types" wt, "materials_catalog" m
        WHERE wtm."work_type_id" = wt."id" AND wtm."material_id" = m."id"
          AND wt."code" = 'drywall'
          AND m."name" = $1 AND m."category" = $2
          AND wtm."is_optional" = false`,
      [INSULATION.name, INSULATION.category],
    );

    for (const link of workTypeMaterialLinksE110) {
      await queryRunner.query(
        `DELETE FROM "work_type_materials" wtm
          USING "work_types" wt, "materials_catalog" m
          WHERE wtm."work_type_id" = wt."id" AND wtm."material_id" = m."id"
            AND wt."code" = $1 AND m."name" = $2 AND m."category" = $3`,
        [link.work_type_code, link.material_name, link.material_category],
      );
    }
  }
}
