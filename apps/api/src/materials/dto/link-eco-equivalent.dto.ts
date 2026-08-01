import { IsUUID } from 'class-validator';

export class LinkEcoEquivalentDto {
  @IsUUID()
  eco_material_id!: string;
}
