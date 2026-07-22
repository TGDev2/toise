import { render, screen } from '@testing-library/react';
import { ShoppingListMaterials } from '../ShoppingListMaterials';
import type { ShoppingListMaterialItem } from '@/lib/shopping-list-types';

function makeItem(
  overrides: Partial<ShoppingListMaterialItem> = {},
): ShoppingListMaterialItem {
  return {
    material_id: 'mat-paint',
    work_type_code: 'wall_painting',
    work_type_label: 'Peinture murale',
    material_name: 'Peinture acrylique mate',
    material_category: 'painting',
    material_unit: 'L',
    packaging_label: 'Pot 10 L',
    packaging_qty_per_unit: 10,
    adjusted_qty: 6.5,
    original_units_needed: 1,
    units_needed: 1,
    is_manually_adjusted: false,
    ...overrides,
  };
}

describe('ShoppingListMaterials', () => {
  it('renders no range when units_needed_low/high are absent', () => {
    render(<ShoppingListMaterials items={[makeItem()]} readOnly />);
    expect(screen.queryByText(/Fourchette/i)).not.toBeInTheDocument();
  });

  it('renders no range when the two bounds are equal (nothing to show)', () => {
    render(
      <ShoppingListMaterials
        items={[makeItem({ units_needed_low: 1, units_needed_high: 1 })]}
        readOnly
      />,
    );
    expect(screen.queryByText(/Fourchette/i)).not.toBeInTheDocument();
  });

  // CV-5 : fourchette basse/haute affichée quand elle est présente et non
  // triviale.
  it('renders the units_needed range when present and non-trivial (CV-5)', () => {
    render(
      <ShoppingListMaterials
        items={[makeItem({ units_needed_low: 1, units_needed_high: 2 })]}
        readOnly
      />,
    );
    expect(screen.getByText(/Fourchette selon la mesure/i)).toBeInTheDocument();
    expect(screen.getByText(/1–2/)).toBeInTheDocument();
  });

  it('hides the range once the quantity has been manually corrected', () => {
    render(
      <ShoppingListMaterials
        items={[
          makeItem({
            units_needed_low: 1,
            units_needed_high: 2,
            is_manually_adjusted: true,
          }),
        ]}
        readOnly
      />,
    );
    expect(screen.queryByText(/Fourchette/i)).not.toBeInTheDocument();
  });
});
