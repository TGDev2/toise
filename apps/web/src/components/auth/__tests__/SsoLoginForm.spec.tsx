import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SsoLoginForm } from '../SsoLoginForm';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockAuth = {
  login: jest.fn(),
  loginWithGoogle: jest.fn(),
  loginWithApple: jest.fn(),
  loginWithSso: jest.fn(),
  startGuestSession: jest.fn(),
  firebaseUser: null,
  appUser: null,
  isGuest: false,
  isLoading: false,
  register: jest.fn(),
  convertGuestAccount: jest.fn(),
  convertGuestWithGoogle: jest.fn(),
  convertGuestWithApple: jest.fn(),
  logout: jest.fn(),
  forgotPassword: jest.fn(),
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const mockApiGet = jest.fn();
jest.mock('@/lib/api', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

function openPanel() {
  render(<SsoLoginForm />);
  fireEvent.click(screen.getByText(/sso de mon entreprise/i));
}

describe('SsoLoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockResolvedValue({
      provider_id: 'saml.acme1a2b3c4d',
      protocol: 'saml',
    });
  });

  it('reste replié par défaut', () => {
    render(<SsoLoginForm />);
    expect(screen.queryByLabelText(/email professionnel/i)).toBeNull();
  });

  it('déploie le champ e-mail au clic', () => {
    openPanel();
    expect(screen.getByLabelText(/email professionnel/i)).toBeInTheDocument();
  });

  it('découvre le fournisseur puis lance la connexion fédérée', async () => {
    openPanel();
    fireEvent.change(screen.getByLabelText(/email professionnel/i), {
      target: { value: 'salarie@acme.com' },
    });
    fireEvent.click(screen.getByText(/continuer avec le sso/i));

    await waitFor(() =>
      expect(mockAuth.loginWithSso).toHaveBeenCalledWith('saml.acme1a2b3c4d'),
    );
    expect(mockApiGet).toHaveBeenCalledWith(
      '/sso/discover?email=salarie%40acme.com',
    );
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('encode l’adresse dans la requête de découverte', async () => {
    openPanel();
    fireEvent.change(screen.getByLabelText(/email professionnel/i), {
      target: { value: 'jean+test@acme.com' },
    });
    fireEvent.click(screen.getByText(/continuer avec le sso/i));

    await waitFor(() =>
      expect(mockApiGet).toHaveBeenCalledWith(
        '/sso/discover?email=jean%2Btest%40acme.com',
      ),
    );
  });

  it('affiche le motif rendu par l’API', async () => {
    mockApiGet.mockRejectedValue(
      new Error('Aucune connexion SSO pour ce domaine'),
    );
    openPanel();
    fireEvent.change(screen.getByLabelText(/email professionnel/i), {
      target: { value: 'jean@sans-sso.fr' },
    });
    fireEvent.click(screen.getByText(/continuer avec le sso/i));

    await waitFor(() =>
      expect(
        screen.getByText(/aucune connexion sso pour ce domaine/i),
      ).toBeInTheDocument(),
    );
    expect(mockAuth.loginWithSso).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('retombe sur un message explicite quand l’échec est muet', async () => {
    mockApiGet.mockRejectedValue(new Error(''));
    openPanel();
    fireEvent.change(screen.getByLabelText(/email professionnel/i), {
      target: { value: 'jean@sans-sso.fr' },
    });
    fireEvent.click(screen.getByText(/continuer avec le sso/i));

    await waitFor(() =>
      expect(
        screen.getByText(/aucune connexion d'entreprise/i),
      ).toBeInTheDocument(),
    );
  });

  it('ne redirige pas si la fenêtre de l’IdP échoue', async () => {
    mockAuth.loginWithSso.mockRejectedValue(new Error('popup closed'));
    openPanel();
    fireEvent.change(screen.getByLabelText(/email professionnel/i), {
      target: { value: 'salarie@acme.com' },
    });
    fireEvent.click(screen.getByText(/continuer avec le sso/i));

    await waitFor(() => expect(mockAuth.loginWithSso).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
  });
});
