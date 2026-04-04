import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ItemSupplierSelectionDto {
  @IsUUID()
  material_id!: string;

  @IsUUID()
  work_item_id!: string;

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
