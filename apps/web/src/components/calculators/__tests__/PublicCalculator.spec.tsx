import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PublicCalculator } from '../PublicCalculator';
import { getCalculatorConfig } from '@/lib/calculators';
import { apiPost } from '@/lib/api';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

interface GuestDraft {
  id: string;
  name: string;
}

const mockAuth = {
  appUser: null as { id: string } | null,
  isGuest: false,
  isLoading: false,
  startGuestSession: jest.fn<
    Promise<{ migrated: string[]; failed: GuestDraft[] }>,
    []
  >(),
};

const DRAFTS_KEY = 'chiffreo_local_projects';

const storedDrafts = (): GuestDraft[] =>
  JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '[]') as GuestDraft[];

/**
 * Brouillons présents **à l'instant où `startGuestSession` est appelée**.
 *
 * C'est le seul relevé qui prouve quelque chose : après l'appel, la clé locale
 * est vide — la session invité adopte les brouillons. Un test qui lirait
 * `localStorage` après coup ne verrait plus rien et conclurait, à tort, que rien
 * n'a été écrit.
 */
let draftsAtSessionStart: Record<string, unknown>[] = [];

/**
 * Ce que fait réellement `startGuestSession` quand tout se passe bien : elle
 * ouvre la session **et** adopte les brouillons, donc la clé locale est vide
 * quand elle rend la main.
 */
function guestSessionMigrating(): void {
  mockAuth.startGuestSession.mockImplementation(async () => {
    draftsAtSessionStart = storedDrafts() as unknown as Record<string, unknown>[];
    localStorage.removeItem(DRAFTS_KEY);
    return {
      migrated: draftsAtSessionStart.map((_, index) => `srv-${index}`),
      failed: [],
    };
  });
}

