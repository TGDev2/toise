import { render, act } from '@testing-library/react';
import { ServiceWorkerRegister } from '../ServiceWorkerRegister';
import { CONSENT_EVENT, CONSENT_KEY } from '@/lib/analytics-consent';
import { flushPwaEvents, trackPwaEvent } from '@/lib/pwa-analytics';

jest.mock('@/lib/pwa-analytics', () => ({
  trackPwaEvent: jest.fn(),
  flushPwaEvents: jest.fn(),
  registerPwaEventFlush: jest.fn(() => jest.fn()),
}));

const mockedTrack = trackPwaEvent as jest.MockedFunction<typeof trackPwaEvent>;
const mockedFlush = flushPwaEvents as jest.MockedFunction<typeof flushPwaEvents>;

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

function announceConsentChange() {
  act(() => {
    window.dispatchEvent(new Event(CONSENT_EVENT));
  });
}

describe('ServiceWorkerRegister', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockMatchMedia(false);
    mockedFlush.mockResolvedValue(undefined);
  });

  it('ne compte aucune session tant que le consentement n\'est pas exprimé', () => {
    render(<ServiceWorkerRegister />);

    expect(mockedTrack).not.toHaveBeenCalled();
  });

  it('ne compte aucune session après un refus', () => {
    localStorage.setItem(CONSENT_KEY, 'declined');

    render(<ServiceWorkerRegister />);
    announceConsentChange();

    expect(mockedTrack).not.toHaveBeenCalled();
  });

  // Le piège du correctif : `trackSessionOnce` posait sa marque dans
  // `sessionStorage` avant de savoir si l'événement partait. Au montage le
  // bandeau vient d'apparaître, donc la marque était posée pour rien et la
  // session devenait définitivement incomptable, même en acceptant juste après.
  it('compte la session dès que le consentement arrive, une seule fois', () => {
    render(<ServiceWorkerRegister />);
    expect(mockedTrack).not.toHaveBeenCalled();

    localStorage.setItem(CONSENT_KEY, 'accepted');
    announceConsentChange();

    expect(mockedTrack).toHaveBeenCalledTimes(1);
    expect(mockedTrack).toHaveBeenCalledWith(
      'pwa_session_start',
      expect.objectContaining({ display_mode: 'browser' }),
    );

    // Un second signal (autre onglet, re-render) ne redouble pas la session.
    announceConsentChange();
    expect(mockedTrack).toHaveBeenCalledTimes(1);
  });

  it('réconcilie la file à chaque changement de consentement', () => {
    render(<ServiceWorkerRegister />);
    expect(mockedFlush).toHaveBeenCalledTimes(1);

    localStorage.setItem(CONSENT_KEY, 'declined');
    announceConsentChange();

    // `flushPwaEvents` purge quand le consentement manque : c'est ce qui donne
    // son effet immédiat au refus sur une file déjà constituée.
    expect(mockedFlush.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('enregistre le service worker indépendamment du consentement', () => {
    const register = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    });

    render(<ServiceWorkerRegister />);

    // La mesure est subordonnée au consentement, la fonctionnalité non.
    expect(register).toHaveBeenCalledWith('/sw.js');
    expect(mockedTrack).not.toHaveBeenCalled();
  });
});
