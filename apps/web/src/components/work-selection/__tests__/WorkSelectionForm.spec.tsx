import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkSelectionForm } from '../WorkSelectionForm';
import type { WorkTypeRef } from '@/lib/work-types';

const mockWorkTypes: WorkTypeRef[] = [
  {
    id: 'wt-1',
    code: 'wall_painting',
    label_fr: 'Peinture murale',
    category: 'painting',
    surface_target: 'wall',
    contextual_questions: [],
  },
  {
    id: 'wt-2',
    code: 'ceiling_painting',
    label_fr: 'Peinture plafond',
    category: 'painting',
    surface_target: 'ceiling',
    contextual_questions: [],
  },
  {
    id: 'wt-3',
    code: 'floor_tiling',
    label_fr: 'Carrelage sol',
    category: 'tiling',
    surface_target: 'floor',
    contextual_questions: [
      {
        key: 'tile_format',
        type: 'select' as const,
        label_fr: 'Format du carreau',
        options: [
          { value: '30x30', label_fr: '30 x 30 cm' },
          { value: '60x60', label_fr: '60 x 60 cm' },
        ],
        required: true,
      },
      {
        key: 'laying_pattern',
        type: 'select' as const,
        label_fr: 'Type de pose',
        options: [
          { value: 'straight', label_fr: 'Pose droite' },
          { value: 'diagonal', label_fr: 'Pose diagonale' },
        ],
        required: true,
      },
    ],
  },
  {
    id: 'wt-4',
    code: 'wall_tiling',
    label_fr: 'Carrelage mural',
    category: 'tiling',
    surface_target: 'wall',
    contextual_questions: [],
  },
  {
    id: 'wt-5',
    code: 'parquet_flooring',
    label_fr: 'Parquet ou stratifie',
    category: 'flooring',
    surface_target: 'floor',
    contextual_questions: [],
  },
  {
    id: 'wt-6',
    code: 'drywall',
    label_fr: 'Cloison seche',
    category: 'partition',
    surface_target: 'wall',
    contextual_questions: [],
  },
  {
    id: 'wt-7',
    code: 'wall_covering',
    label_fr: 'Revetement mural',
    category: 'wall_covering',
    surface_target: 'wall',
    contextual_questions: [],
  },
];

