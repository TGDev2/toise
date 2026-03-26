import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegisterForm } from '../RegisterForm';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockAuth = {
  register: jest.fn(),
  loginWithGoogle: jest.fn(),
  loginWithApple: jest.fn(),
  firebaseUser: null,
  appUser: null,
  isGuest: false,
  isLoading: false,
  login: jest.fn(),
  startGuestSession: jest.fn(),
  convertGuestAccount: jest.fn(),
  convertGuestWithGoogle: jest.fn(),
  convertGuestWithApple: jest.fn(),
  logout: jest.fn(),
  forgotPassword: jest.fn(),
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

describe('RegisterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders registration fields', () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^mot de passe$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmer/i)).toBeInTheDocument();
  });

  it('shows password strength indicator', () => {
    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), {
      target: { value: 'Ab1!strong' },
    });
    expect(screen.getByText(/fort/i)).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/confirmer/i), {
      target: { value: 'different' },
    });
    fireEvent.click(screen.getByText(/s'inscrire/i));

    await waitFor(() => {
      expect(screen.getByText(/ne correspondent pas/i)).toBeInTheDocument();
    });
  });

  it('shows success message after registration', async () => {
    mockAuth.register.mockResolvedValue(undefined);
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), {
      target: { value: 'securepass123' },
    });
    fireEvent.change(screen.getByLabelText(/confirmer/i), {
      target: { value: 'securepass123' },
    });
    fireEvent.click(screen.getByText(/s'inscrire/i));

    await waitFor(() => {
      expect(screen.getByText(/vérifiez votre email/i)).toBeInTheDocument();
    });
  });
});
