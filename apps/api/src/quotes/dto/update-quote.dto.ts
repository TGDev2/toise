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

export class UpdateQuoteDto {
  @IsOptional()
  @IsUUID()
  client_id?: string | null;

  @IsOptional()
  @IsEnum(LaborType)
  labor_type?: LaborType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  labor_hourly_rate?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  labor_estimated_hours?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  labor_flat_amount?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  material_margin_percent?: number;

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
