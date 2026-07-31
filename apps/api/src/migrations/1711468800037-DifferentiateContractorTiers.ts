import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PRO-1 : les 3 paliers Contractor (Essentiel/Standard/Premium) donnaient
 * jusqu'ici un accès strictement identique, `SubscriptionTier` ne connaissant qu'une
 * seule valeur `'contractor'` pour les 3 price IDs Stripe.
 *
 * Cette migration :
 * 1. Réattribue le bon sous-palier aux utilisateurs déjà à `'contractor'`, en
 *    résolvant leur price ID Stripe réel via `subscriptions.stripe_price_id` face
 *    aux 3 price IDs configurés en environnement. Défaut `contractor_essentiel`
 *    quand aucune correspondance n'est trouvée (aucun abonnement, ou price ID
 *    inconnu) : on ne sur-attribue jamais un palier supérieur à ce qui est prouvé.
 * 2. Recale les gates existantes (`export_devis`, `client_management`) sur
 *    `contractor_essentiel`, palier plancher des 3.
 * 3. Seed 4 nouvelles gates désactivées pour les futurs différenciateurs Standard
 *    (`site_tracking`, `quote_reminders` — BACKLOG PRO-2/PRO-3) et Premium
 *    (`multi_user`, `public_api` — BACKLOG PLAT-4/PLAT-5), même patron que
 *    `price_comparison` (migration 1711468800020) : la gate existe et pointe déjà
 *    vers le bon palier, mais reste éteinte tant qu'aucune fonctionnalité réelle
 *    n'existe derrière.
 */
export class DifferentiateContractorTiers1711468800037 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const standardPriceId = process.env.STRIPE_CONTRACTOR_STANDARD_PRICE_ID;
    const premiumPriceId = process.env.STRIPE_CONTRACTOR_PREMIUM_PRICE_ID;

    await queryRunner.query(
      `
      UPDATE "users" u
      SET "subscription_tier" = CASE
        WHEN s.stripe_price_id = $1 THEN 'contractor_standard'
        WHEN s.stripe_price_id = $2 THEN 'contractor_premium'
        ELSE 'contractor_essentiel'
      END
      FROM "subscriptions" s
      WHERE s.user_id = u.id AND u.subscription_tier = 'contractor'
      `,
      [standardPriceId ?? null, premiumPriceId ?? null],
    );

    // Utilisateurs 'contractor' sans ligne 'subscriptions' correspondante (état
    // incohérent en théorie, mais le UPDATE ci-dessus ne les touche pas faute de
    // JOIN) : défaut au palier plancher.
    await queryRunner.query(
      `UPDATE "users" SET "subscription_tier" = 'contractor_essentiel' WHERE "subscription_tier" = 'contractor'`,
    );

    await queryRunner.query(
      `UPDATE "feature_gates" SET "min_tier" = 'contractor_essentiel' WHERE "feature_key" IN ('export_devis', 'client_management') AND "min_tier" = 'contractor'`,
    );

    await queryRunner.query(`
      INSERT INTO "feature_gates" ("feature_key", "label_fr", "description_fr", "min_tier", "is_enabled") VALUES
        ('site_tracking', 'Suivi de chantier', 'Statuts d''avancement, jalons et dates de chantier par projet', 'contractor_standard', false),
        ('quote_reminders', 'Relances de devis', 'Rappels automatiques sur les devis envoyés sans réponse', 'contractor_standard', false),
        ('multi_user', 'Multi-utilisateurs', 'Invitez plusieurs membres de votre équipe sur le même compte', 'contractor_premium', false),
        ('public_api', 'API publique', 'Accès à l''API Chiffréo pour vos intégrations', 'contractor_premium', false)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "feature_gates" WHERE "feature_key" IN ('site_tracking', 'quote_reminders', 'multi_user', 'public_api')`,
    );

    await queryRunner.query(
      `UPDATE "feature_gates" SET "min_tier" = 'contractor' WHERE "feature_key" IN ('export_devis', 'client_management') AND "min_tier" = 'contractor_essentiel'`,
    );

    await queryRunner.query(
      `UPDATE "users" SET "subscription_tier" = 'contractor' WHERE "subscription_tier" IN ('contractor_essentiel', 'contractor_standard', 'contractor_premium')`,
    );
  }
}
