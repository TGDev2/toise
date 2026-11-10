import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { API_URL, FIREBASE_AUTH_EMULATOR_HOST, FIREBASE_PROJECT_ID, WEB_URL } from './e2e/fixtures';

const dbEnv = {
  DB_HOST: process.env.DB_HOST ?? 'localhost',
  DB_PORT: process.env.DB_PORT ?? '5432',
  DB_USERNAME: process.env.DB_USERNAME ?? 'toise',
  DB_PASSWORD: process.env.DB_PASSWORD ?? 'toise_dev',
  DB_NAME: process.env.DB_NAME ?? 'toise',
};

const apiDir = path.resolve(__dirname, '../api');

export default defineConfig({
  testDir: './e2e',
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['line']] : 'list',
  use: {
    baseURL: WEB_URL,
    viewport: { width: 1280, height: 800 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm exec firebase emulators:start --only auth --project demo-toise',
      cwd: path.resolve(__dirname, 'e2e'),
      port: 9099,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node dist/scripts/migrate.js && node dist/main.js',
      cwd: apiDir,
      url: `${API_URL}/projects/work-types`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...dbEnv,
        PORT: '3001',
        CORS_ORIGIN: WEB_URL,
        FIREBASE_PROJECT_ID,
        FIREBASE_AUTH_EMULATOR_HOST,
      },
    },
    {
      command: 'pnpm exec next dev -p 3000',
      cwd: __dirname,
      url: WEB_URL,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: '3000',
        NEXT_PUBLIC_API_URL: API_URL,
        NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: FIREBASE_PROJECT_ID,
        NEXT_PUBLIC_FIREBASE_APP_ID: 'demo-app-id',
        NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: FIREBASE_AUTH_EMULATOR_HOST,
      },
    },
  ],
});
