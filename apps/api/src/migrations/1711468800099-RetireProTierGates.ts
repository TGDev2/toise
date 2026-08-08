import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG_V1 E3-1 (ADR 0002 D4) — le palier DIY `pro` (9,99 €/mois) cesse
 * d'être vendu. Les huit gates qui l'exigeaient ne peuvent pas rester adossées
 * à un palier qu'aucune offre ne porte : elles deviendraient inatteignables
 * sans que rien ne le dise, le mécanisme étant fail-closed
 * (`FeatureGatesService.isFeatureAllowed`).
 *
 * Règle appliquée, celle de l'ADR 0002 §3.2 : **calculer est gratuit, produire
 * un document opposable est payant**. Aucune de ces huit gates ne produit de
 * document opposable — elles descendent donc toutes à `free`. Les trois gelées
 * (`cv_analysis`, `eco_materials`, `cost_benchmark`) descendent aussi : leur
 * `is_enabled = false` les refuse déjà à tous les paliers, mais une ligne qui
 * pointe un palier retiré est une bombe à retardement le jour du dégel.
 *
 * Ce que cette migration ne fait **pas**, délibérément : toucher à
 * `users.subscription_tier`. `'pro'` reste une valeur lisible en base et un
 * rang valide de `SubscriptionTier` — des comptes peuvent encore la porter, et
 * comme toutes leurs gates descendent à `free`, ils ne perdent aucun accès.
 * Rétrograder un compte serait le seul geste de ce lot capable de casser un
 * abonné.
 *
 * Le défaut de colonne passe de `'pro'` à `'contractor_essentiel'` : une gate
 * insérée sans palier explicite doit être fermée par défaut, et le seul palier
 * payant restant est celui-là.
 *
 * Le miroir `apps/web/src/lib/feature-gates-catalogue.ts` est mis à jour dans
 * le même lot, comme l'exige CONTRIBUTING.md.
 */
const RETIRED_PRO_GATES = [
  'cv_analysis',
  'advanced_loss_factors',
  'unlimited_projects',
  'budget_tracking',
  'price_comparison',
  'logbook',
  'eco_materials',
  'cost_benchmark',
];

const FROM_TIER = 'pro';
const TO_TIER = 'free';
const OLD_COLUMN_DEFAULT = 'pro';
const NEW_COLUMN_DEFAULT = 'contractor_essentiel';

export class RetireProTierGates1711468800099 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const key of RETIRED_PRO_GATES) {
      await queryRunner.query(
        `UPDATE "feature_gates" SET "min_tier" = $1, "updated_at" = now() WHERE "feature_key" = $2 AND "min_tier" = $3`,
        [TO_TIER, key, FROM_TIER],
      );
    }

    await queryRunner.query(
      `ALTER TABLE "feature_gates" ALTER COLUMN "min_tier" SET DEFAULT '${NEW_COLUMN_DEFAULT}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "feature_gates" ALTER COLUMN "min_tier" SET DEFAULT '${OLD_COLUMN_DEFAULT}'`,
    );

    for (const key of RETIRED_PRO_GATES) {
      await queryRunner.query(
        `UPDATE "feature_gates" SET "min_tier" = $1, "updated_at" = now() WHERE "feature_key" = $2 AND "min_tier" = $3`,
        [FROM_TIER, key, TO_TIER],
      );
    }
  }
}
