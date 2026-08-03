import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedMaterials } from '../materials/seed-catalog.data';

/**
 * E1-4 (BACKLOG_V1) — `materials_catalog.applies_coats` : le nombre de couches
 * cesse d'être déduit de la catégorie de l'ouvrage et devient un attribut du
 * matériau. Avant, `computeTheoreticalQty` multipliait par `number_of_coats`
 * tout ce qu'un ouvrage `painting` chargeait, accessoires compris — un pinceau
 * à `yield_per_unit = 1` sortait à ~70 unités pour 33 m².
 *
 * Renseignement des 208 matériaux seedés en deux temps :
 *  - `ADD COLUMN … NOT NULL DEFAULT false` pose la valeur de tous les
 *    matériaux, seedés ou créés depuis (`POST /materials`) ;
 *  - un `UPDATE` unique repasse à `true` les seuls revêtements appliqués en
 *    couches, lus depuis `seed-catalog.data.ts` — la même source que le seed
 *    `…006`, donc pas de liste dupliquée qui pourrait diverger.
 *
 * Garde stricte sur le nombre de lignes touchées : l'index unique
 * `UQ_materials_catalog_name_category` interdit les doublons, et le catalogue
 * n'expose aucune suppression (seulement `PATCH :id/deactivate`) — un écart
 * signale une base qui n'a pas le catalogue attendu, pas un cas nominal. Mieux
 * vaut une migration qui échoue en nommant les manquants qu'un chiffrage
 * silencieusement faux sur un pot de peinture.
 *
 * `down()` supprime la colonne : le moteur repasse alors à la déduction par
 * catégorie de la version précédente, sans donnée orpheline.
 */
export class AddAppliesCoatsToMaterialsCatalog1711468800068 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "materials_catalog"
        ADD COLUMN "applies_coats" boolean NOT NULL DEFAULT false;
    `);

    const coatingNames = seedMaterials
      .filter((m) => m.applies_coats)
      .map((m) => m.name);

    // Pour un UPDATE, le driver Postgres de TypeORM renvoie la paire
    // [lignes RETURNING, nombre de lignes touchées] — pas les lignes seules
    // comme pour un INSERT … RETURNING.
    const [updated] = (await queryRunner.query(
      `UPDATE "materials_catalog"
         SET "applies_coats" = true
       WHERE "category" = 'painting' AND "name" = ANY($1::text[])
       RETURNING "name"`,
      [coatingNames],
    )) as [{ name: string }[], number];

    if (updated.length !== coatingNames.length) {
      const touched = new Set(updated.map((r) => r.name));
      const missing = coatingNames.filter((n) => !touched.has(n));
      throw new Error(
        `materials_catalog.applies_coats : ${updated.length} ligne(s) mise(s) ` +
          `à jour au lieu de ${coatingNames.length} — introuvable(s) : ` +
          `${missing.join(', ')}.`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "materials_catalog" DROP COLUMN "applies_coats";`,
    );
  }
}
