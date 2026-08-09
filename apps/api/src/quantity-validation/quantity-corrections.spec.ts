import type { ShoppingListMaterialItem } from '../shopping-lists/entities/shopping-list.entity';
import { QuantityCorrectionSource } from './entities/quantity-correction.entity';
import {
  buildQuantityCorrection,
  relativeDeviation,
  type QuantityCorrectionContext,
} from './quantity-corrections';

const CONTEXT: QuantityCorrectionContext = {
  projectId: 'project-1',
  userId: 'user-1',
  skillLevel: 'expert',
  source: QuantityCorrectionSource.QUOTE_VALIDATION,
};

function item(
  overrides: Partial<ShoppingListMaterialItem> = {},
): ShoppingListMaterialItem {
  return {
    material_id: 'mat-adhesive',
    work_type_code: 'floor_tiling',
    work_type_label: 'Carrelage sol',
    material_name: 'Mortier-colle C2',
    material_category: 'tiling',
    material_unit: 'kg',
    packaging_label: 'Sac 25 kg',
    packaging_qty_per_unit: 25,
    adjusted_qty: 92,
    original_units_needed: 4,
    units_needed: 4,
    is_manually_adjusted: false,
    ...overrides,
  };
}

describe('relativeDeviation', () => {
  it('rapporte l’écart à la quantité calculée', () => {
    expect(relativeDeviation(4, 5)).toBeCloseTo(0.25, 10);
    expect(relativeDeviation(4, 3)).toBeCloseTo(-0.25, 10);
    expect(relativeDeviation(4, 4)).toBe(0);
  });

  /**
   * Le cas qui compte : un `0` renvoyé ici entrerait dans l'agrégat d'E8 comme
   * une confirmation parfaite du catalogue, alors que personne n'a rien
   * observé. C'est le mécanisme de la leçon 18, transposé à l'écart relatif.
   */
  it('rend null quand la quantité calculée est nulle, pas zéro', () => {
    expect(relativeDeviation(0, 3)).toBeNull();
    expect(relativeDeviation(Number.NaN, 3)).toBeNull();
  });
});

describe('buildQuantityCorrection', () => {
  it("conserve la quantité calculée, celle d'avant le geste, et celle retenue", () => {
    const correction = buildQuantityCorrection(
      item({ original_units_needed: 4, units_needed: 5 }),
      6,
      CONTEXT,
    );

    expect(correction).toMatchObject({
      computed_units: 4,
      previous_units: 5,
      corrected_units: 6,
    });
  });

  /**
   * Une deuxième correction sur la même ligne mesure toujours l'écart au
   * **catalogue**. Adossé à `previous_units`, l'agrégat d'E8 dirait « +20 % »
   * sur un chantier passé de 4 à 5 puis à 6, au lieu des +50 % réels.
   */
  it("mesure l'écart au catalogue et non à la correction précédente", () => {
    const correction = buildQuantityCorrection(
      item({ original_units_needed: 4, units_needed: 5 }),
      6,
      CONTEXT,
    );

    expect(correction.relative_deviation).toBeCloseTo(0.5, 10);
  });

  it("fige matériau, ouvrage et niveau : l'agrégat ne rejoint pas le catalogue courant", () => {
    const correction = buildQuantityCorrection(item(), 6, CONTEXT);

    expect(correction).toMatchObject({
      project_id: 'project-1',
      user_id: 'user-1',
      material_id: 'mat-adhesive',
      material_name: 'Mortier-colle C2',
      material_unit: 'kg',
      packaging_label: 'Sac 25 kg',
      work_type_code: 'floor_tiling',
      work_type_label: 'Carrelage sol',
      skill_level: 'expert',
      source: QuantityCorrectionSource.QUOTE_VALIDATION,
    });
  });

  it('accepte un niveau inconnu sans inventer de valeur', () => {
    const correction = buildQuantityCorrection(item(), 6, {
      ...CONTEXT,
      skillLevel: null,
    });

    expect(correction.skill_level).toBeNull();
  });
});
