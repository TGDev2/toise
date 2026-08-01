import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PRO-4 : conversion d'un devis accepté en facture.
 *
 * Trois décisions structurantes portées par ce schéma (détail dans
 * tasks/todo.md §PRO-4) :
 *
 * 1. **Document immuable et autoportant.** Les identités vendeur/acheteur et les
 *    lignes sont figées en jsonb (`seller_snapshot`, `buyer_snapshot`,
 *    `items_json`, `vat_breakdown`). Une facture émise doit se réimprimer à
 *    l'identique dix ans plus tard, même si l'artisan a changé d'adresse ou
 *    supprimé le client. C'est pourquoi toutes les FK vers les sources sont
 *    nullables en ON DELETE SET NULL — y compris `quote_id` : `quotes.project_id`
 *    est CASCADE depuis `projects`, donc un RESTRICT ici ferait échouer la
 *    suppression d'un projet en pleine cascade. `source_quote_number` conserve la
 *    mention « Réf. devis » quand le devis disparaît.
 *
 * 2. **Numérotation continue et sans rupture (art. 242 nonies A CGI).**
 *    `invoice_sequences` est un compteur par (artisan, année) alloué dans la même
 *    transaction que l'INSERT de la facture via
 *    `INSERT ... ON CONFLICT (user_id, year) DO UPDATE SET last_number = last_number + 1 RETURNING`.
 *    L'upsert prend un verrou de ligne : les allocations concurrentes se
 *    sérialisent, et un rollback rend le numéro plutôt que de laisser un trou.
 *    Le `SELECT MAX ... LIKE` de `QuotesService.generateNextQuoteNumber` n'était
 *    pas transposable ici (pas de verrou, donc trous possibles). Table volontairement
 *    sans entité TypeORM : elle n'est manipulée que par cette requête SQL.
 *
 * 3. **Une seule facture de solde par devis**, garantie par l'index unique partiel
 *    `UQ_invoices_quote_solde` plutôt que par un contrôle applicatif (qui serait
 *    racy). `quote_id` reste non-unique pour que les factures d'acompte
 *    (`invoice_type = 'acompte'`) soient un ajout purement additif.
 */
export class CreateInvoices1711468800044 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "invoice_sequences" (
        "user_id" uuid NOT NULL,
        "year" integer NOT NULL,
        "last_number" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_invoice_sequences" PRIMARY KEY ("user_id", "year"),
        CONSTRAINT "FK_invoice_sequences_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "quote_id" uuid DEFAULT NULL,
        "project_id" uuid DEFAULT NULL,
        "client_id" uuid DEFAULT NULL,
        "invoice_number" varchar(20) NOT NULL,
        "invoice_type" varchar(20) NOT NULL DEFAULT 'solde',
        "status" varchar(20) NOT NULL DEFAULT 'issued',
        "source_quote_number" varchar(20) DEFAULT NULL,
        "issued_on" date NOT NULL,
        "supply_date" date DEFAULT NULL,
        "due_on" date NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'EUR',
        "seller_snapshot" jsonb NOT NULL,
        "buyer_snapshot" jsonb NOT NULL,
        "buyer_siren" varchar(9) DEFAULT NULL,
        "delivery_address" text DEFAULT NULL,
        "operation_category" varchar(20) NOT NULL DEFAULT 'services',
        "vat_on_debits" boolean NOT NULL DEFAULT false,
        "items_json" jsonb NOT NULL,
        "vat_breakdown" jsonb NOT NULL,
        "total_ht" numeric(10,2) NOT NULL DEFAULT 0,
        "total_tva" numeric(10,2) NOT NULL DEFAULT 0,
        "total_ttc" numeric(10,2) NOT NULL DEFAULT 0,
        "payment_terms" text DEFAULT NULL,
        "late_penalty_rate" numeric(5,2) DEFAULT NULL,
        "notes" text DEFAULT NULL,
        "paid_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_invoices_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_invoices_quote" FOREIGN KEY ("quote_id")
          REFERENCES "quotes"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_invoices_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_invoices_client" FOREIGN KEY ("client_id")
          REFERENCES "clients"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_invoices_user_number" UNIQUE ("user_id", "invoice_number")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_user_id" ON "invoices" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_quote_id" ON "invoices" ("quote_id")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_invoices_quote_solde" ON "invoices" ("quote_id")
        WHERE "invoice_type" = 'solde' AND "quote_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TABLE "invoice_sequences"`);
  }
}
