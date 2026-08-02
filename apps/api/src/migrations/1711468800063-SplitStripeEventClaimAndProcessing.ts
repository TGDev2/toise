import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sépare « réservé » de « traité » sur les events Stripe.
 *
 * `processed_at` était un `CreateDateColumn` posé à l'insertion, c'est-à-dire à
 * la **réservation** de l'event — avant que son effet métier n'ait eu lieu. Le
 * même marqueur signifiait donc à la fois « quelqu'un s'en occupe » et « c'est
 * fait ». Une exception attrapée supprimait bien la ligne, mais un arrêt du
 * processus (OOM, arrêt de conteneur, `SIGKILL`) ne l'exécute pas : la ligne
 * survivait et tous les retries Stripe recevaient `200 duplicate`. L'abonnement
 * restait désynchronisé pour de bon.
 *
 * Deux colonnes, deux faits : `claimed_at` date la réservation, `processed_at`
 * ne devient non nul qu'après le succès du traitement. Une réservation sans
 * traitement peut donc être reprise (cf. `claimWebhookEvent`).
 *
 * Les lignes existantes gardent un `processed_at` non nul et restent donc
 * « traitées » : on ne peut pas distinguer rétroactivement celles qui auraient
 * été abandonnées, et les rejouer en masse serait la panne inverse.
 */
export class SplitStripeEventClaimAndProcessing1711468800063 implements MigrationInterface {
  name = 'SplitStripeEventClaimAndProcessing1711468800063';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stripe_events" ADD COLUMN "claimed_at" timestamptz NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `UPDATE "stripe_events" SET "claimed_at" = "processed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stripe_events" ALTER COLUMN "processed_at" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "stripe_events" ALTER COLUMN "processed_at" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Une réservation jamais menée à terme n'a pas de date de traitement à
    // restituer : on lui rend sa date de réservation, seule valeur disponible
    // avant que la colonne ne redevienne obligatoire.
    await queryRunner.query(
      `UPDATE "stripe_events" SET "processed_at" = "claimed_at" WHERE "processed_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "stripe_events" ALTER COLUMN "processed_at" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "stripe_events" ALTER COLUMN "processed_at" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "stripe_events" DROP COLUMN "claimed_at"`,
    );
  }
}
