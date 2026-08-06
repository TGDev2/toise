import { render, screen, fireEvent } from '@testing-library/react';
import { EstimationResults } from '../EstimationResults';
import { makeLineItem, makeFloorTilingItem, makeMultiWorkTypeItems } from './fixtures';

describe('EstimationResults', () => {
  it('should show empty message when no items', () => {
    render(<EstimationResults items={[]} />);
    expect(screen.getByText('Aucun matériau à estimer.')).toBeInTheDocument();
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

    // Le résumé de groupe et le détail par ligne montrent tous deux la
    // surface brute/nette (le détail est nécessaire dès qu'un groupe a
    // plusieurs matériaux, cf. le fixture makeMultiWorkTypeItems).
    expect(
      screen.getAllByText(/Surface brute : 35 m²/).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Surface nette : 31.964 m²/).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('should show single surface when gross equals net (floor)', () => {
    const items = [makeFloorTilingItem({ gross_surface_m2: 12, surface_m2: 12 })];
    render(<EstimationResults items={items} />);

    // Section header collapses to a single "Surface : 12 m²" when equal.
    const surfaceTexts = screen.getAllByText(/Surface : 12 m²/);
    expect(surfaceTexts.length).toBeGreaterThanOrEqual(1);
    // Per-line detail always spells out both steps of the chain explicitly,
    // even when brute and nette are equal.
    expect(
      screen.getAllByText(/Surface brute : 12 m²/).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Surface nette : 12 m²/).length,
    ).toBeGreaterThanOrEqual(1);
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

    expect(screen.getByText(/Quantité théorique : 5.81 L/)).toBeInTheDocument();
    expect(screen.getByText(/Perte : 15%/)).toBeInTheDocument();
    expect(
      screen.getByText(/Quantité ajustée \(après perte\) : 6.68 L/),
    ).toBeInTheDocument();
  });

  it('should display the pose type as part of the waste factor reason', () => {
    render(
      <EstimationResults items={[makeLineItem({ pose_type: 'diagonal' })]} />,
    );

    expect(screen.getByText(/Perte : 15% · Pose diagonal/)).toBeInTheDocument();
  });

  it('should display coats for painting items', () => {
    render(<EstimationResults items={[makeLineItem({ number_of_coats: 2 })]} />);
    expect(screen.getByText(/Nombre de couches : 2/)).toBeInTheDocument();
  });

  it('should not display coats for non-painting items', () => {
    render(<EstimationResults items={[makeFloorTilingItem()]} />);
    expect(screen.queryByText(/couches/)).not.toBeInTheDocument();
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

    // Section header falls back to a single "Surface : X m²" (gross === net).
    const surfaceTexts = screen.getAllByText(/Surface : 31.964 m²/);
    expect(surfaceTexts.length).toBeGreaterThanOrEqual(1);
    // Per-line detail also falls back gross -> net for "Surface brute".
    expect(
      screen.getAllByText(/Surface brute : 31.964 m²/).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Surface nette : 31.964 m²/).length,
    ).toBeGreaterThanOrEqual(1);
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

  // E4-2 : le détail doit permettre de reconstituer le chiffre à la main,
  // dans l'ordre — pas seulement afficher chaque nombre isolément.
  it("recompose la chaîne complète du calcul jusqu'au nombre d'unités", () => {
    const items = [
      makeLineItem({
        gross_surface_m2: 35,
        surface_m2: 31.964,
        excluded_surface_m2: 3,
        number_of_coats: 2,
        waste_factor_percent: 15,
        waste_factor_source: 'catalog',
        theoretical_qty: 5.812,
        adjusted_qty: 6.684,
        packaging_label: 'Pot 2.5 L',
        packaging_qty_per_unit: 2.5,
        units_needed: 3,
      }),
    ];
    const { container } = render(<EstimationResults items={items} />);

    const detailToggle = screen.getByRole('button', {
      name: /Détail du calcul/,
    });
    fireEvent.click(detailToggle);
    expect(detailToggle).toHaveAttribute('aria-expanded', 'true');

    const text = container.textContent ?? '';
    const steps = [
      'Surface brute : 35 m²',
      'Surfaces exclues (saisies) : -3 m²',
      'Surface nette : 31.964 m²',
      'Nombre de couches : 2',
      'Perte : 15% · Pose standard',
      'Quantité théorique : 5.81 L',
      'Quantité ajustée (après perte) : 6.68 L',
      'Conditionnement retenu : 3 × Pot 2.5 L',
    ];

    // La section de résumé (WorkTypeSection) répète brute/nette/exclusion
    // avant le détail par ligne : on cherche chaque étape après la
    // précédente pour verrouiller sur la séquence propre à la ligne.
    let previousIndex = -1;
    for (const step of steps) {
      const index = text.indexOf(step, previousIndex + 1);
      expect(index).toBeGreaterThan(-1);
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }

    // 3 unités × 2.5 L = 7.5 L achetés pour 6.684 L nécessaires -> 0.82 L de surplus.
    expect(
      screen.getByText(
        /7.5 L achetés pour 6.68 L nécessaires \(surplus : 0.82 L\)/,
      ),
    ).toBeInTheDocument();
  });
});
