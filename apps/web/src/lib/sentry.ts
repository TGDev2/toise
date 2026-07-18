const DEFAULT_TRACES_SAMPLE_RATE = 0.2;

export interface SentryOptions {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
}

/**
 * Next.js inline les `NEXT_PUBLIC_*` par remplacement textuel statique de
 * l'expression littérale exacte `process.env.NEXT_PUBLIC_X` au build — pas
 * d'analyse de flux de données. Ne PAS lire ces variables via un paramètre
 * ou une déstructuration : ça casserait l'inlining côté navigateur (le code
 * fonctionnerait quand même sous Jest, qui lit `process.env` dynamiquement,
 * masquant le bug jusqu'à la prod).
 */
export function getSentryOptions(): SentryOptions | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return null;

  const parsedRate = Number.parseFloat(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '',
  );
  const tracesSampleRate = Number.isFinite(parsedRate)
    ? parsedRate
    : DEFAULT_TRACES_SAMPLE_RATE;

  return {
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate,
  };
}
