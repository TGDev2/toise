import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCompanyProfileDto } from '../../company-profiles/dto/create-company-profile.dto';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  display_name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCompanyProfileDto)
  company_profile?: CreateCompanyProfileDto;
}
