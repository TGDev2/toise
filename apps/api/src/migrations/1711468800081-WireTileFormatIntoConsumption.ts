import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedMaterials } from '../materials/seed-catalog.data';
import { seedWorkTypes } from '../projects/work-types.data';

/**
 * E1-5 (BACKLOG_V1) — le format du carreau pilote enfin le chiffrage.
 *
 * Trois gestes, une seule cause : la consommation d'un consommable de carrelage
 * dépend de la géométrie du carreau, que le moteur ignorait.
 *
 * **1. `materials_catalog.consumption_model`.** Une colonne, nullable, sur le
 * modèle d'`applies_coats` (`…068`) et de `quantity_driver` (`…080`) : la loi de
 * quantité est portée par le matériau, jamais déduite de sa catégorie ni du code
 * de l'ouvrage. Renseignée depuis `seed-catalog.data.ts`, la même source que le
 * seed `…006` — pas de liste dupliquée qui pourrait diverger.
 *
 * Quand elle est renseignée, `yield_per_unit` change de sens : il devient le
 * rendement **à la géométrie de référence du modèle** (45 × 45 cm au sol en
 * double encollage pour `tile_adhesive` ; 45 × 45 cm, épaisseur 9 mm, joint
 * 3 mm pour `tile_grout`), et le moteur en dérive le rendement effectif du
 * carreau réellement posé.
 *
 * **2. Quatre rendements corrigés**, chacun adossé à une fiche fabricant lue et
 * citée dans `docs/SOURCES_CATALOGUE.md` :
 *
 *  - Les quatre mortiers-colle convergent sur `0,14` (= 7,14 kg/m²), la cellule
 *    « sol intérieur, 1 200 < S ≤ 2 200 cm² : 7 (U9) » où tombe le 45 × 45 de
 *    référence. Les tables de Cermix sont **identiques d'une classe à l'autre**
 *    — CERMICOL EXTRA (C1 E), CERMIPLUS 2.0 (C2), CERMIPLUS RAPID, CERMIFLEX
 *    (C2S1 ET) : aucune fiche lue ne fait dépendre la consommation de la classe
 *    de colle, elle dépend du peigne que le format sélectionne. C'est la
 *    correction de fond du « grand format » seedé à `0,15`, qui consommait
 *    **moins** que le C2 à `0,14`. Il consomme désormais plus là où c'est vrai :
 *    sur un 60 × 60, 8 kg/m² (E10) contre 7.
 *  - `Joint fin 1-6mm` : `4 → 5`, soit 0,200 kg/m², la cellule « 45 × 45,
 *    joint 3 mm » de CERMIJOINT COLOR. La valeur d'avant (0,25 kg/m²) ne
 *    correspondait à aucune ligne de fiche et ne bougeait ni avec le format ni
 *    avec la largeur de joint.
 *
 * **3. La largeur de joint devient une question d'ouvrage** sur `floor_tiling`.
 * C'est le terme qui pèse le plus sur la consommation de joint : un 20 × 20 à
 * 5 mm en demande trois fois plus qu'un 60 × 60 à 2 mm.
 *
 * Additive (leçon 29) : une colonne ajoutée avec un défaut, aucune suppression,
 * aucune contrainte resserrée. Le code de la version précédente tourne sur ce
 * schéma — il ignore simplement la colonne. Le prédicat `AND "yield_per_unit" =
 * <ancien>` rend l'UP rejouable et laisse intacte une valeur qu'un
 * administrateur aurait retouchée entre-temps. Modèles : `…068` pour la colonne,
 * `…070-RecalibrateSourcedYields` pour les rendements.
 */

interface YieldCorrection {
  name: string;
  category: string;
  old: number;
  new: number;
}

