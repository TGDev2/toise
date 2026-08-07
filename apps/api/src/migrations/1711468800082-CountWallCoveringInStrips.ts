import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedMaterials } from '../materials/seed-catalog.data';
import { seedWorkTypes } from '../projects/work-types.data';

/**
 * E1-6 (BACKLOG_V1) — le revêtement mural se compte en lés, plus au mètre carré.
 *
 * Un rouleau ne rend jamais les 5,3 m² que le catalogue lui prêtait : il rend un
 * nombre **entier** de lés, dont la longueur est la hauteur sous plafond
 * augmentée du raccord de motif et d'une marge de coupe. Et un lé ne tourne pas
 * un angle. Sur la chambre de référence à 2,60 m sous plafond, le moteur
 * annonçait 8 rouleaux là où la découpe en demande 10.
 *
 * Quatre gestes, une seule cause.
 *
 * **1. `materials_catalog.roll_width_cm` / `roll_length_cm`.** Deux colonnes
 * nullables, sur le modèle de `consumption_model` (`…081`) et
 * d'`applies_coats` (`…068`) : la loi de quantité est portée par le matériau,
 * jamais déduite de sa catégorie ni du code de l'ouvrage. Leur présence bascule
 * le matériau sur la découpe en lés et **remplace** `yield_per_unit`.
 *
 * Elles sont des données et non des constantes de moteur parce que le catalogue
 * porte déjà deux conditionnements : les papiers peints en 10,05 × 0,53 m, le
 * papier d'apprêt en 10 × 0,50 m. Renseignées depuis `seed-catalog.data.ts`, la
 * même source que le seed `…006` — pas de liste dupliquée qui pourrait diverger.
 *
 * **2. Le conditionnement des papiers peints passe de 5,3 à 5,3265 m².** Ce
 * n'est pas un raffinement : `0,53 × 10,05 = 5,3265` **est** la surface du
 * rouleau, et les deux valeurs doivent décrire le même objet. À 5,3, le séjour
 * en L de référence — qui demande exactement 12 rouleaux — en achetait 13, le
 * besoin ressortant à 12,06 rouleaux par la seule erreur d'arrondi.
 *
 * **3. Deux questions d'ouvrage sur `wall_covering`**, qui n'en portait aucune :
 * le raccord de motif (requis, il se lit sur l'étiquette du produit) et la marge
 * de coupe (facultative, 10 cm par défaut).
 *
 * **4. Rien d'autre.** Ni l'unité, ni le rendement, ni les facteurs de perte ne
 * bougent : la liste de courses, l'export et le comparateur de prix continuent
 * de voir des m² et un « Rouleau ».
 *
 * Additive (leçon 29) : deux colonnes ajoutées avec un défaut `NULL`, aucune
 * suppression, aucune contrainte resserrée. Le code de la version précédente
 * tourne sur ce schéma — il ignore simplement les colonnes. Les prédicats
 * `AND "quantity_per_unit" = <ancien>` rendent l'UP rejouable et laissent intacte
 * une valeur qu'un administrateur aurait retouchée entre-temps.
 */

const WALL_COVERING_WORK_TYPE = 'wall_covering';

/** Les matériaux que le seed déclare vendus au rouleau. */
const rollMaterials = seedMaterials.filter(
  (m) => m.roll_width_cm && m.roll_length_cm,
);

/**
 * Conditionnement des papiers peints, avant et après. Dérivé du seed pour
 * l'après — recopier `5.3265` ici le laisserait diverger le jour où la
 * dimension du rouleau serait corrigée.
 */
const WALLPAPER_ROLL_LABEL_BEFORE = 'Rouleau 10.05m x 0.53m (~5.3 m²)';
const WALLPAPER_QTY_BEFORE = 5.3;

const wallpaperPackaging = (() => {
  const found = rollMaterials.find(
    (m) => m.roll_width_cm === 53 && m.roll_length_cm === 1005,
  )?.packagings[0];
  if (!found) {
    throw new Error(
      'seed-catalog.data.ts ne déclare plus de rouleau 10,05 × 0,53 m : ' +
        'la migration …082 ne sait plus quel conditionnement corriger.',
    );
  }
  return found;
})();

const wallCovering = seedWorkTypes.find(
  (wt) => wt.code === WALL_COVERING_WORK_TYPE,
);
if (!wallCovering) {
  throw new Error(
    `work-types.data.ts ne déclare plus « ${WALL_COVERING_WORK_TYPE} » : ` +
      'la migration …082 ne sait plus quoi mettre à jour.',
  );
}

