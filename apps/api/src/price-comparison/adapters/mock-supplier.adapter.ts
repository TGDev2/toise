import { Injectable } from '@nestjs/common';
import type {
  SupplierAdapter,
  SupplierLookupItem,
  SupplierPriceResult,
} from './supplier-adapter.interface';

/** Simple string hash to produce deterministic but varied mock prices. */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const MOCK_SUPPLIERS = [
  { key: 'home_depot_mock', name: 'Home Depot (mock)', baseMultiplier: 1.0 },
  { key: 'lowes_mock', name: "Lowe's (mock)", baseMultiplier: 1.05 },
  {
    key: 'local_mock',
    name: 'Quincaillerie Locale (mock)',
    baseMultiplier: 0.95,
  },
] as const;

const BASE_PRICES: Record<string, number> = {
  painting: 35,
  tiling: 28,
  flooring: 42,
  partition: 18,
  wall_covering: 22,
};

@Injectable()
export class MockSupplierAdapter implements SupplierAdapter {
  readonly supplierKey: string;
  readonly supplierName: string;
  private readonly baseMultiplier: number;

  constructor(key?: string) {
    const config =
      MOCK_SUPPLIERS.find((s) => s.key === key) ?? MOCK_SUPPLIERS[0];
    this.supplierKey = config.key;
    this.supplierName = config.name;
    this.baseMultiplier = config.baseMultiplier;
  }

  lookupPrices(
    items: SupplierLookupItem[],
    _postalCode?: string,
  ): Promise<Map<string, SupplierPriceResult>> {
    const results = new Map<string, SupplierPriceResult>();

    for (const item of items) {
      const basePrice = BASE_PRICES[item.material_category] ?? 30;
      const variance =
        ((hashCode(item.material_name + this.supplierKey) % 30) - 15) / 100;
      const unitPrice = +(
        basePrice *
        this.baseMultiplier *
        (1 + variance)
      ).toFixed(2);

      results.set(item.material_id, {
        supplier_key: this.supplierKey,
        supplier_name: this.supplierName,
        product_name: item.material_name,
        unit_price: unitPrice,
        currency: 'CAD',
        availability: 'in_stock',
        store_name: `${this.supplierName} — Succursale Centre`,
        store_distance_km: +(2 + (hashCode(item.material_id) % 15)).toFixed(1),
        fetched_at: new Date().toISOString(),
      });
    }

    return Promise.resolve(results);
  }

  healthCheck(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
