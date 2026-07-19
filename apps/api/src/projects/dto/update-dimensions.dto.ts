import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

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
}
