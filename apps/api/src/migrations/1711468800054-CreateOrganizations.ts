import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PLAT-4 : organisations, membres, rôles. Migration structurante —
 * conception complète dans tasks/todo.md §PLAT-4.
 *
 * Quatre décisions portées par ce schéma :
 *
 * 1. **`organization_id` s'ajoute à `user_id`, il ne le remplace pas.** `user_id`
 *    change de sens (auteur de la ligne) mais reste ; `organization_id` devient
 *    l'axe de propriété sur lequel bascule tout le contrôle d'accès. C'est ce qui
 *    rend `down()` non destructif : aucune ligne n'est orpheline après un
 *    rollback, le code d'avant retrouve exactement sa sémantique.
 *
 * 2. **Une organisation personnelle par utilisateur**, backfillée ici en 1:1,
 *    garantie unique par l'index partiel `UQ_organizations_personal_owner`.
 *    Conséquence recherchée : sur la base existante, un filtre `organization_id`
 *    renvoie exactement ce que renvoyait un filtre `user_id` — la bascule est
 *    invisible pour les comptes solos.
 *
 * 3. **Les séquences de numérotation suivent l'émetteur légal, donc l'org.**
 *    `invoice_sequences` est re-clé sur `(organization_id, year)` : laissée sur
 *    `user_id`, deux salariés d'une même entreprise émettraient chacun leur
 *    `F-2026-0001`, ce qui est une non-conformité (art. 242 nonies A CGI, cf.
 *    docs/CONFORMITE_FACTURATION.md), pas un désagrément. `quote_sequences` est
 *    créée pour la même raison côté devis, et **amorcée au MAX existant** : sans
 *    cet amorçage le premier devis post-migration réémettrait `D-2026-001` en
 *    collision avec un devis déjà émis.
 *
 * 4. **Les contraintes d'unicité par utilisateur sont remplacées, pas doublées.**
 *    Conserver `UQ_quotes_user_number` produirait de faux rejets dès qu'un
 *    utilisateur appartient à deux organisations : il obtiendrait légitimement
 *    `D-2026-001` dans chacune, et l'ancienne contrainte refuserait la seconde.
 *    Idem `UQ_invoices_user_number` et `UQ_company_profiles_user`.
 */
export class CreateOrganizations1711468800054 implements MigrationInterface {
  /** Tables dont la propriété bascule à l'organisation (cf. tasks/todo.md §PLAT-4 D5). */
  private static readonly OWNED_TABLES = [
    'projects',
    'clients',
    'quotes',
    'invoices',
    'company_profiles',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Tables de tenancy ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "owner_user_id" uuid NOT NULL,
        "is_personal" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organizations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_organizations_owner" FOREIGN KEY ("owner_user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_organizations_owner_user_id" ON "organizations" ("owner_user_id")`,
    );
    // Exactement une organisation personnelle par utilisateur : le repli de
    // résolution du contexte est ainsi toujours défini et non ambigu.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_organizations_personal_owner"
        ON "organizations" ("owner_user_id") WHERE "is_personal"
    `);

    await queryRunner.query(`
      CREATE TABLE "organization_memberships" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" varchar(20) NOT NULL DEFAULT 'member',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organization_memberships" PRIMARY KEY ("id"),
        CONSTRAINT "FK_organization_memberships_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_organization_memberships_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_organization_memberships" UNIQUE ("organization_id", "user_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_organization_memberships_user_id" ON "organization_memberships" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "organization_invitations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "email" varchar(255) NOT NULL,
        "role" varchar(20) NOT NULL DEFAULT 'member',
        "token_hash" varchar(64) NOT NULL,
        "invited_by_user_id" uuid DEFAULT NULL,
        "expires_at" timestamptz NOT NULL,
        "accepted_at" timestamptz DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organization_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_organization_invitations_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_organization_invitations_inviter" FOREIGN KEY ("invited_by_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_organization_invitations_token" UNIQUE ("token_hash")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_organization_invitations_org_id" ON "organization_invitations" ("organization_id")`,
    );
    // Une seule invitation en attente par (org, e-mail) — un renvoi remplace,
    // il n'empile pas des jetons valides.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_organization_invitations_pending"
        ON "organization_invitations" ("organization_id", lower("email"))
        WHERE "accepted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "active_organization_id" uuid DEFAULT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "FK_users_active_organization"
        FOREIGN KEY ("active_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL
    `);

    // ── 2. Backfill : une organisation personnelle par utilisateur ────────
    // L'org d'un artisan prend la raison sociale de son profil d'entreprise,
    // celle d'un particulier un libellé neutre.
    await queryRunner.query(`
      INSERT INTO "organizations" ("name", "owner_user_id", "is_personal")
      SELECT COALESCE(NULLIF(TRIM(cp."raison_sociale"), ''), 'Mon espace'), u."id", true
      FROM "users" u
      LEFT JOIN "company_profiles" cp ON cp."user_id" = u."id"
    `);
    await queryRunner.query(`
      INSERT INTO "organization_memberships" ("organization_id", "user_id", "role")
      SELECT "id", "owner_user_id", 'owner' FROM "organizations"
    `);