const corrections: YieldCorrection[] = [
  // Mortiers-colle : tous ramenés à la cellule de fiche du 45 × 45 sol en
  // double encollage. Le C2 y était déjà (E1-7, migration …070).
  { name: 'Mortier-colle standard (C1)', category: 'tiling', old: 0.25, new: 0.14 }, // prettier-ignore
  { name: 'Mortier-colle rapide (C2F)', category: 'tiling', old: 0.25, new: 0.14 }, // prettier-ignore
  { name: 'Mortier-colle grand format (C2S1)', category: 'tiling', old: 0.15, new: 0.14 }, // prettier-ignore
  // Joint : 0,25 kg/m² constant → 0,200 kg/m² à la géométrie de référence.
  { name: 'Joint fin 1-6mm', category: 'tiling', old: 4, new: 5 },
];

/** Les matériaux que le seed déclare porteurs d'une loi de consommation. */
const modelled = seedMaterials.filter((m) => m.consumption_model);

const TILED_WORK_TYPE = 'floor_tiling';
const JOINT_WIDTH_KEY = 'joint_width_mm';

const floorTiling = seedWorkTypes.find((wt) => wt.code === TILED_WORK_TYPE);
if (!floorTiling) {
  throw new Error(
    `work-types.data.ts ne déclare plus « ${TILED_WORK_TYPE} » : ` +
      'la migration …081 ne sait plus quoi mettre à jour.',
  );
}

/** Questions d'après ce lot, et d'avant — dérivées de la même source. */
const questionsAfter = floorTiling.contextual_questions;
const questionsBefore = questionsAfter.filter((q) => q.key !== JOINT_WIDTH_KEY);

export class WireTileFormatIntoConsumption1711468800081 implements MigrationInterface {
  private async applyYields(
    queryRunner: QueryRunner,
    from: 'old' | 'new',
    to: 'old' | 'new',
  ): Promise<void> {
    for (const c of corrections) {
      await queryRunner.query(
        `UPDATE "materials_catalog"
           SET "yield_per_unit" = $1
         WHERE "name" = $2 AND "category" = $3 AND "yield_per_unit" = $4`,
        [c[to], c.name, c.category, c[from]],
      );
    }
  }

  private async setQuestions(
    queryRunner: QueryRunner,
    questions: unknown[],
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE "work_types"
         SET "contextual_questions" = $1::jsonb
       WHERE "code" = $2`,
      [JSON.stringify(questions), TILED_WORK_TYPE],
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "materials_catalog"
        ADD COLUMN IF NOT EXISTS "consumption_model" character varying(20);
    `);

    for (const model of new Set(modelled.map((m) => m.consumption_model!))) {
      const names = modelled
        .filter((m) => m.consumption_model === model)
        .map((m) => m.name);

      // Pour un UPDATE, le driver Postgres de TypeORM renvoie la paire
      // [lignes RETURNING, nombre de lignes touchées] — pas les lignes seules
      // comme pour un INSERT … RETURNING.
      const [updated] = (await queryRunner.query(
        `UPDATE "materials_catalog"
           SET "consumption_model" = $1
         WHERE "category" = 'tiling' AND "name" = ANY($2::text[])
         RETURNING "name"`,
        [model, names],
      )) as [{ name: string }[], number];

      // Un écart signale une base qui n'a pas le catalogue attendu, pas un cas
      // nominal : le catalogue n'expose aucune suppression et son index unique
      // interdit les doublons. Mieux vaut échouer en nommant les manquants
      // qu'une colle chiffrée à plat sur un chantier.
      if (updated.length !== names.length) {
        const touched = new Set(updated.map((r) => r.name));
        throw new Error(
          `materials_catalog.consumption_model = ${model} : ` +
            `${updated.length} ligne(s) au lieu de ${names.length} — ` +
            `introuvable(s) : ${names.filter((n) => !touched.has(n)).join(', ')}.`,
        );
      }
    }

    await this.applyYields(queryRunner, 'old', 'new');
    await this.setQuestions(queryRunner, questionsAfter);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.setQuestions(queryRunner, questionsBefore);
    await this.applyYields(queryRunner, 'new', 'old');
    await queryRunner.query(
      `ALTER TABLE "materials_catalog" DROP COLUMN IF EXISTS "consumption_model";`,
    );
  }
}
