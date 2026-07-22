import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUncertaintyToRoomDimensions1711468800034 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_dimensions"
        ADD COLUMN "length_cm_uncertainty" integer DEFAULT NULL,
        ADD COLUMN "width_cm_uncertainty" integer DEFAULT NULL,
        ADD COLUMN "height_cm_uncertainty" integer DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_dimensions"
        DROP COLUMN "length_cm_uncertainty",
        DROP COLUMN "width_cm_uncertainty",
        DROP COLUMN "height_cm_uncertainty"`,
    );
  }
}
