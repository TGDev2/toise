import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { SkillLevel } from '../entities/project-work-item.entity';

export class WorkItemDto {
  @IsUUID()
  work_type_id!: string;

  @IsEnum(SkillLevel)
  skill_level!: SkillLevel;

  @IsOptional()
  @IsObject()
  custom_params?: Record<string, unknown>;
}

export class SaveWorkItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkItemDto)
  items!: WorkItemDto[];
}
