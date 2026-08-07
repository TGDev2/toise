import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SkillLevel } from '../../projects/entities/project-work-item.entity';
import {
  PublicCustomParamsDto,
  PublicOpeningDto,
  RectSegmentDto,
} from './public-estimate-request.dto';

/**
 * Contrat d'entrée de l'API publique (BACKLOG PLAT-5) : multi-pièces et
 * multi-ouvrages, sans persistance.
 *
 * Toutes les collections sont **bornées**, et ce n'est pas de la cosmétique de
 * validation : le moteur reconstruit une grille de rectangles par surface
 * calculée (`room-geometry.ts`), soit quatre grilles par ouvrage et par pièce.
 * Sans plafond sur `rooms` et `work_items`, une seule requête bien formée
 * monopoliserait la boucle d'événements du process — l'API est mono-thread.
 * Les bornes unitaires (dimensions, ouvertures, segments) sont celles, déjà
 * éprouvées, du calculateur public.
 */
export class ApiWorkItemDto {
  @IsString()
  @Length(1, 50)
  work_type_code!: string;

  @IsOptional()
  @IsEnum(SkillLevel)
  skill_level?: SkillLevel;

  @IsOptional()
  @ValidateNested()
  @Type(() => PublicCustomParamsDto)
  custom_params?: PublicCustomParamsDto;

  /**
   * E1-3 — assiette d'un ouvrage qu'on **crée** (cloison sèche). Optionnels
   * ici parce que le type d'ouvrage n'est pas encore résolu à la validation ;
   * `EstimationsService.toWorkItemInput` les exige dès que l'ouvrage demandé
   * déclare `quantity_basis = 'declared'`, et refuse la requête sinon plutôt
   * que de chiffrer la cloison sur le périmètre de la pièce.
   *
   * Bornes reprises de `SaveWorkItemDto` : une seule description des limites
   * d'une cloison, pas deux qui divergeront.
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

export class ApiRoomDto {
  /** Libellé libre, repris tel quel dans les lignes de résultat. */
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsInt()
  @Min(50)
  @Max(10000)
  length_cm!: number;

  @IsInt()
  @Min(50)
  @Max(10000)
  width_cm!: number;

  @IsInt()
  @Min(50)
  @Max(10000)
  height_cm!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PublicOpeningDto)
  openings?: PublicOpeningDto[];

  /** Décomposition d'une pièce non rectangulaire en rectangles (L, T, U…). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RectSegmentDto)
  segments?: RectSegmentDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => ApiWorkItemDto)
  work_items!: ApiWorkItemDto[];
}

export class ApiEstimateRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ApiRoomDto)
  rooms!: ApiRoomDto[];

  /** Niveau par défaut des ouvrages qui n'en précisent pas. */
  @IsOptional()
  @IsEnum(SkillLevel)
  skill_level?: SkillLevel;
}
