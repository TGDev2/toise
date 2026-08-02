import { render, screen, fireEvent } from '@testing-library/react';
import { CloseoutRows } from '../CloseoutRows';
import { CloseoutSummaryPanel } from '../CloseoutSummaryPanel';
import type { CloseoutLine, CloseoutSummary } from '@/lib/closeout-types';

function makeLine(overrides: Partial<CloseoutLine> = {}): CloseoutLine {
  return {
    kind: 'material',
    item_id: 'mat-tiles',
    name: 'Carrelage grès cérame 60x60',
    unit_label: 'Carton 1,44 m²',
    estimated_units: 19,
    purchased_units: null,
    is_declared: false,
    surplus_units: 0,
    surplus_volume: null,
    shortfall_units: 0,
    real_unit_price: 22.9,
    store_name: 'Leroy Merlin',
    surplus_value: null,
    returnability: 'likely',
    policy: null,
    restriction_reason: null,
    return_deadline: null,
    days_remaining: null,
    estimated_waste_percent: null,
    implied_waste_percent: null,
    packaging_floor_percent: null,
    waste_delta_points: null,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<CloseoutSummary> = {}): CloseoutSummary {
  return {
    purchased_on: '2026-07-15',
    lines: [],
    lines_total: 3,
    lines_declared: 0,
    surplus_lines: 0,
    surplus_value_total: 0,
    recoverable_amount: 0,
    restricted_amount: 0,
    unknown_amount: 0,
    unpriced_surplus_lines: 0,
    earliest_deadline: null,
    unknown_retailers: [],
    computed_at: '2026-08-02T10:00:00.000Z',
    ...overrides,
  };
}

describe('CloseoutRows (DATA-5)', () => {
  it('pré-remplit la ligne avec la quantité estimée en indication', () => {
    render(<CloseoutRows lines={[makeLine()]} />);

    const input = screen.getByLabelText('Acheté');
    expect(input).toHaveValue(null);
    expect(input).toHaveAttribute('placeholder', '19');
  });

  it('ne demande qu’une seule correction par ligne', () => {
    // Le contrat de l'écran : pas de prix, pas d'enseigne, pas de « combien
    // vous en reste-t-il ». Une saisie et une seule.
    const { container } = render(<CloseoutRows lines={[makeLine()]} />);

    expect(container.querySelectorAll('input')).toHaveLength(1);
  });

  it('remonte la quantité déclarée à la sortie du champ', () => {
    const onDeclare = jest.fn();
    render(<CloseoutRows lines={[makeLine()]} onDeclare={onDeclare} />);

    const input = screen.getByLabelText('Acheté');
    fireEvent.change(input, { target: { value: '21' } });
    fireEvent.blur(input);

    expect(onDeclare).toHaveBeenCalledWith(expect.anything(), 21);
  });

  it('ne déclare rien tant que le champ est vide', () => {
    const onDeclare = jest.fn();
    render(<CloseoutRows lines={[makeLine()]} onDeclare={onDeclare} />);

    fireEvent.blur(screen.getByLabelText('Acheté'));

    expect(onDeclare).not.toHaveBeenCalled();
  });

  it('affiche l’échéance de reprise quand l’enseigne est connue', () => {
    render(
      <CloseoutRows
        lines={[
          makeLine({
            purchased_units: 21,
            is_declared: true,
            surplus_units: 2,
            surplus_value: 45.8,
            returnability: 'likely',
            return_deadline: '2027-01-11',
            days_remaining: 162,
            policy: {
              slug: 'leroymerlin',
              label: 'Leroy Merlin',
              window_days: 180,
              loyalty_window_days: 365,
              loyalty_program: 'LEROY&MOI',
              conditions_fr: [],
              excluded_fr: [],
              source_url: 'https://www.leroymerlin.fr/',
              verified_on: '2026-08-02',
            },
          }),
        ]}
      />,
    );

    expect(screen.getByText(/45,80 EUR/)).toBeInTheDocument();
    expect(screen.getByText(/jusqu’au 11\/01\/2027/)).toBeInTheDocument();
    expect(screen.getByText(/162 jours/)).toBeInTheDocument();
  });

  it('n’affirme aucun délai pour une enseigne hors catalogue', () => {
    render(
      <CloseoutRows
        lines={[
          makeLine({
            purchased_units: 21,
            is_declared: true,
            surplus_units: 2,
            surplus_value: 45.8,
            store_name: 'Brico Dépôt',
            returnability: 'unknown',
          }),
        ]}
      />,
    );

    expect(screen.getByText(/vérifiez sur votre ticket/)).toBeInTheDocument();
    expect(screen.queryByText(/jusqu’au/)).not.toBeInTheDocument();
  });

  it('signale la réserve sur une catégorie couramment exclue', () => {
    render(
      <CloseoutRows
        lines={[
          makeLine({
            item_id: 'mat-paint',
            name: 'Peinture acrylique mate',
            purchased_units: 3,
            is_declared: true,
            surplus_units: 1,
            surplus_value: 45,
            returnability: 'restricted',
            restriction_reason:
              'Une peinture teintée en machine ou un pot déjà ouvert n’est pas repris.',
          }),
        ]}
      />,
    );

    expect(screen.getByText(/teintée en machine/)).toBeInTheDocument();
  });

  it('distingue l’arrondi du conditionnement de la marge prise', () => {
    // Sans le plancher de conditionnement, l'écran imputerait à l'utilisateur
    // les 14 % que le carton impose mécaniquement.
    render(
      <CloseoutRows
        lines={[
          makeLine({
            purchased_units: 21,
            is_declared: true,
            estimated_waste_percent: 12,
            implied_waste_percent: 26,
            packaging_floor_percent: 14,
            waste_delta_points: 14,
          }),
        ]}
      />,
    );

    expect(
      screen.getByText(/dont 14 % imposés par le conditionnement/),
    ).toBeInTheDocument();
  });
});

describe('CloseoutSummaryPanel (DATA-5)', () => {
  it('invite à déclarer tant que rien ne l’est', () => {
    render(<CloseoutSummaryPanel summary={makeSummary()} />);

    expect(screen.getByText(/Corrigez les quantités/)).toBeInTheDocument();
  });

  it('sépare « ce qui reste » de « ce qui se rend »', () => {
    // Les deux questions de l'utilisateur sont distinctes : confondre les
    // montants promettrait une reprise que l'enseigne ne garantit pas.
    render(
      <CloseoutSummaryPanel
        summary={makeSummary({
          lines_declared: 3,
          surplus_lines: 2,
          surplus_value_total: 90.8,
          recoverable_amount: 45.8,
          restricted_amount: 45,
        })}
      />,
    );

    expect(screen.getByText('90,80 EUR')).toBeInTheDocument();
    expect(screen.getByText('45,80 EUR')).toBeInTheDocument();
    expect(screen.getByText('45,00 EUR')).toBeInTheDocument();
    expect(screen.getByText(/Sous réserve/)).toBeInTheDocument();
  });

  it('porte toujours la réserve sur la valeur des délais affichés', () => {
    render(<CloseoutSummaryPanel summary={makeSummary({ lines_declared: 1 })} />);

    expect(screen.getByText(/confirmez en magasin/i)).toBeInTheDocument();
  });
});
