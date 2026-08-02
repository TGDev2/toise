import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG DATA-4 : médianes de coût matériaux au m², par type d'ouvrage et
 * bande de surface.
 *
 * La table ne stocke que les cellules **publiables**. Une cohorte qui ne
 * satisfait pas le k-anonymat n'y figure pas — pas même avec une médiane à
 * `NULL` : ce qui n'existe pas ne peut pas fuiter à la faveur d'une évolution
 * du chemin de lecture. D'où `median_cost_per_m2 NOT NULL`.
 *
 * La contrainte `CHECK` porte les seuils dans le schéma et non seulement dans
 * le code : un écrivain futur, même buggé, ne peut pas insérer une cellule
 * moins anonyme que k = 5 organisations et 10 observations. Les relever ne
 * demande rien ; les abaisser exige une migration délibérée — c'est voulu.
 */
export class CreateCostBenchmarks1711468800059 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cost_benchmarks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "work_type_code" varchar(50) NOT NULL,
        "surface_band" varchar(20) NOT NULL,
        "median_cost_per_m2" numeric(10,2) NOT NULL,
        "sample_size" integer NOT NULL,
        "organization_count" integer NOT NULL,
        "computed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cost_benchmarks" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_cost_benchmarks_k_anonymity"
          CHECK ("organization_count" >= 5 AND "sample_size" >= 10)
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_cost_benchmarks_cell" ON "cost_benchmarks" ("work_type_code", "surface_band")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_cost_benchmarks_cell"`);
    await queryRunner.query(`DROP TABLE "cost_benchmarks"`);
  }
}
