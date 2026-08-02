import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG DATA-5 : clôture de chantier par ce qui a été réellement acheté.
 *
 * Deux écritures, une seule idée : donner au produit le moyen de distinguer
 * « l'utilisateur a déclaré ses achats » de « personne n'a rien dit ».
 *
 * 1. `shopping_lists.purchased_on` — la date d'achat, au niveau de la liste et
 *    non de la ligne. L'acheteur qui étale ses courses sur plusieurs semaines
 *    est explicitement hors périmètre : lui demander une date par ligne
 *    coûterait à tout le monde ce qui ne sert qu'à lui.
 *
 * 2. La gate `project_closeout`, au palier **free**. `budget_tracking` reste
 *    Pro et garde l'analyse (tableau de bord d'économies, répartition,
 *    benchmark). Le partage de la frontière n'est pas commercial mais
 *    structurel : la clôture est l'unique source de DATA-3, DATA-4, COM-1 et
 *    PLAT-1. Derrière un palier payant, le volant de données ne tourne que sur
 *    les abonnés — c'est-à-dire à peu près jamais, et sur une population qui
 *    n'est pas représentative des chantiers qu'on cherche à apprendre.
 *
 * Les quantités déclarées (`purchased_units`, `purchased_quantity`) vivent
 * dans `items_json` et ne demandent aucune migration : `ShoppingListData` est
 * un JSONB, et l'absence de la clé **est** l'information « non déclaré ».
 * Aucun rattrapage n'est fait sur l'existant, délibérément — inventer une
 * déclaration rétroactive reviendrait à fabriquer l'observation que ce lot
 * existe pour aller chercher.
 */
export class AddPurchaseDeclarationsAndCloseoutGate1711468800064 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shopping_lists" ADD COLUMN "purchased_on" date`,
    );

    await queryRunner.query(`
      INSERT INTO "feature_gates" ("feature_key", "label_fr", "description_fr", "min_tier", "is_enabled") VALUES
        ('project_closeout', 'Clôture de chantier', 'Déclarez ce que vous avez réellement acheté : ce qui vous reste, ce qui est encore reprenable et l''écart avec l''estimation', 'free', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "feature_gates" WHERE "feature_key" = 'project_closeout'`,
    );
    await queryRunner.query(
      `ALTER TABLE "shopping_lists" DROP COLUMN "purchased_on"`,
    );
  }
}
