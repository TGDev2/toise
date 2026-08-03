import { MigrationInterface, QueryRunner } from 'typeorm';
import { workTypeMaterialLinks } from '../materials/work-type-materials.data';

/**
 * E1-2 (BACKLOG_V1) — un ouvrage ne charge plus toute sa catégorie de
 * matériaux. `work_types.required_materials` (jsonb) était seedée '[]' et
 * jamais lue ; `loadMaterialInputs` filtrait uniquement sur `category`, d'où
 * 54 lignes pour une peinture murale (les 54 matériaux `painting` du seed).
 *
 * Remplace la colonne par une table de liaison porteuse d'un rôle
 * (`principal` / `sous_couche` / `consommable` / `accessoire`) et d'un
 * caractère obligatoire ou optionnel — nécessaires à E1-3 pour rattacher des
 * variantes sans regonfler le chiffrage. `material_id` est en
 * `ON DELETE RESTRICT` : E1-7 va réduire le catalogue, et un matériau lié qui
 * disparaîtrait en silence ferait disparaître une ligne de chiffrage sans la
 * moindre erreur au déploiement.
 *
 * Les liaisons seedées ici (`work-type-materials.data.ts`) sont volontairement
 * minimales — le matériau principal et, quand elle couvre toute la surface,
 * une couche de préparation. Colle / joint / croisillons restent aux
 * compléments calculés existants (migrations `…009`/`…010`) : les dupliquer
 * ici ferait apparaître deux fois le même achat sur la liste — arbitrage
 * confié à E1-6. La curation complète des 7 jeux, relue par un artisan, est
 * E1-3.
 */
export class CreateWorkTypeMaterials1711468800066 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "work_type_materials" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "work_type_id" uuid NOT NULL,
        "material_id" uuid NOT NULL,
        "role" varchar(20) NOT NULL,
        "is_optional" boolean NOT NULL DEFAULT false,
        "display_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_type_materials" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_work_type_materials" UNIQUE ("work_type_id", "material_id"),
        CONSTRAINT "CHK_work_type_materials_role"
          CHECK ("role" IN ('principal', 'sous_couche', 'consommable', 'accessoire')),
        CONSTRAINT "FK_work_type_materials_work_type" FOREIGN KEY ("work_type_id")
          REFERENCES "work_types"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_work_type_materials_material" FOREIGN KEY ("material_id")
          REFERENCES "materials_catalog"("id") ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_work_type_materials_work_type_id"
        ON "work_type_materials" ("work_type_id");
    `);

    for (const link of workTypeMaterialLinks) {
      const inserted = (await queryRunner.query(
        `INSERT INTO "work_type_materials"
           ("work_type_id", "material_id", "role", "is_optional", "display_order")
         SELECT wt."id", m."id", $4, $5, $6
         FROM "work_types" wt, "materials_catalog" m
         WHERE wt."code" = $1 AND m."name" = $2 AND m."category" = $3
         RETURNING "id"`,
        [
          link.work_type_code,
          link.material_name,
          link.material_category,
          link.role,
          link.is_optional,
          link.display_order,
        ],
      )) as { id: string }[];

      // Un nom de matériau ou un code d'ouvrage mal orthographié lierait
      // sinon zéro matériau et livrerait un produit qui ne chiffre plus rien,
      // sans une seule erreur au déploiement.
      if (inserted.length === 0) {
        throw new Error(
          `work_type_materials : aucune liaison créée pour ` +
            `${link.work_type_code} → "${link.material_name}" ` +
            `(${link.material_category}) — code ou nom introuvable en base.`,
        );
      }
    }

    const [{ count }] = (await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "work_type_materials"`,
    )) as { count: number }[];
    if (count !== workTypeMaterialLinks.length) {
      throw new Error(
        `work_type_materials : ${count} lignes en base, ` +
          `${workTypeMaterialLinks.length} attendues — vérifier les doublons ` +
          `dans work-type-materials.data.ts.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "work_types" DROP COLUMN "required_materials";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_types"
        ADD COLUMN "required_materials" jsonb NOT NULL DEFAULT '[]';
    `);

    await queryRunner.query(`DROP TABLE "work_type_materials";`);
  }
}
