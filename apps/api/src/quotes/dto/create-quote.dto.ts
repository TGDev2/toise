import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuoteLaborLineDto } from './quote-labor-line.dto';

export class CreateQuoteDto {
  @IsUUID()
  project_id!: string;

  @IsUUID()
  estimation_id!: string;

  @IsOptional()
  @IsUUID()
  client_id?: string;

  /**
   * Absent ⇒ devis sans main-d'œuvre (`[]`) : le serveur n'invente jamais de
   * ligne à l'écriture (leçon 18). La proposition est un acte de lecture
   * distinct, `GET /quotes/labor-proposal`, que le web appelle avant de
   * construire ce payload.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuoteLaborLineDto)
  labor_items?: QuoteLaborLineDto[];

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
