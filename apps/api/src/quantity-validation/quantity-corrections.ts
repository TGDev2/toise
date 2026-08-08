import type { ShoppingListMaterialItem } from '../shopping-lists/entities/shopping-list.entity';
import {
  QuantityCorrection,
  QuantityCorrectionSource,
} from './entities/quantity-correction.entity';

/**
 * E2-4 — construction d'une ligne de `quantity_corrections`.
 *
 * Une fonction pure et pas un service : elle est appelée depuis la transaction
 * de `ShoppingListsService.applyUpdateLocked`, qui écrit avec son
 * `EntityManager`. Un service injecté aurait forcé `ShoppingListsModule` à
 * dépendre de `QuantityValidationModule`, qui dépend déjà de lui — un cycle
 * pour zéro comportement.
 */

export interface QuantityCorrectionContext {
  projectId: string;
  organizationId: string;
  userId: string | null;
  /** Niveau de compétence de la dernière estimation, `null` si inconnu. */
  skillLevel: string | null;
  source: QuantityCorrectionSource;
}

/**
 * `(retenue − calculée) / calculée`.
 *
 * `null` quand la quantité calculée vaut zéro : un écart relatif à rien n'est
 * pas un écart nul, et le stocker comme tel ferait entrer dans l'agrégat d'E8
 * une confirmation parfaite du catalogue que personne n'a observée (leçon 18).
 */
export function relativeDeviation(
  computedUnits: number,
  correctedUnits: number,
): number | null {
  if (!Number.isFinite(computedUnits) || computedUnits === 0) return null;
  return (correctedUnits - computedUnits) / computedUnits;
}

/**
 * Prend la ligne **avant** modification et la quantité retenue.
 *
 * `computed_units` est `original_units_needed`, la quantité du catalogue, et
 * non `units_needed` : sur une deuxième correction de la même ligne, c'est
 * l'écart au calcul qui intéresse E8, pas l'écart à la correction précédente.
 * Les deux sont conservés, `previous_units` portant la seconde.
 */
export function buildQuantityCorrection(
  itemBefore: ShoppingListMaterialItem,
  correctedUnits: number,
  context: QuantityCorrectionContext,
): Partial<QuantityCorrection> {
  const computedUnits = itemBefore.original_units_needed;
  return {
    project_id: context.projectId,
    organization_id: context.organizationId,
    user_id: context.userId,
    material_id: itemBefore.material_id,
    material_name: itemBefore.material_name,
    material_unit: itemBefore.material_unit,
    packaging_label: itemBefore.packaging_label,
    work_type_code: itemBefore.work_type_code,
    work_type_label: itemBefore.work_type_label,
    skill_level: context.skillLevel,
    computed_units: computedUnits,
    previous_units: itemBefore.units_needed,
    corrected_units: correctedUnits,
    relative_deviation: relativeDeviation(computedUnits, correctedUnits),
    source: context.source,
  };
}
