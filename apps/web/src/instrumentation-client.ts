import * as Sentry from '@sentry/nextjs';
import { getSentryOptions } from '@/lib/sentry';

const options = getSentryOptions();

if (options) {
  Sentry.init(options);
}
