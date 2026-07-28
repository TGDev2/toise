import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BUY-1 : table des rapprochements catalogue → produits marchands, alimentée
 * par la synchronisation du flux d'affiliation ManoMano.
 *
 * Le flux marchand lui-même n'est pas persisté : il est parcouru en streaming
 * et seul le meilleur produit par matériau est écrit ici, soit au plus autant
 * de lignes que `materials_catalog`.
 *
 * La feature gate `price_comparison` reste désactivée (migration 027) : sa
 * réactivation et la QA du parcours sont l'objet de BUY-2.
 */
export class CreateSupplierMaterialMatch1711468800035 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "supplier_material_match" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "supplier_key" varchar(50) NOT NULL,
        "material_id" uuid NOT NULL,
        "external_id" varchar(100) NOT NULL,
        "product_name" varchar(500) NOT NULL,
        "product_url" text NOT NULL,
        "brand" varchar(255) DEFAULT NULL,
        "price" numeric(10,2) NOT NULL,
        "currency" varchar(3) NOT NULL,
        "pack_qty" numeric(10,4) NOT NULL,
        "pack_unit" varchar(20) NOT NULL,
        "availability" varchar(20) NOT NULL,
        "match_score" numeric(5,4) NOT NULL,
        "is_pinned" boolean NOT NULL DEFAULT false,
        "matched_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_supplier_material_match" PRIMARY KEY ("id"),
        CONSTRAINT "FK_supplier_material_match_material" FOREIGN KEY ("material_id")
          REFERENCES "materials_catalog" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_supplier_material_match" ON "supplier_material_match" ("supplier_key", "material_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_supplier_material_match_supplier" ON "supplier_material_match" ("supplier_key", "matched_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_supplier_material_match_supplier"`,
    );
    await queryRunner.query(`DROP INDEX "UQ_supplier_material_match"`);
    await queryRunner.query(`DROP TABLE "supplier_material_match"`);
  }
}
