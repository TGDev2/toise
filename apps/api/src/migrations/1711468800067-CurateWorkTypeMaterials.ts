import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  workTypeMaterialLinks,
  workTypeMaterialLinksE13,
} from '../materials/work-type-materials.data';

/**
 * E1-3 (BACKLOG_V1) — curation complète des jeux de matériaux des 7 ouvrages
 * (décision métier détaillée et relue dans `docs/MATERIAUX_OUVRAGES.md`) :
 * consommables systématiques, accessoires « petit matériel par chantier » et
 * alternatives documentées (`is_optional`) viennent compléter le seed minimal
 * d'E1-2. Le `Carrelage sol 30x30 cm`, format daté, cède la place au 45x45
 * comme défaut de `floor_tiling` et devient une alternative.
 *
 * Double chemin, car `…066` insère le tableau VIVANT complet :
 * - base vierge — `…066` a déjà tout posé avec les attributs finaux ; ici
 *   l'UPDATE est un no-op qui touche quand même sa ligne et chaque INSERT
 *   tombe en `ON CONFLICT DO NOTHING` ;
 * - base déjà migrée (11 liaisons d'E1-2) — l'UPDATE rétrograde le 30x30 et
 *   les 45 INSERT posent le delta.
 * `down()` supprime exactement le delta et restaure le 30x30 — jamais de
 * TRUNCATE : les liaisons d'E1-2 survivent à un revert.
 *
 * Pas de garde `COUNT(*)` global comme dans `…066` : le tableau vivant
 * grossira aux épics suivants et un COUNT comparé à sa longueur casserait le
 * rejeu de cette migration sur une base en retard. Les gardes locales
 * (unicité des clés en TS, résolution stricte par liaison) suffisent.
 */
export class CurateWorkTypeMaterials1711468800067 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Un doublon dans le tableau complet serait masqué par ON CONFLICT DO
    // NOTHING (le premier rôle inséré gagnerait en silence) : refus explicite.
    const keys = new Set(
      workTypeMaterialLinks.map(
        (l) => `${l.work_type_code}|${l.material_category}|${l.material_name}`,
      ),
    );
    if (keys.size !== workTypeMaterialLinks.length) {
      throw new Error(
        `work_type_materials : doublon dans work-type-materials.data.ts ` +
          `(${workTypeMaterialLinks.length} liaisons, ${keys.size} clés uniques).`,
      );
    }

    // Pour UPDATE/DELETE, le driver Postgres de TypeORM renvoie la paire
    // [lignes RETURNING, nombre de lignes touchées] — pas les lignes seules
    // comme pour un INSERT … RETURNING.
    const [updated] = (await queryRunner.query(
      `UPDATE "work_type_materials" wtm
         SET "is_optional" = true, "display_order" = 7
       FROM "work_types" wt, "materials_catalog" m
       WHERE wtm."work_type_id" = wt."id" AND wtm."material_id" = m."id"
         AND wt."code" = 'floor_tiling'
         AND m."name" = 'Carrelage sol 30x30 cm' AND m."category" = 'tiling'
       RETURNING wtm."id"`,
    )) as [{ id: string }[], number];
    if (updated.length !== 1) {
      throw new Error(
        `work_type_materials : rétrogradation du Carrelage sol 30x30 cm — ` +
          `${updated.length} ligne(s) touchée(s) au lieu de 1.`,
      );
    }

    for (const link of workTypeMaterialLinksE13) {
      // Résolution séparée de l'insertion : avec ON CONFLICT DO NOTHING, un
      // nom introuvable et une liaison déjà présente rendraient tous deux
      // zéro ligne — indistinguables sur le seul INSERT.
      const resolved = (await queryRunner.query(
        `SELECT wt."id" AS work_type_id, m."id" AS material_id
         FROM "work_types" wt, "materials_catalog" m
         WHERE wt."code" = $1 AND m."name" = $2 AND m."category" = $3`,
        [link.work_type_code, link.material_name, link.material_category],
      )) as { work_type_id: string; material_id: string }[];
      if (resolved.length !== 1) {
        throw new Error(
          `work_type_materials : ${resolved.length} correspondance(s) pour ` +
            `${link.work_type_code} → "${link.material_name}" ` +
            `(${link.material_category}) — code ou nom introuvable ou ambigu.`,
        );
      }

      await queryRunner.query(
        `INSERT INTO "work_type_materials"
           ("work_type_id", "material_id", "role", "is_optional", "display_order")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("work_type_id", "material_id") DO NOTHING`,
        [
          resolved[0].work_type_id,
          resolved[0].material_id,
          link.role,
          link.is_optional,
          link.display_order,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const link of workTypeMaterialLinksE13) {
      const [deleted] = (await queryRunner.query(
        `DELETE FROM "work_type_materials" wtm
         USING "work_types" wt, "materials_catalog" m
         WHERE wtm."work_type_id" = wt."id" AND wtm."material_id" = m."id"
           AND wt."code" = $1 AND m."name" = $2 AND m."category" = $3
         RETURNING wtm."id"`,
        [link.work_type_code, link.material_name, link.material_category],
      )) as [{ id: string }[], number];
      if (deleted.length !== 1) {
        throw new Error(
          `work_type_materials : suppression du delta E1-3 — ` +
            `${deleted.length} ligne(s) pour ${link.work_type_code} → ` +
            `"${link.material_name}" au lieu de 1.`,
        );
      }
    }

    const [restored] = (await queryRunner.query(
      `UPDATE "work_type_materials" wtm
         SET "is_optional" = false, "display_order" = 1
       FROM "work_types" wt, "materials_catalog" m
       WHERE wtm."work_type_id" = wt."id" AND wtm."material_id" = m."id"
         AND wt."code" = 'floor_tiling'
         AND m."name" = 'Carrelage sol 30x30 cm' AND m."category" = 'tiling'
       RETURNING wtm."id"`,
    )) as [{ id: string }[], number];
    if (restored.length !== 1) {
      throw new Error(
        `work_type_materials : restauration du Carrelage sol 30x30 cm — ` +
          `${restored.length} ligne(s) touchée(s) au lieu de 1.`,
      );
    }
  }
}
