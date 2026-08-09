import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG_V1 E3-3 (ADR 0002 §D4) — il n'y a plus qu'un palier payant.
 *
 * `contractor_standard` (29 €/mois) et `contractor_premium` (49 €/mois) sont
 * retirés de `PLANS` et leurs variables d'environnement de `configuration.ts`.
 * Plus aucun prix Stripe ne peut donc les attribuer. Mais un palier est une
 * **valeur de colonne**, pas une constante : ce qui ne peut plus être attribué
 * peut encore être stocké (leçon 22 §3).
 *
 * Et ce vestige-là ne serait pas inerte. `FeatureGatesService.TIER_RANK` classe
 * `contractor_standard` et `contractor_premium` **au-dessus** de
 * `contractor_essentiel` : une ligne oubliée garderait un accès supérieur à
 * tout ce que le catalogue vend, indéfiniment, sans qu'aucune surface ne
 * permette d'en constater l'origine.
 *
 * Le déplacement est vers `contractor_essentiel` et pas vers `free` : ces
 * comptes-là avaient payé davantage, pas moins. Leur retirer la conformité en
 * même temps que leur palier serait faire porter à un client le retrait d'une
 * offre qu'il n'a pas demandé.
 *
 * **Mesuré avant écriture** : `SELECT subscription_tier, count(*) FROM users
 * GROUP BY 1` sur la base réelle rend `free` et `contractor_essentiel`
 * uniquement, et `subscriptions` est vide — rien n'a jamais été vendu. La
 * migration est donc un no-op vérifié, et non un pari. `up()` journalise le
 * compte pour que ce soit vrai à l'exécution et pas seulement au moment où
 * cette phrase a été écrite.
 *
 * **Réversibilité, dite plutôt que supposée** : `down()` ne peut pas
 * reconstruire qui était `standard` et qui était `premium` — l'information est
 * détruite par la fusion. Sur zéro ligne convertie, l'absence de restitution
 * est exacte. Si un jour ce n'est plus zéro, le `down()` rendra un schéma
 * exploitable et non l'état antérieur : c'est la limite, elle est ici et pas
 * dans une note ailleurs.
 *
 * Les valeurs d'énumération restent dans `SubscriptionTier` : leur retrait est
 * une migration de contraction, à faire une version plus tard, quand plus aucun
 * code déployé ne peut lire une ligne les portant (leçon 29).
 */
const RETIRED_TIERS = ['contractor_standard', 'contractor_premium'];
const TARGET_TIER = 'contractor_essentiel';

export class NormalizeRetiredContractorTiers1711468800103 implements MigrationInterface {
  name = 'NormalizeRetiredContractorTiers1711468800103';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `[rows, rowCount]` : c'est la forme que rend le pilote pour un UPDATE,
    // là où un INSERT … RETURNING ne rend que les lignes.
    const [, affected] = (await queryRunner.query(
      `UPDATE "users"
         SET "subscription_tier" = $1
       WHERE "subscription_tier" = ANY($2::varchar[])`,
      [TARGET_TIER, RETIRED_TIERS],
    )) as [unknown, number];

    console.log(
      `[migration 103] paliers retirés normalisés vers ${TARGET_TIER} : ${affected} ligne(s).`,
    );
  }

  public async down(): Promise<void> {
    // Volontairement vide. Voir l'en-tête : la répartition d'origine entre
    // `standard` et `premium` n'est pas reconstructible, et elle porte sur zéro
    // ligne. Un `down()` qui inventerait une répartition serait pire que rien.
  }
}
