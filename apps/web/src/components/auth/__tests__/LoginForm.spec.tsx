import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '../LoginForm';

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

// `LoginForm` rend `SsoLoginForm` (PLAT-6), qui importe le client API — lequel
// charge le SDK Firebase, indisponible sous jsdom.
jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders email and password fields', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument();
  });

  it('renders OAuth buttons', () => {
    render(<LoginForm />);
    expect(screen.getByText(/continuer avec google/i)).toBeInTheDocument();
    expect(screen.getByText(/continuer avec apple/i)).toBeInTheDocument();
  });

  it('renders guest mode link', () => {
    render(<LoginForm />);
    expect(screen.getByText(/continuer en invité/i)).toBeInTheDocument();
  });

  it('renders register link', () => {
    render(<LoginForm />);
    expect(screen.getByText(/créer un compte/i)).toBeInTheDocument();
  });

  it('calls login on form submit', async () => {
    mockAuth.login.mockResolvedValue(undefined);
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByText(/se connecter/i));

    await waitFor(() => {
      expect(mockAuth.login).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('shows error on login failure', async () => {
    mockAuth.login.mockRejectedValue(new Error('Invalid credentials'));
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByText(/se connecter/i));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('redirects to dashboard on successful login', async () => {
    mockAuth.login.mockResolvedValue(undefined);
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByText(/se connecter/i));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('starts guest session on click', async () => {
    mockAuth.startGuestSession.mockResolvedValue(undefined);
    render(<LoginForm />);

    fireEvent.click(screen.getByText(/continuer en invité/i));

    await waitFor(() => {
      expect(mockAuth.startGuestSession).toHaveBeenCalled();
    });
  });
});
