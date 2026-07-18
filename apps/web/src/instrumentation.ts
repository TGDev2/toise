import * as Sentry from '@sentry/nextjs';
import { getSentryOptions } from '@/lib/sentry';

export async function register() {
  const options = getSentryOptions();
  if (!options) return;

  if (
    process.env.NEXT_RUNTIME === 'nodejs' ||
    process.env.NEXT_RUNTIME === 'edge'
  ) {
    Sentry.init(options);
  }
}

export const onRequestError = Sentry.captureRequestError;
