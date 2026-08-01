import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PRO-4 : mentions légales des factures françaises.
 *
 * `company_profiles` ne portait que raison sociale / SIRET / adresse / téléphone,
 * ce qui suffit à un devis mais pas à une facture (art. 242 nonies A CGI,
 * art. L441-9 code de commerce, art. L243-2 code des assurances pour le BTP).
 *
 * Toutes les colonnes sont nullables (sauf le booléen `vat_exempt`) : les profils
 * existants restent valides et la complétude n'est exigée qu'au moment d'émettre
 * une facture, via `findMissingLegalMentions()` qui renvoie un 400
 * `MISSING_LEGAL_MENTIONS`. Bloquer la sauvegarde du profil punirait un artisan
 * qui ne fait que des devis.
 *
 * Volontairement absents : `siren` (= 9 premiers chiffres du SIRET), `rcs_number`
 * (le numéro RCS *est* le SIREN), `ape_code` (non obligatoire sur facture), et
 * l'indemnité forfaitaire de recouvrement de 40 EUR / la mention d'escompte, qui
 * sont des constantes légales et non des données utilisateur — elles sont écrites
 * en dur dans le PDF.
 */
export class AddLegalMentionsToCompanyProfiles1711468800042 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company_profiles"
        ADD COLUMN "legal_form" varchar(50) DEFAULT NULL,
        ADD COLUMN "capital_social" numeric(10,2) DEFAULT NULL,
        ADD COLUMN "vat_number" varchar(20) DEFAULT NULL,
        ADD COLUMN "vat_exempt" boolean NOT NULL DEFAULT false,
        ADD COLUMN "rcs_city" varchar(100) DEFAULT NULL,
        ADD COLUMN "rm_department" varchar(100) DEFAULT NULL,
        ADD COLUMN "insurance_name" varchar(255) DEFAULT NULL,
        ADD COLUMN "insurance_policy" varchar(100) DEFAULT NULL,
        ADD COLUMN "insurance_coverage" varchar(255) DEFAULT NULL,
        ADD COLUMN "iban" varchar(34) DEFAULT NULL,
        ADD COLUMN "bic" varchar(11) DEFAULT NULL,
        ADD COLUMN "email" varchar(255) DEFAULT NULL,
        ADD COLUMN "late_penalty_rate" numeric(5,2) DEFAULT NULL,
        ADD COLUMN "default_payment_terms_days" integer DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company_profiles"
        DROP COLUMN "legal_form",
        DROP COLUMN "capital_social",
        DROP COLUMN "vat_number",
        DROP COLUMN "vat_exempt",
        DROP COLUMN "rcs_city",
        DROP COLUMN "rm_department",
        DROP COLUMN "insurance_name",
        DROP COLUMN "insurance_policy",
        DROP COLUMN "insurance_coverage",
        DROP COLUMN "iban",
        DROP COLUMN "bic",
        DROP COLUMN "email",
        DROP COLUMN "late_penalty_rate",
        DROP COLUMN "default_payment_terms_days"
    `);
  }
}
