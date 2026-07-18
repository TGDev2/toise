import { getSentryOptions } from './sentry-options';

describe('getSentryOptions', () => {
  it('renvoie null si SENTRY_DSN est absente', () => {
    expect(getSentryOptions({})).toBeNull();
  });

  it('renvoie null si SENTRY_DSN est une chaîne vide', () => {
    expect(getSentryOptions({ SENTRY_DSN: '' })).toBeNull();
  });

  it('applique le taux d’échantillonnage par défaut si non fourni', () => {
    expect(getSentryOptions({ SENTRY_DSN: 'https://key@sentry.io/1' })).toEqual(
      {
        dsn: 'https://key@sentry.io/1',
        environment: 'development',
        tracesSampleRate: 0.2,
      },
    );
  });

  it('parse un taux d’échantillonnage valide', () => {
    const options = getSentryOptions({
      SENTRY_DSN: 'https://key@sentry.io/1',
      SENTRY_TRACES_SAMPLE_RATE: '0.5',
      NODE_ENV: 'production',
    });
    expect(options).toEqual({
      dsn: 'https://key@sentry.io/1',
      environment: 'production',
      tracesSampleRate: 0.5,
    });
  });

  it('retombe sur le défaut si le taux fourni est malformé', () => {
    const options = getSentryOptions({
      SENTRY_DSN: 'https://key@sentry.io/1',
      SENTRY_TRACES_SAMPLE_RATE: 'not-a-number',
    });
    expect(options?.tracesSampleRate).toBe(0.2);
  });
});
