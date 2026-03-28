import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRole1711468800004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "role" varchar(20) NOT NULL DEFAULT 'user';
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_role" ON "users" ("role");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_role";`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role";`);
  }
}
