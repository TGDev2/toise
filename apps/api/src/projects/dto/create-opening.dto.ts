import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OpeningType } from '../entities/opening.entity';

export class CreateOpeningDto {
  @IsEnum(OpeningType)
  type!: OpeningType;

  @IsInt()
  @Min(1)
  @Max(100000)
  width_cm!: number;

  @IsInt()
  @Min(1)
  @Max(100000)
  height_cm!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  count?: number;
}
