import type { EstimationLineItem } from '@/lib/estimation-types';

export function makeLineItem(
  overrides?: Partial<EstimationLineItem>,
): EstimationLineItem {
  return {
    work_item_id: 'wi-1',
    work_type_code: 'wall_painting',
    work_type_label: 'Peinture murale',
    material_id: 'mat-1',
    material_name: 'Peinture acrylique mate',
    material_unit: 'L',
    gross_surface_m2: 35,
    surface_m2: 31.964,
    theoretical_qty: 5.812,
    waste_factor_percent: 15,
    waste_factor_source: 'catalog',
    adjusted_qty: 6.684,
    packaging_label: 'Pot 2.5 L',
    packaging_qty_per_unit: 2.5,
    units_needed: 3,
    pose_type: 'standard',
    number_of_coats: 2,
    ...overrides,
  };
}

export function makeFloorTilingItem(
  overrides?: Partial<EstimationLineItem>,
): EstimationLineItem {
  return makeLineItem({
    work_item_id: 'wi-2',
    work_type_code: 'floor_tiling',
    work_type_label: 'Carrelage sol',
    material_id: 'mat-2',
    material_name: 'Carrelage grès cérame 30x30',
    material_unit: 'm2',
    gross_surface_m2: 12,
    surface_m2: 12,
    theoretical_qty: 12,
    waste_factor_percent: 15,
    waste_factor_source: 'catalog',
    adjusted_qty: 13.8,
    packaging_label: 'Carton 1.08 m²',
    packaging_qty_per_unit: 1.08,
    units_needed: 13,
    pose_type: 'straight',
    number_of_coats: undefined,
    ...overrides,
  });
}

export function makeMultiWorkTypeItems(): EstimationLineItem[] {
  return [
    makeLineItem(),
    makeFloorTilingItem(),
  ];
}
