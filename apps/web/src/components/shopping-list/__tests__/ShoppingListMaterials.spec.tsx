import { render, screen, fireEvent } from '@testing-library/react';
import { ShoppingListMaterials } from '../ShoppingListMaterials';
import type { ShoppingListMaterialItem } from '@/lib/shopping-list-types';
import type { BuyLinkItem } from '@/lib/price-comparison-types';
import type { EcoRowData } from '@/lib/eco-materials-types';

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

  // BUY-3 : lien affilié « acheter chez X », disponible sans condition de tier.
  describe('affiliate buy link (BUY-3)', () => {
    const buyLink: BuyLinkItem = {
      material_id: 'mat-paint',
      supplier_key: 'manomano',
      supplier_name: 'ManoMano',
      url: 'https://www.manomano.fr/p/peinture-123',
    };

    it('renders the affiliate buy link when one is provided for the line', () => {
      render(
        <ShoppingListMaterials
          items={[makeItem()]}
          buyLinks={new Map([[buyLink.material_id, buyLink]])}
          readOnly
        />,
      );
      const link = screen.getByRole('link', { name: /Acheter chez ManoMano/i });
      expect(link).toHaveAttribute('href', buyLink.url);
      expect(link).toHaveAttribute('rel', expect.stringContaining('sponsored'));
    });

    it('renders no buy link when none is provided for the line', () => {
      render(<ShoppingListMaterials items={[makeItem()]} readOnly />);
      expect(
        screen.queryByRole('link', { name: /Acheter chez/i }),
      ).not.toBeInTheDocument();
    });

    it('does not render a buy link for a material with no matching entry in the map', () => {
      render(
        <ShoppingListMaterials
          items={[makeItem()]}
          buyLinks={new Map([['some-other-material', buyLink]])}
          readOnly
        />,
      );
      expect(
        screen.queryByRole('link', { name: /Acheter chez/i }),
      ).not.toBeInTheDocument();
    });
  });

  // PLAT-3 : badge/suggestion éco et filtre, tier Pro.
  describe('eco materials (PLAT-3)', () => {
    it('renders an Éco badge for a material flagged is_eco', () => {
      const ecoData = new Map<string, EcoRowData>([
        ['mat-paint', { is_eco: true, eco_label_fr: 'Sans COV' }],
      ]);
      render(
        <ShoppingListMaterials
          items={[makeItem()]}
          ecoAllowed
          ecoData={ecoData}
          readOnly
        />,
      );
      expect(screen.getByText('Éco')).toBeInTheDocument();
    });

    it('renders no Éco badge for a material absent from ecoData', () => {
      render(<ShoppingListMaterials items={[makeItem()]} ecoAllowed readOnly />);
      expect(screen.queryByText('Éco')).not.toBeInTheDocument();
    });

    it('renders the eco equivalent suggestion when one is known', () => {
      const ecoData = new Map<string, EcoRowData>([
        [
          'mat-paint',
          {
            is_eco: false,
            eco_label_fr: null,
            suggestion: {
              eco_material_id: 'mat-paint-eco',
              eco_material_name: 'Peinture acrylique sans COV',
              eco_label_fr: 'Sans COV, écolabel NF Environnement',
            },
          },
        ],
      ]);
      render(
        <ShoppingListMaterials
          items={[makeItem()]}
          ecoAllowed
          ecoData={ecoData}
          readOnly
        />,
      );
      expect(
        screen.getByText(/Alternative durable disponible/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Peinture acrylique sans COV/),
      ).toBeInTheDocument();
    });

    it('calls onShowEcoPaywall instead of filtering when ecoAllowed is false', () => {
      const onShowEcoPaywall = jest.fn();
      render(
        <ShoppingListMaterials
          items={[
            makeItem(),
            makeItem({
              material_id: 'mat-other',
              material_name: 'Enduit de lissage',
            }),
          ]}
          ecoAllowed={false}
          onShowEcoPaywall={onShowEcoPaywall}
          readOnly
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Matériaux éco/i }));

      expect(onShowEcoPaywall).toHaveBeenCalled();
      // Toujours 2 lignes : le paywall bloque le filtre, il ne le déclenche pas.
      expect(screen.getByText('Peinture acrylique mate')).toBeInTheDocument();
    });

    it('filters to eco-only materials when the toggle is active and allowed', () => {
      const ecoData = new Map<string, EcoRowData>([
        ['mat-paint', { is_eco: true, eco_label_fr: 'Sans COV' }],
      ]);
      render(
        <ShoppingListMaterials
          items={[
            makeItem(),
            makeItem({
              material_id: 'mat-other',
              material_name: 'Enduit de lissage',
            }),
          ]}
          ecoAllowed
          ecoData={ecoData}
          readOnly
        />,
      );

      expect(screen.getByText('Enduit de lissage')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Voir les matériaux éco/i }));

      expect(screen.getByText('Peinture acrylique mate')).toBeInTheDocument();
      expect(screen.queryByText('Enduit de lissage')).not.toBeInTheDocument();
    });
  });
});
