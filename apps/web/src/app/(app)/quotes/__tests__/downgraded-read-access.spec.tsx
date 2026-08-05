import { render, screen, waitFor } from '@testing-library/react';
import QuotesListPage from '../page';
import InvoicesListPage from '../../invoices/page';
import { apiGet } from '@/lib/api';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockAuth = {
  appUser: { id: 'user-1', subscription_tier: 'free' },
  isLoading: false,
};
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const mockShowPaywall = jest.fn();
const mockGates = {
  isFeatureAllowed: () => false,
  showPaywall: mockShowPaywall,
};
jest.mock('@/contexts/FeatureGateContext', () => ({
  useFeatureGates: () => mockGates,
}));

jest.mock('@/lib/api', () => ({ apiGet: jest.fn() }));
const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;

const QUOTE = {
  id: 'quote-1',
  quote_number: 'DEV-2026-001',
  status: 'sent',
  created_at: '2026-07-01T10:00:00.000Z',
  total_ttc: '1200.00',
  client: { name: 'Dupont' },
  project: { name: 'Salon' },
};

const INVOICE = {
  id: 'invoice-1',
  invoice_number: 'FAC-2026-001',
  status: 'issued',
  issued_on: '2026-07-01T10:00:00.000Z',
  total_ttc: '1200.00',
  buyer_snapshot: { name: 'Dupont' },
  source_quote_number: 'DEV-2026-001',
};

/**
 * Accès en lecture d'un abonné déclassé (E5-2).
 *
 * Le palier retombe sur gratuit à l'expiration du délai de grâce d'un impayé.
 * Les devis et factures déjà émis doivent rester consultables — ce sont des
 * documents commerciaux engageants, et le bandeau de relance promet
 * explicitement qu'ils le restent.
 *
 * Le paywall se déclenchait au montage sur le seul verdict de la feature gate :
 * l'artisan déclassé recevait donc une modale commerciale par-dessus sa propre
 * liste, à chaque visite. Le critère est désormais « la liste est-elle vide ? ».
 */
describe('Listes de documents pour un utilisateur sans abonnement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rend les devis existants sans ouvrir le paywall', async () => {
    mockApiGet.mockResolvedValue([QUOTE] as never);

    render(<QuotesListPage />);

    expect(await screen.findByText('DEV-2026-001')).toBeInTheDocument();
    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockShowPaywall).not.toHaveBeenCalled();
  });

  it('ouvre le paywall quand il n’y a aucun devis à protéger', async () => {
    mockApiGet.mockResolvedValue([] as never);

    render(<QuotesListPage />);

    // Un utilisateur jamais abonné a toujours zéro devis : l'accroche vers
    // l'offre reste intacte pour lui, qui est le seul qu'elle vise.
    await waitFor(() =>
      expect(mockShowPaywall).toHaveBeenCalledWith('export_devis'),
    );
  });

  it('rend les factures existantes sans ouvrir le paywall', async () => {
    mockApiGet.mockResolvedValue([INVOICE] as never);

    render(<InvoicesListPage />);

    expect(await screen.findByText('FAC-2026-001')).toBeInTheDocument();
    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockShowPaywall).not.toHaveBeenCalled();
  });

  it('ouvre le paywall quand il n’y a aucune facture à protéger', async () => {
    mockApiGet.mockResolvedValue([] as never);

    render(<InvoicesListPage />);

    await waitFor(() =>
      expect(mockShowPaywall).toHaveBeenCalledWith('invoicing'),
    );
  });
});
