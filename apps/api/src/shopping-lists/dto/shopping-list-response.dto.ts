import type {
  ShoppingListData,
  ShoppingListMaterialItem,
  ShoppingListComplementaryItem,
} from '../entities/shopping-list.entity';
import { pickJustification } from '../../materials/render-justification';

/**
 * E1-11 — `ShoppingListMaterialItem` moins le champ `justification` brut
 * (marque comprise), plus les deux champs déjà tranchés par
 * `pickJustification` selon `company_profiles.show_material_brands`. Le web
 * ne reçoit jamais `text_fr`/`text_unbranded_fr` : seulement la phrase déjà
 * choisie.
 */
export type ShoppingListMaterialItemDto = Omit<
  ShoppingListMaterialItem,
  'justification'
> & {
  justification_fr?: string;
  justification_url?: string;
};

export class ShoppingListResponseDto {
  id!: string;
  project_id!: string;
  estimation_id!: string;
  is_stale!: boolean;
  material_items!: ShoppingListMaterialItemDto[];
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
    showBrands = true,
  ): ShoppingListResponseDto {
    const dto = new ShoppingListResponseDto();
    dto.id = entity.id;
    dto.project_id = entity.project_id;
    dto.estimation_id = entity.estimation_id;
    dto.is_stale =
      !!latestEstimationId && entity.estimation_id !== latestEstimationId;
    dto.material_items = entity.items_json.material_items.map((item) => {
      const { justification, ...rest } = item;
      return { ...rest, ...pickJustification(justification, showBrands) };
    });
    dto.complementary_items = entity.items_json.complementary_items;
    dto.created_at = entity.created_at.toISOString();
    dto.updated_at = entity.updated_at.toISOString();
    return dto;
  }
}
