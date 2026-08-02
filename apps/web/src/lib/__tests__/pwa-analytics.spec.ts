import {
  flushPwaEvents,
  registerPwaEventFlush,
  trackPwaEvent,
} from '../pwa-analytics';
import { apiPost, ApiError } from '@/lib/api';
import { CONSENT_EVENT, CONSENT_KEY } from '@/lib/analytics-consent';

jest.mock('@/lib/api', () => {
  class MockApiError extends Error {
    code: string | null;
    details: Record<string, unknown>;
    constructor(
      message: string,
      code: string | null = null,
      details: Record<string, unknown> = {},
    ) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.details = details;
    }
  }
  return { apiPost: jest.fn(), ApiError: MockApiError };
});

const mockedApiPost = apiPost as jest.MockedFunction<typeof apiPost>;

const QUEUE_KEY = 'chiffreo_pwa_events';

function queued(): { event_name: string; properties: Record<string, unknown> }[] {
  return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    value,
    configurable: true,
    writable: true,
  });
}

describe('pwa-analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setOnline(true);
    mockedApiPost.mockResolvedValue(undefined as never);
  });

  describe('consentement', () => {
    it("n'envoie et n'empile rien tant que le choix n'est pas exprimé", async () => {
      localStorage.removeItem(CONSENT_KEY);

      trackPwaEvent('pwa_session_start', { platform: 'ios' });
      await Promise.resolve();

      expect(mockedApiPost).not.toHaveBeenCalled();
      expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
    });

    it("n'envoie et n'empile rien après un refus, en ligne comme hors ligne", async () => {
      localStorage.setItem(CONSENT_KEY, 'declined');

      trackPwaEvent('pwa_installed');
      setOnline(false);
      trackPwaEvent('pwa_offline_view', { url: '/projects/1' });
      await Promise.resolve();

      expect(mockedApiPost).not.toHaveBeenCalled();
      expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
    });

    it('purge la file héritée d\'une session consentante quand le refus arrive', async () => {
      setOnline(false);
      trackPwaEvent('pwa_offline_view', { url: '/projects/1' });
      expect(queued()).toHaveLength(1);

      localStorage.setItem(CONSENT_KEY, 'declined');
      setOnline(true);
      await flushPwaEvents();

      expect(mockedApiPost).not.toHaveBeenCalled();
      expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
    });

    it('rejoue la file dès que le consentement est accordé', async () => {
      setOnline(false);
      trackPwaEvent('pwa_installed');
      setOnline(true);

      // `finally` : un échec ici laisserait sinon l'écouteur sur `window` et
      // ferait tomber les tests suivants pour une raison sans rapport.
      const unregister = registerPwaEventFlush();
      try {
        window.dispatchEvent(new Event(CONSENT_EVENT));
        await Promise.resolve();
        await Promise.resolve();

        expect(mockedApiPost).toHaveBeenCalledTimes(1);
      } finally {
        unregister();
      }
    });
  });

  it("envoie directement quand le réseau répond et n'empile rien", async () => {
    trackPwaEvent('pwa_installed');
    await Promise.resolve();

    expect(mockedApiPost).toHaveBeenCalledWith(
      '/public/analytics/events',
      expect.objectContaining({ event_name: 'pwa_installed' }),
    );
    expect(queued()).toHaveLength(0);
  });

  it('date l\'événement de son émission, pas de son envoi', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-02T10:00:00.000Z'));
    setOnline(false);

    trackPwaEvent('pwa_offline_view', { url: '/projects/1' });

    expect(queued()[0].properties).toEqual({
      url: '/projects/1',
      occurred_at: '2026-08-02T10:00:00.000Z',
    });

    // Le flush a lieu bien plus tard : la propriété ne doit pas bouger.
    jest.setSystemTime(new Date('2026-08-02T18:00:00.000Z'));
    setOnline(true);
    await flushPwaEvents();

    expect(mockedApiPost).toHaveBeenCalledWith('/public/analytics/events', {
      event_name: 'pwa_offline_view',
      properties: {
        url: '/projects/1',
        occurred_at: '2026-08-02T10:00:00.000Z',
      },
    });
    jest.useRealTimers();
  });

  it('empile hors ligne puis rejoue dans l\'ordre au retour du réseau', async () => {
    setOnline(false);
    trackPwaEvent('pwa_session_start', { platform: 'ios' });
    trackPwaEvent('pwa_offline_view', { url: '/a' });

    expect(queued().map((e) => e.event_name)).toEqual([
      'pwa_session_start',
      'pwa_offline_view',
    ]);
    expect(mockedApiPost).not.toHaveBeenCalled();

    setOnline(true);
    await flushPwaEvents();

    expect(mockedApiPost).toHaveBeenCalledTimes(2);
    expect(mockedApiPost.mock.calls[0][1]).toMatchObject({
      event_name: 'pwa_session_start',
    });
    expect(mockedApiPost.mock.calls[1][1]).toMatchObject({
      event_name: 'pwa_offline_view',
    });
    expect(queued()).toHaveLength(0);
  });

  it('empile un événement dont l\'envoi échoue en réseau', async () => {
    mockedApiPost.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    trackPwaEvent('pwa_install_prompted');
    await Promise.resolve();
    await Promise.resolve();

    expect(queued().map((e) => e.event_name)).toEqual(['pwa_install_prompted']);
  });

  it('abandonne un rejet déterministe 400 au lieu de le rejouer indéfiniment', async () => {
    setOnline(false);
    trackPwaEvent('pwa_installed');
    setOnline(true);

    mockedApiPost.mockRejectedValueOnce(
      new ApiError('Bad Request', null, { statusCode: 400 }),
    );
    await flushPwaEvents();

    expect(queued()).toHaveLength(0);
  });

  it('conserve la file intacte en cas de 5xx, pour réessayer plus tard', async () => {
    setOnline(false);
    trackPwaEvent('pwa_installed');
    setOnline(true);

    mockedApiPost.mockRejectedValueOnce(
      new ApiError('Server Error', null, { statusCode: 503 }),
    );
    await flushPwaEvents();

    expect(queued()).toHaveLength(1);
  });

  it('borne la file à 50 événements en abandonnant les plus anciens', async () => {
    setOnline(false);
    for (let i = 0; i < 55; i++) {
      trackPwaEvent('pwa_offline_view', { url: `/p/${i}` });
    }

    const events = queued();
    expect(events).toHaveLength(50);
    expect(events[0].properties.url).toBe('/p/5');
    expect(events[49].properties.url).toBe('/p/54');
  });

  it('rejoue la file sur l\'événement `online` et se désinscrit proprement', async () => {
    setOnline(false);
    trackPwaEvent('pwa_installed');
    const unregister = registerPwaEventFlush();

    setOnline(true);
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedApiPost).toHaveBeenCalledTimes(1);

    unregister();
    setOnline(false);
    trackPwaEvent('pwa_installed');
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();

    expect(mockedApiPost).toHaveBeenCalledTimes(1);
  });
});
