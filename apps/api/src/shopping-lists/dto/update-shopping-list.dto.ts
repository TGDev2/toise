import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

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
}
