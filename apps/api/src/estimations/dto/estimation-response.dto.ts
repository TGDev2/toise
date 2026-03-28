import { EstimationLineItem } from '../entities/estimation-result.entity';

export class EstimationResponseDto {
  id!: string;
  project_id!: string;
  skill_level!: string;
  created_at!: string;
  total_items!: number;
  items!: EstimationLineItem[];

  static fromEntity(entity: {
    id: string;
    project_id: string;
    skill_level: string;
    created_at: Date;
    total_items: number;
    items_json: EstimationLineItem[];
  }): EstimationResponseDto {
    const dto = new EstimationResponseDto();
    dto.id = entity.id;
    dto.project_id = entity.project_id;
    dto.skill_level = entity.skill_level;
    dto.created_at = entity.created_at.toISOString();
    dto.total_items = entity.total_items;
    dto.items = entity.items_json;
    return dto;
  }
}
