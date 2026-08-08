import { render, screen, waitFor } from '@testing-library/react';
import EstimatePage from '../page';
import { apiGet, apiPost } from '@/lib/api';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'project-1' }),
}));

const mockAuth = {
  appUser: null as { id: string } | null,
  isGuest: false,
  isLoading: false,
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/contexts/FeatureGateContext', () => ({
  useFeatureGates: () => ({ isFeatureAllowed: () => false }),
}));

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;

const estimation = {
  id: 'est-1',
  project_id: 'project-1',
  skill_level: 'beginner',
  total_items: 1,
  items: [],
  aggregated: [],
  created_at: '2026-08-04T00:00:00.000Z',
};

/**
 * E2-1. L'écran d'estimation testait `!appUser` seul, là où `dimensions` et
 * `work-selection` testent `!appUser && !isGuest`. Un invité traversait donc
 * tout le parcours — dimensions, ouvertures, travaux — pour se faire renvoyer
 * vers `/login` sans un mot, une seconde avant son résultat.
 */
describe('EstimatePage — garde du parcours invité', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.appUser = null;
    mockAuth.isGuest = false;
    mockAuth.isLoading = false;
    mockApiGet.mockImplementation((url: string) => {
      if (url.endsWith('/rooms')) return Promise.resolve([]);
      return Promise.resolve({ name: 'Salon' });
    });
    mockApiPost.mockResolvedValue(estimation);
  });

  it("n'éjecte pas un invité et calcule son estimation", async () => {
    mockAuth.isGuest = true;

    render(<EstimatePage />);

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/projects/project-1/estimate', {}),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('éjecte toujours un visiteur sans session', async () => {
    render(<EstimatePage />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('sert un compte inscrit', async () => {
    mockAuth.appUser = { id: 'user-1' };

    render(<EstimatePage />);

    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
  });

  /**
   * Ce que la redirection muette cachait : une session invité dont la
   * synchronisation serveur a échoué doit dire pourquoi, pas disparaître.
   */
  it("affiche l'erreur au lieu de disparaître quand l'API refuse", async () => {
    mockAuth.isGuest = true;
    mockApiGet.mockRejectedValue(new Error('Projet introuvable'));

    render(<EstimatePage />);

    expect(await screen.findByText('Projet introuvable')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
