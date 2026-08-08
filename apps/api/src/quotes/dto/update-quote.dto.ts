import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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

export class UpdateQuoteDto {
  @IsOptional()
  @IsUUID()
  client_id?: string | null;

  /**
   * Absent ⇒ le tableau existant n'est pas touché (même contrat que
   * `items_json`, remanié seulement si `material_margin_percent` est fourni).
   * Fourni, même `[]`, il **remplace** entièrement le tableau — envoi complet,
   * pas de correctif par index.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuoteLaborLineDto)
  labor_items?: QuoteLaborLineDto[];

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

  /** E1-11 — un devis en brouillon peut activer le détail avant l'émission. */
  @IsOptional()
  @IsBoolean()
  show_material_details?: boolean;

  @IsOptional()
  @IsBoolean()
  show_material_justifications?: boolean;
}
