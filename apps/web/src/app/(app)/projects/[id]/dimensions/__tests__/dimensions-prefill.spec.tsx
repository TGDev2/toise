import { render, screen, waitFor } from '@testing-library/react';
import DimensionsPage from '../page';
import { apiGet } from '@/lib/api';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useParams: () => ({ id: 'project-1' }),
  useSearchParams: () => ({ get: () => null }),
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
  apiPut: jest.fn(),
  apiPatch: jest.fn(),
  apiDelete: jest.fn(),
}));

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;

const ROOM_WITH_DIMENSIONS = {
  id: 'room-1',
  name: 'Ma pièce',
  sort_order: 0,
  dimensions: {
    length_cm: 400,
    width_cm: 300,
    height_cm: 250,
    segments: [
      { x_cm: 0, y_cm: 0, length_cm: 400, width_cm: 300 },
      { x_cm: 400, y_cm: 0, length_cm: 100, width_cm: 100 },
    ],
    exclusions: [
      { type: 'credence', area_m2: 2, surface_target: 'wall' },
    ],
    source: 'manual',
  },
  openings: [],
  work_items: [],
};

/**
 * E4-5. `activeRoomId` passe de `null` au vrai id de la pièce dans le même
 * rendu que celui qui monte `DimensionsForm` — avant que l'effet de
 * chargement des dimensions (`seedFromRoom`) ait eu la moindre chance de
 * s'exécuter. `DimensionsForm` ne lit ses props `initial*` qu'au montage
 * (`useState(initialLengthCm)`), et `key={activeRoomId}` ne change pas entre
 * ce premier rendu et celui, juste après, où les vraies dimensions arrivent :
 * pas de remontage, donc pas de mise à jour. Un projet rouvert pour modifier
 * ses dimensions se présentait vide, alors qu'elles étaient intactes côté API
 * — reproduit ici en pointant `GET /projects/:id/rooms` vers une pièce déjà
 * mesurée, décrochée et exclue, exactement ce que migre un compte invité
 * converti (`AuthContext.guest-migration.spec.tsx`).
 */
describe('DimensionsPage — pré-remplissage depuis une pièce existante', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.appUser = { id: 'user-1' };
    mockAuth.isGuest = false;
    mockAuth.isLoading = false;
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/projects/project-1') {
        return Promise.resolve({ name: 'Mon projet peinture' });
      }
      if (path === '/projects/project-1/rooms') {
        return Promise.resolve([ROOM_WITH_DIMENSIONS]);
      }
      return Promise.reject(new Error(`unexpected apiGet ${path}`));
    });
  });

  it('affiche les dimensions, le décroché et l’exclusion déjà enregistrés, pas un formulaire vide', async () => {
    render(<DimensionsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/longueur \(m\)/i)).toHaveValue('4');
    });
    expect(screen.getByLabelText(/largeur \(m\)/i)).toHaveValue('3');
    expect(screen.getByLabelText(/hauteur \(m\)/i)).toHaveValue('2.5');

    expect(screen.getAllByText(/crédence/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/décroché 1/i)).toBeInTheDocument();
  });
});
