import type { ShoppingListMaterialItem } from '../shopping-lists/entities/shopping-list.entity';
import {
  fingerprintQuantities,
  fingerprintShoppingList,
  selectQuotableItems,
  toValidatedLines,
} from './quantity-fingerprint';

function item(
  overrides: Partial<ShoppingListMaterialItem> = {},
): ShoppingListMaterialItem {
  return {
    material_id: 'aaaaaaaa-0000-0000-0000-000000000001',
    work_type_code: 'wall_painting',
    work_type_label: 'Peinture murale',
    material_name: 'Peinture acrylique mate',
    material_category: 'painting',
    material_unit: 'L',
    packaging_label: 'Pot 10 L',
    packaging_qty_per_unit: 10,
    adjusted_qty: 10.5,
    original_units_needed: 2,
    units_needed: 2,
    is_manually_adjusted: false,
    real_unit_price: 42,
    ...overrides,
  };
}

describe('selectQuotableItems', () => {
  it('ne retient que les lignes qui figureront sur le devis', () => {
    const items = [
      item({ material_id: 'a', real_unit_price: 42 }),
      item({ material_id: 'b', real_unit_price: null }),
      item({ material_id: 'c', real_unit_price: undefined }),
      // Zéro n'est pas un prix renseigné : c'est le filtre exact de
      // `QuotesService.create`, dont cette fonction est devenue la seule
      // définition.
      item({ material_id: 'd', real_unit_price: 0 }),
    ];

    expect(selectQuotableItems(items).map((i) => i.material_id)).toEqual(['a']);
  });
});

describe('fingerprintQuantities', () => {
  it('est stable : deux calculs sur la même liste donnent la même empreinte', () => {
    const lines = toValidatedLines([
      item({ material_id: 'a', units_needed: 3 }),
      item({ material_id: 'b', units_needed: 1 }),
    ]);

    expect(fingerprintQuantities(lines)).toBe(fingerprintQuantities(lines));
    expect(fingerprintQuantities(lines)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ne dépend pas de l'ordre des lignes", () => {
    const ab = fingerprintShoppingList([
      item({ material_id: 'a', units_needed: 3 }),
      item({ material_id: 'b', units_needed: 1 }),
    ]).fingerprint;
    const ba = fingerprintShoppingList([
      item({ material_id: 'b', units_needed: 1 }),
      item({ material_id: 'a', units_needed: 3 }),
    ]).fingerprint;

    expect(ab).toBe(ba);
  });

  it("change dès qu'une quantité change", () => {
    const before = fingerprintShoppingList([
      item({ material_id: 'a', units_needed: 3 }),
    ]).fingerprint;
    const after = fingerprintShoppingList([
      item({ material_id: 'a', units_needed: 4 }),
    ]).fingerprint;

    expect(after).not.toBe(before);
  });

  it("change quand une ligne chiffrée s'ajoute, même si les autres ne bougent pas", () => {
    const one = fingerprintShoppingList([
      item({ material_id: 'a', units_needed: 3 }),
    ]).fingerprint;
    const two = fingerprintShoppingList([
      item({ material_id: 'a', units_needed: 3 }),
      item({ material_id: 'b', units_needed: 1 }),
    ]).fingerprint;

    expect(two).not.toBe(one);
  });

  it('ignore un libellé de catalogue réécrit : il ne change pas ce qui est engagé', () => {
    const before = fingerprintShoppingList([
      item({ material_id: 'a', units_needed: 3, material_name: 'Peinture A' }),
    ]).fingerprint;
    const after = fingerprintShoppingList([
      item({
        material_id: 'a',
        units_needed: 3,
        material_name: 'Peinture A (nouvelle formule)',
      }),
    ]).fingerprint;

    expect(after).toBe(before);
  });

  it('ignore un prix qui change : ce sont les quantités qui sont validées', () => {
    const before = fingerprintShoppingList([
      item({ material_id: 'a', units_needed: 3, real_unit_price: 42 }),
    ]).fingerprint;
    const after = fingerprintShoppingList([
      item({ material_id: 'a', units_needed: 3, real_unit_price: 51.9 }),
    ]).fingerprint;

    expect(after).toBe(before);
  });

  it('ne fait pas diverger deux quantités égales au bruit flottant près', () => {
    const computed = fingerprintShoppingList([
      item({ material_id: 'a', units_needed: 0.1 + 0.2 }),
    ]).fingerprint;
    const literal = fingerprintShoppingList([
      item({ material_id: 'a', units_needed: 0.3 }),
    ]).fingerprint;

    expect(computed).toBe(literal);
  });
});

describe('toValidatedLines', () => {
  it("fige les libellés de la ligne pour que l'instantané se lise sans le catalogue", () => {
    const [line] = toValidatedLines([item({ units_needed: 3 })]);

    expect(line).toEqual({
      material_id: 'aaaaaaaa-0000-0000-0000-000000000001',
      material_name: 'Peinture acrylique mate',
      work_type_code: 'wall_painting',
      work_type_label: 'Peinture murale',
      packaging_label: 'Pot 10 L',
      units_needed: 3,
    });
  });

  it('écarte les lignes sans prix, qui ne partiront pas sur le devis', () => {
    const lines = toValidatedLines([
      item({ material_id: 'a' }),
      item({ material_id: 'b', real_unit_price: null }),
    ]);

    expect(lines.map((l) => l.material_id)).toEqual(['a']);
  });
});
