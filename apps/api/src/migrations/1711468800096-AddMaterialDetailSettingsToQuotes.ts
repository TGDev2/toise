import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E1-11 (BACKLOG_V1) — le détail des fournitures sur un devis devient
 * optionnel et désactivé par défaut : le détailler ligne à ligne expose la
 * marge de l'artisan sur les matériaux, ce que la plupart évitent
 * délibérément.
 *
 * Avant ce lot, le détail était **toujours** affiché — c'était le seul
 * comportement possible. `show_material_details` est donc posée à
 * `DEFAULT false` pour tout nouveau devis, puis **rétro-datée à `true`** sur
 * les devis déjà émis : un devis qu'un client a déjà reçu doit rester
 * reproductible au pixel, jamais amputé d'une section par un changement de
 * défaut rétroactif. Seuls les devis créés après cette migration héritent du
 * nouveau défaut masqué.
 *
 * `show_material_justifications` n'a pas ce problème — aucun devis
 * antérieur ne porte de justification à préserver (E1-11 les introduit) —
 * et reste donc à `false` pour tout le monde.
 */
export class AddMaterialDetailSettingsToQuotes1711468800096 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quotes"
        ADD COLUMN "show_material_details" boolean NOT NULL DEFAULT false,
        ADD COLUMN "show_material_justifications" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      UPDATE "quotes" SET "show_material_details" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quotes"
        DROP COLUMN "show_material_details",
        DROP COLUMN "show_material_justifications"
    `);
  }
}
