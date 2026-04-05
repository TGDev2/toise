import {
  IsString,
  IsOptional,
  IsEmail,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  postal_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}
