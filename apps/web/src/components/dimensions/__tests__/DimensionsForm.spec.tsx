import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DimensionsForm } from '../DimensionsForm';

describe('DimensionsForm', () => {
  const mockSave = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders metric fields by default', () => {
    render(<DimensionsForm onSave={mockSave} />);
    expect(screen.getByLabelText(/longueur \(m\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/largeur \(m\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hauteur \(m\)/i)).toBeInTheDocument();
  });

  it('renders unit selector with metric selected', () => {
    render(<DimensionsForm onSave={mockSave} />);
    const metricBtn = screen.getByRole('radio', { name: /metres/i });
    expect(metricBtn).toBeChecked();
  });

  it('switches to imperial fields', () => {
    render(<DimensionsForm onSave={mockSave} />);
    fireEvent.click(screen.getByRole('radio', { name: /pieds/i }));
    expect(screen.getByLabelText(/longueur \(pieds\)/i)).toBeInTheDocument();
  });

  it('shows error messages when submitting empty form', async () => {
    render(<DimensionsForm onSave={mockSave} />);
    fireEvent.click(screen.getByText(/enregistrer les dimensions/i));

    await waitFor(() => {
      const errors = screen.getAllByText(/ce champ est obligatoire/i);
      expect(errors.length).toBe(3);
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('calls onSave with cm values and openings on valid submit', async () => {
    render(<DimensionsForm onSave={mockSave} />);

    fireEvent.change(screen.getByLabelText(/longueur \(m\)/i), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByLabelText(/largeur \(m\)/i), {
      target: { value: '4' },
    });
    fireEvent.change(screen.getByLabelText(/hauteur \(m\)/i), {
      target: { value: '2.5' },
    });

    // First click shows zero-openings suggestion
    fireEvent.click(screen.getByText(/enregistrer les dimensions/i));

    await waitFor(() => {
      expect(
        screen.getByText(/vous n'avez pas ajoute de portes ou fenetres/i),
      ).toBeInTheDocument();
    });

    // Click continue button to submit without openings
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(500, 400, 250, []);
    });
  });

  it('displays surface area when dimensions are filled', () => {
    render(
      <DimensionsForm
        initialLengthCm={500}
        initialWidthCm={400}
        initialHeightCm={250}
        onSave={mockSave}
      />,
    );
    expect(screen.getByText(/surface totale estimee/i)).toBeInTheDocument();
    expect(screen.getByText(/surface nette des murs/i)).toBeInTheDocument();
  });

  it('shows warning for unusual dimensions', () => {
    render(
      <DimensionsForm
        initialLengthCm={500}
        initialWidthCm={400}
        initialHeightCm={120}
        onSave={mockSave}
      />,
    );
    expect(screen.getByText(/hauteur inhabituelle/i)).toBeInTheDocument();
  });

  it('shows saving state', () => {
    render(<DimensionsForm onSave={mockSave} isSaving />);
    expect(screen.getByText(/enregistrement/i)).toBeInTheDocument();
  });
});
