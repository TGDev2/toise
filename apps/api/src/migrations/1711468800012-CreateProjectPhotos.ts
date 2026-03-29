import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectPhotos1711468800012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "project_photos" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "project_id" UUID NOT NULL,
        "storage_url" VARCHAR(1024) NOT NULL,
        "thumbnail_url" VARCHAR(1024),
        "original_filename" VARCHAR(255) NOT NULL,
        "mime_type" VARCHAR(50) NOT NULL,
        "size_bytes" INTEGER NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'uploading',
        "sort_order" SMALLINT NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        CONSTRAINT "FK_project_photos_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_project_photos_project_id" ON "project_photos" ("project_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "project_photos"`);
  }
}
