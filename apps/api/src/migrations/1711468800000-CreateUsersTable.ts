import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1711468800000 implements MigrationInterface {
  name = 'CreateUsersTable1711468800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar(255),
        "auth_provider" varchar(20) NOT NULL DEFAULT 'email',
        "subscription_tier" varchar(20) NOT NULL DEFAULT 'free',
        "email_verified" boolean NOT NULL DEFAULT false,
        "firebase_uid" varchar(128) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_firebase_uid" UNIQUE ("firebase_uid"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_users_firebase_uid" ON "users" ("firebase_uid")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_firebase_uid"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
