import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstallPrompt } from '../InstallPrompt';
import { CONSENT_KEY } from '@/components/CookieConsent';
import { trackPwaEvent } from '@/lib/pwa-analytics';

jest.mock('@/lib/pwa-analytics', () => ({
  trackPwaEvent: jest.fn(),
}));

const mockedTrack = trackPwaEvent as jest.MockedFunction<typeof trackPwaEvent>;

function mockMatchMedia(standalone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn(() => ({
      matches: standalone,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
}

/** Rejoue l'événement navigateur `beforeinstallprompt` avec son `userChoice`. */
function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed') {
  const event = Object.assign(new Event('beforeinstallprompt'), {
    prompt: jest.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('InstallPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Le bandeau attend la résolution du consentement cookies pour s'afficher.
    localStorage.setItem(CONSENT_KEY, 'accepted');
    mockMatchMedia(false);
  });

  it("trace l'éligibilité à l'installation dès que le navigateur la propose", () => {
    render(<InstallPrompt />);
    fireBeforeInstallPrompt('accepted');

    expect(mockedTrack).toHaveBeenCalledWith('pwa_install_prompted');
    expect(screen.getByRole('button', { name: 'Installer' })).toBeVisible();
  });

  it('trace une acceptation réelle du prompt natif', async () => {
    render(<InstallPrompt />);
    fireBeforeInstallPrompt('accepted');

    await userEvent.click(screen.getByRole('button', { name: 'Installer' }));

    expect(mockedTrack).toHaveBeenCalledWith('pwa_install_accepted', {});
  });

  it('distingue un refus du prompt natif d\'un report depuis le bandeau', async () => {
    const { unmount } = render(<InstallPrompt />);
    fireBeforeInstallPrompt('dismissed');

    await userEvent.click(screen.getByRole('button', { name: 'Installer' }));

    expect(mockedTrack).toHaveBeenCalledWith('pwa_install_dismissed', {
      surface: 'native',
    });

    unmount();
    localStorage.removeItem('chiffreo_install_dismissed');
    mockedTrack.mockClear();

    render(<InstallPrompt />);
    fireBeforeInstallPrompt('accepted');
    await userEvent.click(screen.getByRole('button', { name: 'Plus tard' }));

    expect(mockedTrack).toHaveBeenCalledWith('pwa_install_dismissed', {
      surface: 'banner',
    });
  });

  it("trace l'installation effective signalée par le navigateur", () => {
    render(<InstallPrompt />);
    fireBeforeInstallPrompt('accepted');

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(mockedTrack).toHaveBeenCalledWith('pwa_installed');
  });

  it('ne trace rien quand l\'app tourne déjà en mode installé', () => {
    mockMatchMedia(true);

    render(<InstallPrompt />);
    fireBeforeInstallPrompt('accepted');

    expect(mockedTrack).not.toHaveBeenCalled();
  });
});
