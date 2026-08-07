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
    quantity_basis: 'room_surface',
    contextual_questions: [],
  },
  {
    id: 'wt-2',
    code: 'ceiling_painting',
    label_fr: 'Peinture plafond',
    category: 'painting',
    surface_target: 'ceiling',
    quantity_basis: 'room_surface',
    contextual_questions: [],
  },
  {
    id: 'wt-3',
    code: 'floor_tiling',
    label_fr: 'Carrelage sol',
    category: 'tiling',
    surface_target: 'floor',
    quantity_basis: 'room_surface',
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
    quantity_basis: 'room_surface',
    contextual_questions: [],
  },
  {
    id: 'wt-5',
    code: 'parquet_flooring',
    label_fr: 'Parquet ou stratifié',
    category: 'flooring',
    surface_target: 'floor',
    quantity_basis: 'room_surface',
    contextual_questions: [],
  },
  {
    id: 'wt-6',
    code: 'drywall',
    label_fr: 'Cloison sèche',
    category: 'partition',
    surface_target: 'wall',
    quantity_basis: 'declared',
    contextual_questions: [],
  },
  {
    id: 'wt-7',
    code: 'wall_covering',
    label_fr: 'Revêtement mural',
    category: 'wall_covering',
    surface_target: 'wall',
    quantity_basis: 'room_surface',
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
    expect(screen.getByText('Parquet ou stratifié')).toBeInTheDocument();
    expect(screen.getByText('Cloison sèche')).toBeInTheDocument();
    expect(screen.getByText('Revêtement mural')).toBeInTheDocument();
  });

  it('renders all 3 skill levels', () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    expect(screen.getByText('Débutant')).toBeInTheDocument();
    expect(screen.getByText('Intermédiaire')).toBeInTheDocument();
    expect(screen.getByText('Confirmé')).toBeInTheDocument();
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
        screen.getByText(/veuillez sélectionner votre niveau de compétence/i),
      ).toBeInTheDocument();
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('shows beginner description when selected', () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    fireEvent.click(screen.getByLabelText(/débutant/i));

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

  /*
    E1-4 — assiette de la cloison sèche : linéaire, hauteur préremplie, faces
    à parementer. Seule la cloison (quantity_basis === 'declared') gagne ces
    champs ; les six ouvrages de recouvrement n'en gagnent aucun.
  */
  describe('assiette déclarée de la cloison sèche (E1-4)', () => {
    it('affiche les champs d’assiette uniquement pour la cloison sèche', () => {
      render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

      expect(screen.queryByLabelText(/linéaire à créer/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /peinture murale/i }));
      expect(screen.queryByLabelText(/linéaire à créer/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /cloison sèche/i }));
      expect(screen.getByLabelText(/linéaire à créer/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/hauteur \(m\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/cloison, deux faces/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/doublage, une face/i)).toBeInTheDocument();
    });

    it('préremplit la hauteur avec celle de la pièce, modifiable', () => {
      render(
        <WorkSelectionForm
          workTypes={mockWorkTypes}
          roomHeightM={2.5}
          onSave={mockSave}
          isSaving={false}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /cloison sèche/i }));
      const height = screen.getByLabelText(/hauteur \(m\)/i) as HTMLInputElement;
      expect(height.value).toBe('2.5');

      fireEvent.change(height, { target: { value: '2.7' } });
      expect(height.value).toBe('2.7');
    });

    it('bloque la soumission avec un linéaire vide, même message que les autres champs requis', async () => {
      render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

      fireEvent.click(screen.getByRole('button', { name: /cloison sèche/i }));
      fireEvent.click(screen.getByLabelText(/confirmé/i));
      fireEvent.click(screen.getByLabelText(/cloison, deux faces/i));
      // Le linéaire reste vide.
      fireEvent.click(screen.getByText('Calculer'));

      await waitFor(() => {
        expect(
          screen.getByText(/veuillez indiquer un linéaire supérieur à zéro/i),
        ).toBeInTheDocument();
      });
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('bloque la soumission avec un linéaire à zéro', async () => {
      render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

      fireEvent.click(screen.getByRole('button', { name: /cloison sèche/i }));
      fireEvent.click(screen.getByLabelText(/confirmé/i));
      fireEvent.click(screen.getByLabelText(/cloison, deux faces/i));
      fireEvent.change(screen.getByLabelText(/linéaire à créer/i), {
        target: { value: '0' },
      });
      fireEvent.click(screen.getByText('Calculer'));

      await waitFor(() => {
        expect(
          screen.getByText(/veuillez indiquer un linéaire supérieur à zéro/i),
        ).toBeInTheDocument();
      });
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('envoie declared_length_m/height_m/clad_faces pour la cloison', async () => {
      render(
        <WorkSelectionForm
          workTypes={mockWorkTypes}
          roomHeightM={2.5}
          onSave={mockSave}
          isSaving={false}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /cloison sèche/i }));
      fireEvent.click(screen.getByLabelText(/confirmé/i));
      fireEvent.change(screen.getByLabelText(/linéaire à créer/i), {
        target: { value: '4' },
      });
      fireEvent.click(screen.getByLabelText(/cloison, deux faces/i));
      fireEvent.click(screen.getByText('Calculer'));

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledWith([
          {
            work_type_id: 'wt-6',
            skill_level: 'expert',
            custom_params: {},
            declared_length_m: 4,
            declared_height_m: 2.5,
            declared_clad_faces: 2,
          },
        ]);
      });
    });
  });

  it('calls onSave with correct payload for simple work type', async () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    fireEvent.click(screen.getByRole('button', { name: /peinture murale/i }));
    fireEvent.click(screen.getByLabelText(/intermédiaire/i));
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
    fireEvent.click(screen.getByLabelText(/confirmé/i));

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
    fireEvent.click(screen.getByLabelText(/confirmé/i));

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
      expect(screen.getByLabelText(/confirmé/i)).toBeChecked();
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
      expect(screen.getByLabelText(/débutant/i)).toBeChecked();
      expect(screen.queryByText(/Repris de/i)).not.toBeInTheDocument();
    });
  });

  it('supports multiple work type selections', async () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    fireEvent.click(screen.getByRole('button', { name: /peinture murale/i }));
    fireEvent.click(screen.getByRole('button', { name: /peinture plafond/i }));
    fireEvent.click(screen.getByLabelText(/débutant/i));

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
