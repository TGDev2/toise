import { Injectable } from '@nestjs/common';
import {
  EstimationLineItem,
  AggregatedMaterialLine,
  PurchaseContribution,
} from './entities/estimation-result.entity';
import { RectSegment, unionAreaCm2, unionPerimeterCm } from './room-geometry';

export interface SurfaceExclusionInput {
  surface_target: string;
  area_m2: number;
}

export interface RoomData {
  length_cm: number;
  width_cm: number;
  height_cm: number;
  openings: { width_cm: number; height_cm: number; count: number }[];
  /**
   * Décomposition en rectangles d'une pièce non rectangulaire (L, T, U…).
   * Absent ou vide → la pièce est un simple rectangle `length_cm × width_cm`.
   */
  segments?: RectSegment[];
  /**
   * Zones non traitées à déduire d'une surface (ENG-3 : crédence, demi-mur,
   * plinthes…). Déduction manuelle d'une aire, filtrée par `surface_target`.
   */
  exclusions?: SurfaceExclusionInput[];
  /**
   * Incertitude de mesure (cm) par dimension (CV-5), absente/0 pour une
   * pièce sans incertitude connue (saisie manuelle, ou legacy). Pilote la
   * fourchette basse/haute des surfaces et quantités — cf. `computeSurfaceBounds`.
   */
  length_cm_uncertainty?: number;
  width_cm_uncertainty?: number;
  height_cm_uncertainty?: number;
}

export interface SurfaceBounds {
  low: number;
  high: number;
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
  /**
   * Rectangles composant la pièce. Une pièce sans `segments` est traitée comme
   * un unique rectangle `length_cm × width_cm` : l'aire vaut alors L×l et le
   * périmètre 2(L+l), strictement identique à l'ancien calcul rectangulaire.
   */
  private resolveSegments(room: RoomData): RectSegment[] {
    if (room.segments && room.segments.length > 0) {
      return room.segments;
    }
    return [
      {
        x_cm: 0,
        y_cm: 0,
        length_cm: room.length_cm,
        width_cm: room.width_cm,
      },
    ];
  }

  private openingsAreaCm2(room: RoomData): number {
    return room.openings.reduce(
      (sum, o) => sum + o.width_cm * o.height_cm * o.count,
      0,
    );
  }

  private excludedAreaCm2(room: RoomData, surfaceTarget: string): number {
    return (room.exclusions ?? [])
      .filter((e) => e.surface_target === surfaceTarget)
      .reduce((sum, e) => sum + e.area_m2 * CM2_TO_M2, 0);
  }

  computeSurface(room: RoomData, surfaceTarget: string): number {
    const segments = this.resolveSegments(room);
    const excludedCm2 = this.excludedAreaCm2(room, surfaceTarget);
    switch (surfaceTarget) {
      case 'wall': {
        const grossWall = unionPerimeterCm(segments) * room.height_cm;
        const netWall = grossWall - this.openingsAreaCm2(room);
        return Math.max(0, netWall - excludedCm2) / CM2_TO_M2;
      }
      case 'floor':
      case 'ceiling':
      default:
        return Math.max(0, unionAreaCm2(segments) - excludedCm2) / CM2_TO_M2;
    }
  }

