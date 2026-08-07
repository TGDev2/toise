import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedMaterials } from '../materials/seed-catalog.data';
import { seedWorkTypes } from '../projects/work-types.data';

/**
 * E1-8 (BACKLOG_V1) — le pare-vapeur cesse d'être acheté sur tous les
 * chantiers.
 *
 * `Film pare-vapeur PE` est lié au parquet en `is_optional: false` : il était
 * donc chiffré quel que soit le support, à 1,25 m² par m² de sol. Le ratio est
 * juste — il porte le recouvrement de 20 cm entre lés — mais le déclenchement
 * était faux. Le NF DTU 51.11 : « Dans le cas de supports à base de liants
 * hydrauliques ou de supports minéraux ou dans le cas de l'utilisation d'un
 * plancher chauffant, un film pare-vapeur doit être mis en œuvre. » Sur un
 * plancher bois, c'est un rouleau acheté pour rien.
 *
 * Cinq gestes, une seule cause.
 *
 * **1. `materials_catalog.vapour_barrier`.** Colonne nullable, sur le modèle de
 * `consumption_model` (`…081`) et de `roll_width_cm` (`…082`) : la règle est
 * portée par le matériau, jamais déduite de sa catégorie ni du code de
 * l'ouvrage. C'est la première colonne du catalogue qui décide de la
 * **présence** d'une ligne et non de sa quantité. `dedicated` sur le film nu ;
 * `integrated` sur une sous-couche qui en porte un.
 *
 * **2. Une question de support sur `parquet_flooring`.** Requise, comme le
 * calepinage : la réponse vaut un rouleau entier. Sa première option, « Béton
 * ou chape », est aussi celle que retient le moteur sans réponse — le sens sûr,
 * puisque c'est celle qui exige le film.
 *
 * **3. Une sous-couche à pare-vapeur intégré entre au catalogue**, en
 * alternative documentée (`is_optional: true`). Sans elle, `integrated` serait
 * une valeur que rien ne déclare — exactement la donnée inatteignable qu'E1-7 a
 * retirée du carrelage en chevrons.
 *
 * **4. `estimation_results.exclusions_json`.** Ce qui n'est pas chiffré doit se
 * dire, sans quoi une ligne absente est indiscernable d'un matériau oublié.
 * `NULL` sur les estimations antérieures, tableau vide quand rien n'est écarté :
 * l'écran ne dit pas la même chose dans les deux cas.
 *
 * **5. Rien d'autre.** Ni rendement, ni conditionnement, ni facteur de perte du
 * film ne bougent : quand il est nécessaire, il est chiffré comme avant.
 *
 * Additive (leçon 29) : deux colonnes ajoutées avec un défaut `NULL`, un
 * matériau et une liaison créés, aucune suppression, aucune contrainte
 * resserrée. Le code de la version précédente tourne sur ce schéma — il ignore
 * les colonnes et chiffre le film sur tous les supports, comme avant. Les
 * prédicats `AND ... = <ancien>` rendent l'UP rejouable et laissent intacte une
 * valeur qu'un administrateur aurait retouchée entre-temps.
 */

const PARQUET_WORK_TYPE = 'parquet_flooring';

/** Le matériau ajouté par ce lot, lu au seed plutôt que recopié ici. */
const INTEGRATED_UNDERLAY_NAME = 'Sous-couche 2mm avec pare-vapeur intégré';

const integratedUnderlay = seedMaterials.find(
  (m) => m.name === INTEGRATED_UNDERLAY_NAME,
);

/** Rôles de pare-vapeur déclarés par le seed, dérivés et non recopiés. */
const vapourBarrierMaterials = seedMaterials.filter((m) => m.vapour_barrier);

/** Questions de l'ouvrage, avant et après — la seconde vient du seed. */
const parquetQuestionsAfter = seedWorkTypes.find(
  (wt) => wt.code === PARQUET_WORK_TYPE,
)!.contextual_questions;

const parquetQuestionsBefore = parquetQuestionsAfter.filter(
  (q) => q.key !== 'subfloor_type',
);

export class GateVapourBarrierOnSubfloor1711468800084 implements MigrationInterface {
  name = 'GateVapourBarrierOnSubfloor1711468800084';

