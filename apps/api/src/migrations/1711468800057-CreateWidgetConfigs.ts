import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG PLAT-7 : widget d'estimation marque blanche. Conception dans
 * tasks/todo.md §PLAT-7.
 *
 * Trois décisions portées par ce schéma :
 *
 * 1. **`widget_key` n'est pas un secret**, contrairement à `key_hash` des
 *    clés d'API (1711468800055) : il est destiné à être collé dans le HTML
 *    statique d'un site tiers, donc visible dans les outils de développement
 *    de n'importe quel visiteur. Il est stocké en clair (pas de hash) et
 *    l'autorisation repose sur `allowed_origins`, pas sur la confidentialité
 *    de la clé — cf. doc-comment de `WidgetConfig`.
 *
 * 2. **Une seule configuration par organisation** (`UQ_widget_configs_organization_id`)
 *    pour la v1 : le widget est un canal d'intégration, pas une collection de
 *    credentials comme les clés d'API, qui en autorisent jusqu'à 10 par
 *    organisation. Une organisation qui aurait besoin de plusieurs widgets
 *    (marques multiples, par exemple) est un besoin non exprimé par le ticket.
 *
 * 3. **Pas de fenêtre de grâce sur la régénération de clé**, contrairement à la
 *    rotation des clés d'API : la clé n'étant pas secrète, régénérer répond à
 *    un widget compromis ou mal configuré, pas à une fuite à couvrir en
 *    douceur. Le risque accepté est une intégration déjà déployée qui casse
 *    aussitôt, pas une fenêtre de vulnérabilité.
 *
 * Aucune nouvelle gate : le widget réutilise `public_api` (PLAT-5, déjà
 * activée), le même palier minimum et le même compteur de quota mensuel.
 */
export class CreateWidgetConfigs1711468800057 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "widget_configs"`);
  }
}
