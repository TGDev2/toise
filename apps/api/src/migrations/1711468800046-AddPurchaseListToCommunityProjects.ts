import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG COM-1 : la liste d'achats communautaire (`materials_list`) était
 * saisie a la main par l'utilisateur — texte libre, cout total auto-declare,
 * sans lien avec les prix reels. `shopping_lists.budget_summary_json` porte
 * deja le vrai chiffrage (prix reel par ligne, saisi via le suivi budgetaire)
 * des qu'un projet atteint le statut COMPLETED — seul chemin vers ce statut,
 * cf. `ShoppingListsService.finalizeBudgetSummary`. On fige desormais cette
 * donnee reelle en jsonb sur `community_projects` au moment du partage, meme
 * logique de snapshot que `invoices` (PRO-4) : le cout affiche publiquement
 * ne doit pas deriver si le proprietaire modifie ses prix ensuite.
 */
export class AddPurchaseListToCommunityProjects1711468800046 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community_projects" ADD COLUMN "purchase_list_json" jsonb DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "community_projects" ADD COLUMN "budget_summary_json" jsonb DEFAULT NULL`,
    );

    // Backfill des publications existantes depuis la liste d'achats reelle du
    // projet lie. Seules les lignes dont la liste d'achats porte encore un
    // budget_summary_json non nul sont recuperees (cas normal) ; celles ou il
    // a ete efface entre-temps (regeneration post-finalisation, cf. notes
    // COM-1) restent a NULL — la couche web affiche alors un etat degrade
    // plutot que de planter.
    await queryRunner.query(`
      UPDATE "community_projects" cp
      SET "purchase_list_json" = sl."items_json",
          "budget_summary_json" = sl."budget_summary_json"
      FROM "shopping_lists" sl
      WHERE sl."project_id" = cp."project_id"
        AND sl."budget_summary_json" IS NOT NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "community_projects" DROP COLUMN "materials_list"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert de schema uniquement : le contenu saisi a la main dans
    // materials_list n'est pas reconstructible.
    await queryRunner.query(
      `ALTER TABLE "community_projects" ADD COLUMN "materials_list" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "community_projects" DROP COLUMN "purchase_list_json"`,
    );
    await queryRunner.query(
      `ALTER TABLE "community_projects" DROP COLUMN "budget_summary_json"`,
    );
  }
}