  /**
   * Fourchette basse/haute de `computeSurface` (CV-5) : bornes pire-cas
   * obtenues en évaluant `computeSurface` sur la pièce dont les dimensions
   * sont respectivement `-Δ` et `+Δ` (Δ = incertitude par champ, clampée à
   * ≥ 0). Exact et pas seulement approché, car toutes les formules de
   * surface (aire/périmètre union, mur = périmètre × hauteur) sont monotones
   * croissantes en chaque dimension. Ouvertures/exclusions restent fixes
   * (aucune donnée d'incertitude sur ces champs). `null` si la pièce n'a
   * aucune incertitude connue — pas de fourchette à afficher.
   *
   * Limite assumée : pour une pièce composite (`segments` ENG-1),
   * `length_cm`/`width_cm` ne pilotent plus `computeSurface` (les segments
   * priment) → fourchette nulle en sol/plafond ; seule la hauteur continue
   * de produire une fourchette murale.
   */
  computeSurfaceBounds(
    room: RoomData,
    surfaceTarget: string,
  ): SurfaceBounds | null {
    const dl = room.length_cm_uncertainty ?? 0;
    const dw = room.width_cm_uncertainty ?? 0;
    const dh = room.height_cm_uncertainty ?? 0;
    if (dl <= 0 && dw <= 0 && dh <= 0) {
      return null;
    }

    const lowRoom: RoomData = {
      ...room,
      length_cm: Math.max(0, room.length_cm - dl),
      width_cm: Math.max(0, room.width_cm - dw),
      height_cm: Math.max(0, room.height_cm - dh),
    };
    const highRoom: RoomData = {
      ...room,
      length_cm: room.length_cm + dl,
      width_cm: room.width_cm + dw,
      height_cm: room.height_cm + dh,
    };

    return {
      low: this.computeSurface(lowRoom, surfaceTarget),
      high: this.computeSurface(highRoom, surfaceTarget),
    };
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
    const segments = this.resolveSegments(room);
    switch (surfaceTarget) {
      case 'wall':
        return (unionPerimeterCm(segments) * room.height_cm) / CM2_TO_M2;
      case 'floor':
      case 'ceiling':
      default:
        return unionAreaCm2(segments) / CM2_TO_M2;
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
      const excludedSurfaceM2 =
        this.excludedAreaCm2(room, wi.surface_target) / CM2_TO_M2;
      const surfaceBounds = this.computeSurfaceBounds(room, wi.surface_target);
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

        // CV-5 : mêmes calculs aux bornes basse/haute de la surface, quand
        // la pièce porte une incertitude de mesure connue.
        let rangeFields: Partial<EstimationLineItem> = {};
        if (surfaceBounds) {
          const adjustedQtyLow =
            this.computeTheoreticalQty(
              surfaceBounds.low,
              mat.yield_per_unit,
              wi.custom_params,
              wi.category,
            ).qty *
            (1 + wasteFactor.percent / 100);
          const adjustedQtyHigh =
            this.computeTheoreticalQty(
              surfaceBounds.high,
              mat.yield_per_unit,
              wi.custom_params,
              wi.category,
            ).qty *
            (1 + wasteFactor.percent / 100);

          const packagingLow = this.selectBestPackaging(
            adjustedQtyLow,
            mat.packagings,
          );
          const packagingHigh = this.selectBestPackaging(
            adjustedQtyHigh,
            mat.packagings,
          );

          rangeFields = {
            surface_m2_low: Math.round(surfaceBounds.low * 1000) / 1000,
            surface_m2_high: Math.round(surfaceBounds.high * 1000) / 1000,
            adjusted_qty_low: Math.round(adjustedQtyLow * 1000) / 1000,
            adjusted_qty_high: Math.round(adjustedQtyHigh * 1000) / 1000,
            units_needed_low: packagingLow.units_needed,
            units_needed_high: packagingHigh.units_needed,
          };
        }

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
          ...(excludedSurfaceM2 > 0
            ? {
                excluded_surface_m2:
                  Math.round(excludedSurfaceM2 * 1000) / 1000,
              }
            : {}),
          ...rangeFields,
        });
      }
    }

    return items;
  }

  /**
   * Mutualise les lignes granulaires par `material_id` : somme les quantités
   * continues (`adjusted_qty`) à travers toutes les pièces et tous les work
   * items, puis sélectionne le conditionnement **une seule fois** sur le total.
   * Cœur de la promesse ENG-2 (`ceil(Σ) ≤ Σ ceil`). Fonction pure.
   */
  aggregatePurchases(
    lines: EstimationLineItem[],
    packagingByMaterialId: Map<string, PackagingInput[]>,
  ): AggregatedMaterialLine[] {
    const groups = new Map<string, EstimationLineItem[]>();
    for (const line of lines) {
      const group = groups.get(line.material_id);
      if (group) {
        group.push(line);
      } else {
        groups.set(line.material_id, [line]);
      }
    }

    const result: AggregatedMaterialLine[] = [];
    for (const [materialId, group] of groups) {
      const first = group[0];

      const totalAdjustedQty =
        Math.round(group.reduce((sum, l) => sum + l.adjusted_qty, 0) * 1000) /
        1000;

      const contributions: PurchaseContribution[] = group.map((l) => ({
        room_id: l.room_id,
        room_name: l.room_name,
        work_item_id: l.work_item_id,
        work_type_code: l.work_type_code,
        surface_m2: l.surface_m2,
        adjusted_qty: l.adjusted_qty,
      }));

      // Conditionnements du catalogue ; repli sur celui déjà sélectionné par la
      // ligne si le catalogue n'est pas fourni (estimation legacy).
      const packagings = packagingByMaterialId.get(materialId) ?? [
        {
          label: first.packaging_label,
          quantity_per_unit: first.packaging_qty_per_unit,
          unit: first.material_unit,
        },
      ];

      const packaging = this.selectBestPackaging(totalAdjustedQty, packagings);

      const distinctRooms = new Set(
        contributions
          .map((c) => c.room_id)
          .filter((id): id is string => id !== undefined),
      );

      // CV-5 : fourchette basse/haute, seulement si au moins une ligne du
      // groupe en porte une (sinon low/high seraient égaux à adjusted_qty
      // sur toute la ligne, une fourchette de largeur nulle sans intérêt).
      let rangeFields: Partial<AggregatedMaterialLine> = {};
      const hasRange = group.some((l) => l.adjusted_qty_low !== undefined);
      if (hasRange) {
        const totalLow = group.reduce(
          (sum, l) => sum + (l.adjusted_qty_low ?? l.adjusted_qty),
          0,
        );
        const totalHigh = group.reduce(
          (sum, l) => sum + (l.adjusted_qty_high ?? l.adjusted_qty),
          0,
        );
        rangeFields = {
          units_needed_low: this.selectBestPackaging(totalLow, packagings)
            .units_needed,
          units_needed_high: this.selectBestPackaging(totalHigh, packagings)
            .units_needed,
        };
      }

      result.push({
        material_id: materialId,
        material_name: first.material_name,
        material_unit: first.material_unit,
        work_type_code: first.work_type_code,
        work_type_label: first.work_type_label,
        total_adjusted_qty: totalAdjustedQty,
        packaging_label: packaging.label,
        packaging_qty_per_unit: packaging.qty_per_unit,
        units_needed: packaging.units_needed,
        room_count: distinctRooms.size || 1,
        contributions,
        ...rangeFields,
      });
    }

    return result;
  }
}
