import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommunityGallery1711468800026 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "community_projects" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "work_type" varchar(50) NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text DEFAULT NULL,
        "materials_list" jsonb NOT NULL DEFAULT '[]',
        "total_cost_cents" integer NOT NULL,
        "duration_days" integer NOT NULL,
        "length_cm" numeric(10,2) NOT NULL,
        "width_cm" numeric(10,2) NOT NULL,
        "height_cm" numeric(10,2) DEFAULT NULL,
        "before_photo_ids" uuid[] NOT NULL DEFAULT '{}',
        "after_photo_ids" uuid[] NOT NULL DEFAULT '{}',
        "moderation_status" varchar(20) NOT NULL DEFAULT 'pending',
        "rejection_reason" text DEFAULT NULL,
        "gdpr_consent" boolean NOT NULL DEFAULT false,
        "gdpr_consent_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "likes_count" integer NOT NULL DEFAULT 0,
        "published_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        CONSTRAINT "PK_community_projects" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_projects_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_projects_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_community_projects_project" UNIQUE ("project_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_community_projects_user_id" ON "community_projects" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_community_projects_work_type" ON "community_projects" ("work_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_community_projects_moderation_status" ON "community_projects" ("moderation_status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "community_likes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "community_project_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_likes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_likes_community_project" FOREIGN KEY ("community_project_id")
          REFERENCES "community_projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_likes_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_community_likes_user_project" UNIQUE ("community_project_id", "user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "community_comments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "community_project_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "content" varchar(2000) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        CONSTRAINT "PK_community_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_comments_community_project" FOREIGN KEY ("community_project_id")
          REFERENCES "community_projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_comments_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_community_comments_community_project_id" ON "community_comments" ("community_project_id")`,
    );

    await queryRunner.query(`
      INSERT INTO "feature_gates" ("feature_key", "label_fr", "description_fr", "min_tier", "is_enabled")
      VALUES ('community_gallery', 'Galerie communautaire', 'Partager un projet terminé dans la galerie', 'free', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "community_comments"`);
    await queryRunner.query(`DROP TABLE "community_likes"`);
    await queryRunner.query(`DROP TABLE "community_projects"`);
    await queryRunner.query(
      `DELETE FROM "feature_gates" WHERE "feature_key" = 'community_gallery'`,
    );
  }
}
