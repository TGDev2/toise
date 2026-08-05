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

// Variables portant une URL censée être joignable depuis l'extérieur en
// production (reverse proxy, redirections Stripe, build web) : un hôte
// localhost/127.0.0.1 y est toujours une erreur de configuration.
const PRODUCTION_URL_VARS = [
  'CORS_ORIGIN',
  'PUBLIC_URL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_SITE_URL',
] as const;

// Marqueur laissé dans .env.example à la place de toute valeur sensible.
// Le retrouver tel quel au démarrage en production signifie que .env n'a
// pas été renseigné.
const CHANGEME_MARKER = 'CHANGEME';

// Valeurs non vides que portait .env.example avant d'être remplacées par
// CHANGEME_MARKER (cf. historique git du fichier). Un .env recopié depuis
// une version antérieure du dépôt sans être modifié doit être refusé au
// même titre qu'un marqueur non renseigné.
const KNOWN_EXAMPLE_VALUES: Partial<Record<string, string>> = {
  DB_PASSWORD: 'chiffreo_dev',
  CORS_ORIGIN: 'http://localhost:3000',
  PUBLIC_URL: 'http://localhost:3000',
  NEXT_PUBLIC_API_URL: 'http://localhost:3001/api/v1',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
};

const MIN_DB_PASSWORD_LENGTH = 16;

function isLocalhostUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return (
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
    );
  } catch {
    return false;
  }
}

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
  // Même raison (défaut : 48). Une valeur non entière ferait expirer une
  // archive contenant IBAN/PII immédiatement (`NaN` comparé à toute date).
  'EXPORT_RETENTION_HOURS',
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

    const changemeCandidates: readonly string[] = [
      ...PRODUCTION_REQUIRED_VARS,
      ...PRODUCTION_URL_VARS,
    ];
    for (const key of changemeCandidates) {
      const value = config[key];
      if (typeof value !== 'string' || value === '') {
        continue;
      }
      if (value === CHANGEME_MARKER) {
        errors.push(
          `${key} n'a pas été renseignée (marqueur ${CHANGEME_MARKER} laissé tel quel)`,
        );
        continue;
      }
      const exampleValue = KNOWN_EXAMPLE_VALUES[key];
      if (exampleValue !== undefined && value === exampleValue) {
        errors.push(`${key} a conservé la valeur d'exemple du dépôt`);
      }
    }

    for (const key of PRODUCTION_URL_VARS) {
      const value = config[key];
      if (typeof value !== 'string' || value === '') {
        continue;
      }
      const origins =
        key === 'CORS_ORIGIN'
          ? value.split(',').map((origin) => origin.trim())
          : [value];
      if (origins.some(isLocalhostUrl)) {
        errors.push(
          `${key} pointe sur localhost/127.0.0.1, injoignable en production`,
        );
      }
    }

    if (
      typeof config.DB_PASSWORD === 'string' &&
      config.DB_PASSWORD !== '' &&
      config.DB_PASSWORD.length < MIN_DB_PASSWORD_LENGTH
    ) {
      errors.push(
        `DB_PASSWORD doit compter au moins ${MIN_DB_PASSWORD_LENGTH} caractères en production`,
      );
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
