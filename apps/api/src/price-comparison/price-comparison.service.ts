import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SupplierPriceCache } from './entities/supplier-price-cache.entity';
import { SupplierRegistry } from './adapters/supplier-registry';
import type {
  SupplierAdapter,
  SupplierLookupItem,
  SupplierPriceResult,
} from './adapters/supplier-adapter.interface';
import type {
  ItemPriceComparison,
  PriceComparisonResponseDto,
  SupplierTotal,
} from './dto/compare-prices-response.dto';
import type { ItemSupplierSelectionDto } from './dto/apply-selections-request.dto';
import type { BuyLinkItem } from './dto/buy-links-response.dto';
import { ShoppingListsService } from '../shopping-lists/shopping-lists.service';
import type { ShoppingListMaterialItem } from '../shopping-lists/entities/shopping-list.entity';
import { SHOPPING_LIST_ENGINE_CORRECTED } from './shopping-list-engine-status';

@Injectable()
export class PriceComparisonService {
  private readonly logger = new Logger(PriceComparisonService.name);
  private readonly cacheTtlHours: number;

  constructor(
    @InjectRepository(SupplierPriceCache)
    private readonly cacheRepo: Repository<SupplierPriceCache>,
    private readonly supplierRegistry: SupplierRegistry,
    private readonly shoppingListsService: ShoppingListsService,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtlHours = this.configService.get<number>(
      'priceComparison.cacheTtlHours',
      24,
    );
  }

  async comparePrices(
    projectId: string,
    organizationId: string,
    userId: string,
    postalCode?: string,
  ): Promise<PriceComparisonResponseDto> {
    const { shoppingList } = await this.shoppingListsService.getOrGenerate(
      projectId,
      organizationId,
      userId,
    );

    const materialItems = shoppingList.items_json.material_items;
    if (materialItems.length === 0) {
      return {
        items: [],
        supplier_totals: [],
        optimized_total: 0,
        fetched_at: new Date().toISOString(),
        cache_expires_at: this.computeExpiresAt().toISOString(),
      };
    }

    const lookupItems = this.toLookupItems(materialItems);
    const supplierPriceMaps = await this.fetchSupplierPriceMaps(
      lookupItems,
      postalCode,
    );

    // Assemble per-item comparison
    const items: ItemPriceComparison[] = materialItems.map((item) => {
      const prices = this.collectSortedPrices(
        item.material_id,
        supplierPriceMaps,
      );
      const bestAvailable = prices.find((p) => p.availability !== 'not_found');

      return {
        material_id: item.material_id,
        work_item_id: item.work_item_id,
        material_name: item.material_name,
        material_unit: item.material_unit,
        units_needed: item.units_needed,
        prices,
        best_supplier_key: bestAvailable?.supplier_key ?? null,
      };
    });

    // Compute per-supplier totals
    const supplierTotals: SupplierTotal[] = supplierPriceMaps.map(
      ({ adapter, prices }) => {
        let totalCost = 0;
        let itemsAvailable = 0;
        for (const item of materialItems) {
          const price = prices.get(item.material_id);
          if (price && price.availability !== 'not_found') {
            totalCost += price.unit_price * item.units_needed;
            itemsAvailable++;
          }
        }
        return {
          supplier_key: adapter.supplierKey,
          supplier_name: adapter.supplierName,
          total_cost: +totalCost.toFixed(2),
          items_available: itemsAvailable,
          items_total: materialItems.length,
        };
      },
    );
    supplierTotals.sort((a, b) => a.total_cost - b.total_cost);

    // Optimized total = cheapest available per item
    let optimizedTotal = 0;
    for (const item of items) {
      const best = item.prices.find((p) => p.availability !== 'not_found');
      if (best) {
        optimizedTotal += best.unit_price * item.units_needed;
      }
    }

    const expiresAt = this.computeExpiresAt();

    return {
      items,
      supplier_totals: supplierTotals,
      optimized_total: +optimizedTotal.toFixed(2),
      fetched_at: new Date().toISOString(),
      cache_expires_at: expiresAt.toISOString(),
    };
  }

