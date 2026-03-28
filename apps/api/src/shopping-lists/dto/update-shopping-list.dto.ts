import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class MaterialItemUpdateDto {
  @IsUUID()
  material_id!: string;

  @IsString()
  work_item_id!: string;

  @IsInt()
  @Min(0)
  units_needed!: number;
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
