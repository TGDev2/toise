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
});
