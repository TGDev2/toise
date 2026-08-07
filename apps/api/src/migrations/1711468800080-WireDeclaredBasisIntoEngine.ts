import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedMaterials } from '../materials/seed-catalog.data';
import { seedWorkTypes } from '../projects/work-types.data';

/**
 * E1-3 : l'assiette d'ouvrage câblée dans le moteur.
 *
 * Deux colonnes, et une ré-expression de rendements qui en découle.
 *
 * **`materials_catalog.quantity_driver`** dit sur quoi la quantité d'un
 * matériau se métré : la surface de l'ouvrage (`work_surface`, le défaut), cette
 * surface multipliée par le nombre de faces à parementer (`clad_faces`), ou la
 * longueur de lisse / de montant de la trame (`frame_runner`, `frame_stud`).
 * C'est ce champ, et lui seul, qui fait qu'une cloison parementée deux faces a
 * deux peaux de plaques et **une** seule ossature. Le moteur ne connaît aucun
 * code d'ouvrage.
 *
 * **`work_types.frame_spec`** porte la trame — entraxe, montants de rive et
 * d'huisserie, nombre de lisses. `NULL` pour les six ouvrages de recouvrement.
 *
 * **Pourquoi les rendements bougent.** Les valeurs sourcées par E1-7
 * (migration `…070`, registre `docs/SOURCES_CATALOGUE.md`) sont exprimées par m²
 * d'ouvrage **deux faces comprises** : la fiche Placo 72/48 donne 2,10 m² de
 * plaque par m² de cloison. Le doublement était donc déjà cuit dans la donnée ;
 * le laisser tel quel et multiplier par le nombre de faces l'aurait compté deux
 * fois. Les matériaux de parement passent donc « par m² de parement » (× 2), et
 * l'ossature à l'identité — un mètre de rail couvre un mètre de lisse, la
 * longueur de trame étant désormais métrée sur le linéaire et la hauteur réels.
 *
 * **Aucune valeur n'est révisée** : à deux faces, chaque taux par m² d'ouvrage
 * reste au chiffre près celui qu'E1-7 a sourcé. `consumption-bounds.data.ts`
 * n'est pas touché et l'invariant I3 du harnais reste vert sans réglage. Une
 * révision (0,48 contre 1/2,10 = 0,476) relèvera d'une tâche catalogue avec sa
 * revue de sources.
 *
 * Les matériaux `partition` **non liés** à un ouvrage reçoivent eux aussi leur
 * driver, sans changer de valeur : leur rendement à 1 est un placeholder qu'E1-7
 * n'a jamais adossé à une fiche. Sous la nouvelle sémantique il devient plus
 * juste, pas moins — 1 m de rail R70 pour 1 m de lisse est exact.
 *
 * Additive (leçon 29) : deux colonnes ajoutées avec un défaut, aucune
 * suppression. Le prédicat `AND "yield_per_unit" = <ancien>` rend l'UP rejouable
 * et laisse intacte une valeur qu'un admin aurait retouchée entre-temps.
 * Modèle : `…070-RecalibrateSourcedYields` et `…079-AddDeclaredQuantityBasis`.
 */

interface YieldReexpression {
  name: string;
  category: string;
  old: number;
  new: number;
}

/**
 * Une ligne par matériau dont E1-7 avait sourcé le rendement par m² d'ouvrage.
 * `clad_faces` : × 2 (l'ancienne valeur valait pour deux faces).
 * `frame_*` : 1 (l'assiette est déjà la longueur de trame).
 */
const reexpressions: YieldReexpression[] = [
  { name: 'Plaque BA13 standard 2.5x1.2m', category: 'partition', old: 0.48, new: 0.96 }, // prettier-ignore
  { name: 'Plaque BA13 hydro 2.5x1.2m', category: 'partition', old: 0.48, new: 0.96 }, // prettier-ignore
  { name: 'Bande à joint papier 23m', category: 'partition', old: 0.36, new: 0.72 }, // prettier-ignore
  { name: 'Enduit à joint prêt 7kg', category: 'partition', old: 1, new: 2 },
  { name: 'Enduit à joint poudre 5kg', category: 'partition', old: 1.52, new: 3.04 }, // prettier-ignore
  { name: 'Vis placo 25mm (x500)', category: 'partition', old: 22.7, new: 45.4 }, // prettier-ignore
  { name: 'Rail R48 3m', category: 'partition', old: 1.11, new: 1 },
  { name: 'Montant M48 2.7m', category: 'partition', old: 0.48, new: 1 },
];

export class WireDeclaredBasisIntoEngine1711468800080 implements MigrationInterface {
  name = 'WireDeclaredBasisIntoEngine1711468800080';

  private async applyYields(
    queryRunner: QueryRunner,
    from: 'old' | 'new',
    to: 'old' | 'new',
  ): Promise<void> {
    for (const r of reexpressions) {
      await queryRunner.query(
        `UPDATE "materials_catalog"
           SET "yield_per_unit" = $1
         WHERE "name" = $2 AND "category" = $3 AND "yield_per_unit" = $4`,
        [r[to], r.name, r.category, r[from]],
      );
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "materials_catalog"
        ADD COLUMN "quantity_driver" varchar(20) NOT NULL DEFAULT 'work_surface'
    `);

    for (const mat of seedMaterials) {
      if (!mat.quantity_driver) continue;
      await queryRunner.query(
        `UPDATE "materials_catalog"
           SET "quantity_driver" = $1
         WHERE "name" = $2 AND "category" = $3`,
        [mat.quantity_driver, mat.name, mat.category],
      );
    }

    await queryRunner.query(`
      ALTER TABLE "work_types" ADD COLUMN "frame_spec" jsonb DEFAULT NULL
    `);

    for (const wt of seedWorkTypes) {
      if (!wt.frame_spec) continue;
      await queryRunner.query(
        `UPDATE "work_types" SET "frame_spec" = $1 WHERE "code" = $2`,
        [JSON.stringify(wt.frame_spec), wt.code],
      );
    }

    await this.applyYields(queryRunner, 'old', 'new');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.applyYields(queryRunner, 'new', 'old');

    await queryRunner.query(`
      ALTER TABLE "work_types" DROP COLUMN "frame_spec"
    `);

    await queryRunner.query(`
      ALTER TABLE "materials_catalog" DROP COLUMN "quantity_driver"
    `);
  }
}
