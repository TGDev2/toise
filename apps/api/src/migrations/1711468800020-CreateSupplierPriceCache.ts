import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSupplierPriceCache1711468800020
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "supplier_price_cache" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "supplier_key" varchar(50) NOT NULL,
        "material_id" uuid NOT NULL,
        "material_name" varchar(255) NOT NULL,
        "price_data" jsonb NOT NULL,
        "postal_code" varchar(10) DEFAULT NULL,
        "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_supplier_price_cache" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_supplier_price_cache_lookup" UNIQUE ("supplier_key", "material_id", COALESCE("postal_code", ''))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_supplier_price_cache_expires" ON "supplier_price_cache" ("expires_at")`,
    );

    await queryRunner.query(`
      INSERT INTO "feature_gates" ("feature_key", "label_fr", "description_fr", "min_tier") VALUES
        ('price_comparison', 'Comparateur de prix', 'Comparez les prix entre différents fournisseurs pour optimiser vos achats', 'pro')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "feature_gates" WHERE "feature_key" = 'price_comparison'`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_supplier_price_cache_expires"`,
    );
    await queryRunner.query(`DROP TABLE "supplier_price_cache"`);
  }
}
