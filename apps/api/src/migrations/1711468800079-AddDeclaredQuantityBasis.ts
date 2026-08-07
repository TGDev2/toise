import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedWorkTypes } from '../projects/work-types.data';

/**
 * E1-2 : schéma de l'assiette d'ouvrage.
 *
 * `drywall.surface_target = 'wall'` fait chiffrer une cloison **créée** sur le
 * périmètre entier de la pièce (`estimation-engine.ts`, `computeSurface`) —
 * 300 à 500 % de sur-achat pour une cloison de quelques mètres linéaires.
 * `apps/api/src/estimations/__tests__/drywall-created-partition.spec.ts` le
 * prouve, volontairement rouge.
 *
 * Cette migration pose le schéma, pas le correctif : `quantity_basis` sur
 * `work_types` distingue un ouvrage dont la quantité est dérivée de la
 * géométrie de la pièce (`room_surface`, tous les ouvrages sauf `drywall`)
 * d'un ouvrage dont la quantité est saisie par l'utilisateur (`declared`).
 * `project_work_items` gagne les trois colonnes qui porteront cette saisie.
 *
 * Séquencement délibéré : `surface_target` n'est pas touché, et le moteur ne
 * lit pas encore `quantity_basis` (câblage prévu en E1-3). Marquer `drywall`
 * en `declared` ici est donc **inerte** — `computeSurface` continue de lire
 * `surface_target = 'wall'` exactement comme avant cette migration, et les
 * instantanés des 7 ouvrages, `drywall` compris, ne bougent pas d'un chiffre.
 *
 * Reprise des `project_work_items` existants : aucune. Les trois nouvelles
 * colonnes restent `NULL` pour toute ligne déjà en base — y compris un
 * `drywall` existant. Dériver une longueur depuis l'assiette actuelle (le
 * périmètre de la pièce) figerait dans la donnée le défaut qu'on corrige et
 * affirmerait une déclaration que personne n'a faite (`tasks/lessons.md` §18).
 * `NULL` porte un sens unique : « pas encore déclaré ».
 */
export class AddDeclaredQuantityBasis1711468800079 implements MigrationInterface {
  name = 'AddDeclaredQuantityBasis1711468800079';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_types"
        ADD COLUMN "quantity_basis" varchar(20) NOT NULL DEFAULT 'room_surface'
    `);

    for (const wt of seedWorkTypes) {
      await queryRunner.query(
        `UPDATE "work_types" SET "quantity_basis" = $1 WHERE "code" = $2`,
        [wt.quantity_basis, wt.code],
      );
    }

    await queryRunner.query(`
      ALTER TABLE "project_work_items"
        ADD COLUMN "declared_length_m" numeric(6,2) DEFAULT NULL,
        ADD COLUMN "declared_height_m" numeric(6,2) DEFAULT NULL,
        ADD COLUMN "declared_clad_faces" smallint DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_work_items"
        DROP COLUMN "declared_clad_faces",
        DROP COLUMN "declared_height_m",
        DROP COLUMN "declared_length_m"
    `);

    await queryRunner.query(`
      ALTER TABLE "work_types" DROP COLUMN "quantity_basis"
    `);
  }
}
