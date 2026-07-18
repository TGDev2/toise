import { getSentryOptions } from '../sentry';

describe('getSentryOptions', () => {
  const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const originalRate = process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE;

  afterEach(() => {
    if (originalDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;

    if (originalRate === undefined) {
      delete process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE;
    } else {
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE = originalRate;
    }
  });

  it('renvoie null si NEXT_PUBLIC_SENTRY_DSN est absente', () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    expect(getSentryOptions()).toBeNull();
  });

  it('applique le taux d’échantillonnage par défaut si non fourni', () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/1';
    delete process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE;

    expect(getSentryOptions()).toEqual({
      dsn: 'https://key@sentry.io/1',
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0.2,
    });
  });

  it('parse un taux d’échantillonnage valide', () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/1';
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE = '0.5';

    expect(getSentryOptions()?.tracesSampleRate).toBe(0.5);
  });

  it('retombe sur le défaut si le taux fourni est malformé', () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/1';
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE = 'not-a-number';

    expect(getSentryOptions()?.tracesSampleRate).toBe(0.2);
  });
});
