import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PLAT-6 : offre Enterprise — SSO SAML/OIDC, contrat annuel sur devis,
 * SLA. Conception complète dans tasks/todo.md §PLAT-6.
 *
 * Cinq décisions portées par ce schéma :
 *
 * 1. **L'habilitation Enterprise est un contrat porté par l'organisation.**
 *    `enterprise_agreements.organization_id` est la seule colonne de propriété ;
 *    `created_by_user_id` n'est qu'une trace d'auteur (`ON DELETE SET NULL`).
 *    C'est `OrgContextService` qui interroge cette table **avant** de retomber sur
 *    le palier du propriétaire — un changement de propriétaire ou une
 *    rétrogradation Stripe de sa personne n'éteint donc pas le contrat de
 *    l'entreprise. C'est la dette inscrite en PLAT-4 §10.
 *
 * 2. **Un seul contrat courant par organisation, et l'expiration se dérive.**
 *    L'index unique est **partiel** (`WHERE status = 'active'`) : il laisse
 *    coexister l'historique des contrats terminés tout en garantissant qu'un seul
 *    est en vigueur. Aucun statut `expired` n'est stocké — il aurait exigé un
 *    sweep quotidien, donc une fenêtre pendant laquelle la base ment sur
 *    l'habilitation. `ends_at` fait foi, et il est indexé pour la liste des
 *    échéances à renouveler.
 *
 * 3. **L'ancre de confiance du SSO est `provider_id`, jamais le domaine e-mail.**
 *    C'est nous qui émettons cet identifiant en créant le fournisseur chez GCIP :
 *    un jeton dont `firebase.sign_in_provider` vaut cette valeur prouve que
 *    l'assertion vient de l'IdP de cette organisation-là. Rattacher par domaine
 *    aurait donné à l'IdP d'un client le pouvoir d'affirmer `ceo@concurrent.fr`
 *    et d'entrer chez un autre client. `organization_id` est unique : une
 *    organisation, une connexion, donc aucun rattachement ambigu.
 *
 * 4. **Aucun secret d'IdP dans le schéma.** Certificats X.509, `client_secret`
 *    OIDC et URL de SSO partent chez GCIP par le SDK Admin et ne sont jamais
 *    persistés ici. Une fuite de cette base ne livre aucun credential fédéré, et
 *    il n'y a pas de second exemplaire à faire tourner le jour où le client
 *    change son certificat. Seules la correspondance et la politique restent.
 *
 * 5. **Les domaines ne servent qu'à la découverte, et l'unicité est partielle.**
 *    `UQ_sso_domains_verified ... WHERE verified_at IS NOT NULL` : deux
 *    organisations peuvent tenter de prouver le même domaine, une seule y
 *    parvient — sans le prédicat, la première ligne non vérifiée bloquerait le
 *    domaine, ce qui suffirait à empêcher un concurrent de configurer son SSO.
 *    Même raisonnement que `UQ_api_keys_previous_key_hash` (1711468800055).
 *
 * La gate `enterprise_sso` est seedée **activée** : elle et son code arrivent
 * dans la même livraison, contrairement à `public_api`/`multi_user` qui
 * attendaient la leur (même geste qu'en PRO-4, PLAT-1 et PLAT-3).
 */
export class CreateEnterpriseOffer1711468800056 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Contrat Enterprise ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "enterprise_agreements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'draft',
        "starts_at" timestamptz NOT NULL,
        "ends_at" timestamptz NOT NULL,
        "annual_amount_cents" integer NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'EUR',
        "quote_reference" varchar(100) NOT NULL,
        "purchase_order_reference" varchar(100) DEFAULT NULL,
        "billing_contact_email" varchar(255) NOT NULL,
        "sla_uptime_target" numeric(5,2) DEFAULT NULL,
        "sla_support_response_hours" integer DEFAULT NULL,
        "sla_support_email" varchar(255) DEFAULT NULL,
        "dedicated_environment" boolean NOT NULL DEFAULT false,
        "dedicated_environment_region" varchar(50) DEFAULT NULL,
        "notes" text DEFAULT NULL,
        "created_by_user_id" uuid DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_enterprise_agreements" PRIMARY KEY ("id"),
        CONSTRAINT "CK_enterprise_agreements_period" CHECK ("ends_at" > "starts_at"),
        CONSTRAINT "FK_enterprise_agreements_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_enterprise_agreements_created_by" FOREIGN KEY ("created_by_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_enterprise_agreements_organization_id" ON "enterprise_agreements" ("organization_id")`,
    );
    // Partiel : cf. décision 2 du bloc ci-dessus.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_enterprise_agreements_active_org"
        ON "enterprise_agreements" ("organization_id") WHERE "status" = 'active'
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_enterprise_agreements_ends_at" ON "enterprise_agreements" ("ends_at")`,
    );

    // ── 2. Connexions SSO ─────────────────────────────────────────────────
    // Aucune colonne de secret ici : cf. décision 4.
    await queryRunner.query(`
      CREATE TABLE "sso_connections" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "provider_id" varchar(64) NOT NULL,
        "protocol" varchar(10) NOT NULL,
        "display_name" varchar(100) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "enforced" boolean NOT NULL DEFAULT false,
        "default_role" varchar(20) NOT NULL DEFAULT 'member',
        "provisioning_error" varchar(500) DEFAULT NULL,
        "created_by_user_id" uuid DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sso_connections" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sso_connections_organization" UNIQUE ("organization_id"),
        CONSTRAINT "UQ_sso_connections_provider_id" UNIQUE ("provider_id"),
        CONSTRAINT "FK_sso_connections_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sso_connections_created_by" FOREIGN KEY ("created_by_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // ── 3. Domaines de découverte ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "sso_domains" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "sso_connection_id" uuid NOT NULL,
        "domain" varchar(255) NOT NULL,
        "verification_token" varchar(64) NOT NULL,
        "verified_at" timestamptz DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sso_domains" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sso_domains_connection_domain" UNIQUE ("sso_connection_id", "domain"),
        CONSTRAINT "FK_sso_domains_connection" FOREIGN KEY ("sso_connection_id")
          REFERENCES "sso_connections"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_sso_domains_domain" ON "sso_domains" ("domain")`,
    );
    // Partiel : cf. décision 5 du bloc ci-dessus.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_sso_domains_verified"
        ON "sso_domains" ("domain") WHERE "verified_at" IS NOT NULL
    `);

    // ── 4. Gate seedée activée : elle arrive avec son code ────────────────
    await queryRunner.query(`
      INSERT INTO "feature_gates" ("feature_key", "label_fr", "description_fr", "min_tier", "is_enabled")
      VALUES (
        'enterprise_sso',
        'Authentification SSO',
        'Fédération d''identité SAML ou OIDC avec l''annuaire de votre entreprise',
        'enterprise',
        true
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "feature_gates" WHERE "feature_key" = 'enterprise_sso'`,
    );
    await queryRunner.query(`DROP INDEX "UQ_sso_domains_verified"`);
    await queryRunner.query(`DROP INDEX "IDX_sso_domains_domain"`);
    await queryRunner.query(`DROP TABLE "sso_domains"`);
    await queryRunner.query(`DROP TABLE "sso_connections"`);
    await queryRunner.query(`DROP INDEX "IDX_enterprise_agreements_ends_at"`);
    await queryRunner.query(`DROP INDEX "UQ_enterprise_agreements_active_org"`);
    await queryRunner.query(
      `DROP INDEX "IDX_enterprise_agreements_organization_id"`,
    );
    await queryRunner.query(`DROP TABLE "enterprise_agreements"`);
  }
}
