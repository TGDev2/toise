import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Reference object used to calibrate the photo analysis scale.
 *
 * - `door` (default): a standard door is auto-detected (~204 cm).
 * - `a4` / `card`: a universal planar marker the user lays on the wall, which
 *   unblocks photos with no visible door (BACKLOG CV-3). Their real dimensions
 *   are fixed by type on the CV side, so `height_cm` is only used for doors.
 */
export class ReferenceObjectDto {
  @IsIn(['door', 'a4', 'card'])
  type!: 'door' | 'a4' | 'card';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(400)
  height_cm?: number;
}

export class StartAnalysisRequestDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ReferenceObjectDto)
  reference_object?: ReferenceObjectDto;
}
