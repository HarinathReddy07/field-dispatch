const base = {
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
};

// `unit`: pure tests, no infrastructure. `integration`: real PostgreSQL/PostGIS + Redis
// (Testcontainers, or TEST_ADMIN_DATABASE_URL / TEST_REDIS_URL when set).
module.exports = {
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    {
      ...base,
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.int.spec.ts'],
      globalSetup: '<rootDir>/test/support/global-setup.js',
      globalTeardown: '<rootDir>/test/support/global-teardown.js',
    },
  ],
  testTimeout: 120000,
  maxWorkers: 3, // each suite boots a full Nest app + argon2; more parallelism starves small machines
  collectCoverageFrom: ['src/domain/**/*.ts', 'src/modules/dispatch/dispatch*.ts', '!**/*.spec.ts'],
  coverageThreshold: { global: { lines: 90, statements: 90 } }, // domain + dispatch (see collectCoverageFrom)
};
