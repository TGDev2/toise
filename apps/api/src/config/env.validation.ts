const PRODUCTION_REQUIRED_VARS = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
  'CORS_ORIGIN',
  'PUBLIC_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID',
  'BREVO_API_KEY',
  'BREVO_SENDER_EMAIL',
] as const;

const INTEGER_VARS = [
  'PORT',
  'DB_PORT',
  'CV_SERVICE_TIMEOUT_MS',
  'PRICE_CACHE_TTL_HOURS',
  'MANOMANO_TIMEOUT_MS',
  'MANOMANO_FEED_TTL_HOURS',
] as const;

export function validate(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];

  if (config.NODE_ENV === 'production') {
    for (const key of PRODUCTION_REQUIRED_VARS) {
      const value = config[key];
      if (value === undefined || value === '') {
        errors.push(`${key} est requise en production`);
      }
    }
  }

  for (const key of INTEGER_VARS) {
    const value = config[key];
    if (typeof value === 'string' && value !== '' && !/^\d+$/.test(value)) {
      errors.push(`${key} doit être un entier (valeur reçue : "${value}")`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration invalide :\n  - ${errors.join('\n  - ')}`);
  }

  return config;
}
