import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PLAT-2 : e-mails de cycle de vie (onboarding J+1/J+3, projet
 * abandonné, fin d'essai Pro).
 *
 * Table d'idempotence dédiée plutôt que des colonnes sur `users`/`projects`
 * (patron PRO-3 `reminder_7d_sent_at`/`reminder_14d_sent_at`) : 4 types
 * d'e-mails répartis sur 2 entités différentes ne passent pas à l'échelle en
 * colonnes dédiées, et une table permet d'ajouter un futur type sans
 * migration supplémentaire.
 *
 * Deux index uniques partiels plutôt qu'un seul UNIQUE composite : en SQL,
 * deux valeurs NULL ne sont jamais égales dans une contrainte unique, donc un
 * UNIQUE(user_id, project_id, email_type) laisserait passer des doublons pour
 * les types "par compte" (project_id toujours NULL). Même pattern que
 * UQ_invoices_quote_solde (1711468800044-CreateInvoices.ts).
 */
export class CreateLifecycleEmailSends1711468800050 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lifecycle_email_sends" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "project_id" uuid DEFAULT NULL,
        "email_type" varchar(30) NOT NULL,
        "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lifecycle_email_sends" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lifecycle_email_sends_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lifecycle_email_sends_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_lifecycle_email_sends_user_id" ON "lifecycle_email_sends" ("user_id")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_lifecycle_email_sends_user_type"
        ON "lifecycle_email_sends" ("user_id", "email_type")
        WHERE "project_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_lifecycle_email_sends_project_type"
        ON "lifecycle_email_sends" ("user_id", "project_id", "email_type")
        WHERE "project_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "lifecycle_email_sends"`);
  }
}