/** Questions d'après ce lot, et d'avant — l'ouvrage n'en portait aucune. */
const questionsAfter = wallCovering.contextual_questions;
const questionsBefore: unknown[] = [];

export class CountWallCoveringInStrips1711468800082 implements MigrationInterface {
  /** Les noms des matériaux vendus au rouleau, pour un `ANY(...)` paramétré. */
  private names(widthCm: number, lengthCm: number): string[] {
    return rollMaterials
      .filter(
        (m) => m.roll_width_cm === widthCm && m.roll_length_cm === lengthCm,
      )
      .map((m) => m.name);
  }

  private async setQuestions(
    queryRunner: QueryRunner,
    questions: unknown[],
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE "work_types"
         SET "contextual_questions" = $1::jsonb
       WHERE "code" = $2`,
      [JSON.stringify(questions), WALL_COVERING_WORK_TYPE],
    );
  }

  /**
   * Le conditionnement du rouleau standard, dans un sens ou dans l'autre. Le
   * prédicat porte sur l'ancienne valeur, jamais sur le seul nom du matériau :
   * une quantité déjà corrigée à la main n'est pas écrasée.
   */
  private async setWallpaperPackaging(
    queryRunner: QueryRunner,
    from: { label: string; qty: number },
    to: { label: string; qty: number },
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE "material_packaging" AS p
          SET "label" = $1, "quantity_per_unit" = $2
         FROM "materials_catalog" AS m
        WHERE p."material_id" = m."id"
          AND m."category" = 'wall_covering'
          AND m."name" = ANY($3::text[])
          AND p."label" = $4
          AND p."quantity_per_unit" = $5`,
      [to.label, to.qty, this.names(53, 1005), from.label, from.qty],
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "materials_catalog"
        ADD COLUMN IF NOT EXISTS "roll_width_cm" numeric(8,2),
        ADD COLUMN IF NOT EXISTS "roll_length_cm" numeric(8,2);
    `);

    // Un couple de dimensions par conditionnement réellement seedé : le
    // 10,05 × 0,53 des papiers peints, le 10 × 0,50 du papier d'apprêt.
    const shapes = new Map(
      rollMaterials.map((m) => [
        `${m.roll_width_cm}:${m.roll_length_cm}`,
        { width: m.roll_width_cm!, length: m.roll_length_cm! },
      ]),
    );

    for (const { width, length } of shapes.values()) {
      const names = this.names(width, length);

      // Pour un UPDATE, le driver Postgres de TypeORM renvoie la paire
      // [lignes RETURNING, nombre de lignes touchées] — pas les lignes seules
      // comme pour un INSERT … RETURNING.
      const [updated] = (await queryRunner.query(
        `UPDATE "materials_catalog"
            SET "roll_width_cm" = $1, "roll_length_cm" = $2
          WHERE "category" = 'wall_covering' AND "name" = ANY($3::text[])
          RETURNING "name"`,
        [width, length, names],
      )) as [{ name: string }[], number];

      // Un écart signale une base qui n'a pas le catalogue attendu, pas un cas
      // nominal. Mieux vaut échouer en nommant les manquants qu'un papier peint
      // chiffré au mètre carré sur un chantier.
      if (updated.length !== names.length) {
        const touched = new Set(updated.map((r) => r.name));
        throw new Error(
          `materials_catalog.roll_*_cm = ${width} × ${length} : ` +
            `${updated.length} ligne(s) au lieu de ${names.length} — ` +
            `introuvable(s) : ${names.filter((n) => !touched.has(n)).join(', ')}.`,
        );
      }
    }

    await this.setWallpaperPackaging(
      queryRunner,
      { label: WALLPAPER_ROLL_LABEL_BEFORE, qty: WALLPAPER_QTY_BEFORE },
      {
        label: wallpaperPackaging.label,
        qty: wallpaperPackaging.quantity_per_unit,
      },
    );
    await this.setQuestions(queryRunner, questionsAfter);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.setQuestions(queryRunner, questionsBefore);
    await this.setWallpaperPackaging(
      queryRunner,
      {
        label: wallpaperPackaging.label,
        qty: wallpaperPackaging.quantity_per_unit,
      },
      { label: WALLPAPER_ROLL_LABEL_BEFORE, qty: WALLPAPER_QTY_BEFORE },
    );
    await queryRunner.query(`
      ALTER TABLE "materials_catalog"
        DROP COLUMN IF EXISTS "roll_length_cm",
        DROP COLUMN IF EXISTS "roll_width_cm";
    `);
  }
}
