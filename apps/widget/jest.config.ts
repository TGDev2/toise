import type { Config } from 'jest';

const config: Config = {
  maxWorkers: 1,
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testMatch: ['**/*.spec.ts'],
};

export default config;
