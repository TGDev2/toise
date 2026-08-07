import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SkillLevel } from '../../projects/entities/project-work-item.entity';
import { ExclusionType } from '../../projects/entities/room-dimensions.entity';
import { SUBFLOOR_TYPES } from '../vapour-barrier';

export const PUBLIC_WORK_TYPE_CODES = [
  'wall_painting',
  'ceiling_painting',
  'floor_tiling',
  'wall_tiling',
  'parquet_flooring',
] as const;

export class PublicOpeningDto {
  @IsInt()
  @Min(1)
  @Max(1000)
  width_cm!: number;

  @IsInt()
  @Min(1)
  @Max(1000)
  height_cm!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  count!: number;
}

/**
 * Rectangle composant une pièce non rectangulaire (L, T, U…). Repère vu de
 * dessus : (x_cm, y_cm) = coin minimal, length_cm sur X, width_cm sur Y.
 */
export class RectSegmentDto {
  @IsInt()
  @Min(0)
  @Max(10000)
  x_cm!: number;

  @IsInt()
  @Min(0)
  @Max(10000)
  y_cm!: number;

  @IsInt()
  @Min(1)
  @Max(10000)
  length_cm!: number;

  @IsInt()
  @Min(1)
  @Max(10000)
  width_cm!: number;
}

/**
 * Zone non traitée à déduire d'une surface (ENG-3) : crédence, demi-mur,
 * plinthes… Miroir public de `RoomExclusionDto`, bornes resserrées comme
 * `RectSegmentDto` l'est vis-à-vis de `RoomSegmentDto`.
 *
 * `label` est accepté mais inutilisé par le calcul : le formulaire l'envoie
 * pour le type `other`, et `forbidNonWhitelisted` rejetterait la requête
 * entière si le champ n'était pas déclaré ici.
 */
export class PublicExclusionDto {
  @IsIn(['wall', 'floor', 'ceiling'])
  surface_target!: 'wall' | 'floor' | 'ceiling';

  @IsEnum(ExclusionType)
  type!: ExclusionType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @IsNumber()
  @Min(0)
  @Max(500)
  area_m2!: number;
}

export class PublicCustomParamsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  number_of_coats?: number;

  @IsOptional()
  @IsIn(['20x20', '30x30', '45x45', '60x60', '30x60'])
  tile_format?: string;

  /**
   * E1-7 — `herringbone` rejoint la liste avec la pose en chevrons du parquet.
   *
   * Cette validation ne connaît pas l'ouvrage : elle dit quelles poses existent
   * dans le produit, pas lesquelles vont ensemble. C'est `resolveLayingPose`
   * qui refuse un couple impossible — des chevrons sur un carrelage — et il
   * répond 400, pas 500 : la demande est mal formée, elle n'est pas le symptôme
   * d'un catalogue troué.
   */
  @IsOptional()
  @IsIn(['straight', 'diagonal', 'herringbone'])
  laying_pattern?: string;

  /**
   * E1-8 — la nature du support, qui décide de la présence du pare-vapeur.
   *
   * La liste est **importée** et non recopiée : c'est le même vocabulaire que
   * celui qui chiffre (`estimations/vapour-barrier.ts`) et que celui qu'affiche
   * la question de l'ouvrage. Une troisième copie ici finirait par accepter une
   * valeur que le moteur ne connaît pas, ou refuser une qu'il connaît.
   */
  @IsOptional()
  @IsIn([...SUBFLOOR_TYPES])
  subfloor_type?: string;
}

export class PublicEstimateRequestDto {
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

  /**
   * Décomposition d'une pièce non rectangulaire en rectangles. Absent → la
   * pièce est le simple rectangle length_cm × width_cm.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RectSegmentDto)
  segments?: RectSegmentDto[];

  /**
   * Zones à retirer de la surface calculée. Le formulaire public les déduit
   * déjà dans son aperçu en direct : ne pas les transmettre au moteur ferait
   * chiffrer une surface plus grande que celle affichée (GTM-9).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PublicExclusionDto)
  exclusions?: PublicExclusionDto[];

  @IsIn(PUBLIC_WORK_TYPE_CODES)
  work_type_code!: string;

  @IsOptional()
  @IsEnum(SkillLevel)
  skill_level?: SkillLevel;

  @IsOptional()
  @ValidateNested()
  @Type(() => PublicCustomParamsDto)
  custom_params?: PublicCustomParamsDto;
}
