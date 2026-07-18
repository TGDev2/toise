import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PublicCalculator } from '../PublicCalculator';
import { getCalculatorConfig } from '@/lib/calculators';
import { apiPost } from '@/lib/api';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockAuth = {
  appUser: null as { id: string } | null,
  isGuest: false,
  isLoading: false,
  startGuestSession: jest.fn(),
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/lib/api', () => ({
  apiPost: jest.fn(),
  apiPut: jest.fn(),
}));

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
};

jest.mock('@/components/ui', () => ({
  ...jest.requireActual('@/components/ui'),
  useToast: () => mockToast,
}));

const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;

const estimateResponse = {
  work_type_code: 'wall_painting',
  work_type_label: 'Peinture murale',
  skill_level: 'intermediate',
  total_items: 1,
  items: [
    {
      work_item_id: 'public',
      work_type_code: 'wall_painting',
      work_type_label: 'Peinture murale',
      material_id: 'mat-paint',
      material_name: 'Peinture acrylique mate',
      material_unit: 'L',
      gross_surface_m2: 35,
      surface_m2: 33.1,
      theoretical_qty: 6.62,
      waste_factor_percent: 5,
      waste_factor_source: 'catalog' as const,
      adjusted_qty: 6.95,
      packaging_label: 'Pot 10 L',
      packaging_qty_per_unit: 10,
      units_needed: 1,
      pose_type: 'standard',
      number_of_coats: 2,
    },
  ],
};

async function fillAndCompute() {
  fireEvent.change(screen.getByLabelText(/longueur \(m\)/i), {
    target: { value: '4' },
  });
  fireEvent.change(screen.getByLabelText(/largeur \(m\)/i), {
    target: { value: '3' },
  });
  fireEvent.change(screen.getByLabelText(/hauteur \(m\)/i), {
    target: { value: '2.5' },
  });

  // First submit shows the zero-openings suggestion; confirm to continue
  fireEvent.click(screen.getByText(/calculer mon estimation/i));
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: /continuer/i }),
    ).toBeInTheDocument();
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }));
  });
}

describe('PublicCalculator', () => {
  const config = getCalculatorConfig('peinture')!;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockAuth.appUser = null;
    mockAuth.isGuest = false;
  });

  it('renders the email-capture card with an unchecked box and a disabled submit button', async () => {
    mockApiPost.mockResolvedValue(estimateResponse);
    render(<PublicCalculator config={config} />);

    await fillAndCompute();

    expect(
      await screen.findByLabelText(/votre e-mail/i),
    ).toBeInTheDocument();
    const consentBox = screen.getByRole('checkbox');
    expect(consentBox).not.toBeChecked();
    expect(
      screen.getByRole('button', { name: /recevoir par e-mail/i }),
    ).toBeDisabled();
  });

  it('keeps the submit button disabled when the email is filled but consent is unchecked', async () => {
    mockApiPost.mockResolvedValue(estimateResponse);
    render(<PublicCalculator config={config} />);

    await fillAndCompute();
    fireEvent.change(screen.getByLabelText(/votre e-mail/i), {
      target: { value: 'visiteur@example.fr' },
    });

    expect(
      screen.getByRole('button', { name: /recevoir par e-mail/i }),
    ).toBeDisabled();
  });

  it('sends the estimate by email once the box is checked, then shows a success toast and resets the form', async () => {
    mockApiPost.mockResolvedValue(estimateResponse);
    render(<PublicCalculator config={config} />);

    await fillAndCompute();
    fireEvent.change(screen.getByLabelText(/votre e-mail/i), {
      target: { value: 'visiteur@example.fr' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    const submitButton = screen.getByRole('button', {
      name: /recevoir par e-mail/i,
    });
    expect(submitButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/public/calculators/estimate-email',
        {
          length_cm: 400,
          width_cm: 300,
          height_cm: 250,
          openings: [],
          work_type_code: 'wall_painting',
          skill_level: 'intermediate',
          custom_params: { number_of_coats: 2 },
          email: 'visiteur@example.fr',
          consent: true,
        },
      );
      expect(mockToast.success).toHaveBeenCalled();
    });

    expect(screen.getByLabelText(/votre e-mail/i)).toHaveValue('');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('shows an error toast when the email-send request fails', async () => {
    mockApiPost.mockResolvedValue(estimateResponse);
    render(<PublicCalculator config={config} />);

    await fillAndCompute();
    fireEvent.change(screen.getByLabelText(/votre e-mail/i), {
      target: { value: 'visiteur@example.fr' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    mockApiPost.mockRejectedValueOnce(new Error('Trop de tentatives'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /recevoir par e-mail/i }));
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Trop de tentatives');
    });
  });

  it('renders variant toggle, skill selector and params', () => {
    render(<PublicCalculator config={config} />);
    expect(screen.getByRole('radio', { name: /murs/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /plafond/i })).not.toBeChecked();
    expect(screen.getByLabelText(/nombre de couches/i)).toBeInTheDocument();
    expect(screen.getByText(/intermediaire/i)).toBeInTheDocument();
  });

  it('submits dimensions to the public endpoint and shows results', async () => {
    mockApiPost.mockResolvedValue(estimateResponse);
    render(<PublicCalculator config={config} />);

    await fillAndCompute();

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/public/calculators/estimate', {
        length_cm: 400,
        width_cm: 300,
        height_cm: 250,
        openings: [],
        work_type_code: 'wall_painting',
        skill_level: 'intermediate',
        custom_params: { number_of_coats: 2 },
      });
    });

    expect(
      await screen.findByText(/peinture acrylique mate/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/sauvegarder mon projet/i)).toBeInTheDocument();
  });

  it('saves a guest draft, starts a guest session and redirects to the dashboard', async () => {
    mockApiPost.mockResolvedValue(estimateResponse);
    mockAuth.startGuestSession.mockResolvedValue(undefined);
    render(<PublicCalculator config={config} />);

    await fillAndCompute();
    const saveButton = await screen.findByText(/sauvegarder mon projet/i);
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockAuth.startGuestSession).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    const drafts = JSON.parse(
      localStorage.getItem('chiffreo_local_projects') ?? '[]',
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      name: 'Mon projet peinture',
      room_name: 'Ma pièce',
      work_type: 'painting',
      length_m: 4,
      width_m: 3,
      height_m: 2.5,
      openings: [],
    });
    expect(drafts[0].updated_at).toBeTruthy();
  });
});
