import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SkillLevel } from '../../projects/entities/project-work-item.entity';

export const PUBLIC_WORK_TYPE_CODES = [
  'wall_painting',
  'ceiling_painting',
  'floor_tiling',
  'wall_tiling',
  'parquet_flooring',
] as const;

export class PublicOpeningDto {
  @IsInt()
  @Min(1)
  @Max(1000)
  width_cm!: number;

  @IsInt()
  @Min(1)
  @Max(1000)
  height_cm!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  count!: number;
}

/**
 * Rectangle composant une pièce non rectangulaire (L, T, U…). Repère vu de
 * dessus : (x_cm, y_cm) = coin minimal, length_cm sur X, width_cm sur Y.
 */
export class RectSegmentDto {
  @IsInt()
  @Min(0)
  @Max(10000)
  x_cm!: number;

  @IsInt()
  @Min(0)
  @Max(10000)
  y_cm!: number;

  @IsInt()
  @Min(1)
  @Max(10000)
  length_cm!: number;

  @IsInt()
  @Min(1)
  @Max(10000)
  width_cm!: number;
}

export class PublicCustomParamsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  number_of_coats?: number;

  @IsOptional()
  @IsIn(['20x20', '30x30', '45x45', '60x60', '30x60'])
  tile_format?: string;

  @IsOptional()
  @IsIn(['straight', 'diagonal'])
  laying_pattern?: string;
}

export class PublicEstimateRequestDto {
  @IsInt()
  @Min(50)
  @Max(10000)
  length_cm!: number;

  @IsInt()
  @Min(50)
  @Max(10000)
  width_cm!: number;

  @IsInt()
  @Min(50)
  @Max(10000)
  height_cm!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PublicOpeningDto)
  openings?: PublicOpeningDto[];

  /**
   * Décomposition d'une pièce non rectangulaire en rectangles. Absent → la
   * pièce est le simple rectangle length_cm × width_cm.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RectSegmentDto)
  segments?: RectSegmentDto[];

  @IsIn(PUBLIC_WORK_TYPE_CODES)
  work_type_code!: string;

  @IsOptional()
  @IsEnum(SkillLevel)
  skill_level?: SkillLevel;

  @IsOptional()
  @ValidateNested()
  @Type(() => PublicCustomParamsDto)
  custom_params?: PublicCustomParamsDto;
}
