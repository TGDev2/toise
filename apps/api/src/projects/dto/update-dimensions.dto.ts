import { IsInt, Max, Min } from 'class-validator';

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
}
