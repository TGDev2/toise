import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG DATA-3 : facteurs de perte appris sur les écarts estimé/acheté des
 * chantiers terminés.
 *
 * Table séparée de `waste_factors` : le catalogue de pertes étalonné par ENG-5 n'est
 * jamais réécrit par le calcul automatique, il reste la référence auditable
 * vers laquelle l'apprentissage rétrécit (`baseline_percent`). Vider cette
 * table suffit à revenir au catalogue seul.
 *
 * `observed_percent` est en `numeric(6,2)` là où les deux autres colonnes sont
 * en `(5,2)` : c'est la médiane **brute**, avant bornage, qui peut dépasser
 * 999,99 sur une cellule aberrante (un achat 20× supérieur au prévu), alors
 * que `factor_percent` et `baseline_percent` sont bornés à 30 par construction.
 */
export class CreateLearnedWasteFactors1711468800058 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "learned_waste_factors" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "material_id" uuid NOT NULL,
        "pose_type" varchar(50) NOT NULL,
        "skill_level" varchar(20) NOT NULL,
        "factor_percent" numeric(5,2) NOT NULL,
        "baseline_percent" numeric(5,2) NOT NULL,
        "observed_percent" numeric(6,2) NOT NULL,
        "sample_size" integer NOT NULL,
        "computed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_learned_waste_factors" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_learned_waste_factors_cell"
          UNIQUE ("material_id", "pose_type", "skill_level"),
        CONSTRAINT "FK_learned_waste_factors_material" FOREIGN KEY ("material_id")
          REFERENCES "materials_catalog"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_learned_waste_factors_material_id" ON "learned_waste_factors" ("material_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_learned_waste_factors_material_id"`,
    );
    await queryRunner.query(`DROP TABLE "learned_waste_factors"`);
  }
}
