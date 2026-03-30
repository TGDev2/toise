import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShareTokenToShoppingLists1711468800013
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shopping_lists" ADD "share_token" VARCHAR(64) NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "shopping_lists" ADD "share_token_created_at" TIMESTAMP WITH TIME ZONE NULL`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_shopping_lists_share_token" ON "shopping_lists" ("share_token") WHERE "share_token" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_shopping_lists_share_token"`);

    await queryRunner.query(
      `ALTER TABLE "shopping_lists" DROP COLUMN "share_token_created_at"`,
    );

    await queryRunner.query(
      `ALTER TABLE "shopping_lists" DROP COLUMN "share_token"`,
    );
  }
}
