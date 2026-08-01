import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PRO-4 : distinguer un client particulier d'un client professionnel.
 *
 * La réforme de la facturation électronique impose le SIREN de l'acheteur sur les
 * factures B2B à compter du 1er septembre 2026 ; `country` est BT-55 de la norme
 * EN 16931 (obligatoire, ajoutée maintenant pour éviter une migration au moment
 * du Factur-X).
 *
 * Pas de contrainte d'unicité sur `siret` : le même SIRET peut légitimement être
 * client de deux artisans différents.
 */
export class AddBusinessFieldsToClients1711468800043 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN "is_company" boolean NOT NULL DEFAULT false,
        ADD COLUMN "siret" varchar(14) DEFAULT NULL,
        ADD COLUMN "vat_number" varchar(20) DEFAULT NULL,
        ADD COLUMN "country" varchar(2) NOT NULL DEFAULT 'FR'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        DROP COLUMN "is_company",
        DROP COLUMN "siret",
        DROP COLUMN "vat_number",
        DROP COLUMN "country"
    `);
  }
}
