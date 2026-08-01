import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsEnum,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MilestoneStatus } from '../entities/site-milestone.entity';

export class UpdateMilestoneDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  label?: string;

  @IsOptional()
  @IsEnum(MilestoneStatus)
  status?: MilestoneStatus;

  @IsOptional()
  @IsDateString()
  planned_date?: string;

  @IsOptional()
  @IsDateString()
  actual_date?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}
