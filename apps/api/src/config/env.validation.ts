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
  // Le service CV n'était protégé que par son isolement réseau. Le secret
  // partagé n'est une garantie que s'il est exigé des deux côtés : ici au
  // démarrage de l'API, et dans `Settings.validate_runtime()` côté Python.
  'CV_SERVICE_TOKEN',
] as const;

const INTEGER_VARS = [
  'PORT',
  'DB_PORT',
  'CV_SERVICE_TIMEOUT_MS',
  'PRICE_CACHE_TTL_HOURS',
  'MANOMANO_TIMEOUT_MS',
  'MANOMANO_FEED_TTL_HOURS',
  // Absente de PRODUCTION_REQUIRED_VARS à dessein : elle a un défaut (14) et
  // l'exiger ferait refuser de démarrer une production qui va très bien.
  'STRIPE_PAST_DUE_GRACE_DAYS',
  // Même raison (défaut : 30). Une valeur non entière tomberait sur `NaN`, donc
  // sur une date de coupure invalide dans une passe destructive : le contrôle
  // au démarrage vaut mieux que le refus à 3 h du matin.
  'DATA_RETENTION_DAYS',
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
