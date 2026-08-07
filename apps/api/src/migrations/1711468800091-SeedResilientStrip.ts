import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedMaterials } from '../materials/seed-catalog.data';

/**
 * E1-10 (BACKLOG_V1) — la bande résiliente entre au catalogue.
 *
 * Knauf (« Accessoires pour cloisons - Bande résiliente ») : « La bande
 * résiliente (grise) se colle sous les rails », largeur 50 mm pour le rail de
 * 48, rouleau de 30 ml. Posée en course continue et aboutable, son assiette
 * est exactement celle du rail : `frame_runner`, un mètre de bande par mètre
 * de lisse — définitionnel, aucun ratio fabricant n'étant publié (règle de
 * pose seule, consigné au registre).
 *
 * Même modèle que le bloc d'insertion de `…084` : valeurs dérivées du seed
 * (une seule source de vérité), ON CONFLICT DO NOTHING sur une base vierge où
 * `…006` a déjà tout inséré, down en ordre de clés étrangères.
 */

const STRIP_NAME = 'Bande résiliente 50mm';
const STRIP_CATEGORY = 'partition';

const strip = seedMaterials.find(
  (m) => m.name === STRIP_NAME && m.category === STRIP_CATEGORY,
);

export class SeedResilientStrip1711468800091 implements MigrationInterface {
  name = 'SeedResilientStrip1711468800091';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!strip) {
      throw new Error(
        `Le catalogue seedé ne contient plus « ${STRIP_NAME} » : cette ` +
          `migration en dérive ses valeurs et ne peut pas les inventer.`,
      );
    }

    const inserted = (await queryRunner.query(
      `INSERT INTO "materials_catalog"
         ("name", "category", "unit", "yield_per_unit", "quantity_driver")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("name", "category") DO NOTHING
       RETURNING "id"`,
      [
        strip.name,
        strip.category,
        strip.unit,
        strip.yield_per_unit,
        strip.quantity_driver ?? 'work_surface',
      ],
    )) as { id: string }[];

    if (inserted.length > 0) {
      const materialId = inserted[0].id;
      for (const pkg of strip.packagings) {
        await queryRunner.query(
          `INSERT INTO "material_packaging" ("material_id", "label", "quantity_per_unit", "unit")
           VALUES ($1, $2, $3, $4)`,
          [materialId, pkg.label, pkg.quantity_per_unit, pkg.unit],
        );
      }
      for (const wf of strip.waste_factors) {
        await queryRunner.query(
          `INSERT INTO "waste_factors" ("material_id", "pose_type", "skill_level", "factor_percent")
           VALUES ($1, $2, $3, $4)
           ON CONFLICT ("material_id", "pose_type", "skill_level") DO NOTHING`,
          [materialId, wf.pose_type, wf.skill_level, wf.factor_percent],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // La liaison éventuelle (…092) descend avant ; ici : pertes,
    // conditionnements, puis le matériau — l'ordre des clés étrangères.
    await queryRunner.query(
      `DELETE FROM "waste_factors" wf
        USING "materials_catalog" m
        WHERE wf."material_id" = m."id"
          AND m."name" = $1 AND m."category" = $2`,
      [STRIP_NAME, STRIP_CATEGORY],
    );
    await queryRunner.query(
      `DELETE FROM "material_packaging" mp
        USING "materials_catalog" m
        WHERE mp."material_id" = m."id"
          AND m."name" = $1 AND m."category" = $2`,
      [STRIP_NAME, STRIP_CATEGORY],
    );
    await queryRunner.query(
      `DELETE FROM "materials_catalog" WHERE "name" = $1 AND "category" = $2`,
      [STRIP_NAME, STRIP_CATEGORY],
    );
  }
}
