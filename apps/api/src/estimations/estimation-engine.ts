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
  /**
   * Origine de la valeur. Absente = catalogue. `learned` marque une valeur
   * recalculée sur les achats réels (DATA-3), superposée au catalogue par
   * `overlayLearnedWasteFactors` avant l'appel au moteur.
   */
  source?: 'catalog' | 'learned';
}

export interface MaterialInput {
  id: string;
  name: string;
  unit: string;
  yield_per_unit: number;
  /**
   * E1-4 — la quantité de ce matériau est proportionnelle au nombre de couches
   * (`custom_params.number_of_coats`). Porté par le catalogue
   * (`materials_catalog.applies_coats`), jamais déduit de la catégorie de
   * l'ouvrage : une peinture et le pinceau qui l'applique sont tous deux des
   * matériaux `painting`, seule la première se multiplie par les couches.
   *
   * Absent = `false`, comme le défaut de la colonne : un appel qui ne renseigne
   * pas l'attribut ne fait pas de couches.
   */
  applies_coats?: boolean;
  /**
   * Rôle porté par la liaison ouvrage → matériau (E1-3). Absent pour les
   * appels qui ne passent pas par `work_type_materials` (tests legacy). Le
   * moteur ne s'en sert pas encore pour les quantités (E1-4) ; il permet déjà
   * d'exclure les accessoires de la fourchette de référence d'un devis.
   */
  role?: 'principal' | 'sous_couche' | 'consommable' | 'accessoire';
  waste_factors: WasteFactorInput[];
  packagings: PackagingInput[];
}

export interface WorkItemInput {
  id: string;
  work_type_code: string;
  work_type_label: string;
  /**
   * Famille de l'ouvrage, conservée pour la traçabilité de l'entrée et les
   * appelants qui la portent déjà. Le moteur ne l'utilise plus pour aucun
   * calcul depuis E1-4 : les règles de quantité sont portées par le matériau
   * (`MaterialInput.applies_coats`), jamais déduites de cette valeur.
   */
  category: string;
  surface_target: string;
  skill_level: string;
  custom_params: Record<string, unknown>;
  materials: MaterialInput[];
}

export interface ResolvedWasteFactor {
  percent: number;
  source: 'catalog' | 'default' | 'learned';
}

/** Un format et son nombre de contenants dans un achat (E1-5). */
export interface PackagingUnits {
  label: string;
  units: number;
}

export interface SelectedPackaging {
  label: string;
  qty_per_unit: number;
  units_needed: number;
  /**
   * Détail de l'achat, du plus grand format au plus petit. Un seul élément
   * quand un format suffit, vide quand il n'y a rien à acheter.
   */
  breakdown: PackagingUnits[];
}

const CM2_TO_M2 = 10_000;
export const DEFAULT_WASTE_PERCENT = 10;
/**
 * Couches appliquées quand `custom_params.number_of_coats` est absent. Exporté
 * parce que le harnais de non-régression doit diviser une quantité par le
 * nombre de couches réellement appliqué : recopier `2` de son côté ferait
 * diverger les deux valeurs le jour où celle-ci change.
 */
export const DEFAULT_COATS = 2;

/** Format de conditionnement normalisé pour le choix d'achat (E1-5). */
interface PackagingFormat {
  label: string;
  /** `quantity_per_unit` en millièmes d'unité — entier, base de tous les coûts. */
  steps: number;
}

const PACKAGING_SCALE = 1000;

/**
 * Plafond de la table de programmation dynamique. Au-delà, le gros de l'achat
 * part sur le plus grand format — le seul choix raisonnable à cette échelle —
 * et seul le reliquat est optimisé. Hors d'atteinte sur le catalogue réel
 * (formats à deux décimales → pas ≥ 0,01 → 100 000 pas = 1 000 unités de
 * besoin) : garde-fou contre une donnée aberrante, pas un compromis de calcul.
 */
const MAX_PACKAGING_STEPS = 100_000;

/**
 * Tolérance sur le besoin, en pas de la grille. Sans elle, 7,5 L — dont la
 * représentation flottante vaut 7500,000000000001 millièmes — demanderait
 * 16 demi-pots au lieu de 15.
 */
