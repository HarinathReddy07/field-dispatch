module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  moduleNameMapper: {
    '^@dispatch/contracts$': '<rootDir>/../../packages/contracts/src',
    '^@dispatch/config$': '<rootDir>/../../packages/config/src',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: { ignoreCodes: [151001] } }],
  },
  testMatch: ['<rootDir>/test/e2e/**/*.e2e.spec.ts'],
  globalSetup: '<rootDir>/test/support/global-setup.js',
  globalTeardown: '<rootDir>/test/support/global-teardown.js',
  testTimeout: 180000,
};
