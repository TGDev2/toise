import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG_V1 E3-3 — filigrane du préavis de reconduction annuelle.
 *
 * Sur une offre mensuelle, une reconduction tacite passe inaperçue : 19 € que
 * personne ne conteste. Sur 279 € prélevés une fois l'an, un prélèvement sans
 * préavis est la première cause de demande de remboursement — et, à défaut, de
 * contestation bancaire, qui coûte plus cher que le remboursement qu'elle
 * remplace.
 *
 * **Pourquoi une colonne ici plutôt qu'une ligne dans `lifecycle_email_sends`**,
 * qui est pourtant le registre d'idempotence de tous les autres e-mails de
 * cycle de vie : ce registre porte un index unique **partiel** sur
 * `(user_id, email_type) WHERE project_id IS NULL` (migration …050). Un e-mail
 * « par compte » n'y part donc qu'une fois **pour toujours**. Un préavis annuel
 * y aurait été envoyé la première année et jamais plus — une panne silencieuse
 * qui ne se serait manifestée qu'au bout de deux ans, sur le renouvellement
 * qu'il fallait justement annoncer.
 *
 * La bonne clé de dédoublonnage n'est pas le compte, c'est **la période
 * annoncée**. `renewal_notice_sent_for` porte le `current_period_end` pour
 * lequel l'abonné a déjà été prévenu : il se réarme tout seul à chaque période,
 * et il est exact plutôt qu'approximatif — pas de fenêtre glissante à régler,
 * pas de doublon possible si le balayage tourne deux fois le même jour.
 *
 * Nullable, sans rattrapage : un abonnement existant n'a été prévenu de rien,
 * et `NULL` est exactement cela. Le premier balayage préviendra ceux dont
 * l'échéance approche, ce qui est le comportement voulu.
 *
 * Additive : le code de la version précédente ignore la colonne (leçon 29).
 */
export class AddRenewalNoticeWatermark1711468800102 implements MigrationInterface {
  name = 'AddRenewalNoticeWatermark1711468800102';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN "renewal_notice_sent_for" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP COLUMN "renewal_notice_sent_for"
    `);
  }
}
