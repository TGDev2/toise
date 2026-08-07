import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E1-10 (BACKLOG_V1) — les croisillons se comptent sur la géométrie du
 * carreau.
 *
 * E1-7 les avait retirés « faute de table de consommation fabricant » (Rubi,
 * Raimondi, Taliaplast vérifiés — aucun ne publie). Ce qui les réintègre
 * n'est pas une fiche, c'est une **dérivation géométrique** du même statut
 * que la longueur de joint de la formule Cermix (E1-5) : un croisillon par
 * intersection de joints, soit autant que de carreaux sous un m² —
 * `10 000 / (L_cm × l_cm)` (`estimations/tile-consumption.ts`,
 * `spacersPerM2`, loi `tile_spacers`).
 *
 * Le rendement passe à la géométrie de référence du modèle (45 × 45 :
 * 4,94 croisillons/m²) : un sachet de 200 couvre 200 × 2 025 / 10 000 =
 * 40,5 m², un sachet de 100 en couvre 20,25. Le moteur dérive le rendement
 * effectif du format posé, comme pour la colle et le joint. Insensible à la
 * largeur de joint et au sens de pose. Registre : « Croisillons : dérivation
 * géométrique (E1-10) », décision `définitionnel — dérivation géométrique`.
 *
 * UPDATE gardés sur les anciennes valeurs (rejouable, retouche admin
 * préservée) ; down exact.
 */

const SPACERS: { name: string; newYield: number }[] = [
  { name: 'Croisillons 2mm (x200)', newYield: 40.5 },
  { name: 'Croisillons 3mm (x200)', newYield: 40.5 },
  { name: 'Croisillons 5mm (x100)', newYield: 20.25 },
];

export class CountSpacersOnTileGeometry1711468800089 implements MigrationInterface {
  name = 'CountSpacersOnTileGeometry1711468800089';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const s of SPACERS) {
      await queryRunner.query(
        `UPDATE "materials_catalog"
            SET "consumption_model" = 'tile_spacers', "yield_per_unit" = $2
          WHERE "name" = $1 AND "category" = 'tiling'
            AND "consumption_model" IS NULL AND "yield_per_unit" = 1`,
        [s.name, s.newYield],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const s of SPACERS) {
      await queryRunner.query(
        `UPDATE "materials_catalog"
            SET "consumption_model" = NULL, "yield_per_unit" = 1
          WHERE "name" = $1 AND "category" = 'tiling'
            AND "consumption_model" = 'tile_spacers'
            AND "yield_per_unit" = $2`,
        [s.name, s.newYield],
      );
    }
  }
}
