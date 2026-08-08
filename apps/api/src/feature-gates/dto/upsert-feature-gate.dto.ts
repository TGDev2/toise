import {
  IsString,
  IsBoolean,
  IsOptional,
  IsIn,
  MaxLength,
} from 'class-validator';

export class UpsertFeatureGateDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label_fr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description_fr?: string;

  @IsOptional()
  @IsString()
  // `'pro'` a quitté cette liste avec le palier lui-même (E3-1). Le rang existe
  // encore pour les comptes qui portent la valeur en base, mais l'accorder à
  // une gate depuis l'administration recréerait précisément le défaut que la
  // migration 1711468800099 a réparé : une gate adossée à un palier que plus
  // aucune offre ne vend, donc fermée sans que rien ne le dise.
  @IsIn([
    'free',
    'contractor_essentiel',
    'contractor_standard',
    'contractor_premium',
    'enterprise',
  ])
  min_tier?: string;

  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;
}
