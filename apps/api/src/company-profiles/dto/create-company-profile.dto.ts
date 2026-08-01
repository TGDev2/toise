import {
  IsString,
  IsOptional,
  IsArray,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LegalMentionsDto } from './legal-mentions.dto';

export class CreateCompanyProfileDto extends LegalMentionsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  raison_sociale!: string;

  @IsString()
  @Matches(/^\d{14}$/, {
    message: 'Le SIRET doit contenir exactement 14 chiffres',
  })
  siret!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  address_line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line2?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  postal_code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];
}
