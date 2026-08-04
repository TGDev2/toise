import { render, screen, fireEvent } from '@testing-library/react';
import { EstimationResults } from '../EstimationResults';
import { makeLineItem, makeFloorTilingItem, makeMultiWorkTypeItems } from './fixtures';

describe('EstimationResults', () => {
  it('should show empty message when no items', () => {
    render(<EstimationResults items={[]} />);
    expect(screen.getByText('Aucun matériau a estimer.')).toBeInTheDocument();
  });

  it('should render one section for a single work type', () => {
    const items = [makeLineItem()];
    render(<EstimationResults items={items} />);

    expect(screen.getByText('Peinture murale')).toBeInTheDocument();
    expect(screen.getByText('Peinture acrylique mate')).toBeInTheDocument();
  });

  it('should render multiple sections for different work types', () => {
    render(<EstimationResults items={makeMultiWorkTypeItems()} />);

    expect(screen.getByText('Peinture murale')).toBeInTheDocument();
    expect(screen.getByText('Carrelage sol')).toBeInTheDocument();
  });

  it('should toggle accordion on click', () => {
    render(<EstimationResults items={[makeLineItem()]} />);

    const toggle = screen.getByRole('button', { expanded: true });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  // E1-5 : un achat panaché ne se dit pas « N × un format ». Rendu tel quel,
  // le gabarit historique donnerait « 2 × Pot 5 L + Pot 2.5 L », qui se lit
  // comme deux fois le couple.
  it('détaille un achat panaché format par format', () => {
    const items = [
      makeLineItem({
        packaging_label: 'Pot 5 L + Pot 2.5 L',
        packaging_qty_per_unit: 3.75,
        units_needed: 2,
        packaging_breakdown: [
          { label: 'Pot 5 L', units: 1 },
          { label: 'Pot 2.5 L', units: 1 },
        ],
      }),
    ];
    render(<EstimationResults items={items} />);

    expect(
      screen.getByText('1 × Pot 5 L + 1 × Pot 2.5 L'),
    ).toBeInTheDocument();
  });

  it('garde le gabarit « N × format » sans panachage', () => {
    render(<EstimationResults items={[makeLineItem()]} />);
    expect(screen.getByText('3 × Pot 2.5 L')).toBeInTheDocument();
  });

  it('should show both surfaces when gross differs from net (wall)', () => {
    const items = [makeLineItem({ gross_surface_m2: 35, surface_m2: 31.964 })];
    render(<EstimationResults items={items} />);

    expect(screen.getByText(/Surface brute : 35 m²/)).toBeInTheDocument();
    expect(screen.getByText(/Surface nette : 31.964 m²/)).toBeInTheDocument();
  });

  it('should show single surface when gross equals net (floor)', () => {
    const items = [makeFloorTilingItem({ gross_surface_m2: 12, surface_m2: 12 })];
    render(<EstimationResults items={items} />);

    // Both the section header and material card show "Surface : 12 m²"
    const surfaceTexts = screen.getAllByText(/Surface : 12 m²/);
    expect(surfaceTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Surface brute/)).not.toBeInTheDocument();
  });

  it('should mention the excluded surface when a wall exclusion was applied', () => {
    const items = [
      makeLineItem({
        gross_surface_m2: 35,
        surface_m2: 29.964,
        excluded_surface_m2: 2,
      }),
    ];
    render(<EstimationResults items={items} />);

    expect(
      screen.getByText(/\(dont 2 m² exclus\)/),
    ).toBeInTheDocument();
  });

  it('should not mention excluded surface when none was applied', () => {
    render(<EstimationResults items={[makeLineItem()]} />);
    expect(screen.queryByText(/exclus/)).not.toBeInTheDocument();
  });

  it('should display material detail: theoretical, waste, adjusted', () => {
    render(<EstimationResults items={[makeLineItem()]} />);

    expect(screen.getByText(/Theorique : 5.81 L/)).toBeInTheDocument();
    expect(screen.getByText(/Perte : 15%/)).toBeInTheDocument();
    expect(screen.getByText(/Ajuste : 6.68 L/)).toBeInTheDocument();
  });

  it('should display coats for painting items', () => {
    render(<EstimationResults items={[makeLineItem({ number_of_coats: 2 })]} />);
    expect(screen.getByText(/2 couches/)).toBeInTheDocument();
  });

  it('should not display coats for non-painting items', () => {
    render(<EstimationResults items={[makeFloorTilingItem()]} />);
    expect(screen.queryByText(/couche/)).not.toBeInTheDocument();
  });

  it('should display packaging info', () => {
    render(<EstimationResults items={[makeLineItem()]} />);
    expect(screen.getByText('3 × Pot 2.5 L')).toBeInTheDocument();
  });

  it('should handle missing gross_surface_m2 gracefully (backward compat)', () => {
    const item = makeLineItem();
    // Simulate old estimation without gross_surface_m2
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (item as any).gross_surface_m2;
    render(<EstimationResults items={[item]} />);

    // Should fall back to surface_m2 and show single surface (appears in header and card)
    const surfaceTexts = screen.getAllByText(/Surface : 31.964 m²/);
    expect(surfaceTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('should hide the calculation detail by default and expand it on click', () => {
    render(<EstimationResults items={[makeLineItem()]} />);

    const detailToggle = screen.getByRole('button', {
      name: /Détail du calcul/,
    });
    expect(detailToggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(detailToggle);
    expect(detailToggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('should show the low/high range when it exists and differs', () => {
    const items = [
      makeLineItem({ units_needed: 3, units_needed_low: 2, units_needed_high: 3 }),
    ];
    render(<EstimationResults items={items} />);

    expect(
      screen.getByText(/Fourchette selon la mesure : 2–3 Pot 2.5 L/),
    ).toBeInTheDocument();
  });

  it('should not show the range when bounds are absent or equal', () => {
    render(<EstimationResults items={[makeLineItem()]} />);
    expect(screen.queryByText(/Fourchette selon la mesure/)).not.toBeInTheDocument();

    const items = [
      makeLineItem({ units_needed_low: 3, units_needed_high: 3 }),
    ];
    render(<EstimationResults items={items} />);
    expect(screen.queryByText(/Fourchette selon la mesure/)).not.toBeInTheDocument();
  });
});
