import {
  IsString,
  IsOptional,
  IsArray,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateCompanyProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  raison_sociale?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{14}$/, { message: 'Le SIRET doit contenir exactement 14 chiffres' })
  siret?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  address_line1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line2?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  postal_code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];
}
