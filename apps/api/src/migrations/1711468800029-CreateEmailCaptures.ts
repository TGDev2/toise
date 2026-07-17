import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailCaptures1711468800029 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "email_captures" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar(255) NOT NULL,
        "work_type_code" varchar(50) NOT NULL,
        "skill_level" varchar(20) NOT NULL,
        "estimate_snapshot" jsonb NOT NULL DEFAULT '[]',
        "consent" boolean NOT NULL DEFAULT false,
        "consent_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "email_sent_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_captures" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_email_captures_email" ON "email_captures" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_captures_work_type_code" ON "email_captures" ("work_type_code")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_email_captures_work_type_code"`);
    await queryRunner.query(`DROP INDEX "IDX_email_captures_email"`);
    await queryRunner.query(`DROP TABLE "email_captures"`);
  }
}
