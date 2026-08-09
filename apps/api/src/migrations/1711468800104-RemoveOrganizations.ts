import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG_V1 E4-1 (ADR 0002 §2, D3 étendue) — les organisations et le
 * multi-utilisateurs sont supprimés. La portée redevient l'utilisateur.
 *
 * L'ADR 0001 §3.3 les exceptait des suppressions au motif que « le modèle est
 * déjà backfillé 1:1 […] le retrait coûterait plus cher que la conservation ».
 * L'ADR 0002 renverse l'arbitrage : l'unité qui paie est une entreprise d'une
 * personne, et un niveau organisationnel qui n'aura jamais plus d'un membre est
 * une jointure payée sur chaque requête pour une fonctionnalité que rien ne
 * vend et qu'aucun écran n'expose.
 *
 * Cette migration est l'inverse assumé de …054, et elle en reprend les gestes
 * dans l'ordre inverse. Quatre décisions la portent.
 *
 * 1. **Rien n'est déplacé : `user_id` est promu, `organization_id` est retiré.**
 *    Les cinq tables métier portent les deux colonnes depuis …054 — l'une
 *    l'auteur, l'autre la propriété. La bijection organisation ↔ propriétaire
 *    les rend équivalentes, donc la propriété se relit sur la colonne qui existe
 *    déjà. Aucune donnée ne bouge, ce qui est la raison pour laquelle
 *    l'opération est sûre.
 *
 * 2. **La propriété suit le propriétaire de l'organisation, pas l'auteur.**
 *    `user_id` est normalisé sur `organizations.owner_user_id` avant d'être
 *    promu (§2). Sans ce geste, une ligne écrite par un membre qui a depuis
 *    quitté l'organisation migrerait vers cet ancien membre plutôt que vers le
 *    propriétaire. Sur une base 1:1 le `UPDATE` ne touche aucune ligne ; il
 *    n'est pas là pour les données d'aujourd'hui mais pour la définition.
 *
 * 3. **Les séquences de numérotation redeviennent `(user_id, year)`**, ce
 *    qu'elles étaient avant …054. La continuité exigée par l'art. 242 nonies A
 *    CGI porte sur l'émetteur légal ; …054 l'avait déplacée sur l'organisation
 *    parce que « deux salariés d'une même entreprise auraient chacun émis leur
 *    F-2026-0001 ». Sans salariés, l'émetteur légal **est** l'utilisateur.
 *    Aucun numéro déjà émis n'est réécrit : ils vivent dans
 *    `quotes.quote_number` / `invoices.invoice_number`, que cette migration ne
 *    touche pas. Seule la clé du compteur change, à `last_number` constant —
 *    donc ni trou, ni doublon (§1 et §5).
 *
 * 4. **Les deux tables de trace ne perdent que la colonne.**
 *    `quantity_validations` et `quantity_corrections` (…098) portent
 *    `organization_id` sans aucune clé étrangère vers `organizations`, et leur
 *    `user_id` est nullable **à dessein** — c'est ce qui permet de supprimer un
 *    compte sans détruire l'historique probatoire, et un compte invité n'a pas
 *    d'e-mail. Les promouvoir comme les cinq autres détruirait cette intention.
 *    Leur portée passe par `project_id → projects.user_id`.
 *
 * **Garde-fou (§0).** Tout repose sur la bijection organisation ↔ propriétaire.
 * Elle est *vérifiée en base*, pas supposée : deux organisations pour un même
 * propriétaire collisionneraient sur la nouvelle clé primaire des séquences, et
 * une organisation à plusieurs membres verrait ses données réattribuées à son
 * propriétaire — une décision qu'aucune migration ne doit prendre en silence.
 * Dans les deux cas elle échoue en nommant le cas fautif.
 *
 * **Réversibilité.** `down()` est complet et rejoué en test : il recrée les
 * trois tables, une organisation personnelle par utilisateur, les colonnes et
 * leurs contraintes, et re-clé les séquences. Ne sont pas restitués les UUID
 * d'origine et les `created_at` des organisations — rien ne les référence,
 * l'abonnement Stripe étant porté par `users` et non par l'organisation.
 *
 * Le miroir `apps/web/src/lib/feature-gates-catalogue.ts` est mis à jour dans le
 * même lot, comme l'exige CONTRIBUTING.md.
 */
const GATE_KEY = 'multi_user';
const GATE_LABEL = 'Multi-utilisateurs';
const GATE_DESCRIPTION =
  'Invitez plusieurs membres de votre équipe sur le même compte';
const GATE_TIER = 'contractor_essentiel';

export class RemoveOrganizations1711468800104 implements MigrationInterface {
  /** Tables dont la propriété revient à l'utilisateur (miroir de …054). */
  private static readonly OWNED_TABLES = [
    'projects',
    'clients',
    'quotes',
    'invoices',
    'company_profiles',
  ];

