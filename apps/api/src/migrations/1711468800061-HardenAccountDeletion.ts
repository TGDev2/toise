import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Suppression de compte : rendre au schéma les invariants que PLAT-4 avait
 * déplacés dans le code sans les y suivre.
 *
 * Depuis PLAT-4 la propriété d'une donnée métier est portée par
 * `organization_id`, `user_id` n'étant plus que la trace de l'auteur — les
 * entités le disent explicitement (« Auteur du projet. La propriété, elle, est
 * portée par `organization_id` »). Les clés étrangères, elles, sont restées
 * telles qu'écrites du temps où l'utilisateur *était* le propriétaire : toutes
 * en `ON DELETE CASCADE`. Trois conséquences, toutes déclenchées par un simple
 * `DELETE FROM users`.
 *
 * 1. **`FK_organizations_owner` → `RESTRICT`.** En cascade, supprimer un
 *    propriétaire effaçait l'organisation, donc — de proche en proche via les
 *    `FK_<table>_organization` — projets, clients, devis, factures et profil
 *    d'entreprise de *tous* ses membres. La destruction de données collectives
 *    ne doit pas être l'effet de bord d'une suppression de compte individuel :
 *    elle devient impossible en base, et le service doit désormais supprimer
 *    explicitement les organisations qu'il estime supprimables.
 *
 * 2. **Les FK d'auteur des 5 tables PLAT-4 → `SET NULL`.** En cascade, un
 *    membre qui ferme son compte emportait les devis et les **factures** qu'il
 *    avait émis pour son organisation — des pièces à conservation obligatoire
 *    (art. L102 B LPF, cf. docs/CONFORMITE_FACTURATION.md), et qui n'étaient
 *    pas les siennes. `SET NULL` réalise la seule lecture cohérente avec les
 *    commentaires d'entités : la donnée appartient à l'organisation et lui
 *    reste, l'auteur devient inconnu. C'est aussi le bon geste RGPD — on efface
 *    l'identifiant personnel, pas la comptabilité de l'entreprise. Le schéma le
 *    faisait déjà là où la question s'était posée : `api_keys.created_by_user_id`
 *    (PLAT-5) et `organization_invitations.invited_by_user_id` (PLAT-4).
 *
 * 3. **`FK_subscriptions_user` → `RESTRICT`.** En cascade, la ligne portant
 *    `stripe_subscription_id` disparaissait avec le compte — sans annulation
 *    côté Stripe, et en supprimant du même coup la seule référence locale
 *    permettant de la retrouver. L'abonnement continuait donc d'être facturé
 *    sans qu'aucune donnée locale ne permette d'ouvrir le portail. `RESTRICT`
 *    force le chemin de suppression à traiter l'abonnement d'abord.
 *
 * Les FK d'auteur restées en cascade hors de ce périmètre le sont à raison :
 * `room_log_entries` (carnet du logement, clé sur le seul `user_id`),
 * `community_*` et `lifecycle_email_sends` sont réellement personnels.
 */
export class HardenAccountDeletion1711468800061 implements MigrationInterface {
  /** Tables dont PLAT-4 a fait basculer la propriété vers l'organisation. */
  private static readonly AUTHORED_TABLES = [
    'projects',
    'clients',
    'quotes',
    'invoices',
    'company_profiles',
  ];

  /**
   * Nom réel de la FK `<table>.user_id → users.id`, lu en base plutôt que
   * supposé : `projects` la déclare en ligne dans la migration d'origine, donc
   * sous le nom généré par PostgreSQL (`projects_user_id_fkey`), quand les
   * quatre autres portent un `FK_<table>_user` explicite. Coder les deux
   * conventions en dur, c'est faire échouer la migration sur la base où
   * l'historique diffère.
   */
  private static async findUserFkName(
    queryRunner: QueryRunner,
    table: string,
  ): Promise<string> {
    const rows = (await queryRunner.query(
      `SELECT con.conname
         FROM pg_constraint con
         JOIN pg_class rel ON rel.oid = con.conrelid
         JOIN pg_attribute att
           ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = $1
          AND con.contype = 'f'
          AND att.attname = 'user_id'
          AND array_length(con.conkey, 1) = 1`,
      [table],
    )) as { conname: string }[];
    const name = rows[0]?.conname;
    if (!name) {
      throw new Error(
        `Aucune clé étrangère "${table}".user_id → users trouvée : schéma inattendu.`,
      );
    }
    return name;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP CONSTRAINT "FK_organizations_owner"`,
    );
    await queryRunner.query(`
      ALTER TABLE "organizations" ADD CONSTRAINT "FK_organizations_owner"
        FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_user"`,
    );
    await queryRunner.query(`
      ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_user"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
    `);

    for (const table of HardenAccountDeletion1711468800061.AUTHORED_TABLES) {
      const fkName = await HardenAccountDeletion1711468800061.findUserFkName(
        queryRunner,
        table,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "user_id" DROP NOT NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "${fkName}"`,
      );
      await queryRunner.query(`
        ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      ...HardenAccountDeletion1711468800061.AUTHORED_TABLES,
    ].reverse()) {
      // Rétablir `NOT NULL` sur une colonne que `up()` a rendue nullable exige
      // de reloger les lignes dont l'auteur a été effacé entre-temps. Le
      // propriétaire de l'organisation est le seul rattachement disponible qui
      // ne perde pas la ligne — un rollback ne doit pas détruire de données.
      await queryRunner.query(`
        UPDATE "${table}" t SET "user_id" = o."owner_user_id"
        FROM "organizations" o
        WHERE o."id" = t."organization_id" AND t."user_id" IS NULL
      `);
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
    }

    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_user"`,
    );
    await queryRunner.query(`
      ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_user"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(
      `ALTER TABLE "organizations" DROP CONSTRAINT "FK_organizations_owner"`,
    );
    await queryRunner.query(`
      ALTER TABLE "organizations" ADD CONSTRAINT "FK_organizations_owner"
        FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }
}