const STEP_EPSILON = 1e-6;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * Formats exploitables, dédoublonnés par taille et triés du plus grand au plus
 * petit. Les quantités nulles ou non numériques sont écartées ici, une fois,
 * plutôt que testées à chaque comparaison.
 */
const normalizePackagings = (
  packagings: PackagingInput[],
): PackagingFormat[] => {
  const bySteps = new Map<number, PackagingFormat>();
  for (const pkg of packagings) {
    const steps = Math.round(Number(pkg.quantity_per_unit) * PACKAGING_SCALE);
    if (!Number.isFinite(steps) || steps <= 0 || bySteps.has(steps)) {
      continue;
    }
    bySteps.set(steps, { label: pkg.label, steps });
  }
  return [...bySteps.values()].sort((a, b) => b.steps - a.steps);
};

/**
 * Nombre de contenants de chaque format, indexé comme `formats`, minimisant
 * `S = q_min × contenants + volume` sous contrainte `volume ≥ adjustedQty`.
 *
 * Programmation dynamique sur le pgcd des formats : tout format est un multiple
 * entier du pas, donc « couvrir le besoin » se dit exactement « couvrir
 * `ceil(besoin / pas)` pas », et tous les coûts comparés sont des entiers —
 * aucune dérive flottante ne peut départager deux achats.
 */
const solvePackagingMix = (
  adjustedQty: number,
  formats: PackagingFormat[],
): number[] => {
  const counts = new Array<number>(formats.length).fill(0);
  const step = formats.reduce((acc, f) => gcd(acc, f.steps), 0);
  const sizes = formats.map((f) => f.steps / step);
  const smallestSteps = formats[formats.length - 1].steps;
  // Coût d'un contenant : son contenu, plus le plus petit format offert — le
  // prix forfaitaire du contenant, exprimé dans la seule unité dont on dispose.
  const costs = formats.map((f) => smallestSteps + f.steps);

  let remaining = Math.max(
    0,
    Math.ceil((adjustedQty * PACKAGING_SCALE) / step - STEP_EPSILON),
  );
  if (remaining === 0) {
    return counts;
  }

  if (remaining > MAX_PACKAGING_STEPS) {
    const bulk = Math.ceil((remaining - MAX_PACKAGING_STEPS) / sizes[0]);
    counts[0] += bulk;
    remaining -= bulk * sizes[0];
  }

  // best[n] : coût minimal pour couvrir n pas ; unitsAt[n] départage à coût
  // égal ; from[n] retient le dernier format posé, pour la reconstruction.
  const best = new Float64Array(remaining + 1);
  const unitsAt = new Int32Array(remaining + 1);
  const from = new Int32Array(remaining + 1);

  for (let n = 1; n <= remaining; n++) {
    let bestCost = Infinity;
    let bestUnits = 0;
    let bestIdx = 0;
    // Du plus grand format au plus petit : à coût et contenants égaux, le grand
    // format l'emporte — le choix reste déterministe et le détail trié.
    for (let i = 0; i < formats.length; i++) {
      const prev = Math.max(0, n - sizes[i]);
      const cost = best[prev] + costs[i];
      const units = unitsAt[prev] + 1;
      if (cost < bestCost || (cost === bestCost && units < bestUnits)) {
        bestCost = cost;
        bestUnits = units;
        bestIdx = i;
      }
    }
    best[n] = bestCost;
    unitsAt[n] = bestUnits;
    from[n] = bestIdx;
  }

  for (let n = remaining; n > 0; ) {
    const i = from[n];
    counts[i] += 1;
    n = Math.max(0, n - sizes[i]);
  }

  return counts;
};

/**
 * Libellé d'un achat panaché : « 2 × Pot 10 L + Pot 5 L + Pot 2.5 L ». Un achat
 * à format unique garde son libellé nu — le nombre de contenants est déjà porté
 * par `units_needed`, et l'affichage historique « N × libellé » reste juste.
 */
