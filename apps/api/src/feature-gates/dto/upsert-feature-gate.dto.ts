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
  @IsIn([
    'free',
    'pro',
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
