import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteToProjects1711468800011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "deleted_at" TIMESTAMP WITH TIME ZONE NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_projects_user_deleted" ON "projects" ("user_id", "deleted_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_projects_user_deleted"`);

    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "deleted_at"`);
  }
}
