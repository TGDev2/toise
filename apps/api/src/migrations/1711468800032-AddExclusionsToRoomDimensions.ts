import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExclusionsToRoomDimensions1711468800032 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" ADD COLUMN "exclusions_json" jsonb DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" DROP COLUMN "exclusions_json"`,
    );
  }
}
