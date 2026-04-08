import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClients1711468800024 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "clients" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "email" varchar(255) DEFAULT NULL,
        "phone" varchar(20) DEFAULT NULL,
        "address_line1" varchar(255) DEFAULT NULL,
        "address_line2" varchar(255) DEFAULT NULL,
        "postal_code" varchar(10) DEFAULT NULL,
        "city" varchar(100) DEFAULT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_clients" PRIMARY KEY ("id"),
        CONSTRAINT "FK_clients_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_clients_user_id" ON "clients" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "clients"`);
  }
}