const composePackagingLabel = (breakdown: PackagingUnits[]): string =>
  breakdown.length === 1
    ? breakdown[0].label
    : breakdown
        .map((b) => (b.units > 1 ? `${b.units} × ${b.label}` : b.label))
        .join(' + ');

/**
 * Résolution du facteur de perte : exact (pose, niveau) → pose `standard` du
 * même niveau → défaut générique. Exportée comme fonction pure car DATA-3 doit
 * résoudre la **même** valeur de référence hors du moteur (calcul des facteurs
 * appris) : la dupliquer laisserait les deux logiques diverger en silence.
 */
export function resolveWasteFactor(
  wasteFactors: WasteFactorInput[],
  poseType: string,
  skillLevel: string,
): ResolvedWasteFactor {
  const exact = wasteFactors.find(
    (wf) => wf.pose_type === poseType && wf.skill_level === skillLevel,
  );
  if (exact) {
    return {
      percent: Number(exact.factor_percent),
      source: exact.source ?? 'catalog',
    };
  }

  const standard = wasteFactors.find(
    (wf) => wf.pose_type === 'standard' && wf.skill_level === skillLevel,
  );
  if (standard) {
    return {
      percent: Number(standard.factor_percent),
      source: standard.source ?? 'catalog',
    };
  }

  return { percent: DEFAULT_WASTE_PERCENT, source: 'default' };
}

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
    return resolveWasteFactor(wasteFactors, poseType, skillLevel);
  }

  /**
   * Quantité théorique avant perte. Le nombre de couches ne s'applique qu'aux
   * matériaux qui le déclarent (`applies_coats`, E1-4) — un rouleau, un ruban
   * ou une bâche ne se rachètent pas à chaque couche.
   *
   * `coats` n'est renseigné dans le retour que pour ces matériaux : c'est ce
   * qui alimente le « · 2 couches » affiché sur la ligne, qui n'a de sens que
   * là où la quantité en dépend vraiment.
   */
  computeTheoreticalQty(
    surfaceM2: number,
    yieldPerUnit: number,
    customParams: Record<string, unknown>,
    appliesCoats: boolean,
  ): { qty: number; coats?: number } {
    const yield_ = Number(yieldPerUnit);
    const qty = surfaceM2 / yield_;

    if (appliesCoats) {
      const coats = Number(customParams.number_of_coats) || DEFAULT_COATS;
      return { qty: qty * coats, coats };
    }

    return { qty };
  }

  /**
   * Que faut-il acheter pour couvrir `adjustedQty` ? E1-5 — le critère est
   *
   *     minimiser  S = q_min × (nombre de contenants) + (volume acheté)
   *     sous       volume acheté ≥ adjustedQty
   *
   * où `q_min` est le plus petit format offert pour ce matériau. Plusieurs
   * formats peuvent être panachés : 6,66 L de peinture donnent 1 pot de 5 L
   * plus 1 de 2,5 L.
   *
   * Pourquoi cette forme. Le prix d'un conditionnement vaut `a + b × contenu`,
   * avec `a > 0` — le pot, l'étiquette, la manutention. C'est ce qui fait
   * baisser le prix au litre quand le pot grossit. Minimiser le coût revient
   * donc à minimiser `(a/b) × contenants + volume`, dont la seule inconnue
   * `r = a/b` est homogène à un volume. Le catalogue ne portant pas de prix, on
   * pose `r = q_min` : **un contenant de plus doit faire économiser au moins la
   * plus petite quantité que le magasin sait vendre**. Estimation volontairement
   * prudente — le vrai `r` est plus grand, donc la règle penche vers moins de
   * contenants, le côté sûr : un fond de pot se garde, un second aller-retour au
   * magasin ne se rattrape pas. Et sans échelle : elle vaut en litres, en m² et
   * en kg sans réglage par famille de matériau.
   *
   * Le critère n'est pas fragile au choix de `r` : pour 6,66 L, 5 L + 2,5 L est
   * optimal pour tout `r` entre 0,167 et 2,5 — une plage de 1 à 15.
   *
   * Ce qu'il remplace : minimiser le seul surplus en volume, format unique. Ce
   * critère achetait 14 pots de 0,5 L (7,0 L) plutôt que 5 L + 2,5 L (7,5 L)
   * pour 6,66 L — trois à cinq fois le prix pour 0,5 L de peinture économisée.
   * Son symétrique, minimiser le seul nombre de contenants, sature sur le plus
   * grand format : un pot de 2,5 L pour 0,6 L de besoin. `S` pénalise les deux.
   */
  selectBestPackaging(
    adjustedQty: number,
    packagings: PackagingInput[],
  ): SelectedPackaging {
    const formats = normalizePackagings(packagings);

    if (formats.length === 0) {
      const units = Math.max(0, Math.ceil(adjustedQty));
      return {
        label: '-',
        qty_per_unit: 1,
        units_needed: units,
        breakdown: units > 0 ? [{ label: '-', units }] : [],
      };
    }

    const counts = solvePackagingMix(adjustedQty, formats);

    const breakdown: PackagingUnits[] = [];
    let totalUnits = 0;
    let totalSteps = 0;
    formats.forEach((format, i) => {
      if (counts[i] === 0) {
        return;
      }
      breakdown.push({ label: format.label, units: counts[i] });
      totalUnits += counts[i];
      totalSteps += counts[i] * format.steps;
    });

    // Rien à acheter (surface nulle) : on nomme quand même le format qu'on
    // aurait pris, comme avant E1-5, plutôt que de renvoyer un libellé vide.
    if (totalUnits === 0) {
      const smallest = formats[formats.length - 1];
      return {
        label: smallest.label,
        qty_per_unit: smallest.steps / PACKAGING_SCALE,
        units_needed: 0,
        breakdown: [],
      };
    }

    return {
      label: composePackagingLabel(breakdown),
      // Contenu moyen par contenant : le format exact quand il n'y en a qu'un,
      // et sinon la valeur qui préserve `units_needed × qty_per_unit = volume
      // acheté` — l'invariant dont vivent la clôture de chantier, la
      // comparaison de prix et la correction manuelle des quantités.
      qty_per_unit: totalSteps / totalUnits / PACKAGING_SCALE,
      units_needed: totalUnits,
      breakdown,
    };
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

        const appliesCoats = mat.applies_coats ?? false;

        const { qty: theoreticalQty, coats } = this.computeTheoreticalQty(
          surfaceM2,
          mat.yield_per_unit,
          wi.custom_params,
          appliesCoats,
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
              appliesCoats,
            ).qty *
            (1 + wasteFactor.percent / 100);
          const adjustedQtyHigh =
            this.computeTheoreticalQty(
              surfaceBounds.high,
              mat.yield_per_unit,
              wi.custom_params,
              appliesCoats,
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
          ...(packaging.breakdown.length > 1
            ? { packaging_breakdown: packaging.breakdown }
            : {}),
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
   * Fonction pure.
   *
   * Ce que cela garantit, exactement : la réunion des achats pièce par pièce est
   * une solution admissible du problème mutualisé, de coût `Σ S_pièce` au sens
   * de `selectBestPackaging`. L'optimum mutualisé ne peut donc pas coûter plus
   * cher — c'est cela, la promesse ENG-2.
   *
   * Ce que cela ne garantit **pas**, contrairement à ce que ce commentaire a
   * longtemps affirmé : que le nombre de contenants ne puisse pas augmenter.
   * `ceil(Σ) ≤ Σ ceil` valait quand un achat tenait dans un format unique ; le
   * panachage d'E1-5 arbitre en coût, et peut préférer plus de contenants pour
   * moins de volume. Le cas se produit sur le catalogue réel, pas seulement en
   * théorie : cf. `__tests__/two-room-project.spec.ts`, qui en énumère les deux
   * occurrences. `budget-summary.ts` clampe l'économie affichée à 0 pour cette
   * raison.
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
        ...(packaging.breakdown.length > 1
          ? { packaging_breakdown: packaging.breakdown }
          : {}),
        room_count: distinctRooms.size || 1,
        contributions,
        ...rangeFields,
      });
    }

    return result;
  }
}
