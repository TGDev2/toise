import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedMaterials } from '../materials/seed-catalog.data';

/**
 * E1-11 (BACKLOG_V1) — porter la source du rendement sur le matériau, en
 * colonnes, plutôt que dans `docs/SOURCES_CATALOGUE.md` (lu par un seul
 * consommateur, `sources-catalogue.spec.ts`, jamais par le produit).
 *
 * Colonnes sur le matériau, pas sur une table satellite ni un fichier de
 * données séparé : `PUT /admin/materials/:id` édite `yield_per_unit` en
 * direct (`materials.controller.ts`, `AdminGuard`), et une source rangée
 * ailleurs divergerait au premier correctif admin — même argument que
 * `quantity_driver`/`consumption_model`.
 *
 * `source_manufacturer` nul ⇒ rendement définitionnel (vendu et posé au m²,
 * dérivation géométrique) : `source_basis_fr` porte alors la règle plutôt
 * qu'une fiche. Renseigné, les quatre champs identité (fabricant, produit,
 * URL, date) vont ensemble.
 *
 * Le seed 006 (`seed-catalog.data.ts`) est la source de vérité, enrichi des
 * cinq champs pour les 54 matériaux liés à un ouvrage. Cette migration met à
 * jour les bases DÉJÀ seedées, gardée sur `source_url IS NULL AND
 * source_basis_fr IS NULL` pour ne jamais écraser une édition admin déjà
 * faite — même prudence que `…070-RecalibrateSourcedYields`.
 */
export class AddSourceToMaterialsCatalog1711468800094 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "materials_catalog"
        ADD COLUMN "source_manufacturer" character varying(255),
        ADD COLUMN "source_product" character varying(255),
        ADD COLUMN "source_url" character varying(500),
        ADD COLUMN "source_consulted_on" date,
        ADD COLUMN "source_basis_fr" text
    `);

    for (const m of seedMaterials) {
      if (!m.source_basis_fr) continue;
      await queryRunner.query(
        `UPDATE "materials_catalog"
           SET "source_manufacturer" = $1,
               "source_product" = $2,
               "source_url" = $3,
               "source_consulted_on" = $4,
               "source_basis_fr" = $5
         WHERE "name" = $6 AND "category" = $7
           AND "source_url" IS NULL AND "source_basis_fr" IS NULL`,
        [
          m.source_manufacturer ?? null,
          m.source_product ?? null,
          m.source_url ?? null,
          m.source_consulted_on ?? null,
          m.source_basis_fr,
          m.name,
          m.category,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "materials_catalog"
        DROP COLUMN "source_manufacturer",
        DROP COLUMN "source_product",
        DROP COLUMN "source_url",
        DROP COLUMN "source_consulted_on",
        DROP COLUMN "source_basis_fr"
    `);
  }
}