    // ── 3. Propriété : colonne ajoutée puis backfillée, jamais NOT NULL avant ──
    for (const table of CreateOrganizations1711468800054.OWNED_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "organization_id" uuid`,
      );
      await queryRunner.query(`
        UPDATE "${table}" t SET "organization_id" = o."id"
        FROM "organizations" o
        WHERE o."owner_user_id" = t."user_id" AND o."is_personal"
      `);
      // Sonde de complétude : la migration échoue et s'annule si une seule
      // ligne n'a pas trouvé son organisation.
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "organization_id" SET NOT NULL`,
      );
      await queryRunner.query(`
        ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_organization"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      `);
      await queryRunner.query(
        `CREATE INDEX "IDX_${table}_organization_id" ON "${table}" ("organization_id")`,
      );
    }

    // ── 4. Unicité : par organisation, plus par utilisateur ───────────────
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP CONSTRAINT "UQ_quotes_user_number"`,
    );
    await queryRunner.query(`
      ALTER TABLE "quotes" ADD CONSTRAINT "UQ_quotes_org_number"
        UNIQUE ("organization_id", "quote_number")
    `);
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "UQ_invoices_user_number"`,
    );
    await queryRunner.query(`
      ALTER TABLE "invoices" ADD CONSTRAINT "UQ_invoices_org_number"
        UNIQUE ("organization_id", "invoice_number")
    `);
    // 0..1 profil d'entreprise par organisation (l'identité légale d'émetteur
    // appartient à l'entreprise, pas à la personne qui l'a saisie).
    await queryRunner.query(
      `ALTER TABLE "company_profiles" DROP CONSTRAINT "UQ_company_profiles_user"`,
    );
    await queryRunner.query(`
      ALTER TABLE "company_profiles" ADD CONSTRAINT "UQ_company_profiles_organization"
        UNIQUE ("organization_id")
    `);

    // ── 5. Séquences de numérotation par émetteur légal ───────────────────
    await queryRunner.query(
      `ALTER TABLE "invoice_sequences" ADD COLUMN "organization_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "invoice_sequences" s SET "organization_id" = o."id"
      FROM "organizations" o
      WHERE o."owner_user_id" = s."user_id" AND o."is_personal"
    `);
    await queryRunner.query(
      `ALTER TABLE "invoice_sequences" ALTER COLUMN "organization_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_sequences" DROP CONSTRAINT "PK_invoice_sequences"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_sequences" DROP CONSTRAINT "FK_invoice_sequences_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_sequences" DROP COLUMN "user_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "invoice_sequences" ADD CONSTRAINT "PK_invoice_sequences"
        PRIMARY KEY ("organization_id", "year")
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_sequences" ADD CONSTRAINT "FK_invoice_sequences_organization"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE TABLE "quote_sequences" (
        "organization_id" uuid NOT NULL,
        "year" integer NOT NULL,
        "last_number" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_quote_sequences" PRIMARY KEY ("organization_id", "year"),
        CONSTRAINT "FK_quote_sequences_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    // Amorçage au dernier numéro réellement émis, par organisation et par année.
    // Les numéros hors format `D-AAAA-NNN` sont ignorés plutôt que de faire
    // échouer un cast.
    await queryRunner.query(`
      INSERT INTO "quote_sequences" ("organization_id", "year", "last_number")
      SELECT "organization_id",
             CAST(SUBSTRING("quote_number" FROM 3 FOR 4) AS integer),
             MAX(CAST(SUBSTRING("quote_number" FROM 8) AS integer))
      FROM "quotes"
      WHERE "quote_number" ~ '^D-[0-9]{4}-[0-9]+$'
      GROUP BY 1, 2
    `);

    // ── 6. La gate n'est allumée que par la livraison qui l'implémente ────
    await queryRunner.query(`
      UPDATE "feature_gates" SET "is_enabled" = true WHERE "feature_key" = 'multi_user'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "feature_gates" SET "is_enabled" = false WHERE "feature_key" = 'multi_user'
    `);

    await queryRunner.query(`DROP TABLE "quote_sequences"`);

    // `organizations` reste la seule source du mapping organisation →
    // propriétaire : la colonne `user_id` doit être restaurée avant que la table
    // ne disparaisse.
    await queryRunner.query(
      `ALTER TABLE "invoice_sequences" ADD COLUMN "user_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "invoice_sequences" s SET "user_id" = o."owner_user_id"
      FROM "organizations" o WHERE o."id" = s."organization_id"
    `);
    await queryRunner.query(
      `ALTER TABLE "invoice_sequences" ALTER COLUMN "user_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_sequences" DROP CONSTRAINT "PK_invoice_sequences"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_sequences" DROP CONSTRAINT "FK_invoice_sequences_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_sequences" DROP COLUMN "organization_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "invoice_sequences" ADD CONSTRAINT "PK_invoice_sequences"
        PRIMARY KEY ("user_id", "year")
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_sequences" ADD CONSTRAINT "FK_invoice_sequences_user"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(
      `ALTER TABLE "company_profiles" DROP CONSTRAINT "UQ_company_profiles_organization"`,
    );
    await queryRunner.query(`
      ALTER TABLE "company_profiles" ADD CONSTRAINT "UQ_company_profiles_user" UNIQUE ("user_id")
    `);
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "UQ_invoices_org_number"`,
    );
    await queryRunner.query(`
      ALTER TABLE "invoices" ADD CONSTRAINT "UQ_invoices_user_number"
        UNIQUE ("user_id", "invoice_number")
    `);
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP CONSTRAINT "UQ_quotes_org_number"`,
    );
    await queryRunner.query(`
      ALTER TABLE "quotes" ADD CONSTRAINT "UQ_quotes_user_number"
        UNIQUE ("user_id", "quote_number")
    `);

    for (const table of [
      ...CreateOrganizations1711468800054.OWNED_TABLES,
    ].reverse()) {
      await queryRunner.query(`DROP INDEX "IDX_${table}_organization_id"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_organization"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "organization_id"`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_users_active_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "active_organization_id"`,
    );

    await queryRunner.query(`DROP TABLE "organization_invitations"`);
    await queryRunner.query(`DROP TABLE "organization_memberships"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
  }
}
