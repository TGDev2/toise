import {
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  IsOptional,
  MaxLength,
  Min,
  Max,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MaterialCategory } from '../entities/material-catalog.entity';
import { CreatePackagingDto, CreateWasteFactorDto } from './create-material.dto';

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEnum(MaterialCategory)
  category?: MaterialCategory;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  yield_per_unit?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePackagingDto)
  packagings?: CreatePackagingDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWasteFactorDto)
  waste_factors?: CreateWasteFactorDto[];
}