  private async setParquetQuestions(
    queryRunner: QueryRunner,
    questions: unknown,
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE "work_types" SET "contextual_questions" = $1 WHERE "code" = $2`,
      [JSON.stringify(questions), PARQUET_WORK_TYPE],
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!integratedUnderlay) {
      throw new Error(
        `Le catalogue seedé ne contient plus « ${INTEGRATED_UNDERLAY_NAME} » : ` +
          `cette migration en dérive ses valeurs et ne peut pas les inventer.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "materials_catalog"
        ADD COLUMN IF NOT EXISTS "vapour_barrier" character varying(20);
    `);
    await queryRunner.query(`
      ALTER TABLE "estimation_results"
        ADD COLUMN IF NOT EXISTS "exclusions_json" jsonb DEFAULT NULL;
    `);

    // Le matériau d'abord : son rôle est renseigné par la boucle ci-dessous,
    // avec celui du film, plutôt qu'en double ici.
    const inserted = (await queryRunner.query(
      `INSERT INTO "materials_catalog" ("name", "category", "unit", "yield_per_unit")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("name", "category") DO NOTHING
       RETURNING "id"`,
      [
        integratedUnderlay.name,
        integratedUnderlay.category,
        integratedUnderlay.unit,
        integratedUnderlay.yield_per_unit,
      ],
    )) as { id: string }[];

    if (inserted.length > 0) {
      const materialId = inserted[0].id;
      for (const pkg of integratedUnderlay.packagings) {
        await queryRunner.query(
          `INSERT INTO "material_packaging" ("material_id", "label", "quantity_per_unit", "unit")
           VALUES ($1, $2, $3, $4)`,
          [materialId, pkg.label, pkg.quantity_per_unit, pkg.unit],
        );
      }
      for (const wf of integratedUnderlay.waste_factors) {
        await queryRunner.query(
          `INSERT INTO "waste_factors" ("material_id", "pose_type", "skill_level", "factor_percent")
           VALUES ($1, $2, $3, $4)
           ON CONFLICT ("material_id", "pose_type", "skill_level") DO NOTHING`,
          [materialId, wf.pose_type, wf.skill_level, wf.factor_percent],
        );
      }
    }

    for (const material of vapourBarrierMaterials) {
      await queryRunner.query(
        `UPDATE "materials_catalog"
            SET "vapour_barrier" = $1
          WHERE "name" = $2 AND "category" = $3 AND "vapour_barrier" IS NULL`,
        [material.vapour_barrier, material.name, material.category],
      );
    }

    // Alternative documentée : `is_optional`, donc jamais chiffrée d'office.
    await queryRunner.query(
      `INSERT INTO "work_type_materials"
         ("work_type_id", "material_id", "role", "is_optional", "display_order")
       SELECT wt."id", m."id", 'sous_couche', true, 8
         FROM "work_types" wt, "materials_catalog" m
        WHERE wt."code" = $1 AND m."name" = $2 AND m."category" = $3
       ON CONFLICT ("work_type_id", "material_id") DO NOTHING`,
      [PARQUET_WORK_TYPE, integratedUnderlay.name, integratedUnderlay.category],
    );

    await this.setParquetQuestions(queryRunner, parquetQuestionsAfter);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.setParquetQuestions(queryRunner, parquetQuestionsBefore);

    // La liaison, puis les pertes et conditionnements, puis le matériau : les
    // clés étrangères imposent l'ordre, et `…006` ne recrée pas ce matériau sur
    // une base existante.
    await queryRunner.query(
      `DELETE FROM "work_type_materials" wtm
        USING "work_types" wt, "materials_catalog" m
        WHERE wtm."work_type_id" = wt."id" AND wtm."material_id" = m."id"
          AND wt."code" = $1 AND m."name" = $2 AND m."category" = $3`,
      [
        PARQUET_WORK_TYPE,
        INTEGRATED_UNDERLAY_NAME,
        integratedUnderlay?.category ?? 'flooring',
      ],
    );
    await queryRunner.query(
      `DELETE FROM "waste_factors" wf
        USING "materials_catalog" m
        WHERE wf."material_id" = m."id" AND m."name" = $1`,
      [INTEGRATED_UNDERLAY_NAME],
    );
    await queryRunner.query(
      `DELETE FROM "material_packaging" mp
        USING "materials_catalog" m
        WHERE mp."material_id" = m."id" AND m."name" = $1`,
      [INTEGRATED_UNDERLAY_NAME],
    );
    await queryRunner.query(
      `DELETE FROM "materials_catalog" WHERE "name" = $1`,
      [INTEGRATED_UNDERLAY_NAME],
    );

    await queryRunner.query(`
      ALTER TABLE "estimation_results" DROP COLUMN IF EXISTS "exclusions_json";
    `);
    await queryRunner.query(`
      ALTER TABLE "materials_catalog" DROP COLUMN IF EXISTS "vapour_barrier";
    `);
  }
}
