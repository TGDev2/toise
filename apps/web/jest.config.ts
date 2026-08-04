import type { Config } from 'jest';

const config: Config = {
  maxWorkers: 1,
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
  // Les specs Playwright (apps/web/e2e/**) importent leur propre test()/expect()
  // et attendent un navigateur réel — Jest les collecterait sinon via le même
  // testMatch et échouerait sous jsdom.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/'],
};

export default config;
