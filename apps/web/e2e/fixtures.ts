export const FIREBASE_PROJECT_ID = 'demo-toise';
export const FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

export const API_URL = 'http://localhost:3001/api/v1';
export const WEB_URL = 'http://localhost:3000';

export const ARTISAN_EMAIL = 'e2e-artisan@toise.test';
export const ARTISAN_PASSWORD = 'E2eArtisan!2026';
export const ARTISAN_SIRET = '12345678901234';
export const ARTISAN_LABOR_RATE = 45;

/**
 * Compte **gratuit inscrit** — la sorte de compte qu'E3-2 rend capable de
 * chiffrer sans limite. Distinct de l'invité (anonyme, plafonné à un projet) et
 * de l'artisan ci-dessus (palier payant) : c'est le seul des trois pour qui la
 * question « rencontre-t-il un paywall avant l'export du devis ? » se pose.
 *
 * Sans profil entreprise : un compte gratuit n'émet pas de devis, donc rien ne
 * l'oblige à en avoir un. Le seeder ne touche pas non plus à
 * `subscription_tier` — le défaut de la colonne est `free`, et le forcer
 * masquerait une régression qui inscrirait autre chose.
 */
export const FREE_EMAIL = 'e2e-gratuit@toise.test';
export const FREE_PASSWORD = 'E2eGratuit!2026';
