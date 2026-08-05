import { validate } from './env.validation';

/**
 * Configuration minimale mais valide pour un démarrage en production,
 * utilisée comme base que chaque test dérive en cassant une seule règle.
 */
const VALID_PRODUCTION_CONFIG: Record<string, string> = {
  NODE_ENV: 'production',
  DB_HOST: 'postgres',
  DB_PORT: '5432',
  DB_USERNAME: 'chiffreo',
  DB_PASSWORD: 'un-mot-de-passe-vraiment-solide',
  DB_NAME: 'chiffreo',
  CORS_ORIGIN: 'https://chiffreo.fr',
  PUBLIC_URL: 'https://chiffreo.fr',
  FIREBASE_PROJECT_ID: 'chiffreo-prod',
  FIREBASE_CLIENT_EMAIL: 'sa@chiffreo-prod.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY:
    '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
  STRIPE_SECRET_KEY: 'sk_live_xxx',
  STRIPE_WEBHOOK_SECRET: 'whsec_xxx',
  STRIPE_PRO_PRICE_ID: 'price_xxx',
  BREVO_API_KEY: 'xkeysib-xxx',
  BREVO_SENDER_EMAIL: 'contact@chiffreo.fr',
  CV_SERVICE_TOKEN: 'un-secret-partage',
  NEXT_PUBLIC_API_URL: 'https://api.chiffreo.fr/api/v1',
  NEXT_PUBLIC_SITE_URL: 'https://chiffreo.fr',
};

describe('validate (env.validation)', () => {
  it('accepts a fully-configured production environment', () => {
    expect(() => validate({ ...VALID_PRODUCTION_CONFIG })).not.toThrow();
  });

  it('does not validate production-only rules outside production', () => {
    const config = {
      NODE_ENV: 'development',
      DB_PASSWORD: 'CHANGEME',
      CORS_ORIGIN: 'http://localhost:3000',
    };
    expect(() => validate(config)).not.toThrow();
  });

  describe('CHANGEME marker', () => {
    it.each(['DB_PASSWORD', 'CORS_ORIGIN', 'PUBLIC_URL', 'STRIPE_SECRET_KEY'])(
      'rejects %s left at the CHANGEME marker',
      (key) => {
        const config = { ...VALID_PRODUCTION_CONFIG, [key]: 'CHANGEME' };
        expect(() => validate(config)).toThrow(new RegExp(`${key}.*CHANGEME`));
      },
    );
  });

  describe('example values copied verbatim', () => {
    it.each([
      ['DB_PASSWORD', 'chiffreo_dev'],
      ['CORS_ORIGIN', 'http://localhost:3000'],
      ['PUBLIC_URL', 'http://localhost:3000'],
      ['NEXT_PUBLIC_API_URL', 'http://localhost:3001/api/v1'],
      ['NEXT_PUBLIC_SITE_URL', 'http://localhost:3000'],
    ])('rejects %s left at its .env.example value', (key, exampleValue) => {
      const config = { ...VALID_PRODUCTION_CONFIG, [key]: exampleValue };
      expect(() => validate(config)).toThrow(new RegExp(key));
    });
  });

  describe('localhost URLs', () => {
    it.each([
      'CORS_ORIGIN',
      'PUBLIC_URL',
      'NEXT_PUBLIC_API_URL',
      'NEXT_PUBLIC_SITE_URL',
    ])('rejects %s pointing at 127.0.0.1', (key) => {
      const config = {
        ...VALID_PRODUCTION_CONFIG,
        [key]: 'http://127.0.0.1:3000',
      };
      expect(() => validate(config)).toThrow(new RegExp(key));
    });

    it('rejects one localhost origin among several in CORS_ORIGIN', () => {
      const config = {
        ...VALID_PRODUCTION_CONFIG,
        CORS_ORIGIN: 'https://chiffreo.fr,http://localhost:3000',
      };
      expect(() => validate(config)).toThrow(/CORS_ORIGIN/);
    });

    it('accepts a public HTTPS origin', () => {
      const config = {
        ...VALID_PRODUCTION_CONFIG,
        PUBLIC_URL: 'https://chiffreo.fr',
      };
      expect(() => validate(config)).not.toThrow();
    });
  });

  describe('DB_PASSWORD length', () => {
    it('rejects a password shorter than 16 characters', () => {
      const config = { ...VALID_PRODUCTION_CONFIG, DB_PASSWORD: 'trop-court' };
      expect(() => validate(config)).toThrow(/DB_PASSWORD.*16/);
    });

    it('accepts a password of exactly 16 characters', () => {
      const config = {
        ...VALID_PRODUCTION_CONFIG,
        DB_PASSWORD: '1234567890123456',
      };
      expect(() => validate(config)).not.toThrow();
    });
  });

  it('reports every faulty variable in a single error', () => {
    const config = {
      ...VALID_PRODUCTION_CONFIG,
      DB_PASSWORD: 'CHANGEME',
      CORS_ORIGIN: 'http://localhost:3000',
    };
    expect(() => validate(config)).toThrow(
      /DB_PASSWORD[\s\S]*CORS_ORIGIN|CORS_ORIGIN[\s\S]*DB_PASSWORD/,
    );
  });
});
