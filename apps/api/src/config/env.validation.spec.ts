import { validate } from './env.validation';

/**
 * Configuration minimale mais valide pour un démarrage en production,
 * utilisée comme base que chaque test dérive en cassant une seule règle.
 *
 * Elle ne porte **pas** `CV_SERVICE_TOKEN`, délibérément : c'est exactement ce
 * que `docker-compose.prod.yml` transmet au conteneur API depuis que
 * `cv-service` a été débranché (ADR 0001 §D2). Tant que cette variable était
 * exigée sans condition, la pile de production refusait de démarrer alors que
 * ce jeu de valeurs est complet.
 */
const VALID_PRODUCTION_CONFIG: Record<string, string> = {
  NODE_ENV: 'production',
  DB_HOST: 'postgres',
  DB_PORT: '5432',
  DB_USERNAME: 'toise',
  DB_PASSWORD: 'un-mot-de-passe-vraiment-solide',
  DB_NAME: 'toise',
  CORS_ORIGIN: 'https://toise.fr',
  PUBLIC_URL: 'https://toise.fr',
  FIREBASE_PROJECT_ID: 'toise-prod',
  FIREBASE_CLIENT_EMAIL: 'sa@toise-prod.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY:
    '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
  STRIPE_SECRET_KEY: 'sk_live_xxx',
  STRIPE_WEBHOOK_SECRET: 'whsec_xxx',
  BREVO_API_KEY: 'xkeysib-xxx',
  BREVO_SENDER_EMAIL: 'contact@toise.fr',
  NEXT_PUBLIC_API_URL: 'https://api.toise.fr/api/v1',
  NEXT_PUBLIC_SITE_URL: 'https://toise.fr',
};

describe('validate (env.validation)', () => {
  it('accepts a fully-configured production environment', () => {
    expect(() => validate({ ...VALID_PRODUCTION_CONFIG })).not.toThrow();
  });

  it("n'exige plus le prix d'un palier retiré de l'offre", () => {
    // `STRIPE_PRO_PRICE_ID` était requise au démarrage. Le palier supprimé
    // (E3-1), l'exiger obligeait à créer chez Stripe un prix qu'aucune surface
    // ne vend, sous peine de refus de démarrage — le contournement décrit dans
    // DEPLOY.md §4.2, qui disparaît avec sa cause.
    //
    // L'assertion « une configuration sans elle démarre » ne prouverait rien
    // seule : la même ligne est verte si la validation ne regarde plus rien.
    // Le second cas montre que le mécanisme rougit encore.
    expect(() =>
      validate({ ...VALID_PRODUCTION_CONFIG, STRIPE_PRO_PRICE_ID: undefined }),
    ).not.toThrow();

    const withoutSecretKey = { ...VALID_PRODUCTION_CONFIG };
    delete withoutSecretKey.STRIPE_SECRET_KEY;
    expect(() => validate(withoutSecretKey)).toThrow(/STRIPE_SECRET_KEY/);
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
      ['DB_PASSWORD', 'toise_dev'],
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
        CORS_ORIGIN: 'https://toise.fr,http://localhost:3000',
      };
      expect(() => validate(config)).toThrow(/CORS_ORIGIN/);
    });

    it('accepts a public HTTPS origin', () => {
      const config = {
        ...VALID_PRODUCTION_CONFIG,
        PUBLIC_URL: 'https://toise.fr',
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

  describe('CV_SERVICE_TOKEN, required only when the CV service is wired in', () => {
    it('starts without the shared secret while CV_ENABLED is absent (production default)', () => {
      expect(() => validate({ ...VALID_PRODUCTION_CONFIG })).not.toThrow();
    });

    it('starts without the shared secret while CV_ENABLED is false', () => {
      const config = { ...VALID_PRODUCTION_CONFIG, CV_ENABLED: 'false' };
      expect(() => validate(config)).not.toThrow();
    });

    it('rejects a missing shared secret once CV_ENABLED is true', () => {
      const config = { ...VALID_PRODUCTION_CONFIG, CV_ENABLED: 'true' };
      expect(() => validate(config)).toThrow(
        /CV_SERVICE_TOKEN.*CV_ENABLED=true/,
      );
    });

    it('accepts CV_ENABLED=true when the shared secret is provided', () => {
      const config = {
        ...VALID_PRODUCTION_CONFIG,
        CV_ENABLED: 'true',
        CV_SERVICE_TOKEN: 'un-secret-partage',
      };
      expect(() => validate(config)).not.toThrow();
    });

    it('still rejects a CHANGEME shared secret once CV_ENABLED is true', () => {
      const config = {
        ...VALID_PRODUCTION_CONFIG,
        CV_ENABLED: 'true',
        CV_SERVICE_TOKEN: 'CHANGEME',
      };
      expect(() => validate(config)).toThrow(/CV_SERVICE_TOKEN.*CHANGEME/);
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
