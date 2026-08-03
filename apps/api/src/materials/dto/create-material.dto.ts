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
import { SkillLevel } from '../../projects/entities/project-work-item.entity';

export class CreatePackagingDto {
  @IsString()
  @MaxLength(255)
  label!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity_per_unit!: number;

  @IsString()
  @MaxLength(20)
  unit!: string;
}

export class CreateWasteFactorDto {
  @IsString()
  @MaxLength(50)
  pose_type!: string;

  @IsEnum(SkillLevel)
  skill_level!: SkillLevel;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  factor_percent!: number;
}

export class CreateMaterialDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsEnum(MaterialCategory)
  category!: MaterialCategory;

  @IsString()
  @MaxLength(20)
  unit!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  yield_per_unit!: number;

  /**
   * E1-4 — à vrai pour un revêtement dont la quantité suit le nombre de
   * couches (peinture, lasure, vernis). Absent = faux : un matériau créé sans
   * le préciser n'est jamais multiplié par les couches.
   */
  @IsOptional()
  @IsBoolean()
  applies_coats?: boolean;

  @IsOptional()
  @IsBoolean()
  is_eco?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  eco_label_fr?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePackagingDto)
  packagings!: CreatePackagingDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWasteFactorDto)
  waste_factors?: CreateWasteFactorDto[];
}
