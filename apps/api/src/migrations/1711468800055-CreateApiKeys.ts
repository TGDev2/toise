import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PLAT-5 : API publique, clés et quotas par palier. Conception complète
 * dans tasks/todo.md §PLAT-5.
 *
 * Quatre décisions portées par ce schéma :
 *
 * 1. **La clé appartient à l'organisation, pas à une personne.** `organization_id`
 *    est la seule colonne de propriété ; `created_by_user_id` n'est qu'une trace
 *    d'auteur (`ON DELETE SET NULL`), exactement le renversement de sens acté en
 *    PLAT-4 D1. Une clé survit donc au départ du salarié qui l'a créée. C'est
 *    aussi ce qui permet de résoudre une portée sans en-tête client :
 *    `OrgContextService` refuse par construction de lire une organisation
 *    fournie par l'appelant, la clé doit donc porter la sienne.
 *
 * 2. **Seul le SHA-256 du secret est stocké** (`key_hash`), jamais le secret.
 *    Même patron que `organization_invitations.token_hash` (1711468800054) : sur
 *    un secret aléatoire de 256 bits, ni sel ni HMAC n'ajoutent quoi que ce soit
 *    — il n'y a pas de dictionnaire à précalculer — et le hash nu permet la
 *    recherche O(1) sur index unique dont le guard a besoin à chaque requête.
 *
 * 3. **La rotation est en place, pas un remplacement.** `previous_key_hash` +
 *    `previous_key_expires_at` gardent l'ancienne empreinte valide pendant une
 *    fenêtre de grâce, ce qui permet à un intégrateur de redéployer sans
 *    coupure. L'`id` de la clé ne change pas : son historique d'usage et les
 *    références qui la désignent survivent à la rotation. L'index unique est
 *    **partiel** (`WHERE previous_key_hash IS NOT NULL`) car en SQL deux NULL ne
 *    sont jamais égaux : sans le prédicat, la contrainte laisserait passer des
 *    doublons de NULL tout en interdisant… rien. Même raisonnement que
 *    `UQ_lifecycle_email_sends_*` (1711468800050).
 *
 * 4. **Le quota est un compteur agrégé, pas un journal de requêtes.**
 *    `api_usage_counters` porte une ligne par organisation et par mois, incrémentée
 *    par `INSERT … ON CONFLICT … DO UPDATE … RETURNING` — le comptage et la
 *    décision d'autoriser sont ainsi la *même* opération atomique, patron déjà
 *    éprouvé sur `invoice_sequences`/`quote_sequences`. Un journal ligne-à-ligne
 *    croîtrait sans borne et ralentirait à mesure que l'API réussit. Le compteur
 *    est porté par l'organisation et non par la clé : le quota suit le palier, et
 *    le palier suit l'organisation (PLAT-4 D3).
 *
 * La gate `public_api` (seedée désactivée en 1711468800037) est allumée ici, dans
 * la livraison qui l'implémente — même geste qu'en BUY-2/PRO-2/PRO-3/PLAT-4.
 */
export class CreateApiKeys1711468800055 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Clés d'API ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "key_prefix" varchar(16) NOT NULL,
        "key_hash" varchar(64) NOT NULL,
        "previous_key_hash" varchar(64) DEFAULT NULL,
        "previous_key_expires_at" timestamptz DEFAULT NULL,
        "created_by_user_id" uuid DEFAULT NULL,
        "last_used_at" timestamptz DEFAULT NULL,
        "revoked_at" timestamptz DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_api_keys" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_api_keys_key_hash" UNIQUE ("key_hash"),
        CONSTRAINT "FK_api_keys_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_api_keys_created_by" FOREIGN KEY ("created_by_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_api_keys_organization_id" ON "api_keys" ("organization_id")`,
    );
    // Partiel : cf. décision 3 du bloc ci-dessus.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_api_keys_previous_key_hash"
        ON "api_keys" ("previous_key_hash") WHERE "previous_key_hash" IS NOT NULL
    `);

    // ── 2. Compteurs d'usage ──────────────────────────────────────────────
    // `period` est un mois calendaire 'YYYY-MM' calculé en Europe/Paris côté
    // SQL : le calculer en Node exposerait le compteur au fuseau du process, et
    // deux instances mal configurées scinderaient le quota d'un même client.
    await queryRunner.query(`
      CREATE TABLE "api_usage_counters" (
        "organization_id" uuid NOT NULL,
        "period" varchar(7) NOT NULL,
        "request_count" integer NOT NULL DEFAULT 0,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_api_usage_counters" PRIMARY KEY ("organization_id", "period"),
        CONSTRAINT "FK_api_usage_counters_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);

    // ── 3. La gate n'est allumée que par la livraison qui l'implémente ────
    await queryRunner.query(`
      UPDATE "feature_gates" SET "is_enabled" = true WHERE "feature_key" = 'public_api'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "feature_gates" SET "is_enabled" = false WHERE "feature_key" = 'public_api'
    `);
    await queryRunner.query(`DROP TABLE "api_usage_counters"`);
    await queryRunner.query(`DROP INDEX "UQ_api_keys_previous_key_hash"`);
    await queryRunner.query(`DROP INDEX "IDX_api_keys_organization_id"`);
    await queryRunner.query(`DROP TABLE "api_keys"`);
  }
}
