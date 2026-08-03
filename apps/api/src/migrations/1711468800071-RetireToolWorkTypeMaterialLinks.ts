import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E1-7 (BACKLOG_V1) — sort du périmètre chiffré tout matériau lié dont le
 * rendement en m² par unité n'est pas sourçable sur fiche fabricant :
 * - 15 liaisons d'outils purs (« un rouleau couvre 1 m² » faisait acheter
 *   35 rouleaux pour une chambre) ;
 * - le ruban adhésif pare-vapeur (aucune consommation normée en fiche, pose
 *   non requise en conditions normales d'après la fiche du film) ;
 * - le joint silicone (les fiches ne publient que du linéaire — 12 m de
 *   cordon par cartouche — jamais un rendement surfacique) ;
 * - les croisillons 2 et 3 mm (aucune table de consommation par m² chez
 *   Rubi, Raimondi ni Taliaplast).
 * Les matériaux restent au catalogue (`is_active` inchangé), seuls les liens
 * `work_type_materials` disparaissent. Le registre des décisions, matériau
 * par matériau, est `docs/SOURCES_CATALOGUE.md`.
 *
 * Tableau en dur (modèle `…069`) et non le fichier data vivant : la
 * migration reste figée sur ce qu'E1-7 a réellement retiré, quand bien même
 * la curation évoluerait ensuite.
 *
 * `up()` tolère zéro ligne, sans garde de comptage — c'est l'écart assumé
 * avec le down strict de `…067` : sur base vierge, `…066` seede le tableau
 * vivant qui ne contient déjà plus ces liaisons, et un DELETE rejoué est un
 * no-op légitime. L'unicité (work_type_id, material_id) garantit ≤ 1 ligne
 * par entrée.
 *
 * `down()` résout séparément (modèle `…067` : distinguer « introuvable »
 * d'« ambigu ») puis ré-insère à l'identique. Zéro correspondance ne jette
 * pas : une fois déliés, ces matériaux ne sont plus protégés par le
 * FK RESTRICT et un admin peut les avoir supprimés du catalogue — un down
 * bloquant interdirait tout revert.
 */

interface RetiredLink {
  work_type_code: string;
  material_name: string;
  material_category: string;
  role: 'accessoire' | 'consommable';
  is_optional: boolean;
  /** Rang d'origine, restitué tel quel par `down()`. */
  display_order: number;
}

const retired: RetiredLink[] = [
  {
    work_type_code: 'wall_painting',
    material_name: 'Rouleau méché 180mm',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 3,
  },
  {
    work_type_code: 'wall_painting',
    material_name: 'Pinceau à rechampir 25mm',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 4,
  },
  {
    work_type_code: 'wall_painting',
    material_name: 'Ruban de masquage 50m',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 5,
  },
  {
    work_type_code: 'wall_painting',
    material_name: 'Bâche de protection 4x5m',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 6,
  },
  {
    work_type_code: 'ceiling_painting',
    material_name: 'Rouleau méché 180mm',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 3,
  },
  {
    work_type_code: 'ceiling_painting',
    material_name: 'Pinceau à rechampir 25mm',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 4,
  },
  {
    work_type_code: 'ceiling_painting',
    material_name: 'Bâche de protection 4x5m',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 5,
  },
  {
    work_type_code: 'ceiling_painting',
    material_name: 'Ruban de masquage 50m',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 6,
  },
  {
    work_type_code: 'floor_tiling',
    material_name: 'Croisillons 3mm (x200)',
    material_category: 'tiling',
    role: 'accessoire',
    is_optional: false,
    display_order: 4,
  },
  {
    work_type_code: 'floor_tiling',
    material_name: 'Éponge de carreleur',
    material_category: 'tiling',
    role: 'accessoire',
    is_optional: false,
    display_order: 5,
  },
  {
    work_type_code: 'floor_tiling',
    material_name: 'Peigne à colle 10mm',
    material_category: 'tiling',
    role: 'accessoire',
    is_optional: false,
    display_order: 6,
  },
  {
    work_type_code: 'wall_tiling',
    material_name: 'Joint souple silicone',
    material_category: 'tiling',
    role: 'consommable',
    is_optional: false,
    display_order: 4,
  },
  {
    work_type_code: 'wall_tiling',
    material_name: 'Croisillons 2mm (x200)',
    material_category: 'tiling',
    role: 'accessoire',
    is_optional: false,
    display_order: 5,
  },
  {
    work_type_code: 'wall_tiling',
    material_name: 'Éponge de carreleur',
    material_category: 'tiling',
    role: 'accessoire',
    is_optional: false,
    display_order: 6,
  },
  {
    work_type_code: 'parquet_flooring',
    material_name: 'Ruban adhésif pare-vapeur',
    material_category: 'flooring',
    role: 'consommable',
    is_optional: false,
    display_order: 4,
  },
  {
    work_type_code: 'parquet_flooring',
    material_name: 'Cale de dilatation (x40)',
    material_category: 'flooring',
    role: 'accessoire',
    is_optional: false,
    display_order: 5,
  },
  {
    work_type_code: 'wall_covering',
    material_name: 'Brosse à maroufler',
    material_category: 'wall_covering',
    role: 'accessoire',
    is_optional: false,
    display_order: 3,
  },
  {
    work_type_code: 'wall_covering',
    material_name: 'Roulette de joint',
    material_category: 'wall_covering',
    role: 'accessoire',
    is_optional: false,
    display_order: 4,
  },
  {
    work_type_code: 'wall_covering',
    material_name: 'Cutter de précision',
    material_category: 'wall_covering',
    role: 'accessoire',
    is_optional: false,
    display_order: 5,
  },
];

export class RetireToolWorkTypeMaterialLinks1711468800071 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const link of retired) {
      await queryRunner.query(
        `DELETE FROM "work_type_materials" wtm
         USING "work_types" wt, "materials_catalog" m
         WHERE wtm."work_type_id" = wt."id" AND wtm."material_id" = m."id"
           AND wt."code" = $1 AND m."name" = $2 AND m."category" = $3`,
        [link.work_type_code, link.material_name, link.material_category],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const link of retired) {
      const resolved = (await queryRunner.query(
        `SELECT wt."id" AS work_type_id, m."id" AS material_id
         FROM "work_types" wt, "materials_catalog" m
         WHERE wt."code" = $1 AND m."name" = $2 AND m."category" = $3`,
        [link.work_type_code, link.material_name, link.material_category],
      )) as { work_type_id: string; material_id: string }[];
      if (resolved.length > 1) {
        throw new Error(
          `work_type_materials : ${resolved.length} correspondances pour ` +
            `${link.work_type_code} → "${link.material_name}" ` +
            `(${link.material_category}) — nom ambigu.`,
        );
      }
      if (resolved.length === 0) {
        // Matériau délié puis supprimé du catalogue : rien à relier.
        continue;
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
}