  async applySelections(
    projectId: string,
    organizationId: string,
    userId: string,
    selections: ItemSupplierSelectionDto[],
  ): Promise<void> {
    const { shoppingList } = await this.shoppingListsService.getOrGenerate(
      projectId,
      organizationId,
      userId,
    );

    const materialItems = [...shoppingList.items_json.material_items];
    let updated = false;

    for (const sel of selections) {
      // Find the cached price for this selection
      const cached = await this.cacheRepo.findOne({
        where: {
          supplier_key: sel.supplier_key,
          material_id: sel.material_id,
          expires_at: MoreThan(new Date()),
        },
      });

      if (!cached) {
        this.logger.warn(
          `No cached price for supplier=${sel.supplier_key} material=${sel.material_id}`,
        );
        continue;
      }

      // ENG-2 : les lignes d'achat sont mutualisées par matériau ; le
      // matching se fait sur `material_id` seul (cf. MaterialItemUpdateDto).
      const itemIdx = materialItems.findIndex(
        (m) => m.material_id === sel.material_id,
      );
      if (itemIdx >= 0) {
        materialItems[itemIdx] = {
          ...materialItems[itemIdx],
          real_unit_price: cached.price_data.unit_price,
          store_name:
            cached.price_data.store_name ?? cached.price_data.supplier_name,
        };
        updated = true;
      }
    }

    if (updated) {
      shoppingList.items_json = {
        ...shoppingList.items_json,
        material_items: materialItems,
      };
      await this.shoppingListsService.saveEntity(shoppingList);
    }
  }

  /**
   * BACKLOG BUY-3 : un lien affilié « acheter chez X » par ligne, disponible
   * sans feature gate (y compris tier Free) — contrairement à `comparePrices`
   * /`applySelections`. Réutilise l'adaptateur BUY-1 (même cache
   * `supplier_price_cache`) : rien n'est recalculé ni persisté en plus.
   *
   * Un seul lien par ligne, celui du fournisseur disponible le moins cher —
   * même critère que `best_supplier_key` ci-dessus. Une ligne `not_found`
   * (aucun rapprochement marchand exploitable) n'apparaît simplement pas.
   *
   * E5-4 : gardé par `SHOPPING_LIST_ENGINE_CORRECTED` — voir
   * `shopping-list-engine-status.ts`. Tant qu'il vaut `false`, cette
   * méthode ne rend jamais aucun lien, quel que soit l'état des flux
   * marchands.
   */
  async getBuyLinks(
    projectId: string,
    organizationId: string,
    userId: string,
  ): Promise<BuyLinkItem[]> {
    if (!SHOPPING_LIST_ENGINE_CORRECTED) {
      return [];
    }

    const { shoppingList } = await this.shoppingListsService.getOrGenerate(
      projectId,
      organizationId,
      userId,
    );

    const materialItems = shoppingList.items_json.material_items;
    if (materialItems.length === 0) {
      return [];
    }

    const lookupItems = this.toLookupItems(materialItems);
    const supplierPriceMaps = await this.fetchSupplierPriceMaps(lookupItems);

    const links: BuyLinkItem[] = [];
    for (const item of materialItems) {
      const prices = this.collectSortedPrices(
        item.material_id,
        supplierPriceMaps,
      );
      const best = prices.find(
        (p) => p.availability !== 'not_found' && p.product_url,
      );
      if (best && best.product_url) {
        links.push({
          material_id: item.material_id,
          supplier_key: best.supplier_key,
          supplier_name: best.supplier_name,
          url: best.product_url,
        });
      }
    }
    return links;
  }

  // ──────────────────────────────────────────────────────

