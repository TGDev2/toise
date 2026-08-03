import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ShoppingListPage from '../page';
import { apiDownload, apiGet } from '@/lib/api';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'project-1' }),
}));

const mockAuth = {
  appUser: null as { id: string } | null,
  isGuest: false,
  isLoading: false,
  convertGuestAccount: jest.fn(),
  convertGuestWithGoogle: jest.fn(),
  convertGuestWithApple: jest.fn(),
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/contexts/FeatureGateContext', () => ({
  useFeatureGates: () => ({
    isFeatureAllowed: () => false,
    showPaywall: jest.fn(),
  }),
}));

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPatch: jest.fn(),
  apiPost: jest.fn(),
  apiDownload: jest.fn(),
}));

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockApiDownload = apiDownload as jest.MockedFunction<typeof apiDownload>;

const shoppingList = {
  id: 'sl-1',
  project_id: 'project-1',
  estimation_id: 'est-1',
  is_stale: false,
  material_items: [
    {
      material_id: 'mat-1',
      work_type_code: 'wall_painting',
      work_type_label: 'Peinture murale',
      material_name: 'Peinture acrylique mate',
      material_category: 'painting',
      material_unit: 'L',
      packaging_label: 'Pot 10 L',
      packaging_qty_per_unit: 10,
      adjusted_qty: 6.95,
      original_units_needed: 1,
      units_needed: 1,
      is_manually_adjusted: false,
    },
  ],
  complementary_items: [],
  created_at: '2026-08-04T00:00:00.000Z',
  updated_at: '2026-08-04T00:00:00.000Z',
};

function mockLoad() {
  mockApiGet.mockImplementation((path: string) => {
    if (path.endsWith('/shopping-list')) return Promise.resolve(shoppingList);
    if (path.endsWith('/buy-links')) return Promise.resolve({ links: [] });
    return Promise.resolve({ name: 'Salon' });
  });
}

/**
 * E2-1. Terminus du parcours invité : c'est ce qu'il est venu chercher. La
 * garde `!appUser` seule l'éjectait vers `/login` — et les deux actions qui
 * doivent rester derrière la création de compte (PDF, partage) n'étaient
 * gardées ni ici ni côté serveur.
 */
describe('ShoppingListPage — parcours invité et conversion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.appUser = null;
    mockAuth.isGuest = false;
    mockAuth.isLoading = false;
    mockLoad();
  });

  it("n'éjecte pas un invité et charge sa liste", async () => {
    mockAuth.isGuest = true;

    render(<ShoppingListPage />);

    expect(
      await screen.findByText('Peinture acrylique mate'),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('éjecte toujours un visiteur sans session', async () => {
    render(<ShoppingListPage />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  describe('moments de conversion', () => {
    beforeEach(() => {
      mockAuth.isGuest = true;
    });

    it("propose la création de compte au lieu de télécharger le PDF", async () => {
      render(<ShoppingListPage />);
      fireEvent.click(await screen.findByText('Télécharger PDF'));

      expect(
        await screen.findByText('Créez un compte pour sauvegarder'),
      ).toBeInTheDocument();
      expect(mockApiDownload).not.toHaveBeenCalled();
    });

    it('propose la création de compte au lieu du panneau de partage', async () => {
      render(<ShoppingListPage />);
      fireEvent.click(await screen.findByText('Partager un lien'));

      expect(
        await screen.findByText('Créez un compte pour sauvegarder'),
      ).toBeInTheDocument();
    });

    /**
     * On lui a fait payer le prix — l'inscription — au moment où il voulait son
     * PDF : le lui livrer sans qu'il ait à redécouvrir le bouton est le
     * minimum. La modale reste ouverte tant que rien n'aboutit.
     */
    it("rejoue le téléchargement après l'inscription", async () => {
      mockAuth.convertGuestAccount.mockResolvedValue(undefined);

      render(<ShoppingListPage />);
      fireEvent.click(await screen.findByText('Télécharger PDF'));

      fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'invite@example.com' },
      });
      fireEvent.change(screen.getByLabelText('Mot de passe'), {
        target: { value: 'motdepasse1' },
      });
      fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
        target: { value: 'motdepasse1' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /s'inscrire et sauvegarder/i }),
      );

      await waitFor(() =>
        expect(mockApiDownload).toHaveBeenCalledWith(
          '/projects/project-1/shopping-list/export/pdf',
          'liste-courses-Salon.pdf',
        ),
      );
    });
  });

  it('télécharge directement pour un compte inscrit', async () => {
    mockAuth.appUser = { id: 'user-1' };

    render(<ShoppingListPage />);
    fireEvent.click(await screen.findByText('Télécharger PDF'));

    await waitFor(() => expect(mockApiDownload).toHaveBeenCalled());
    expect(
      screen.queryByText('Créez un compte pour sauvegarder'),
    ).not.toBeInTheDocument();
  });
});
