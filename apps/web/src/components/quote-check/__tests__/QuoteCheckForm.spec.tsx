import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { QuoteCheckForm } from '../QuoteCheckForm';
import { apiPost } from '@/lib/api';
import { QUOTE_COHERENCE_WORDING } from '@/lib/quote-check';

jest.mock('@/lib/api', () => ({
  apiPost: jest.fn(),
}));

const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;

const items = [
  {
    work_item_id: 'public',
    work_type_code: 'wall_painting',
    work_type_label: 'Peinture murale',
    material_id: 'mat-paint',
    material_name: 'Peinture acrylique mate',
    material_unit: 'L',
    gross_surface_m2: 35,
    surface_m2: 33.11,
    theoretical_qty: 6.62,
    waste_factor_percent: 10,
    waste_factor_source: 'catalog' as const,
    adjusted_qty: 7.28,
    packaging_label: 'Pot 10 L',
    packaging_qty_per_unit: 10,
    units_needed: 1,
    pose_type: 'standard',
    number_of_coats: 2,
  },
];

function makeResponse(overrides: Record<string, unknown> = {}) {
  return {
    work_type_code: 'wall_painting',
    work_type_label: 'Peinture murale',
    surface_target: 'wall',
    gross_surface_m2: 35,
    net_surface_m2: 33.11,
    deducted_m2: 1.89,
    declared_surface_m2: 46,
    implied_waste_percent: 38.9,
    reference: {
      pose_type: 'standard',
      min_percent: 5,
      max_percent: 15,
      by_skill: [
        { skill_level: 'beginner', percent: 15 },
        { skill_level: 'intermediate', percent: 10 },
        { skill_level: 'expert', percent: 5 },
      ],
      is_default: false,
    },
    status: 'above_reference',
    items,
    ...overrides,
  };
}

/**
 * `DimensionsForm` intercepte le premier envoi quand la pièce n'a aucune
 * ouverture, pour proposer d'en ajouter. Il faut confirmer pour poursuivre —
 * même geste que dans `PublicCalculator.spec.tsx`.
 */
async function fillAndCheck(declaredSurface = '46') {
  fireEvent.change(screen.getByLabelText(/quantité inscrite au devis/i), {
    target: { value: declaredSurface },
  });
  fireEvent.change(screen.getByLabelText(/longueur \(m\)/i), {
    target: { value: '4' },
  });
  fireEvent.change(screen.getByLabelText(/largeur \(m\)/i), {
    target: { value: '3' },
  });
  fireEvent.change(screen.getByLabelText(/hauteur \(m\)/i), {
    target: { value: '2.5' },
  });

  fireEvent.click(screen.getByText(/vérifier les quantités/i));
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: /continuer/i }),
    ).toBeInTheDocument();
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }));
  });
}

describe('QuoteCheckForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiPost.mockResolvedValue(makeResponse());
  });

  it('submits the room and the declared quantity to the public endpoint', async () => {
    render(<QuoteCheckForm />);
    await fillAndCheck();

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/public/quote-check', {
        length_cm: 400,
        width_cm: 300,
        height_cm: 250,
        openings: [],
        work_type_code: 'wall_painting',
        custom_params: { number_of_coats: 2 },
        declared_surface_m2: 46,
      });
    });
  });

  it('renders the verdict wording and its caveat, never a raw status code', async () => {
    render(<QuoteCheckForm />);
    await fillAndCheck();

    const wording = QUOTE_COHERENCE_WORDING.above_reference;
    expect(await screen.findByText(wording.headline)).toBeInTheDocument();
    // La réserve est le garde-fou : un « au-dessus » affiché sans ses causes
    // légitimes est exactement le verdict qui peut nuire à une entreprise.
    expect(screen.getByText(wording.caveat!)).toBeInTheDocument();
    expect(screen.queryByText('above_reference')).not.toBeInTheDocument();
  });

  it('shows the net surface, what was deducted, and the reference bracket', async () => {
    render(<QuoteCheckForm />);
    await fillAndCheck();

    expect(await screen.findByText('33,11 m²')).toBeInTheDocument();
    expect(screen.getByText(/1,89 m² déduits/)).toBeInTheDocument();
    expect(screen.getByText('5 à 15 %')).toBeInTheDocument();
    expect(screen.getByText(/\+ 38,9 % de marge/)).toBeInTheDocument();
  });

  it('says when the bracket is only a generic default', async () => {
    // Sinon « pas de référence de pose » et « référence de pose » produisent le
    // même écran, et le lecteur croit à une fourchette qui n'en est pas une.
    mockApiPost.mockResolvedValue(
      makeResponse({
        reference: {
          pose_type: 'standard',
          min_percent: 10,
          max_percent: 10,
          by_skill: [],
          is_default: true,
        },
      }),
    );
    render(<QuoteCheckForm />);
    await fillAndCheck();

    expect(
      await screen.findByText(/aucune référence de pose/i),
    ).toBeInTheDocument();
  });

  it('refuses to call the API without a declared quantity', async () => {
    render(<QuoteCheckForm />);
    await fillAndCheck('');

    expect(mockApiPost).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/indiquez la quantité que porte le devis/i),
    ).toBeInTheDocument();
  });

  it('always offers the lump-sum guidance, before any check is run', async () => {
    // L'objection la plus solide : beaucoup de devis sont forfaitaires, sans
    // quantité. La page doit le dire d'emblée, pas après un échec.
    render(<QuoteCheckForm />);

    expect(screen.getByText(/votre devis est au forfait/i)).toBeInTheDocument();
  });

  it('surfaces an API error instead of a silent empty result', async () => {
    mockApiPost.mockRejectedValue(new Error('Type de travaux inconnu'));
    render(<QuoteCheckForm />);
    await fillAndCheck();

    expect(
      await screen.findByText('Type de travaux inconnu'),
    ).toBeInTheDocument();
  });
});
