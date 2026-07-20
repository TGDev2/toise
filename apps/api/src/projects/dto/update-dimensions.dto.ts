import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExclusionType } from '../entities/room-dimensions.entity';

/**
 * Rectangle composant une pièce non rectangulaire (L, T, U…). Repère vu de
 * dessus : (x_cm, y_cm) = coin minimal, length_cm sur X, width_cm sur Y.
 */
export class RoomSegmentDto {
  @IsInt()
  @Min(0)
  @Max(100000)
  x_cm!: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  y_cm!: number;

  @IsInt()
  @Min(1)
  @Max(100000)
  length_cm!: number;

  @IsInt()
  @Min(1)
  @Max(100000)
  width_cm!: number;
}

/**
 * Zone à exclure d'une surface calculée (ENG-3) : déduction manuelle simple
 * d'une aire, sans géométrie (crédence, demi-mur, plinthes…).
 */
export class RoomExclusionDto {
  @IsIn(['wall', 'floor', 'ceiling'])
  surface_target!: 'wall' | 'floor' | 'ceiling';

  @IsEnum(ExclusionType)
  type!: ExclusionType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @IsNumber()
  @Min(0)
  @Max(500)
  area_m2!: number;
}

export class UpdateDimensionsDto {
  @IsInt()
  @Min(1)
  @Max(100000)
  length_cm!: number;

  @IsInt()
  @Min(1)
  @Max(100000)
  width_cm!: number;

  @IsInt()
  @Min(1)
  @Max(100000)
  height_cm!: number;

  /**
   * Décomposition d'une pièce non rectangulaire en rectangles. Absent → la
   * pièce est le simple rectangle length_cm × width_cm.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RoomSegmentDto)
  segments?: RoomSegmentDto[];

  /**
   * Zones à exclure des surfaces (ENG-3). Absent/vide → aucune exclusion.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RoomExclusionDto)
  exclusions?: RoomExclusionDto[];
}
