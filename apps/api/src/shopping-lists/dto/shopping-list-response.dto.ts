import type {
  ShoppingListData,
  ShoppingListMaterialItem,
  ShoppingListComplementaryItem,
} from '../entities/shopping-list.entity';

export class ShoppingListResponseDto {
  id!: string;
  project_id!: string;
  estimation_id!: string;
  is_stale!: boolean;
  material_items!: ShoppingListMaterialItem[];
  complementary_items!: ShoppingListComplementaryItem[];
  created_at!: string;
  updated_at!: string;

  static fromEntity(
    entity: {
      id: string;
      project_id: string;
      estimation_id: string;
      items_json: ShoppingListData;
      created_at: Date;
      updated_at: Date;
    },
    latestEstimationId?: string,
  ): ShoppingListResponseDto {
    const dto = new ShoppingListResponseDto();
    dto.id = entity.id;
    dto.project_id = entity.project_id;
    dto.estimation_id = entity.estimation_id;
    dto.is_stale =
      !!latestEstimationId && entity.estimation_id !== latestEstimationId;
    dto.material_items = entity.items_json.material_items;
    dto.complementary_items = entity.items_json.complementary_items;
    dto.created_at = entity.created_at.toISOString();
    dto.updated_at = entity.updated_at.toISOString();
    return dto;
  }
}
