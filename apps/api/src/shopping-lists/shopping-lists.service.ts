import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ShoppingList,
  ShoppingListData,
  ShoppingListMaterialItem,
  ShoppingListComplementaryItem,
} from './entities/shopping-list.entity';
import { ComplementaryMaterial } from './entities/complementary-material.entity';
import { WorkType } from '../projects/entities/work-type.entity';
import { EstimationsService } from '../estimations/estimations.service';
import { ProjectsService } from '../projects/projects.service';
import { UpdateShoppingListDto } from './dto/update-shopping-list.dto';
import {
  ComplementaryContext,
  computeComplementaryQuantity,
  parseTileFormat,
} from './complementary-formulas';

@Injectable()
export class ShoppingListsService {
  constructor(
    @InjectRepository(ShoppingList)
    private readonly shoppingListRepo: Repository<ShoppingList>,
    @InjectRepository(ComplementaryMaterial)
    private readonly complementaryRepo: Repository<ComplementaryMaterial>,
    @InjectRepository(WorkType)
    private readonly workTypeRepo: Repository<WorkType>,
    private readonly estimationsService: EstimationsService,
    private readonly projectsService: ProjectsService,
  ) {}

  async getOrGenerate(
    projectId: string,
    userId: string,
  ): Promise<{ shoppingList: ShoppingList; latestEstimationId: string }> {
    await this.projectsService.findOneByUser(projectId, userId);

    const latest = await this.estimationsService.getLatest(projectId, userId);

    const existing = await this.shoppingListRepo.findOne({
      where: { project_id: projectId },
    });

    if (existing) {
      return { shoppingList: existing, latestEstimationId: latest.id };
    }

    const generated = await this.generate(projectId, userId);
    return { shoppingList: generated, latestEstimationId: latest.id };
  }

  async generate(
    projectId: string,
    userId: string,
  ): Promise<ShoppingList> {
    const latest = await this.estimationsService.getLatest(projectId, userId);

    // Build work_type_code → category map
    const codes = [
      ...new Set(latest.items_json.map((item) => item.work_type_code)),
    ];
    const workTypes = await this.workTypeRepo.find({
      where: { code: In(codes) },
    });
    const categoryByCode = new Map(
      workTypes.map((wt) => [wt.code, wt.category]),
    );

    // Transform estimation items into shopping list material items
    const materialItems: ShoppingListMaterialItem[] = latest.items_json.map(
      (item) => ({
        material_id: item.material_id,
        work_item_id: item.work_item_id,
        work_type_code: item.work_type_code,
        work_type_label: item.work_type_label,
        material_name: item.material_name,
        material_category: categoryByCode.get(item.work_type_code) || 'other',
        material_unit: item.material_unit,
        packaging_label: item.packaging_label,
        packaging_qty_per_unit: item.packaging_qty_per_unit,
        adjusted_qty: item.adjusted_qty,
        original_units_needed: item.units_needed,
        units_needed: item.units_needed,
        is_manually_adjusted: false,
      }),
    );

    // Fetch complementary materials for relevant categories
    const categories = [...new Set(categoryByCode.values())];
    const complements = await this.complementaryRepo.find({
      where: { category: In(categories) },
      order: { category: 'ASC', display_order: 'ASC' },
    });

    // Build tiling context for calculated complementary materials
    const tilingContext = await this.buildTilingContext(
      projectId,
      userId,
      latest.items_json,
      categoryByCode,
    );

    const complementaryItems: ShoppingListComplementaryItem[] = complements.map(
      (c) => {
        let quantity = c.default_quantity;
        let isCalculated = false;

        if (c.formula_code && tilingContext) {
          const computed = computeComplementaryQuantity(
            c.formula_code,
            tilingContext,
          );
          if (computed !== null) {
            quantity = computed;
            isCalculated = true;
          }
        }

        return {
          complementary_material_id: c.id,
          name: c.name,
          description_fr: c.description_fr,
          category: c.category,
          unit_label: c.unit_label,
          default_quantity: quantity,
          quantity,
          is_removed: false,
          is_calculated: isCalculated,
        };
      },
    );

    const data: ShoppingListData = {
      material_items: materialItems,
      complementary_items: complementaryItems,
    };

    // Upsert: delete existing then insert
    await this.shoppingListRepo.delete({ project_id: projectId });

    const entity = this.shoppingListRepo.create({
      project_id: projectId,
      estimation_id: latest.id,
      items_json: data,
    });

    return this.shoppingListRepo.save(entity);
  }

  async update(
    projectId: string,
    userId: string,
    dto: UpdateShoppingListDto,
  ): Promise<{ shoppingList: ShoppingList; latestEstimationId: string }> {
    await this.projectsService.findOneByUser(projectId, userId);

    const shoppingList = await this.shoppingListRepo.findOne({
      where: { project_id: projectId },
    });

    if (!shoppingList) {
      throw new NotFoundException(
        'No shopping list found for this project. Generate one first.',
      );
    }

    const data = shoppingList.items_json;

    // Merge material item updates
    if (dto.material_items) {
      for (const update of dto.material_items) {
        const item = data.material_items.find(
          (m) =>
            m.material_id === update.material_id &&
            m.work_item_id === update.work_item_id,
        );
        if (item) {
          item.units_needed = update.units_needed;
          item.is_manually_adjusted =
            update.units_needed !== item.original_units_needed;
        }
      }
    }

    // Merge complementary item updates
    if (dto.complementary_items) {
      for (const update of dto.complementary_items) {
        const item = data.complementary_items.find(
          (c) =>
            c.complementary_material_id === update.complementary_material_id,
        );
        if (item) {
          if (update.quantity !== undefined) {
            item.quantity = update.quantity;
          }
          if (update.is_removed !== undefined) {
            item.is_removed = update.is_removed;
          }
        }
      }
    }

    shoppingList.items_json = data;
    const saved = await this.shoppingListRepo.save(shoppingList);

    const latest = await this.estimationsService.getLatest(projectId, userId);
    return { shoppingList: saved, latestEstimationId: latest.id };
  }

  async regenerate(
    projectId: string,
    userId: string,
  ): Promise<{ shoppingList: ShoppingList; latestEstimationId: string }> {
    await this.projectsService.findOneByUser(projectId, userId);

    const shoppingList = await this.generate(projectId, userId);

    return { shoppingList, latestEstimationId: shoppingList.estimation_id };
  }

  private async buildTilingContext(
    projectId: string,
    userId: string,
    estimationItems: { work_type_code: string; surface_m2: number }[],
    categoryByCode: Map<string, string>,
  ): Promise<ComplementaryContext | null> {
    // Aggregate tiling surface from estimation items
    const tilingSurfaceM2 = estimationItems
      .filter((item) => categoryByCode.get(item.work_type_code) === 'tiling')
      .reduce((sum, item) => sum + item.surface_m2, 0);

    if (tilingSurfaceM2 <= 0) return null;

    // Get tile format from project work items
    const workItems = await this.projectsService.getWorkItems(
      projectId,
      userId,
    );

    const tilingWorkItem = workItems.find(
      (wi) => wi.work_type.category === 'tiling',
    );

    const tileFormatStr =
      (tilingWorkItem?.custom_params?.tile_format as string) || '30x30';
    const tileFormat = parseTileFormat(tileFormatStr) || {
      length_cm: 30,
      width_cm: 30,
    };

    return {
      total_surface_m2: tilingSurfaceM2,
      tile_length_cm: tileFormat.length_cm,
      tile_width_cm: tileFormat.width_cm,
    };
  }
}
