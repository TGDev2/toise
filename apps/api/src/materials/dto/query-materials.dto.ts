import { IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { MaterialCategory } from '../entities/material-catalog.entity';

export class QueryMaterialsDto {
  @IsOptional()
  @IsEnum(MaterialCategory)
  category?: MaterialCategory;

  @IsOptional()
  @Transform(({ value }): unknown => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  is_active?: boolean;

  @IsOptional()
  @Transform(({ value }): unknown => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  is_eco?: boolean;
}
