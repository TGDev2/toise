import type { SupplierPriceResult } from '../adapters/supplier-adapter.interface';

export interface ItemPriceComparison {
  material_id: string;
  // ENG-2 : optionnel (lignes mutualisées par matériau) ; le matching prix se
  // fait sur material_id.
  work_item_id?: string;
  material_name: string;
  material_unit: string;
  units_needed: number;
  prices: SupplierPriceResult[];
  best_supplier_key: string | null;
}

export interface SupplierTotal {
  supplier_key: string;
  supplier_name: string;
  total_cost: number;
  items_available: number;
  items_total: number;
}

export interface PriceComparisonResponseDto {
  items: ItemPriceComparison[];
  supplier_totals: SupplierTotal[];
  optimized_total: number;
  fetched_at: string;
  cache_expires_at: string;
}
