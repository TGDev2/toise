import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuotes1711468800025 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "quotes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "client_id" uuid DEFAULT NULL,
        "estimation_id" uuid NOT NULL,
        "quote_number" varchar(20) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'draft',
        "labor_type" varchar(10) NOT NULL DEFAULT 'hourly',
        "labor_hourly_rate" numeric(10,2) DEFAULT NULL,
        "labor_estimated_hours" numeric(10,2) DEFAULT NULL,
        "labor_flat_amount" numeric(10,2) DEFAULT NULL,
        "material_margin_percent" numeric(5,2) NOT NULL DEFAULT 0,
        "discount_percent" numeric(5,2) DEFAULT 0,
        "payment_terms" text DEFAULT NULL,
        "validity_days" integer NOT NULL DEFAULT 30,
        "notes" text DEFAULT NULL,
        "items_json" jsonb NOT NULL,
        "subtotal_materials_ht" numeric(10,2) NOT NULL DEFAULT 0,
        "subtotal_labor_ht" numeric(10,2) NOT NULL DEFAULT 0,
        "total_ht" numeric(10,2) NOT NULL DEFAULT 0,
        "tva_rate" numeric(5,2) NOT NULL DEFAULT 20.00,
        "total_ttc" numeric(10,2) NOT NULL DEFAULT 0,
        "sent_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "accepted_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "refused_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quotes_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quotes_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quotes_client" FOREIGN KEY ("client_id")
          REFERENCES "clients"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_quotes_estimation" FOREIGN KEY ("estimation_id")
          REFERENCES "estimation_results"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_quotes_user_number" UNIQUE ("user_id", "quote_number")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_quotes_user_id" ON "quotes" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotes_project_id" ON "quotes" ("project_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "quotes"`);
  }
}
