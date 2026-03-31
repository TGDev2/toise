import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeatureGatesAndAnalyticsEvents1711468800017
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "feature_gates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "feature_key" varchar(50) NOT NULL,
        "label_fr" varchar(100) NOT NULL,
        "description_fr" varchar(255) DEFAULT NULL,
        "min_tier" varchar(20) NOT NULL DEFAULT 'pro',
        "is_enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feature_gates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feature_gates_key" UNIQUE ("feature_key")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "feature_gates" ("feature_key", "label_fr", "description_fr", "min_tier") VALUES
        ('cv_analysis', 'Analyse photo automatique', 'Détection automatique des dimensions à partir de vos photos', 'pro'),
        ('advanced_loss_factors', 'Facteurs de perte avancés', 'Calculs de perte adaptés au type de travaux et au niveau de compétence', 'pro'),
        ('unlimited_projects', 'Projets illimités', 'Créez autant de projets que nécessaire', 'pro'),
        ('budget_tracking', 'Suivi budgétaire', 'Suivez vos dépenses en temps réel', 'pro')
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid DEFAULT NULL,
        "event_name" varchar(50) NOT NULL,
        "properties" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_analytics_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_analytics_events_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_name_created" ON "analytics_events" ("event_name", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_analytics_events_name_created"`);
    await queryRunner.query(`DROP TABLE "analytics_events"`);
    await queryRunner.query(`DROP TABLE "feature_gates"`);
  }
}
