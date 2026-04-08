import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompanyProfiles1711468800022 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "company_profiles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "raison_sociale" varchar(255) NOT NULL,
        "siret" varchar(14) NOT NULL,
        "address_line1" varchar(255) NOT NULL,
        "address_line2" varchar(255) DEFAULT NULL,
        "postal_code" varchar(10) NOT NULL,
        "city" varchar(100) NOT NULL,
        "country" varchar(2) NOT NULL DEFAULT 'FR',
        "phone" varchar(20) DEFAULT NULL,
        "specialties" text[] NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_company_profiles_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_company_profiles_user" UNIQUE ("user_id"),
        CONSTRAINT "UQ_company_profiles_siret" UNIQUE ("siret")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "company_profiles"`);
  }
}
