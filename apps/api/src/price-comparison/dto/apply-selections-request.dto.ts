import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ItemSupplierSelectionDto {
  @IsUUID()
  material_id!: string;

  // ENG-2 : les lignes d'achat sont mutualisées par matériau ; le matching se
  // fait sur `material_id` seul, comme dans `MaterialItemUpdateDto`.
  // `work_item_id` reste toléré (clients anciens) mais n'est plus utilisé.
  @IsOptional()
  @IsString()
  work_item_id?: string;

  @IsString()
  supplier_key!: string;
}

export class ApplySelectionsRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemSupplierSelectionDto)
  selections!: ItemSupplierSelectionDto[];
}
