import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GuestPromptModal } from '../GuestPromptModal';

const mockAuth = {
  convertGuestAccount: jest.fn(),
  convertGuestWithGoogle: jest.fn(),
  convertGuestWithApple: jest.fn(),
  firebaseUser: null,
  appUser: null,
  isGuest: true,
  isLoading: false,
  login: jest.fn(),
  register: jest.fn(),
  loginWithGoogle: jest.fn(),
  loginWithApple: jest.fn(),
  startGuestSession: jest.fn(),
  logout: jest.fn(),
  forgotPassword: jest.fn(),
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

describe('GuestPromptModal', () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when closed', () => {
    render(
      <GuestPromptModal isOpen={false} onClose={onClose} onSuccess={onSuccess} />,
    );
    expect(screen.queryByText(/créez un compte/i)).not.toBeInTheDocument();
  });

  it('renders when open', () => {
    render(
      <GuestPromptModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />,
    );
    expect(screen.getByText(/créez un compte/i)).toBeInTheDocument();
    expect(screen.getByText(/continuer avec google/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <GuestPromptModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />,
    );
    fireEvent.click(screen.getByLabelText(/fermer/i));
    expect(onClose).toHaveBeenCalled();
  });

  it('converts guest account on email registration', async () => {
    mockAuth.convertGuestAccount.mockResolvedValue(undefined);
    render(
      <GuestPromptModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/mot de passe \(8/i), {
      target: { value: 'securepass123' },
    });
    fireEvent.change(screen.getByPlaceholderText(/confirmer/i), {
      target: { value: 'securepass123' },
    });
    fireEvent.click(screen.getByText(/s'inscrire et sauvegarder/i));

    await waitFor(() => {
      expect(mockAuth.convertGuestAccount).toHaveBeenCalledWith(
        'test@example.com',
        'securepass123',
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows error on password mismatch', async () => {
    render(
      <GuestPromptModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/mot de passe \(8/i), {
      target: { value: 'securepass123' },
    });
    fireEvent.change(screen.getByPlaceholderText(/confirmer/i), {
      target: { value: 'different' },
    });
    fireEvent.click(screen.getByText(/s'inscrire et sauvegarder/i));

    await waitFor(() => {
      expect(screen.getByText(/ne correspondent pas/i)).toBeInTheDocument();
    });
  });

  it('links to the privacy policy from the guest conversion modal', () => {
    render(
      <GuestPromptModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />,
    );

    expect(
      screen.getByRole('link', { name: /politique de confidentialite/i }),
    ).toHaveAttribute('href', '/privacy');
  });
});
