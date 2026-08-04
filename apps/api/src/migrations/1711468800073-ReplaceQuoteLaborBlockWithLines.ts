import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG E2-3 : une ligne de MO par ouvrage, plus un bloc unique.
 *
 * `up()` ajoute `labor_items_json`, backfille un devis existant en **exactement
 * une ligne** à partir de ses 4 colonnes, puis les supprime.
 *
 * Point capital du backfill : `line_total_ht` reprend `subtotal_labor_ht`
 * **tel quel**, jamais recalculé en `quantity × unit_price_ht`. `round2(rate) ×
 * round2(hours)` peut différer d'un centime de `subtotal_labor_ht`, qui a déjà
 * servi à dériver `total_ht`/`total_ttc` sur ce devis — le recalculer ferait
 * apparaître une dérive dès le jour 1, qu'une facture émise depuis ce devis
 * masquerait derrière une fausse ligne « Remise (0 %) » (cf. `invoices.service.ts`,
 * qui absorbe tout écart entre `Σ lignes` et `total_ht` dans la remise). Un
 * devis à MO nulle reste à `[]` (le `DEFAULT`).
 *
 * `down()` restaure fidèlement le schéma d'origine pour tout devis resté à 0 ou
 * 1 ligne. Un devis à N > 1 lignes s'effondre sur `labor_type = 'flat'`,
 * `labor_flat_amount = subtotal_labor_ht` — perte du détail, exactitude des
 * montants. Un modèle plus riche ne peut pas redevenir plus pauvre sans perte ;
 * même parti que `…031-CreateRoomsAndReparentGeometry` pour les pièces.
 *
 * Migration volontairement **postée après** `…072` : `schema.int-spec.ts` ne
 * révoque et ne réapplique que la dernière migration à chaque exécution de
 * `pnpm test:api:integration`. Celle qui déplace de l'argent doit être cette
 * dernière, pour que son `up → down → up` soit rejoué en continu plutôt que
 * vérifié une seule fois à la main.
 */
export class ReplaceQuoteLaborBlockWithLines1711468800073 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quotes"
        ADD COLUMN "labor_items_json" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "quotes" SET "labor_items_json" = jsonb_build_array(
        jsonb_build_object(
          'work_item_id',   NULL,
          'work_type_code', NULL,
          'label',          'Main d''oeuvre',
          'room_name',      NULL,
          'kind',           "labor_type",
          'surface_m2',     NULL,
          'quantity',       CASE WHEN "labor_type" = 'flat'
                                 THEN 1
                                 ELSE COALESCE("labor_estimated_hours", 0) END,
          'unit_price_ht',  CASE WHEN "labor_type" = 'flat'
                                 THEN COALESCE("labor_flat_amount", 0)
                                 ELSE COALESCE("labor_hourly_rate", 0) END,
          'line_total_ht',  COALESCE("subtotal_labor_ht", 0)
        )
      )
      WHERE COALESCE("subtotal_labor_ht", 0) <> 0
    `);

    await queryRunner.query(`
      ALTER TABLE "quotes"
        ADD CONSTRAINT "CHK_quotes_labor_items_json_array"
        CHECK (jsonb_typeof("labor_items_json") = 'array')
    `);

    await queryRunner.query(`
      ALTER TABLE "quotes"
        DROP COLUMN "labor_flat_amount",
        DROP COLUMN "labor_estimated_hours",
        DROP COLUMN "labor_hourly_rate",
        DROP COLUMN "labor_type"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quotes"
        ADD COLUMN "labor_type" varchar(10) NOT NULL DEFAULT 'hourly',
        ADD COLUMN "labor_hourly_rate" numeric(10,2) DEFAULT NULL,
        ADD COLUMN "labor_estimated_hours" numeric(10,2) DEFAULT NULL,
        ADD COLUMN "labor_flat_amount" numeric(10,2) DEFAULT NULL
    `);

    // Exactement 1 ligne : restitution fidèle. up -> down -> up est
    // l'identité pour tout devis antérieur à cette migration.
    await queryRunner.query(`
      UPDATE "quotes" q
      SET "labor_type"            = COALESCE(s.line->>'kind', 'hourly'),
          "labor_hourly_rate"     = CASE WHEN s.line->>'kind' = 'hourly'
                                         THEN (s.line->>'unit_price_ht')::numeric END,
          "labor_estimated_hours" = CASE WHEN s.line->>'kind' = 'hourly'
                                         THEN (s.line->>'quantity')::numeric END,
          "labor_flat_amount"     = CASE WHEN s.line->>'kind' = 'flat'
                                         THEN (s.line->>'unit_price_ht')::numeric END
      FROM (
        SELECT "id", "labor_items_json"->0 AS line
        FROM "quotes"
        WHERE jsonb_array_length("labor_items_json") = 1
      ) s
      WHERE q."id" = s."id"
    `);

    // N > 1 : effondrement en forfait. Exact sur l'argent (subtotal_labor_ht
    // n'est pas touché), dégradé sur le détail.
    await queryRunner.query(`
      UPDATE "quotes"
      SET "labor_type"            = 'flat',
          "labor_hourly_rate"     = NULL,
          "labor_estimated_hours" = NULL,
          "labor_flat_amount"     = "subtotal_labor_ht"
      WHERE jsonb_array_length("labor_items_json") > 1
    `);

    // Tableau vide : les DEFAULT de l'ADD COLUMN rendent déjà ('hourly',
    // NULL x3), l'état d'un devis legacy sans MO.
    await queryRunner.query(`
      ALTER TABLE "quotes" DROP CONSTRAINT "CHK_quotes_labor_items_json_array"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotes" DROP COLUMN "labor_items_json"
    `);
  }
}
