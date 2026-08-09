/**
 * Le tableau de bord n'a qu'une source de vérité.
 *
 * La double section venait d'une condition de rendu fausse : la liste API était
 * gardée par `appUser`, la liste locale par `isGuest`, et **un invité satisfait
 * les deux** — `onIdTokenChanged` synchronise aussi les comptes anonymes. Un
 * invité voyait donc simultanément une liste API vide et la carte d'un brouillon
 * local dont le bouton « Définir les dimensions » menait à
 * `/projects/<uuid-local>/dimensions`, c'est-à-dire à un 404.
 *
 * La règle figée ici : dès qu'un compte API existe, la liste API **est** la
 * liste des projets. Un brouillon qui traîne alors est le reste d'une migration
 * échouée ; il se présente comme tel, avec de quoi la relancer.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '../page';
import { apiGet } from '@/lib/api';
import { ToastProvider } from '@/components/ui';
import { writeGuestDrafts, type GuestProjectDraft } from '@/lib/guest-drafts';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const migrateLocalProjectsMock = jest.fn();

const mockAuth = {
  appUser: null as { id: string; email: string; subscription_tier: string } | null,
  isGuest: false,
  isLoading: false,
  logout: jest.fn(),
  deleteAccount: jest.fn(),
  migrateLocalProjects: (...args: unknown[]) => migrateLocalProjectsMock(...args),
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    subscription: null,
    openCheckout: jest.fn(),
    openPortal: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock('@/components/auth/GuestPromptModal', () => ({
  GuestPromptModal: () => null,
}));


jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiDelete: jest.fn(),
  ApiError: class ApiError extends Error {
    code: string | null = null;
  },
}));

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;

const DRAFT: GuestProjectDraft = {
  id: 'local-uuid-1',
  name: 'Mon projet peinture',
  room_name: 'Ma pièce',
  work_type: 'painting',
  length_m: 4,
  width_m: 3,
  height_m: 2.5,
  updated_at: '2026-08-09T10:00:00.000Z',
};

/**
 * Rendu sous le vrai `ToastProvider`.
 *
 * Le tableau de bord appelle `useToast`, qui lance hors fournisseur. Le mocker
 * demanderait d'étaler tout le barrel `@/components/ui` dans une fabrique
 * `jest.mock` — un coût de typage inutile, pour remplacer un composant qui ne
 * gêne pas.
 */
const renderDashboard = () =>
  render(
    <ToastProvider>
      <DashboardPage />
    </ToastProvider>,
  );

const EMPTY_PAGE = {
  data: [],
  meta: { total: 0, page: 1, limit: 12, totalPages: 1 },
};

/** Les deux boutons que la carte de brouillon locale est seule à porter. */
const localDraftCardButtons = () =>
  screen.queryAllByRole('button', {
    name: /définir les dimensions|modifier les dimensions/i,
  });

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockAuth.appUser = null;
  mockAuth.isGuest = false;
  mockAuth.isLoading = false;
  mockApiGet.mockResolvedValue(EMPTY_PAGE);
});

describe('tableau de bord d’un invité', () => {
  it('n’affiche pas de carte de brouillon local en même temps que la liste API', async () => {
    writeGuestDrafts([DRAFT]);
    mockAuth.isGuest = true;
    mockAuth.appUser = {
      id: 'user-1',
      email: 'invite@chiffreo.test',
      subscription_tier: 'free',
    };

    await act(async () => {
      renderDashboard();
    });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/projects?page=1&limit=12');
    });

    // C'était exactement le bouton qui menait au cul-de-sac.
    expect(localDraftCardButtons()).toHaveLength(0);
    expect(screen.queryByText('Mon projet peinture')).not.toBeInTheDocument();
  });

  it('propose de reprendre un brouillon resté sur l’appareil', async () => {
    writeGuestDrafts([DRAFT]);
    mockAuth.isGuest = true;
    mockAuth.appUser = {
      id: 'user-1',
      email: 'invite@chiffreo.test',
      subscription_tier: 'free',
    };
    migrateLocalProjectsMock.mockResolvedValue({
      migrated: ['srv-1'],
      failed: [],
    });

    await act(async () => {
      renderDashboard();
    });

    const retry = await screen.findByRole('button', { name: /réessayer/i });
    expect(
      screen.getByText(/n’a pas pu être enregistré dans votre compte/i),
    ).toBeInTheDocument();

    await act(async () => {
      retry.click();
    });

    expect(migrateLocalProjectsMock).toHaveBeenCalled();
    // Repris : plus de bandeau, et la liste API est rechargée.
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /réessayer/i }),
      ).not.toBeInTheDocument();
    });
    expect(mockApiGet).toHaveBeenCalledTimes(2);
  });

  /**
   * Mode dégradé : la session existe mais `POST /auth/sync` n'a pas répondu,
   * donc pas de compte API. Les brouillons sont alors la seule liste possible et
   * la page locale des dimensions sait les lire — ce chemin doit rester ouvert.
   */
  it('affiche les brouillons comme projets quand il n’y a aucun compte API', async () => {
    writeGuestDrafts([DRAFT]);
    mockAuth.isGuest = true;
    mockAuth.appUser = null;

    await act(async () => {
      renderDashboard();
    });

    expect(screen.getByText('Mon projet peinture')).toBeInTheDocument();
    expect(localDraftCardButtons()).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: /réessayer/i }),
    ).not.toBeInTheDocument();
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});
