export interface SupplierPriceResult {
  supplier_key: string;
  supplier_name: string;
  product_name: string;
  unit_price: number;
  currency: string;
  availability: 'in_stock' | 'limited' | 'out_of_stock' | 'not_found';
  store_name?: string;
  store_distance_km?: number;
  product_url?: string;
  fetched_at: string;
}

export interface ItemPriceComparison {
  material_id: string;
  work_item_id: string;
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

export interface PriceComparisonResponse {
  items: ItemPriceComparison[];
  supplier_totals: SupplierTotal[];
  optimized_total: number;
  fetched_at: string;
  cache_expires_at: string;
}

export interface ItemSupplierSelection {
  material_id: string;
  work_item_id: string;
  supplier_key: string;
}
