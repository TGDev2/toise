import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContractorDashboard } from '../ContractorDashboard';
import { apiGet, apiPost } from '@/lib/api';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockAuth: {
  appUser: { email: string; subscription_tier: string } | null;
  logout: jest.Mock;
  deleteAccount: jest.Mock;
} = {
  appUser: { email: 'artisan@example.com', subscription_tier: 'contractor_standard' },
  logout: jest.fn(),
  deleteAccount: jest.fn(),
};
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ subscription: null, openPortal: jest.fn() }),
}));

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiDelete: jest.fn(),
  apiDownload: jest.fn(),
}));

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/ui', () => ({
  ...jest.requireActual('@/components/ui'),
  useToast: () => mockToast,
}));

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;

describe('ContractorDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockImplementation((path: string) => {
      if (path.startsWith('/projects')) {
        return Promise.resolve({
          data: [],
          meta: { total: 0, page: 1, limit: 12, totalPages: 1 },
        } as never);
      }
      return Promise.resolve([] as never);
    });
  });

  // PRO-5 : le pitch n°1 du tier Contractor est « mesure chez le client → devis
  // PDF avant de partir ». Nommer le chantier avant de pouvoir mesurer
  // est une étape sans valeur pendant que le client attend. L'analyse photo
  // automatique est débranchée de la production (ADR 0001 D2) : la saisie
  // manuelle des dimensions est le seul chemin.
  it('starts the devis-minute flow straight at manual dimensions entry', async () => {
    mockApiPost.mockResolvedValue({ id: 'new-project' } as never);
    render(<ContractorDashboard />);

    fireEvent.click(screen.getByRole('button', { name: /Devis-minute/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/projects',
        expect.objectContaining({ room_name: 'Pièce 1' }),
      );
      expect(mockPush).toHaveBeenCalledWith('/projects/new-project/dimensions');
    });
  });

  it('names the quick project after the day it was created', async () => {
    mockApiPost.mockResolvedValue({ id: 'new-project' } as never);
    render(<ContractorDashboard />);

    fireEvent.click(screen.getByRole('button', { name: /Devis-minute/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/projects',
        expect.objectContaining({
          name: expect.stringMatching(/^Devis du \d{2}\/\d{2}\/\d{4}$/),
        }),
      );
    });
  });

  it('surfaces a creation failure instead of navigating', async () => {
    // `getErrorMessage` privilégie le message de l'API quand il existe ; le
    // libellé de repli ne sort que pour une erreur sans message.
    mockApiPost.mockRejectedValue(new Error('Quota de projets atteint'));
    render(<ContractorDashboard />);

    fireEvent.click(screen.getByRole('button', { name: /Devis-minute/i }));

    await waitFor(() => {
      expect(screen.getByText('Quota de projets atteint')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('keeps the named-project composer available', () => {
    render(<ContractorDashboard />);

    fireEvent.click(screen.getByRole('button', { name: 'Nouveau chantier' }));

    expect(screen.getByLabelText('Nom du chantier')).toBeInTheDocument();
  });

  it('links the Clients tile to the clients list', () => {
    render(<ContractorDashboard />);

    const clientsTile = screen.getByText('Clients').closest('a');
    expect(clientsTile).toHaveAttribute('href', '/clients');
  });
});
