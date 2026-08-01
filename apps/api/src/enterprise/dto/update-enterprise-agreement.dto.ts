import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { EnterpriseAgreementStatus } from '../entities/enterprise-agreement.entity';

/**
 * `organization_id` est volontairement absent : un contrat ne se déplace pas
 * d'une organisation à l'autre — cela transférerait silencieusement
 * l'habilitation. Le renouvellement se fait en repoussant `ends_at` (PLAT-6 D14).
 */
export class UpdateEnterpriseAgreementDto {
  @IsOptional()
  @IsIn([
    EnterpriseAgreementStatus.DRAFT,
    EnterpriseAgreementStatus.ACTIVE,
    EnterpriseAgreementStatus.TERMINATED,
  ])
  status?: EnterpriseAgreementStatus;

  @IsOptional()
  @IsISO8601()
  starts_at?: string;

  @IsOptional()
  @IsISO8601()
  ends_at?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  annual_amount_cents?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  quote_reference?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  purchase_order_reference?: string;

  @IsOptional()
  @IsEmail()
  billing_contact_email?: string;

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
