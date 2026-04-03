import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBudgetSummaryToShoppingLists1711468800019
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shopping_lists" ADD COLUMN "budget_summary_json" jsonb DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shopping_lists" DROP COLUMN "budget_summary_json"`,
    );
  }
}
