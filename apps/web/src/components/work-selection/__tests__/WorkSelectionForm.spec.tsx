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
        screen.getByText(/veuillez selectionner au moins un type de travaux/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/veuillez selectionner votre niveau de competence/i),
      ).toBeInTheDocument();
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('shows beginner description when selected', () => {
    render(<WorkSelectionForm workTypes={mockWorkTypes} onSave={mockSave} isSaving={false} />);

    fireEvent.click(screen.getByLabelText(/debutant/i));

    expect(
      screen.getByText(/facteur de perte sera augmente/i),
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
