import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { LaborType } from '../entities/quote.entity';

export class CreateQuoteDto {
  @IsUUID()
  project_id!: string;

  @IsUUID()
  estimation_id!: string;

  @IsOptional()
  @IsUUID()
  client_id?: string;

  @IsEnum(LaborType)
  labor_type!: LaborType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  labor_hourly_rate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  labor_estimated_hours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  labor_flat_amount?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  material_margin_percent!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount_percent?: number;

  @IsOptional()
  @IsString()
  payment_terms?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validity_days?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tva_rate?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