describe('WorkSelectionForm', () => {
  const mockSave = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all 7 work types', () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    expect(screen.getByText('Peinture murale')).toBeInTheDocument();
    expect(screen.getByText('Peinture plafond')).toBeInTheDocument();
    expect(screen.getByText('Carrelage sol')).toBeInTheDocument();
    expect(screen.getByText('Carrelage mural')).toBeInTheDocument();
    expect(screen.getByText('Parquet ou stratifie')).toBeInTheDocument();
    expect(screen.getByText('Cloison seche')).toBeInTheDocument();
    expect(screen.getByText('Revetement mural')).toBeInTheDocument();
  });

  it('renders all 3 skill levels', () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    expect(screen.getByText('Debutant')).toBeInTheDocument();
    expect(screen.getByText('Intermediaire')).toBeInTheDocument();
    expect(screen.getByText('Confirme')).toBeInTheDocument();
  });

  it('toggles work type selection', () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    const wallPainting = screen.getByRole('button', { name: /peinture murale/i });
    expect(wallPainting).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(wallPainting);
    expect(wallPainting).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(wallPainting);
    expect(wallPainting).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows validation errors when submitting without selections', async () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    fireEvent.click(screen.getByText('Calculer'));

    await waitFor(() => {
      expect(
        screen.getByText(/veuillez sélectionner au moins un type de travaux/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/veuillez sélectionner votre niveau de competence/i),
      ).toBeInTheDocument();
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('shows beginner description when selected', () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    fireEvent.click(screen.getByLabelText(/debutant/i));

    expect(
      screen.getByText(/facteur de perte sera augmenté/i),
    ).toBeInTheDocument();
  });

  it('shows contextual questions when floor tiling is selected', () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    fireEvent.click(screen.getByRole('button', { name: /carrelage sol/i }));

    expect(screen.getByText('Format du carreau')).toBeInTheDocument();
    expect(screen.getByText('Type de pose')).toBeInTheDocument();
  });

  it('hides contextual questions when floor tiling is deselected', () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    fireEvent.click(screen.getByRole('button', { name: /carrelage sol/i }));
    expect(screen.getByText('Format du carreau')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /carrelage sol/i }));
    expect(screen.queryByText('Format du carreau')).not.toBeInTheDocument();
  });

  it('calls onSave with correct payload for simple work type', async () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    fireEvent.click(screen.getByRole('button', { name: /peinture murale/i }));
    fireEvent.click(screen.getByLabelText(/intermediaire/i));
    fireEvent.click(screen.getByText('Calculer'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith([
        {
          work_type_id: 'wt-1',
          skill_level: 'intermediate',
          custom_params: {},
        },
      ]);
    });
  });

  it('calls onSave with contextual params for floor tiling', async () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    fireEvent.click(screen.getByRole('button', { name: /carrelage sol/i }));
    fireEvent.click(screen.getByLabelText(/confirme/i));

    // Fill contextual questions
    fireEvent.change(screen.getByLabelText(/format du carreau/i), {
      target: { value: '30x30' },
    });
    fireEvent.change(screen.getByLabelText(/type de pose/i), {
      target: { value: 'diagonal' },
    });

    fireEvent.click(screen.getByText('Calculer'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith([
        {
          work_type_id: 'wt-3',
          skill_level: 'expert',
          custom_params: { tile_format: '30x30', laying_pattern: 'diagonal' },
        },
      ]);
    });
  });

  it('does not submit when required contextual params are missing', async () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    fireEvent.click(screen.getByRole('button', { name: /carrelage sol/i }));
    fireEvent.click(screen.getByLabelText(/confirme/i));

    // Don't fill contextual questions
    fireEvent.click(screen.getByText('Calculer'));

    await waitFor(() => {
      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  /*
    E4-4 — reprise de la pièce précédente ou du dernier chantier. L'artisan de
    finition refait les mêmes ouvrages et ne change pas de niveau : la sélection
    repartait pourtant de zéro à chaque pièce, pour 15,3 s mesurées à 390 px.
  */
  describe('reprise du dernier chantier (E4-4)', () => {
    const suggestion = {
      work_type_ids: ['wt-1', 'wt-2'],
      skill_level: 'expert',
      custom_params: {},
      source: 'project' as const,
    };

    it('pré-coche les ouvrages et le niveau repris, et le dit', () => {
      render(
        <WorkSelectionForm
          workTypes={mockWorkTypes}
          suggestion={suggestion}
          onSave={mockSave}
          isSaving={false}
        />,
      );

      expect(
        screen.getByRole('button', { name: /peinture murale/i }),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(
        screen.getByRole('button', { name: /peinture plafond/i }),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText(/confirme/i)).toBeChecked();
      expect(screen.getByText(/votre dernier chantier/i)).toBeInTheDocument();
    });

    it('annonce la pièce précédente quand la reprise vient du même chantier', () => {
      render(
        <WorkSelectionForm
          workTypes={mockWorkTypes}
          suggestion={{ ...suggestion, source: 'room' }}
          onSave={mockSave}
          isSaving={false}
        />,
      );
      expect(screen.getByText(/la pièce précédente/i)).toBeInTheDocument();
    });

    it('soumet la reprise sans geste supplémentaire', async () => {
      render(
        <WorkSelectionForm
          workTypes={mockWorkTypes}
          suggestion={suggestion}
          onSave={mockSave}
          isSaving={false}
        />,
      );

      fireEvent.click(screen.getByText('Calculer'));

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              work_type_id: 'wt-1',
              skill_level: 'expert',
            }),
            expect.objectContaining({
              work_type_id: 'wt-2',
              skill_level: 'expert',
            }),
          ]),
        );
      });
    });

    it('reprend aussi les réponses contextuelles', async () => {
      render(
        <WorkSelectionForm
          workTypes={mockWorkTypes}
          suggestion={{
            work_type_ids: ['wt-3'],
            skill_level: 'expert',
            custom_params: {
              'wt-3': { tile_format: '60x60', laying_pattern: 'straight' },
            },
            source: 'project',
          }}
          onSave={mockSave}
          isSaving={false}
        />,
      );

      fireEvent.click(screen.getByText('Calculer'));

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledWith([
          {
            work_type_id: 'wt-3',
            skill_level: 'expert',
            custom_params: {
              tile_format: '60x60',
              laying_pattern: 'straight',
            },
          },
        ]);
      });
    });

    /*
      Ce que l'artisan a enregistré pour CETTE pièce prime toujours : une
      reprise qui écraserait une sélection existante changerait les quantités
      d'une pièce déjà chiffrée, en silence.
    */
    it("ne touche pas à une pièce qui a déjà ses propres travaux", () => {
      render(
        <WorkSelectionForm
          workTypes={mockWorkTypes}
          initialSelections={[
            {
              id: 'wi-1',
              work_type: mockWorkTypes[3],
              skill_level: 'beginner',
              custom_params: {},
            },
          ]}
          suggestion={suggestion}
          onSave={mockSave}
          isSaving={false}
        />,
      );

      expect(
        screen.getByRole('button', { name: /carrelage mural/i }),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(
        screen.getByRole('button', { name: /peinture murale/i }),
      ).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByLabelText(/debutant/i)).toBeChecked();
      expect(screen.queryByText(/Repris de/i)).not.toBeInTheDocument();
    });
  });

  it('supports multiple work type selections', async () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    fireEvent.click(screen.getByRole('button', { name: /peinture murale/i }));
    fireEvent.click(screen.getByRole('button', { name: /peinture plafond/i }));
    fireEvent.click(screen.getByLabelText(/debutant/i));

    fireEvent.click(screen.getByText('Calculer'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ work_type_id: 'wt-1', skill_level: 'beginner' }),
          expect.objectContaining({ work_type_id: 'wt-2', skill_level: 'beginner' }),
        ]),
      );
    });
  });
});
