import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG_V1 E3-3 — sortie du dépôt du widget marque blanche (PLAT-7), de l'API
 * publique à clés (PLAT-5) et de l'offre Enterprise avec SSO (PLAT-6). La
 * migration `1711468800065` les avait gelées (ADR 0001 D3) ; leur code part
 * dans la même livraison que cette migration, et les tables suivent.
 *
 * Quatre points sur le schéma :
 *
 * 1. **L'ordre de `up()` suit les clés étrangères entrantes.** Une seule existe
 *    entre ces tables : `FK_sso_domains_connection` → `sso_connections`, d'où
 *    `sso_domains` en premier. Les autres FK de ce lot sortent toutes vers
 *    `organizations` et `users`, qui restent : rien d'autre à ordonner, et
 *    aucune table conservée ne pointe vers celles-ci.
 *
 * 2. **Pas de `DROP INDEX` préalable.** Contrairement aux `down()` de #055 et
 *    #056, qui les listaient, `DROP TABLE` emporte en PostgreSQL les index et
 *    contraintes de la table. Les répéter n'ajouterait qu'un risque d'oubli
 *    asymétrique.
 *
 * 3. **Les deux gates sont supprimées, pas éteintes.** #065 avait choisi le gel
 *    — `is_enabled = false`, lignes intactes — précisément parce que le code
 *    restait. Ici il n'y a plus rien derrière : une gate sans consommateur est
 *    une bascule d'administration sans effet, et `PUT /admin/feature-gates/:key`
 *    permettrait de la rallumer sur du vide. Le miroir
 *    `apps/web/src/lib/feature-gates-catalogue.ts` est mis à jour dans le même
 *    lot, comme l'exige CONTRIBUTING.md.
 *
 * 4. **Réserve honnête sur la réversibilité.** `down()` recrée les six tables au
 *    DDL exact de #055, #056 et #057, et repose les deux gates avec leur
 *    `label_fr`, leur `description_fr` et leur `min_tier` d'origine, à
 *    `is_enabled = false` — leur état après #065, donc celui qui précède
 *    immédiatement cette migration. Ce que `down()` ne restaure pas : les `id`
 *    uuid d'origine des deux lignes de gate, et les **données** des six tables.
 *    C'est la limite déjà assumée au doc-comment de #065 pour tout `DELETE`
 *    réinséré.
 */
export class RemoveWidgetApiKeysAndEnterprise1711468800074 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enterprise / SSO : l'enfant d'abord (cf. point 1) ─────────────────
    await queryRunner.query(`DROP TABLE "sso_domains"`);
    await queryRunner.query(`DROP TABLE "sso_connections"`);
    await queryRunner.query(`DROP TABLE "enterprise_agreements"`);

    // ── API publique à clés ───────────────────────────────────────────────
    await queryRunner.query(`DROP TABLE "api_usage_counters"`);
    await queryRunner.query(`DROP TABLE "api_keys"`);

    // ── Widget marque blanche ─────────────────────────────────────────────
    await queryRunner.query(`DROP TABLE "widget_configs"`);

    // ── Gates devenues sans code (cf. point 3) ────────────────────────────
    await queryRunner.query(
      `DELETE FROM "feature_gates" WHERE "feature_key" IN ('public_api', 'enterprise_sso')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Contrat Enterprise — DDL de 1711468800056 ─────────────────────────
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
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_enterprise_agreements_active_org"
        ON "enterprise_agreements" ("organization_id") WHERE "status" = 'active'
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_enterprise_agreements_ends_at" ON "enterprise_agreements" ("ends_at")`,
    );

    // ── Connexions SSO — DDL de 1711468800056 ─────────────────────────────
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

    // ── Domaines de découverte — DDL de 1711468800056 ─────────────────────
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
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_sso_domains_verified"
        ON "sso_domains" ("domain") WHERE "verified_at" IS NOT NULL
    `);

    // ── Clés d'API — DDL de 1711468800055 ─────────────────────────────────
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
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_api_keys_previous_key_hash"
        ON "api_keys" ("previous_key_hash") WHERE "previous_key_hash" IS NOT NULL
    `);

    // ── Compteurs d'usage — DDL de 1711468800055 ──────────────────────────
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

    // ── Configurations widget — DDL de 1711468800057 ──────────────────────
    await queryRunner.query(`
      CREATE TABLE "widget_configs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "widget_key" varchar(40) NOT NULL,
        "allowed_origins" text[] NOT NULL DEFAULT '{}',
        "enabled" boolean NOT NULL DEFAULT true,
        "display_name" varchar(100) DEFAULT NULL,
        "accent_color" varchar(7) DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_widget_configs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_widget_configs_organization_id" UNIQUE ("organization_id"),
        CONSTRAINT "UQ_widget_configs_widget_key" UNIQUE ("widget_key"),
        CONSTRAINT "FK_widget_configs_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);

    // ── Gates reposées dans leur état d'après #065 (cf. point 4) ──────────
    // `public_api` : libellés de #037, `enterprise_sso` : libellés de #056.
    await queryRunner.query(`
      INSERT INTO "feature_gates" ("feature_key", "label_fr", "description_fr", "min_tier", "is_enabled") VALUES
        ('public_api', 'API publique', 'Accès à l''API Chiffréo pour vos intégrations', 'contractor_premium', false),
        ('enterprise_sso', 'Authentification SSO', 'Fédération d''identité SAML ou OIDC avec l''annuaire de votre entreprise', 'enterprise', false)
    `);
  }
}