  /** Tables de trace (…098) : la colonne part, `user_id` reste tel quel. */
  private static readonly TRACE_TABLES = [
    'quantity_validations',
    'quantity_corrections',
  ];

  /**
   * Refuse la migration si la bijection organisation ↔ propriétaire est fausse.
   * Les deux cas sont distincts et n'ont pas la même conséquence, donc pas le
   * même message.
   */
  private static async assertOneOrganizationPerUser(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const [multiOwned] = (await queryRunner.query(`
      SELECT count(*)::int AS n
        FROM (SELECT "owner_user_id" FROM "organizations"
               GROUP BY 1 HAVING count(*) > 1) x
    `)) as { n: number }[];
    if (multiOwned.n > 0) {
      throw new Error(
        `E4-1 : ${multiOwned.n} utilisateur(s) possèdent plusieurs organisations. ` +
          `Les séquences de numérotation collisionneraient sur la clé (user_id, year). ` +
          `Fusionner ou supprimer ces organisations avant de rejouer la migration.`,
      );
    }

    const [shared] = (await queryRunner.query(`
      SELECT count(*)::int AS n
        FROM "organization_memberships" m
        JOIN "organizations" o ON o."id" = m."organization_id"
       WHERE m."user_id" <> o."owner_user_id"
    `)) as { n: number }[];
    if (shared.n > 0) {
      throw new Error(
        `E4-1 : ${shared.n} adhésion(s) ne sont pas celles d'un propriétaire. ` +
          `Les données de ces organisations seraient réattribuées à leur propriétaire, ` +
          `ce qu'une migration ne doit pas décider seule. Retirer ces membres d'abord.`,
      );
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 0. La bijection est une précondition, pas une hypothèse ───────────
    await RemoveOrganizations1711468800104.assertOneOrganizationPerUser(
      queryRunner,
    );

    // ── 1. Séquences de numérotation : retour à (user_id, year) ───────────
    // Traitées en premier : c'est la seule partie de la migration dont une
    // erreur serait irrattrapable côté conformité. `organizations` est encore
    // là, donc le mapping est disponible.
    for (const table of ['invoice_sequences', 'quote_sequences']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "user_id" uuid`,
      );
      await queryRunner.query(`
        UPDATE "${table}" s SET "user_id" = o."owner_user_id"
        FROM "organizations" o WHERE o."id" = s."organization_id"
      `);
      // Sonde de complétude : une seule ligne non mappée annule la migration.
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "user_id" SET NOT NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "PK_${table}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_organization"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "organization_id"`,
      );
      await queryRunner.query(`
        ALTER TABLE "${table}" ADD CONSTRAINT "PK_${table}"
          PRIMARY KEY ("user_id", "year")
      `);
      await queryRunner.query(`
        ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      `);
    }

    // ── 2. Unicité : par utilisateur, plus par organisation ───────────────
    // Avant la promotion de `user_id`, pour que les contraintes soient posées
    // sur des valeurs déjà normalisées.
    for (const table of RemoveOrganizations1711468800104.OWNED_TABLES) {
      // La propriété suit le propriétaire de l'organisation, jamais l'auteur :
      // couvre aussi bien `user_id IS NULL` (auteur supprimé, …061) qu'un
      // auteur qui aurait quitté l'organisation.
      await queryRunner.query(`
        UPDATE "${table}" t SET "user_id" = o."owner_user_id"
        FROM "organizations" o
        WHERE o."id" = t."organization_id"
          AND t."user_id" IS DISTINCT FROM o."owner_user_id"
      `);
    }

    await queryRunner.query(
      `ALTER TABLE "quotes" DROP CONSTRAINT "UQ_quotes_org_number"`,
    );
    await queryRunner.query(`
      ALTER TABLE "quotes" ADD CONSTRAINT "UQ_quotes_user_number"
        UNIQUE ("user_id", "quote_number")
    `);
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "UQ_invoices_org_number"`,
    );
    await queryRunner.query(`
      ALTER TABLE "invoices" ADD CONSTRAINT "UQ_invoices_user_number"
        UNIQUE ("user_id", "invoice_number")
    `);
    await queryRunner.query(
      `ALTER TABLE "company_profiles" DROP CONSTRAINT "UQ_company_profiles_organization"`,
    );
    await queryRunner.query(`
      ALTER TABLE "company_profiles" ADD CONSTRAINT "UQ_company_profiles_user"
        UNIQUE ("user_id")
    `);

    // ── 3. `user_id` redevient la propriété : NOT NULL et cascade ─────────
    // Retour exact à l'état d'avant …061 pour ces cinq tables. La cascade
    // reproduit le comportement effectif d'aujourd'hui : `organization_id` est
    // déjà NOT NULL et sa FK déjà en CASCADE, donc supprimer un compte détruit
    // déjà ces lignes en passant par l'organisation. E4-1 ne change rien ici —
    // la tension avec l'art. L102 B LPF préexiste et reste ouverte.
    for (const table of RemoveOrganizations1711468800104.OWNED_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_user"`,
      );
      await queryRunner.query(`
        ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      `);
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "user_id" SET NOT NULL`,
      );
      await queryRunner.query(`DROP INDEX "IDX_${table}_organization_id"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_organization"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "organization_id"`,
      );
    }

    // ── 4. Tables de trace : la colonne seulement ─────────────────────────
    for (const table of RemoveOrganizations1711468800104.TRACE_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "organization_id"`,
      );
    }

    // ── 5. Démontage de la tenancy ────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_users_active_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "active_organization_id"`,
    );
    await queryRunner.query(`DROP TABLE "organization_invitations"`);
    await queryRunner.query(`DROP TABLE "organization_memberships"`);
    await queryRunner.query(`DROP TABLE "organizations"`);

    // Plus rien ne lit cette gate : la laisser serait garder une ligne dont le
    // prochain lecteur croirait qu'elle protège quelque chose (cf. …100).
    await queryRunner.query(
      `DELETE FROM "feature_gates" WHERE "feature_key" = $1`,
      [GATE_KEY],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "feature_gates" ("feature_key", "label_fr", "description_fr", "min_tier", "is_enabled")
       VALUES ($1, $2, $3, $4, false)
       ON CONFLICT ("feature_key") DO NOTHING`,
      [GATE_KEY, GATE_LABEL, GATE_DESCRIPTION, GATE_TIER],
    );

    // ── 1. Tenancy : tables, puis une organisation personnelle par compte ──
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
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_organizations_owner_user_id" ON "organizations" ("owner_user_id")`,
    );
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
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_organization_invitations_pending"
        ON "organization_invitations" ("organization_id", lower("email"))
        WHERE "accepted_at" IS NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "active_organization_id" uuid DEFAULT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "FK_users_active_organization"
        FOREIGN KEY ("active_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL
    `);

    // Même règle de nommage que …054 : la raison sociale du profil d'entreprise
    // quand elle existe, un libellé neutre sinon.
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

    // ── 2. Tables de trace ────────────────────────────────────────────────
    for (const table of [
      ...RemoveOrganizations1711468800104.TRACE_TABLES,
    ].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "organization_id" uuid`,
      );
      await queryRunner.query(`
        UPDATE "${table}" t SET "organization_id" = o."id"
        FROM "projects" p
        JOIN "organizations" o ON o."owner_user_id" = p."user_id" AND o."is_personal"
        WHERE p."id" = t."project_id"
      `);
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "organization_id" SET NOT NULL`,
      );
    }

    // ── 3. Propriété rendue à l'organisation ──────────────────────────────
    for (const table of [
      ...RemoveOrganizations1711468800104.OWNED_TABLES,
    ].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "organization_id" uuid`,
      );
      await queryRunner.query(`
        UPDATE "${table}" t SET "organization_id" = o."id"
        FROM "organizations" o
        WHERE o."owner_user_id" = t."user_id" AND o."is_personal"
      `);
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
      // Retour à l'état …061 : l'auteur redevient nullable et sa FK non
      // destructrice.
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "user_id" DROP NOT NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_user"`,
      );
      await queryRunner.query(`
        ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      `);
    }

    // ── 4. Unicité rendue à l'organisation ────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "company_profiles" DROP CONSTRAINT "UQ_company_profiles_user"`,
    );
    await queryRunner.query(`
      ALTER TABLE "company_profiles" ADD CONSTRAINT "UQ_company_profiles_organization"
        UNIQUE ("organization_id")
    `);
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "UQ_invoices_user_number"`,
    );
    await queryRunner.query(`
      ALTER TABLE "invoices" ADD CONSTRAINT "UQ_invoices_org_number"
        UNIQUE ("organization_id", "invoice_number")
    `);
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP CONSTRAINT "UQ_quotes_user_number"`,
    );
    await queryRunner.query(`
      ALTER TABLE "quotes" ADD CONSTRAINT "UQ_quotes_org_number"
        UNIQUE ("organization_id", "quote_number")
    `);

    // ── 5. Séquences rendues à l'organisation ─────────────────────────────
    for (const table of ['quote_sequences', 'invoice_sequences']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "organization_id" uuid`,
      );
      await queryRunner.query(`
        UPDATE "${table}" s SET "organization_id" = o."id"
        FROM "organizations" o
        WHERE o."owner_user_id" = s."user_id" AND o."is_personal"
      `);
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "organization_id" SET NOT NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "PK_${table}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_user"`,
      );
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "user_id"`);
      await queryRunner.query(`
        ALTER TABLE "${table}" ADD CONSTRAINT "PK_${table}"
          PRIMARY KEY ("organization_id", "year")
      `);
      await queryRunner.query(`
        ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_organization"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      `);
    }
  }
}
