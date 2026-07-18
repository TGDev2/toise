const DEFAULT_TRACES_SAMPLE_RATE = 0.2;

export interface SentryOptions {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
}

/**
 * `instrument.ts` s'exécute avant que le conteneur DI de Nest existe : on lit
 * `process.env` directement plutôt que via `ConfigService`. Le paramètre
 * `env` sert uniquement les tests (aucune étape de bundling côté serveur ne
 * casse cette indirection, contrairement à l'équivalent web).
 */
export function getSentryOptions(
  env: NodeJS.ProcessEnv = process.env,
): SentryOptions | null {
  const dsn = env.SENTRY_DSN;
  if (!dsn) return null;

  const parsedRate = Number.parseFloat(env.SENTRY_TRACES_SAMPLE_RATE ?? '');
  const tracesSampleRate = Number.isFinite(parsedRate)
    ? parsedRate
    : DEFAULT_TRACES_SAMPLE_RATE;

  return {
    dsn,
    environment: env.NODE_ENV ?? 'development',
    tracesSampleRate,
  };
}