/** Session ouverte, migration refusée : le brouillon reste sur l'appareil. */
function guestSessionFailingToMigrate(): void {
  mockAuth.startGuestSession.mockImplementation(async () => {
    draftsAtSessionStart = storedDrafts() as unknown as Record<string, unknown>[];
    return { migrated: [], failed: storedDrafts() };
  });
}

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
    draftsAtSessionStart = [];
    guestSessionMigrating();
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
    expect(screen.getByText(/intermédiaire/i)).toBeInTheDocument();
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
    // E4-5 : le nombre mis en avant est le conditionnement à acheter, pas
    // seulement une quantité en litres — c'est le terrain où une calculette
    // d'enseigne ne suit pas.
    expect(screen.getAllByText(/1 × pot 10 l/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/sauvegarder mon projet/i)).toBeInTheDocument();
  });

  it('forwards the surface exclusions the visitor declared (GTM-9)', async () => {
    // Le formulaire déduit déjà la crédence dans son aperçu en direct. Si elle
    // ne part pas dans la requête, la page chiffre une surface plus grande que
    // celle qu'elle vient d'afficher.
    mockApiPost.mockResolvedValue(estimateResponse);
    render(<PublicCalculator config={config} />);

    fireEvent.click(screen.getByRole('button', { name: /\+ crédence/i }));
    await fillAndCompute();

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/public/calculators/estimate',
        expect.objectContaining({
          exclusions: [
            { surface_target: 'wall', type: 'credence', area_m2: 2 },
          ],
        }),
      );
    });
  });

  it('omits the exclusions key entirely when none was declared (GTM-9)', async () => {
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
  });

  /**
   * Le brouillon doit être **écrit avant** l'ouverture de la session : c'est
   * `startGuestSession` qui adopte les brouillons présents, et elle ne repasse
   * pas. L'écrire après ferait de l'ordre des deux instructions une course, et
   * du brouillon un orphelin.
   */
  it('saves a guest draft, starts a guest session and redirects to the dashboard', async () => {
    mockApiPost.mockResolvedValue(estimateResponse);
    guestSessionMigrating();
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

    // Le brouillon existait bien **avant** l'ouverture de la session : c'est
    // `startGuestSession` qui l'adopte, et elle ne repasse pas. L'écrire après
    // ferait de l'ordre des deux instructions une course, et du brouillon un
    // orphelin.
    expect(draftsAtSessionStart).toHaveLength(1);
    expect(draftsAtSessionStart[0]).toMatchObject({
      name: 'Mon projet peinture',
      room_name: 'Ma pièce',
      work_type: 'painting',
      length_m: 4,
      width_m: 3,
      height_m: 2.5,
      openings: [],
    });
    expect(draftsAtSessionStart[0].updated_at).toBeTruthy();

    // Adopté, donc plus rien en local : c'est ce qui empêche le tableau de bord
    // d'afficher en même temps une liste API vide et une carte de brouillon.
    expect(localStorage.getItem(DRAFTS_KEY)).toBeNull();
  });

  /**
   * Le cul-de-sac du parcours d'acquisition, vu depuis l'écran où le geste a eu
   * lieu : quand la migration échoue, atterrir sur le tableau de bord ferait
   * croire que c'est enregistré. L'utilisateur doit lire une erreur qui dit quoi
   * faire, et retrouver sa saisie.
   */
  it('n’envoie pas vers le tableau de bord quand le brouillon n’a pas pu être migré', async () => {
    mockApiPost.mockResolvedValue(estimateResponse);
    guestSessionFailingToMigrate();
    render(<PublicCalculator config={config} />);

    await fillAndCompute();
    await act(async () => {
      fireEvent.click(await screen.findByText(/sauvegarder mon projet/i));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/votre saisie est conservée/i),
      ).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();

    // La saisie est bien là où l'alerte promet qu'elle est.
    expect(storedDrafts()).toHaveLength(1);
    expect(storedDrafts()[0]).toMatchObject({ name: 'Mon projet peinture' });
  });

  /**
   * Un invité déjà en session passe par la branche API : le projet est créé
   * côté serveur et le parcours continue sur l'identifiant que le serveur a
   * émis — jamais sur un uuid local.
   */
  it('crée le projet côté API et poursuit le parcours quand la session est déjà ouverte', async () => {
    mockApiPost.mockImplementation((path: string) =>
      path === '/projects'
        ? Promise.resolve({ id: 'srv-42' })
        : Promise.resolve(estimateResponse),
    );
    mockAuth.appUser = { id: 'user-1' };
    mockAuth.isGuest = true;
    render(<PublicCalculator config={config} />);

    await fillAndCompute();
    await act(async () => {
      fireEvent.click(await screen.findByText(/sauvegarder mon projet/i));
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/projects/srv-42/work-selection');
    });
    expect(mockAuth.startGuestSession).not.toHaveBeenCalled();
    expect(localStorage.getItem(DRAFTS_KEY)).toBeNull();
  });

  /**
   * E4-5 : la migration du brouillon invité (`AuthContext.guest-migration.spec.tsx`)
   * prouve déjà, champ par champ, que `segments`/`exclusions` sont **rejoués**
   * vers l'API à l'inscription — mais rien ne prouvait jusqu'ici que
   * `PublicCalculator` les **écrit** dans le brouillon en premier lieu. La
   * régression GTM-9 (exclusions saisies puis jetées avant l'appel) était côté
   * écriture, pas côté lecture.
   */
  it('carries segments and exclusions declared on the public page into the guest draft', async () => {
    mockApiPost.mockResolvedValue(estimateResponse);
    guestSessionMigrating();
    render(<PublicCalculator config={config} />);

    fireEvent.click(screen.getByRole('button', { name: /\+ crédence/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /oui, ajouter un décroché/i }),
    );
    await fillAndCompute();

    const saveButton = await screen.findByText(/sauvegarder mon projet/i);
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    const drafts = draftsAtSessionStart;
    expect(drafts).toHaveLength(1);
    expect(drafts[0].exclusions).toEqual([
      { surface_target: 'wall', type: 'credence', area_m2: 2 },
    ]);
    // `DimensionsForm` résout le décroché saisi en rectangles avant de le
    // remonter : la pièce (4 × 3 m) et l'ajout du décroché (1 × 1 m).
    expect(drafts[0].segments).toEqual([
      { x_cm: 0, y_cm: 0, length_cm: 400, width_cm: 300 },
      { x_cm: 400, y_cm: 0, length_cm: 100, width_cm: 100 },
    ]);
  });
});
