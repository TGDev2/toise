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
  /**
   * Conditionnement retenu par le devis (« Pot 2.5 L », « Sac 25 kg »).
   *
   * `units_needed` compte des colis à ce format, et le service multiplie
   * `unit_price * units_needed` : un adaptateur doit donc pouvoir ramener le
   * prix du marchand à ce conditionnement-là, sans quoi le total n'a pas de
   * sens.
   */
  packaging_label: string;
  packaging_qty_per_unit: number;
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
