import { Injectable } from '@nestjs/common';
import { EstimationLineItem } from './entities/estimation-result.entity';

export interface RoomData {
  length_cm: number;
  width_cm: number;
  height_cm: number;
  openings: { width_cm: number; height_cm: number; count: number }[];
}

export interface PackagingInput {
  label: string;
  quantity_per_unit: number;
  unit: string;
}

export interface WasteFactorInput {
  pose_type: string;
  skill_level: string;
  factor_percent: number;
}

export interface MaterialInput {
  id: string;
  name: string;
  unit: string;
  yield_per_unit: number;
  waste_factors: WasteFactorInput[];
  packagings: PackagingInput[];
}

export interface WorkItemInput {
  id: string;
  work_type_code: string;
  work_type_label: string;
  category: string;
  surface_target: string;
  skill_level: string;
  custom_params: Record<string, unknown>;
  materials: MaterialInput[];
}

export interface ResolvedWasteFactor {
  percent: number;
  source: 'catalog' | 'default';
}

export interface SelectedPackaging {
  label: string;
  qty_per_unit: number;
  units_needed: number;
}

const CM2_TO_M2 = 10_000;
export const DEFAULT_WASTE_PERCENT = 10;
const DEFAULT_COATS = 2;

@Injectable()
export class EstimationEngine {
  computeSurface(room: RoomData, surfaceTarget: string): number {
    switch (surfaceTarget) {
      case 'wall': {
        const grossWall = 2 * (room.length_cm + room.width_cm) * room.height_cm;
        const openingsArea = room.openings.reduce(
          (sum, o) => sum + o.width_cm * o.height_cm * o.count,
          0,
        );
        return Math.max(0, grossWall - openingsArea) / CM2_TO_M2;
      }
      case 'floor':
      case 'ceiling':
        return (room.length_cm * room.width_cm) / CM2_TO_M2;
      default:
        return (room.length_cm * room.width_cm) / CM2_TO_M2;
    }
  }

  resolveWasteFactor(
    wasteFactors: WasteFactorInput[],
    poseType: string,
    skillLevel: string,
  ): ResolvedWasteFactor {
    // Exact match on (pose_type, skill_level)
    const exact = wasteFactors.find(
      (wf) => wf.pose_type === poseType && wf.skill_level === skillLevel,
    );
    if (exact) {
      return { percent: Number(exact.factor_percent), source: 'catalog' };
    }

    // Fallback: standard pose_type with same skill_level
    const standard = wasteFactors.find(
      (wf) => wf.pose_type === 'standard' && wf.skill_level === skillLevel,
    );
    if (standard) {
      return { percent: Number(standard.factor_percent), source: 'catalog' };
    }

    // Default
    return { percent: DEFAULT_WASTE_PERCENT, source: 'default' };
  }

  computeTheoreticalQty(
    surfaceM2: number,
    yieldPerUnit: number,
    customParams: Record<string, unknown>,
    category: string,
  ): { qty: number; coats?: number } {
    const yield_ = Number(yieldPerUnit);
    let qty = surfaceM2 / yield_;

    if (category === 'painting') {
      const coats = Number(customParams.number_of_coats) || DEFAULT_COATS;
      qty *= coats;
      return { qty, coats };
    }

    return { qty };
  }

  selectBestPackaging(
    adjustedQty: number,
    packagings: PackagingInput[],
  ): SelectedPackaging {
    if (packagings.length === 0) {
      return {
        label: '-',
        qty_per_unit: 1,
        units_needed: Math.ceil(adjustedQty),
      };
    }

    let best: SelectedPackaging | null = null;
    let bestSurplus = Infinity;

    for (const pkg of packagings) {
      const qtyPerUnit = Number(pkg.quantity_per_unit);
      const unitsNeeded = Math.ceil(adjustedQty / qtyPerUnit);
      const surplus = unitsNeeded * qtyPerUnit - adjustedQty;

      if (
        surplus < bestSurplus ||
        (surplus === bestSurplus && best && unitsNeeded < best.units_needed)
      ) {
        best = {
          label: pkg.label,
          qty_per_unit: qtyPerUnit,
          units_needed: unitsNeeded,
        };
        bestSurplus = surplus;
      }
    }

    return best!;
  }

  computeGrossSurface(room: RoomData, surfaceTarget: string): number {
    switch (surfaceTarget) {
      case 'wall':
        return (
          (2 * (room.length_cm + room.width_cm) * room.height_cm) / CM2_TO_M2
        );
      case 'floor':
      case 'ceiling':
      default:
        return (room.length_cm * room.width_cm) / CM2_TO_M2;
    }
  }

  computeEstimation(
    room: RoomData,
    workItems: WorkItemInput[],
  ): EstimationLineItem[] {
    const items: EstimationLineItem[] = [];

    for (const wi of workItems) {
      const surfaceM2 = this.computeSurface(room, wi.surface_target);
      const grossSurfaceM2 = this.computeGrossSurface(room, wi.surface_target);
      const poseType =
        (wi.custom_params.laying_pattern as string) || 'standard';

      for (const mat of wi.materials) {
        const wasteFactor = this.resolveWasteFactor(
          mat.waste_factors,
          poseType,
          wi.skill_level,
        );

        const { qty: theoreticalQty, coats } = this.computeTheoreticalQty(
          surfaceM2,
          mat.yield_per_unit,
          wi.custom_params,
          wi.category,
        );

        const adjustedQty = theoreticalQty * (1 + wasteFactor.percent / 100);

        const packaging = this.selectBestPackaging(adjustedQty, mat.packagings);

        items.push({
          work_item_id: wi.id,
          work_type_code: wi.work_type_code,
          work_type_label: wi.work_type_label,
          material_id: mat.id,
          material_name: mat.name,
          material_unit: mat.unit,
          gross_surface_m2: Math.round(grossSurfaceM2 * 1000) / 1000,
          surface_m2: Math.round(surfaceM2 * 1000) / 1000,
          theoretical_qty: Math.round(theoreticalQty * 1000) / 1000,
          waste_factor_percent: wasteFactor.percent,
          waste_factor_source: wasteFactor.source,
          adjusted_qty: Math.round(adjustedQty * 1000) / 1000,
          packaging_label: packaging.label,
          packaging_qty_per_unit: packaging.qty_per_unit,
          units_needed: packaging.units_needed,
          pose_type: poseType,
          ...(coats !== undefined ? { number_of_coats: coats } : {}),
        });
      }
    }

    return items;
  }
}
