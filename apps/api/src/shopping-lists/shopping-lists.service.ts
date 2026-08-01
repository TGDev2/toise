import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  ShoppingList,
  ShoppingListData,
  ShoppingListMaterialItem,
  ShoppingListComplementaryItem,
  BudgetSummary,
  CategoryBreakdown,
} from './entities/shopping-list.entity';
import { ComplementaryMaterial } from './entities/complementary-material.entity';
import { WorkType } from '../projects/entities/work-type.entity';
import { MaterialCatalog } from '../materials/entities/material-catalog.entity';
import { MaterialEcoEquivalence } from '../materials/entities/material-eco-equivalence.entity';
import {
  EcoItemDto,
  EcoSuggestionDto,
} from './dto/eco-suggestions-response.dto';
import { EstimationsService } from '../estimations/estimations.service';
import { ProjectsService } from '../projects/projects.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { LogbookService } from '../logbook/logbook.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import { UpdateShoppingListDto } from './dto/update-shopping-list.dto';
import { DEFAULT_WASTE_PERCENT } from '../estimations/estimation-engine';
import { ProjectStatus } from '../projects/entities/project.entity';
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
    @InjectRepository(MaterialCatalog)
    private readonly materialCatalogRepo: Repository<MaterialCatalog>,
    @InjectRepository(MaterialEcoEquivalence)
    private readonly ecoEquivalenceRepo: Repository<MaterialEcoEquivalence>,
    private readonly estimationsService: EstimationsService,
    private readonly projectsService: ProjectsService,
    private readonly analyticsService: AnalyticsService,
    private readonly logbookService: LogbookService,
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

  async generate(projectId: string, userId: string): Promise<ShoppingList> {
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

    // Lignes d'achat mutualisées (ENG-2) : 1 ligne par matériau, sommée sur
    // toutes les pièces, conditionnement choisi une seule fois (aggregated_json).
    // Repli sur le mapping 1:1 pour les estimations antérieures (null).
    const materialItems: ShoppingListMaterialItem[] = latest.aggregated_json
      ? latest.aggregated_json.map((agg) => ({
          material_id: agg.material_id,
          work_type_code: agg.work_type_code,
          work_type_label: agg.work_type_label,
          material_name: agg.material_name,
          material_category: categoryByCode.get(agg.work_type_code) || 'other',
          material_unit: agg.material_unit,
          packaging_label: agg.packaging_label,
          packaging_qty_per_unit: agg.packaging_qty_per_unit,
          adjusted_qty: agg.total_adjusted_qty,
          original_units_needed: agg.units_needed,
          units_needed: agg.units_needed,
          is_manually_adjusted: false,
          room_count: agg.room_count,
          units_needed_low: agg.units_needed_low,
          units_needed_high: agg.units_needed_high,
        }))
      : latest.items_json.map((item) => ({
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
          units_needed_low: item.units_needed_low,
          units_needed_high: item.units_needed_high,
        }));

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

    const saved = await this.shoppingListRepo.save(entity);

    // Se déclenche aussi depuis regenerate() (régénération manuelle) : c'est
    // volontaire, le funnel agrège en aval sur la première occurrence par projet.
    this.analyticsService.track(
      AnalyticsEventName.SHOPPING_LIST_GENERATED,
      userId,
      {
        project_id: projectId,
        total_items: materialItems.length,
      },
    );

    return saved;
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

    // Merge material item updates (mutualisé : matching par material_id seul)
    if (dto.material_items) {
      for (const update of dto.material_items) {
        const item = data.material_items.find(
          (m) => m.material_id === update.material_id,
        );
        if (item) {
          item.units_needed = update.units_needed;
          item.is_manually_adjusted =
            update.units_needed !== item.original_units_needed;
          if (update.real_unit_price !== undefined) {
            item.real_unit_price = update.real_unit_price;
          }
          if (update.store_name !== undefined) {
            item.store_name = update.store_name;
          }
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
          if (update.real_unit_price !== undefined) {
            item.real_unit_price = update.real_unit_price;
          }
          if (update.store_name !== undefined) {
            item.store_name = update.store_name;
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

    // Preserve existing prices before regeneration
    const existing = await this.shoppingListRepo.findOne({
      where: { project_id: projectId },
    });

    const priceMap = new Map<
      string,
      { real_unit_price?: number | null; store_name?: string | null }
    >();
    if (existing) {
      for (const item of existing.items_json.material_items) {
        if (item.real_unit_price != null || item.store_name != null) {
          priceMap.set(item.material_id, {
            real_unit_price: item.real_unit_price,
            store_name: item.store_name,
          });
        }
      }
    }

    const shoppingList = await this.generate(projectId, userId);

    // Restore prices on matching items
    if (priceMap.size > 0) {
      let changed = false;
      for (const item of shoppingList.items_json.material_items) {
        const saved = priceMap.get(item.material_id);
        if (saved) {
          item.real_unit_price = saved.real_unit_price;
          item.store_name = saved.store_name;
          changed = true;
        }
      }
      if (changed) {
        await this.shoppingListRepo.save(shoppingList);
      }
    }

    return { shoppingList, latestEstimationId: shoppingList.estimation_id };
  }

  async getBudgetSummary(
    projectId: string,
    userId: string,
  ): Promise<{ summary: BudgetSummary; isFinalized: boolean }> {
    await this.projectsService.findOneByUser(projectId, userId);

    const shoppingList = await this.shoppingListRepo.findOne({
      where: { project_id: projectId },
    });

    if (!shoppingList) {
      throw new NotFoundException('No shopping list found for this project.');
    }

    const estimation = await this.estimationsService.findById(
      shoppingList.estimation_id,
    );

    return {
      summary: this.computeBudgetSummary(shoppingList, estimation.items_json),
      // COM-1 : regenerate() peut effacer budget_summary_json sur un projet
      // deja COMPLETED (prix restaures, resume non recalcule) — le live
      // recompute ci-dessus ne suffit pas a distinguer ce cas d'un budget
      // reellement finalise. Les appelants (ex. partage communaute) doivent
      // se fier a isFinalized, pas a summary.is_complete.
      isFinalized: shoppingList.budget_summary_json != null,
    };
  }

  async getEcoSuggestions(
    projectId: string,
    userId: string,
  ): Promise<{ eco_items: EcoItemDto[]; suggestions: EcoSuggestionDto[] }> {
    await this.projectsService.findOneByUser(projectId, userId);

    const shoppingList = await this.shoppingListRepo.findOne({
      where: { project_id: projectId },
    });

    if (!shoppingList) {
      throw new NotFoundException('No shopping list found for this project.');
    }

    const materialIds = [
      ...new Set(
        shoppingList.items_json.material_items.map((i) => i.material_id),
      ),
    ];
    if (materialIds.length === 0) {
      return { eco_items: [], suggestions: [] };
    }

    const materials = await this.materialCatalogRepo.find({
      where: { id: In(materialIds) },
    });
    const materialById = new Map(materials.map((m) => [m.id, m]));

    const eco_items: EcoItemDto[] = materials
      .filter((m) => m.is_eco)
      .map((m) => ({
        material_id: m.id,
        material_name: m.name,
        eco_label_fr: m.eco_label_fr,
      }));

    const standardIds = materials.filter((m) => !m.is_eco).map((m) => m.id);
    let suggestions: EcoSuggestionDto[] = [];
    if (standardIds.length > 0) {
      const equivalences = await this.ecoEquivalenceRepo.find({
        where: { standard_material_id: In(standardIds) },
        relations: ['ecoMaterial'],
      });
      suggestions = equivalences
        // N'affiche pas une alternative désactivée entre-temps par l'admin.
        .filter((e) => e.ecoMaterial.is_active)
        .map((e) => ({
          material_id: e.standard_material_id,
          material_name: materialById.get(e.standard_material_id)?.name ?? '',
          eco_material_id: e.eco_material_id,
          eco_material_name: e.ecoMaterial.name,
          eco_label_fr: e.ecoMaterial.eco_label_fr,
        }));
    }

    return { eco_items, suggestions };
  }

  async finalizeBudgetSummary(
    projectId: string,
    userId: string,
  ): Promise<BudgetSummary> {
    await this.projectsService.findOneByUser(projectId, userId);

    const shoppingList = await this.shoppingListRepo.findOne({
      where: { project_id: projectId },
    });

    if (!shoppingList) {
      throw new NotFoundException('No shopping list found for this project.');
    }

    // Validate all material items have prices
    const unpricedMaterials = shoppingList.items_json.material_items.filter(
      (item) => item.real_unit_price == null,
    );
    if (unpricedMaterials.length > 0) {
      throw new BadRequestException(
        `${unpricedMaterials.length} article(s) n'ont pas encore de prix reel.`,
      );
    }

    const estimation = await this.estimationsService.findById(
      shoppingList.estimation_id,
    );

    const summary = this.computeBudgetSummary(
      shoppingList,
      estimation.items_json,
    );

    shoppingList.budget_summary_json = summary;
    await this.shoppingListRepo.save(shoppingList);

    await this.projectsService.updateStatus(projectId, ProjectStatus.COMPLETED);

    // PLAT-1 : instantané par pièce (dimensions validées, matériaux
    // réellement achetés) — même point d'ancrage que le partage communauté
    // (COM-1/COM-2), seul moment garanti où prix réels ET dimensions sont
    // connus pour tout utilisateur.
    await this.logbookService.recordChantierCompletion(
      projectId,
      userId,
      estimation,
      shoppingList,
    );

    this.analyticsService.track(AnalyticsEventName.BUDGET_TRACKED, userId, {
      project_id: projectId,
      savings_amount: summary.savings_amount,
      savings_percent: summary.savings_percent,
    });

    return summary;
  }

  private computeBudgetSummary(
    shoppingList: ShoppingList,
    estimationItems: {
      material_id: string;
      theoretical_qty: number;
      packaging_qty_per_unit: number;
    }[],
  ): BudgetSummary {
    const CATEGORY_LABELS: Record<string, string> = {
      painting: 'Peinture',
      tiling: 'Carrelage',
      flooring: 'Parquet / Sol',
      partition: 'Cloison',
      wall_covering: 'Revêtement mural',
    };

    // Coût « brut » = acheteur naïf : 10 % de perte forfaitaire, arrondi au
    // conditionnement PAR pièce (donc SANS mutualisation). L'écart réel↔brut
    // capture ainsi le gain des facteurs de perte ET de la mutualisation ENG-2.
    // Somme des unités naïves par matériau sur toutes les lignes granulaires.
    const bruteUnitsByMaterial = new Map<string, number>();
    for (const item of estimationItems) {
      const bruteAdjustedQty =
        item.theoretical_qty * (1 + DEFAULT_WASTE_PERCENT / 100);
      const bruteUnits = Math.ceil(
        bruteAdjustedQty / item.packaging_qty_per_unit,
      );
      bruteUnitsByMaterial.set(
        item.material_id,
        (bruteUnitsByMaterial.get(item.material_id) ?? 0) + bruteUnits,
      );
    }

    const categoryTotals = new Map<
      string,
      { real_cost: number; brute_cost: number }
    >();
    let totalRealCost = 0;
    let totalBruteCost = 0;
    let itemsPriced = 0;

    const materialItems = shoppingList.items_json.material_items;
    const complementaryItems =
      shoppingList.items_json.complementary_items.filter((c) => !c.is_removed);

    for (const item of materialItems) {
      if (item.real_unit_price == null) continue;
      itemsPriced++;

      const realCost = item.real_unit_price * item.units_needed;
      totalRealCost += realCost;

      // Coût brut : unités naïves cumulées de ce matériau × prix réel.
      const bruteUnits = bruteUnitsByMaterial.get(item.material_id);
      const bruteCost =
        bruteUnits !== undefined ? item.real_unit_price * bruteUnits : realCost;
      totalBruteCost += bruteCost;

      const cat = item.material_category;
      const existing = categoryTotals.get(cat) || {
        real_cost: 0,
        brute_cost: 0,
      };
      existing.real_cost += realCost;
      existing.brute_cost += bruteCost;
      categoryTotals.set(cat, existing);
    }

    // Complementary items contribute to real cost only (no brute concept)
    for (const item of complementaryItems) {
      if (item.real_unit_price == null) continue;
      itemsPriced++;
      const realCost = item.real_unit_price * item.quantity;
      totalRealCost += realCost;
      totalBruteCost += realCost; // same for complementary
    }

    const itemsTotal = materialItems.length + complementaryItems.length;

    const savingsAmount =
      Math.round((totalBruteCost - totalRealCost) * 100) / 100;
    const savingsPercent =
      totalBruteCost > 0
        ? Math.round((savingsAmount / totalBruteCost) * 10000) / 100
        : 0;

    const byCategory: CategoryBreakdown[] = Array.from(
      categoryTotals.entries(),
    ).map(([category, totals]) => ({
      category,
      label: CATEGORY_LABELS[category] || category,
      real_cost: Math.round(totals.real_cost * 100) / 100,
      brute_cost: Math.round(totals.brute_cost * 100) / 100,
    }));

    return {
      total_real_cost: Math.round(totalRealCost * 100) / 100,
      total_brute_cost: Math.round(totalBruteCost * 100) / 100,
      savings_amount: savingsAmount,
      savings_percent: savingsPercent,
      items_priced: itemsPriced,
      items_total: itemsTotal,
      is_complete: itemsPriced === itemsTotal,
      by_category: byCategory,
      computed_at: new Date().toISOString(),
    };
  }

  async generateShareToken(
    projectId: string,
    userId: string,
  ): Promise<{ share_token: string }> {
    await this.projectsService.findOneByUser(projectId, userId);

    const shoppingList = await this.shoppingListRepo.findOne({
      where: { project_id: projectId },
    });

    if (!shoppingList) {
      throw new NotFoundException(
        'No shopping list found for this project. Generate one first.',
      );
    }

    if (shoppingList.share_token) {
      return { share_token: shoppingList.share_token };
    }

    const token = randomBytes(32).toString('hex');
    shoppingList.share_token = token;
    shoppingList.share_token_created_at = new Date();
    await this.shoppingListRepo.save(shoppingList);

    return { share_token: token };
  }

  async revokeShareToken(projectId: string, userId: string): Promise<void> {
    await this.projectsService.findOneByUser(projectId, userId);

    const shoppingList = await this.shoppingListRepo.findOne({
      where: { project_id: projectId },
    });

    if (!shoppingList) {
      throw new NotFoundException('No shopping list found for this project.');
    }

    shoppingList.share_token = null;
    shoppingList.share_token_created_at = null;
    await this.shoppingListRepo.save(shoppingList);
  }

  async findByShareToken(token: string): Promise<ShoppingList> {
    const shoppingList = await this.shoppingListRepo.findOne({
      where: { share_token: token },
      relations: ['project', 'project.rooms', 'project.rooms.dimensions'],
    });

    if (!shoppingList) {
      throw new NotFoundException(
        'Shopping list not found or link has expired.',
      );
    }

    return shoppingList;
  }

  async saveEntity(entity: ShoppingList): Promise<ShoppingList> {
    return this.shoppingListRepo.save(entity);
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

    // Format de carreau : 1er work item carrelage trouvé, toutes pièces
    // confondues (hypothèse mono-format documentée — multi-format = passe
    // ultérieure).
    const rooms = await this.projectsService.getRooms(projectId, userId);
    const tilingWorkItem = rooms
      .flatMap((r) => r.workItems || [])
      .find((wi) => wi.work_type.category === 'tiling');

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
