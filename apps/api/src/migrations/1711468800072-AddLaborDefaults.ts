import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG E2-3 : deux valeurs par défaut pour la main-d'œuvre par ouvrage.
 *
 * `default_labor_hourly_rate` (`company_profiles`) est un taux **choisi par
 * l'artisan** : nullable, jamais seedé, pour que son absence reste une absence
 * réelle plutôt qu'un chiffre plausible qu'on ne pourrait plus distinguer d'une
 * saisie (cf. `tasks/lessons.md` leçon 18).
 *
 * `labor_minutes_per_m2` (`work_types`) est en revanche seedé sur les 7 ouvrages.
 * Ce ne sont **pas** des rendements sourcés au sens de `docs/SOURCES_CATALOGUE.md` :
 * il n'existe pas de fiche fabricant pour un temps de pose. Ce sont des ordres de
 * grandeur métier, du même statut que `waste_factor_base` (déjà seedé sans fiche
 * dans cette même table) — documentés comme tels dans une section dédiée de
 * `docs/SOURCES_CATALOGUE.md`, distincte du registre des rendements fabricant,
 * et présentés côté web comme un temps indicatif, modifiable ligne à ligne.
 */
export class AddLaborDefaults1711468800072 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company_profiles"
        ADD COLUMN "default_labor_hourly_rate" numeric(10,2) DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "work_types"
        ADD COLUMN "labor_minutes_per_m2" numeric(6,2) DEFAULT NULL
    `);

    const minutesByCode: Record<string, number> = {
      wall_painting: 8,
      ceiling_painting: 10,
      wall_covering: 15,
      parquet_flooring: 20,
      drywall: 35,
      floor_tiling: 40,
      wall_tiling: 50,
    };

    for (const [code, minutes] of Object.entries(minutesByCode)) {
      await queryRunner.query(
        `UPDATE "work_types" SET "labor_minutes_per_m2" = $1 WHERE "code" = $2`,
        [minutes, code],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_types" DROP COLUMN "labor_minutes_per_m2"
    `);

    await queryRunner.query(`
      ALTER TABLE "company_profiles" DROP COLUMN "default_labor_hourly_rate"
    `);
  }
}
