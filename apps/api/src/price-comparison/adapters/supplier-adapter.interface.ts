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

export interface SupplierLookupItem {
  material_id: string;
  material_name: string;
  material_category: string;
  material_unit: string;
  units_needed: number;
}

export interface SupplierAdapter {
  readonly supplierKey: string;
  readonly supplierName: string;

  lookupPrices(
    items: SupplierLookupItem[],
    postalCode?: string,
  ): Promise<Map<string, SupplierPriceResult>>;

  healthCheck(): Promise<boolean>;
}
