import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PRO-3 : relances devis. Deux colonnes d'idempotence/audit sur
 * `quotes`, même style que `sent_at`/`accepted_at`/`refused_at` : une colonne
 * non nulle empêche le renvoi de la relance correspondante, et sert aussi de
 * trace pour l'artisan (bloc "Historique" côté web).
 *
 * Politique de stamp (décidée dans le plan PRO-3, à connaître avant de
 * modifier `quote-reminders.service.ts`) : la colonne est toujours marquée
 * après tentative d'envoi, que les e-mails aient réussi ou non — évite qu'une
 * panne du provider transforme chaque sweep quotidien en re-traitement d'un
 * lot de devis en retard qui grossit indéfiniment. Une relance perdue pendant
 * une panne ne repart donc pas toute seule ; acceptable pour une relance
 * commerciale (pas un e-mail transactionnel à enjeu légal).
 */
export class AddReminderTimestampsToQuotes1711468800040 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD COLUMN "reminder_7d_sent_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD COLUMN "reminder_14d_sent_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP COLUMN "reminder_14d_sent_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP COLUMN "reminder_7d_sent_at"`,
    );
  }
}
