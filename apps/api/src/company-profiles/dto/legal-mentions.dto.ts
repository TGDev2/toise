import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Mentions légales de facturation (PRO-4). Optionnelles partout : un artisan qui
 * ne fait que des devis n'a aucune raison de les saisir. La complétude est
 * vérifiée à l'émission d'une facture par `findMissingLegalMentions()`.
 *
 * Classe de base partagée par Create/Update — les deux DTO portent exactement les
 * mêmes règles pour ces champs, et le repo n'utilise pas `PartialType`.
 */
export class LegalMentionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  legal_form?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capital_social?: number | null;

  @IsOptional()
  @Matches(/^FR[0-9A-Z]{2}\d{9}$/, {
    message:
      'Le numero de TVA intracommunautaire doit etre au format FRxx999999999',
  })
  vat_number?: string | null;

  @IsOptional()
  @IsBoolean()
  vat_exempt?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  rcs_city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  rm_department?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  insurance_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  insurance_policy?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  insurance_coverage?: string | null;

  @IsOptional()
  @Matches(/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/, {
    message: 'IBAN invalide',
  })
  iban?: string | null;

  @IsOptional()
  @Matches(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, {
    message: 'BIC invalide',
  })
  bic?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  late_penalty_rate?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  default_payment_terms_days?: number | null;
}
