import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSegmentsToRoomDimensions1711468800030 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" ADD COLUMN "segments_json" jsonb DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_dimensions" DROP COLUMN "segments_json"`,
    );
  }
}
