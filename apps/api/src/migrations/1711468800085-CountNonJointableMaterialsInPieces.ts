import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedMaterials } from '../materials/seed-catalog.data';

/**
 * E1-8 (BACKLOG_V1) — l'ossature se compte en pièces, plus en mètres divisés.
 *
 * Le moteur métrait les montants en mètres linéaires puis divisait par la
 * longueur de barre. C'est le bon calcul pour un **rail**, posé en course
 * continue au sol et au plafond : deux bouts de barre s'aboutent et rien ne se
 * perd. C'est le mauvais pour un **montant**, coupé à la hauteur de la cloison,
 * dont la chute ne va nulle part. Sous 2,30 m de plafond, une barre de 2,70 m
 * donne un montant et 0,40 m de perdu : il faut autant de barres que
 * d'emplacements — 30, quand le moteur en achetait 28.
 *
 * Deux gestes, une seule cause.
 *
 * **1. `materials_catalog.offcuts_reusable`.** Booléen à `true` par défaut :
 * tout le catalogue était aboutable avant ce lot, et le reste. Passent à
 * `false` les seuls matériaux découpés à longueur dont le moteur connaisse la
 * **géométrie de pièce**, c'est-à-dire ceux qui se métrent sur les montants
 * d'une trame : `Montant M48/M70/M90 2.7m` et `Fourrure F530 3m`. Leur achat
 * cesse d'être une division pour devenir un comptage
 * (`estimations/piece-cutting.ts`).
 *
 * **2. Leur facteur de perte passe à 0 %.** Ce n'est pas un renoncement, c'est
 * la conséquence : sur un matériau découpé à longueur, la chute est désormais
 * **mesurée** — `barres × longueur de barre − pièces × longueur de pièce` — et
 * lui ajouter les 12/8/4 % de la plâtrerie la compterait deux fois. C'est mot
 * pour mot l'arbitrage d'E1-7 sur les mortiers-colle, dont la consommation
 * suivait la surface achetée du carrelage au lieu de sa surface nette.
 *
 * Ce que ce 0 % ne couvre pas, et qui est écrit au registre : la **casse** — la
 * barre pliée, le montant recoupé trop court. Aucune source consultée ne la
 * chiffre, et le sens de l'écart n'est pas le sens sûr. La valeur vit donc dans
 * le catalogue, visible et discutable, plutôt que dans une condition du moteur
 * qui sauterait la résolution : le jour où une source la chiffrera, il n'y aura
 * que trois lignes à remplacer.
 *
 * Additive : une colonne ajoutée avec un défaut `true`, aucune suppression.
 * Le code de la version précédente tourne sur ce schéma — il ignore la colonne
 * et redivise, comme avant. Les `UPDATE` portent leur prédicat sur l'ancienne
 * valeur : l'UP est rejouable et ne touche pas à un facteur qu'un
 * administrateur aurait retouché entre-temps.
 */

/** Les matériaux que le seed déclare découpés à longueur. */
const nonJointable = seedMaterials.filter((m) => m.offcuts_reusable === false);

/** Le forfait de coupe de la plâtrerie, tel qu'il était avant ce lot. */
const WASTE_BEFORE: Record<string, number> = {
  beginner: 12,
  intermediate: 8,
  expert: 4,
};

export class CountNonJointableMaterialsInPieces1711468800085 implements MigrationInterface {
  name = 'CountNonJointableMaterialsInPieces1711468800085';

  private async setWaste(
    queryRunner: QueryRunner,
    skillLevel: string,
    from: number,
    to: number,
    names: string[],
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE "waste_factors" wf
          SET "factor_percent" = $1
         FROM "materials_catalog" m
        WHERE wf."material_id" = m."id"
          AND m."name" = ANY($2::text[])
          AND wf."skill_level" = $3
          AND wf."factor_percent" = $4`,
      [to, names, skillLevel, from],
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (nonJointable.length === 0) {
      throw new Error(
        'Le catalogue seedé ne déclare plus aucun matériau découpé à longueur : ' +
          'cette migration en dérive sa liste et ne peut pas l’inventer.',
      );
    }

    await queryRunner.query(`
      ALTER TABLE "materials_catalog"
        ADD COLUMN IF NOT EXISTS "offcuts_reusable" boolean NOT NULL DEFAULT true;
    `);

    const names = nonJointable.map((m) => m.name);
    await queryRunner.query(
      `UPDATE "materials_catalog"
          SET "offcuts_reusable" = false
        WHERE "name" = ANY($1::text[]) AND "offcuts_reusable" = true`,
      [names],
    );

    for (const [skillLevel, before] of Object.entries(WASTE_BEFORE)) {
      await this.setWaste(queryRunner, skillLevel, before, 0, names);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = nonJointable.map((m) => m.name);

    for (const [skillLevel, before] of Object.entries(WASTE_BEFORE)) {
      await this.setWaste(queryRunner, skillLevel, 0, before, names);
    }

    await queryRunner.query(`
      ALTER TABLE "materials_catalog" DROP COLUMN IF EXISTS "offcuts_reusable";
    `);
  }
}
