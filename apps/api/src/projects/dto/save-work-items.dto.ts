import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsUUID,
  Max,
  Min,
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

  /**
   * E1-2 — requis côté service (`ProjectsService.saveWorkItems`) quand
   * `work_type.quantity_basis === 'declared'` ; sans objet ici, où le type
   * d'ouvrage n'est pas encore résolu. Bornes larges mais réelles : au-delà,
   * ce n'est plus une cloison/un doublage de pièce.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(50)
  declared_length_m?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(6)
  declared_height_m?: number;

  /** Faces à parementer : 1 (doublage) ou 2 (cloison). */
  @IsOptional()
  @IsIn([1, 2])
  declared_clad_faces?: number;
}

export class SaveWorkItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkItemDto)
  items!: WorkItemDto[];
}
