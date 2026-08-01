import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateEnterpriseAgreementDto {
  @IsUUID()
  organization_id!: string;

  @IsISO8601()
  starts_at!: string;

  /** L'antériorité sur `starts_at` est refusée par le service et par un CHECK. */
  @IsISO8601()
  ends_at!: string;

  @IsInt()
  @Min(0)
  annual_amount_cents!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  /** Référence du devis signé, émis hors produit. */
  @IsString()
  @Length(1, 100)
  quote_reference!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  purchase_order_reference?: string;

  @IsEmail()
  billing_contact_email!: string;

  /** Engagements chiffrés, pas un palier énuméré (PLAT-6 D11). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  sla_uptime_target?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  sla_support_response_hours?: number;

  @IsOptional()
  @IsEmail()
  sla_support_email?: string;

  /** Déclaratif : aucune automatisation d'infrastructure n'est déclenchée. */
  @IsOptional()
  @IsBoolean()
  dedicated_environment?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  dedicated_environment_region?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  notes?: string;
}
