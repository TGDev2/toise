import * as Sentry from '@sentry/node';
import { getSentryOptions } from './sentry-options';

const options = getSentryOptions();

if (options) {
  Sentry.init(options);
} else {
  console.warn(
    'SENTRY_DSN absente — le monitoring Sentry est désactivé (dev uniquement).',
  );
}
