import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OpeningType } from '../entities/opening.entity';

export class UpdateOpeningDto {
  @IsOptional()
  @IsEnum(OpeningType)
  type?: OpeningType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  width_cm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  height_cm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  count?: number;
}
