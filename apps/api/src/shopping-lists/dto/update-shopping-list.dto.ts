import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuantityCorrectionSource } from '../../quantity-validation/entities/quantity-correction.entity';

/**
 * Plafond de saisie par ligne d'achat. Dix mille conditionnements d'un même
 * matériau sur un seul chantier n'est pas une correction, c'est une faute de
 * frappe ou une valeur forgée. Sans borne haute, une ligne finalisée alimente
 * l'apprentissage des facteurs de perte (DATA-3) avec une perte impliquée
 * arbitrairement grande.
 */
const MAX_UNITS_PER_ITEM = 10_000;

export class MaterialItemUpdateDto {
  @IsUUID()
  material_id!: string;

  // ENG-2 : les lignes d'achat sont mutualisées par matériau ; le matching se
  // fait sur `material_id` seul. `work_item_id` reste toléré (clients anciens)
  // mais n'est plus utilisé.
  @IsOptional()
  @IsString()
  work_item_id?: string;

  @IsInt()
  @Min(0)
  @Max(MAX_UNITS_PER_ITEM)
  units_needed!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  real_unit_price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  store_name?: string;
}

export class ComplementaryItemUpdateDto {
  @IsUUID()
  complementary_material_id!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_UNITS_PER_ITEM)
  quantity?: number;

  @IsOptional()
  @IsBoolean()
  is_removed?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  real_unit_price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  store_name?: string;
}

export class UpdateShoppingListDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialItemUpdateDto)
  material_items?: MaterialItemUpdateDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComplementaryItemUpdateDto)
  complementary_items?: ComplementaryItemUpdateDto[];

  /**
   * E2-4 — d'où vient le geste, pour la trace des corrections. Déclaratif :
   * c'est l'écran de l'artisan qui le dit, et il n'ouvre aucun droit. Par
   * défaut la liste d'achats, qui est le chemin historique ; l'écran de devis
   * déclare `quote_validation`, dont la valeur probatoire est plus forte
   * puisqu'il précède immédiatement l'engagement.
   */
  @IsOptional()
  @IsEnum(QuantityCorrectionSource)
  source?: QuantityCorrectionSource;
}
