import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MaterialItemDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(100)
  quantity!: string;
}

export class CreateCommunityProjectDto {
  @IsUUID()
  project_id!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialItemDto)
  materials_list!: MaterialItemDto[];

  @IsInt()
  @Min(0)
  total_cost_cents!: number;

  @IsInt()
  @Min(1)
  duration_days!: number;

  @IsArray()
  @IsUUID('4', { each: true })
  before_photo_ids!: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  after_photo_ids!: string[];

  @IsBoolean()
  gdpr_consent!: boolean;
}
