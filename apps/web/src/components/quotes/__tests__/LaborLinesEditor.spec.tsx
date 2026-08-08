import { render, screen, fireEvent } from '@testing-library/react';
import { LaborLinesEditor } from '../LaborLinesEditor';
import type { QuoteLaborLineInput } from '@/lib/quote-types';

function makeLine(
  overrides: Partial<QuoteLaborLineInput> = {},
): QuoteLaborLineInput {
  return {
    work_item_id: 'wi-1',
    work_type_code: 'wall_painting',
    label: 'Peinture murale',
    room_name: 'Salon',
    kind: 'hourly',
    surface_m2: 25,
    quantity: 5,
    unit_price_ht: 45,
    ...overrides,
  };
}

describe('LaborLinesEditor', () => {
  const mockAdd = jest.fn();
  const mockUpdate = jest.fn();
  const mockRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the empty state when there are no lines', () => {
    render(
      <LaborLinesEditor
        lines={[]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    expect(
      screen.getByText(/aucune ligne de main-d'œuvre/i),
    ).toBeInTheDocument();
  });

  it('renders one row per line with its label and room', () => {
    render(
      <LaborLinesEditor
        lines={[
          makeLine({ label: 'Peinture murale', room_name: 'Salon' }),
          makeLine({ label: 'Peinture plafond', room_name: 'Salon' }),
        ]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    expect(screen.getAllByDisplayValue(/peinture/i)).toHaveLength(2);
    expect(screen.getAllByText('Salon — 25 m²')).toHaveLength(2);
  });

  it('calls onAdd when clicking the add button', () => {
    render(
      <LaborLinesEditor
        lines={[]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    fireEvent.click(screen.getByText(/ajouter une ligne/i));
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove with the correct index, even after earlier lines shift', () => {
    render(
      <LaborLinesEditor
        lines={[
          makeLine({ label: 'Peinture murale' }),
          makeLine({ label: 'Peinture plafond' }),
        ]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /supprimer la ligne peinture plafond/i,
      }),
    );
    expect(mockRemove).toHaveBeenCalledWith(1);
  });

  it('switching to forfait forces quantity to 1', () => {
    render(
      <LaborLinesEditor
        lines={[makeLine({ quantity: 8 })]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    fireEvent.click(screen.getByText('Forfait'));
    expect(mockUpdate).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ kind: 'flat', quantity: 1 }),
    );
  });

  it('editing the hours calls onUpdate with the whole line', () => {
    render(
      <LaborLinesEditor
        lines={[makeLine({ quantity: 5 })]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    fireEvent.change(screen.getByLabelText('Heures'), {
      target: { value: '8' },
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ quantity: 8 }),
    );
  });

  it('flags a line with no rate as requiring one', () => {
    render(
      <LaborLinesEditor
        lines={[makeLine({ unit_price_ht: 0 })]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    expect(screen.getByText(/taux requis/i)).toBeInTheDocument();
  });

  it('does not flag a line that has a rate', () => {
    render(
      <LaborLinesEditor
        lines={[makeLine({ unit_price_ht: 45 })]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    expect(screen.queryByText(/taux requis/i)).not.toBeInTheDocument();
  });

  it('shows the line total', () => {
    render(
      <LaborLinesEditor
        lines={[makeLine({ quantity: 5, unit_price_ht: 45 })]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    expect(screen.getByText('225,00 EUR')).toBeInTheDocument();
  });

  it('reports a rate edit', () => {
    render(
      <LaborLinesEditor
        lines={[makeLine({ unit_price_ht: 45 })]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    fireEvent.change(screen.getByLabelText(/taux horaire/i), {
      target: { value: '52' },
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ unit_price_ht: 52 }),
    );
  });

  describe('base sourcée (E2-2)', () => {
    const basis = {
      hours_per_unit: 0.25,
      unit_basis: 'm2',
      skill_level: null,
      source_org: 'Bibliothèque de temps unitaires',
      source_document: 'Temps de pose peinture',
      source_url: 'https://example.org/temps',
    };

    it("montre le temps unitaire multiplié par l'assiette, et sa source", () => {
      render(
        <LaborLinesEditor
          lines={[makeLine({ surface_m2: 25, quantity: 6.25, basis })]}
          onAdd={mockAdd}
          onUpdate={mockUpdate}
          onRemove={mockRemove}
        />,
      );
      expect(
        screen.getByText(/base proposée : 0,25 h\/m² × 25 m² = 6,25 h/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /bibliothèque de temps unitaires/i }),
      ).toHaveAttribute('href', 'https://example.org/temps');
    });

    it('nomme le niveau seulement quand le temps en porte un', () => {
      const { rerender } = render(
        <LaborLinesEditor
          lines={[makeLine({ basis })]}
          onAdd={mockAdd}
          onUpdate={mockUpdate}
          onRemove={mockRemove}
        />,
      );
      expect(screen.queryByText(/niveau/i)).not.toBeInTheDocument();

      rerender(
        <LaborLinesEditor
          lines={[makeLine({ basis: { ...basis, skill_level: 'beginner' } })]}
          onAdd={mockAdd}
          onUpdate={mockUpdate}
          onRemove={mockRemove}
        />,
      );
      expect(screen.getByText(/niveau débutant/i)).toBeInTheDocument();
    });

    it("reste vraie quand l'artisan corrige ses heures : elle décrit la proposition, pas la saisie", () => {
      render(
        <LaborLinesEditor
          lines={[makeLine({ surface_m2: 25, quantity: 12, basis })]}
          onAdd={mockAdd}
          onUpdate={mockUpdate}
          onRemove={mockRemove}
        />,
      );
      expect(screen.getByDisplayValue('12')).toBeInTheDocument();
      expect(screen.getByText(/= 6,25 h/)).toBeInTheDocument();
    });

    it("n'affiche rien pour une ligne libre, qui n'a pas de base", () => {
      render(
        <LaborLinesEditor
          lines={[makeLine({ basis: undefined })]}
          onAdd={mockAdd}
          onUpdate={mockUpdate}
          onRemove={mockRemove}
        />,
      );
      expect(screen.queryByText(/base proposée/i)).not.toBeInTheDocument();
    });
  });
});