  private async fetchSupplierPriceMaps(
    items: SupplierLookupItem[],
    postalCode?: string,
  ): Promise<
    { adapter: SupplierAdapter; prices: Map<string, SupplierPriceResult> }[]
  > {
    const adapters = this.supplierRegistry.getAllAdapters();

    const adapterResults = await Promise.allSettled(
      adapters.map((adapter) =>
        this.getCachedOrFetch(adapter, items, postalCode),
      ),
    );

    const supplierPriceMaps: {
      adapter: SupplierAdapter;
      prices: Map<string, SupplierPriceResult>;
    }[] = [];
    for (let i = 0; i < adapters.length; i++) {
      const result = adapterResults[i];
      if (result.status === 'fulfilled') {
        supplierPriceMaps.push({ adapter: adapters[i], prices: result.value });
      } else {
        this.logger.warn(
          `Adapter ${adapters[i].supplierKey} failed: ${result.reason}`,
        );
      }
    }
    return supplierPriceMaps;
  }

  private collectSortedPrices(
    materialId: string,
    supplierPriceMaps: {
      adapter: SupplierAdapter;
      prices: Map<string, SupplierPriceResult>;
    }[],
  ): SupplierPriceResult[] {
    const prices: SupplierPriceResult[] = [];
    for (const { prices: priceMap } of supplierPriceMaps) {
      const price = priceMap.get(materialId);
      if (price) {
        prices.push(price);
      }
    }
    prices.sort((a, b) => {
      if (a.availability === 'not_found' && b.availability !== 'not_found')
        return 1;
      if (b.availability === 'not_found' && a.availability !== 'not_found')
        return -1;
      return a.unit_price - b.unit_price;
    });
    return prices;
  }

  private async getCachedOrFetch(
    adapter: SupplierAdapter,
    items: SupplierLookupItem[],
    postalCode?: string,
  ): Promise<Map<string, SupplierPriceResult>> {
    const now = new Date();
    const materialIds = items.map((i) => i.material_id);

    // Check cache
    const cached = await this.cacheRepo
      .createQueryBuilder('c')
      .where('c.supplier_key = :key', { key: adapter.supplierKey })
      .andWhere('c.material_id IN (:...ids)', { ids: materialIds })
      .andWhere('c.expires_at > :now', { now })
      .andWhere(
        postalCode ? 'c.postal_code = :postalCode' : 'c.postal_code IS NULL',
        postalCode ? { postalCode } : {},
      )
      .getMany();

    const cachedMap = new Map<string, SupplierPriceResult>();
    for (const entry of cached) {
      cachedMap.set(entry.material_id, entry.price_data);
    }

    // Determine uncached items
    const uncachedItems = items.filter((i) => !cachedMap.has(i.material_id));

    if (uncachedItems.length > 0) {
      const fetched = await adapter.lookupPrices(uncachedItems, postalCode);
      const expiresAt = this.computeExpiresAt();

      // Store in cache
      const cacheEntries: Partial<SupplierPriceCache>[] = [];
      for (const [materialId, priceResult] of fetched) {
        cachedMap.set(materialId, priceResult);
        const item = uncachedItems.find((i) => i.material_id === materialId);
        cacheEntries.push({
          supplier_key: adapter.supplierKey,
          material_id: materialId,
          material_name: item?.material_name ?? priceResult.product_name,
          price_data: priceResult,
          postal_code: postalCode ?? null,
          expires_at: expiresAt,
        });
      }

      if (cacheEntries.length > 0) {
        await this.cacheRepo
          .createQueryBuilder()
          .insert()
          .into(SupplierPriceCache)
          .values(cacheEntries)
          .orIgnore()
          .execute();
      }
    }

    return cachedMap;
  }

  private toLookupItems(
    materialItems: ShoppingListMaterialItem[],
  ): SupplierLookupItem[] {
    return materialItems.map((item) => ({
      material_id: item.material_id,
      material_name: item.material_name,
      material_category: item.material_category,
      material_unit: item.material_unit,
      packaging_label: item.packaging_label,
      packaging_qty_per_unit: item.packaging_qty_per_unit,
      units_needed: item.units_needed,
    }));
  }

  private computeExpiresAt(): Date {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.cacheTtlHours);
    return expiresAt;
  }
}
