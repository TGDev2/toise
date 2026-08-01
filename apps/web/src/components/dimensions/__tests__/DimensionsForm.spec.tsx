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

  // PRO-5 : les champs métriques étaient en `type="number"`, qui refuse la
  // virgule des claviers français et renvoie alors une chaîne vide. « 2,5 m »
  // partait donc à 0 cm vers l'API, sans erreur ni signal visible.
  it('accepts French decimal commas in metric fields', async () => {
    render(<DimensionsForm onSave={mockSave} />);

    fireEvent.change(screen.getByLabelText(/longueur \(m\)/i), {
      target: { value: '5,2' },
    });
    fireEvent.change(screen.getByLabelText(/largeur \(m\)/i), {
      target: { value: '4' },
    });
    fireEvent.change(screen.getByLabelText(/hauteur \(m\)/i), {
      target: { value: '2,5' },
    });

    fireEvent.click(screen.getByText(/enregistrer les dimensions/i));
    await waitFor(() => {
      expect(
        screen.getByText(/vous n'avez pas ajoute de portes ou fenêtres/i),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(520, 400, 250, [], [], []);
    });
  });

  it('renders unit selector with metric selected', () => {
    render(<DimensionsForm onSave={mockSave} />);
    const metricBtn = screen.getByRole('radio', { name: /mètres/i });
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
        screen.getByText(/vous n'avez pas ajoute de portes ou fenêtres/i),
      ).toBeInTheDocument();
    });

    // Click continue button to submit without openings
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }));

    await waitFor(() => {
      // 5ᵉ argument : segments, 6ᵉ : exclusions (vides tant qu'aucun ajout)
      expect(mockSave).toHaveBeenCalledWith(500, 400, 250, [], [], []);
    });
  });

  it('adds a décroché section and calls onSave with composite segments', async () => {
    render(
      <DimensionsForm
        initialLengthCm={400}
        initialWidthCm={300}
        initialHeightCm={250}
        onSave={mockSave}
      />,
    );

    // Ajoute un décroché à droite (offset 0, largeur 150, profondeur 200)
    fireEvent.click(screen.getByRole('button', { name: /décroché/i }));
    fireEvent.change(screen.getByLabelText(/depuis le coin/i), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByLabelText(/largeur \(cm\)/i), {
      target: { value: '150' },
    });
    fireEvent.change(screen.getByLabelText(/profondeur \(cm\)/i), {
      target: { value: '200' },
    });

    // Aucune ouverture → premier clic affiche la suggestion, puis « Continuer »
    fireEvent.click(screen.getByText(/enregistrer les dimensions/i));
    await waitFor(() => {
      expect(
        screen.getByText(/vous n'avez pas ajoute de portes ou fenêtres/i),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        400,
        300,
        250,
        [],
        [
          { x_cm: 0, y_cm: 0, length_cm: 400, width_cm: 300 },
          { x_cm: 400, y_cm: 0, length_cm: 200, width_cm: 150 },
        ],
        [],
      );
    });
  });

  it('adds a wall exclusion, reflects it in the net wall breakdown and calls onSave with it', async () => {
    render(
      <DimensionsForm
        initialLengthCm={500}
        initialWidthCm={400}
        initialHeightCm={250}
        onSave={mockSave}
      />,
    );

    fireEvent.click(screen.getByText(/\+ crédence/i));

    await waitFor(() => {
      expect(screen.getByText(/zones exclues/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/enregistrer les dimensions/i));
    await waitFor(() => {
      expect(
        screen.getByText(/vous n'avez pas ajoute de portes ou fenêtres/i),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(500, 400, 250, [], [], [
        { surface_target: 'wall', type: 'credence', area_m2: 2 },
      ]);
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
    expect(screen.getByText(/surface totale estimée/i)).toBeInTheDocument();
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

  // CV-5 : badge d'incertitude affiché uniquement pour une pièce mesurée par CV.
  describe('CV-5 uncertainty badges', () => {
    it('shows no badge by default (manual entry)', () => {
      render(
        <DimensionsForm
          initialLengthCm={420}
          initialWidthCm={310}
          initialHeightCm={250}
          onSave={mockSave}
        />,
      );
      expect(screen.queryByText(/±/)).not.toBeInTheDocument();
    });

    it('shows a per-field badge when sourceIsCv is true', () => {
      render(
        <DimensionsForm
          initialLengthCm={420}
          initialWidthCm={310}
          initialHeightCm={250}
          sourceIsCv
          lengthUncertaintyCm={15}
          widthUncertaintyCm={8}
          heightUncertaintyCm={null}
          onSave={mockSave}
        />,
      );
      expect(screen.getByText('± 15 cm')).toBeInTheDocument();
      expect(screen.getByText('± 8 cm')).toBeInTheDocument();
      // Pas d'incertitude connue pour la hauteur → pas de badge sur ce champ.
      expect(screen.getAllByText(/±/)).toHaveLength(2);
    });

    it('hides the badge when sourceIsCv is false even if an uncertainty value is passed', () => {
      render(
        <DimensionsForm
          initialLengthCm={420}
          initialWidthCm={310}
          initialHeightCm={250}
          lengthUncertaintyCm={15}
          onSave={mockSave}
        />,
      );
      expect(screen.queryByText(/±/)).not.toBeInTheDocument();
    });
  });
});
