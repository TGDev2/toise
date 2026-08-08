import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E1-11 (BACKLOG_V1) — réglage entreprise : citer ou non le fabricant et le
 * produit dans la justification affichée d'une quantité.
 *
 * Défaut `true` : citer la source est l'argument de traçabilité le plus
 * fort, et c'est le comportement neuf — aucune organisation existante n'a
 * jamais vu de marque avant ce lot, donc rien à préserver côté migration au
 * sens d'un `UPDATE` de rattrapage. Un artisan qui pose une autre marque que
 * celle sourcée le désactive lui-même, ligne « Chiffrage » des réglages
 * entreprise.
 */
export class AddMaterialBrandVisibilityToCompanyProfiles1711468800095 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company_profiles"
        ADD COLUMN "show_material_brands" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company_profiles" DROP COLUMN "show_material_brands"
    `);
  }
}
