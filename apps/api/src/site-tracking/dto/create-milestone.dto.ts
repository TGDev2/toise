import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateMilestoneDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  label!: string;

  @IsOptional()
  @IsDateString()
  planned_date?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}
