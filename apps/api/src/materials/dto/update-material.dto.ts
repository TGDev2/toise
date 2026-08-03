import {
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  IsOptional,
  MaxLength,
  Min,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MaterialCategory } from '../entities/material-catalog.entity';
import {
  CreatePackagingDto,
  CreateWasteFactorDto,
} from './create-material.dto';

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

  /** Cf. `CreateMaterialDto.applies_coats` (E1-4). */
  @IsOptional()
  @IsBoolean()
  applies_coats?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_eco?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  eco_label_fr?: string;

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
