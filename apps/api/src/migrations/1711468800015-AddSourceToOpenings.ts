import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSourceToOpenings1711468800015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "openings" ADD "source" varchar(10) NOT NULL DEFAULT 'manual'`,
    );
    await queryRunner.query(
      `ALTER TABLE "openings" ADD "cv_confidence" real DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "openings" DROP COLUMN "cv_confidence"`,
    );
    await queryRunner.query(`ALTER TABLE "openings" DROP COLUMN "source"`);
  }
}
