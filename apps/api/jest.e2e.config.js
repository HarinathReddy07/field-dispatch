// `make e2e`: the scripted acceptance scenarios A1-A7 plus the realtime flow, each driving the real HTTP/Socket.io API
// against real PostgreSQL/PostGIS + Redis (no manual DB edits to pass a flow).
//   A1/A2  test/integration/lifecycle.int.spec.ts     A3  otp.int.spec.ts
//   A4     concurrency.int.spec.ts                    A5  admin.int.spec.ts, security.int.spec.ts
//   A6     settlement.int.spec.ts                     A7  restart.int.spec.ts
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
  testMatch: [
    '<rootDir>/test/integration/lifecycle.int.spec.ts',
    '<rootDir>/test/integration/otp.int.spec.ts',
    '<rootDir>/test/integration/concurrency.int.spec.ts',
    '<rootDir>/test/integration/admin.int.spec.ts',
    '<rootDir>/test/integration/security.int.spec.ts',
    '<rootDir>/test/integration/settlement.int.spec.ts',
    '<rootDir>/test/integration/restart.int.spec.ts',
    '<rootDir>/test/integration/realtime.int.spec.ts',
  ],
  globalSetup: '<rootDir>/test/support/global-setup.js',
  globalTeardown: '<rootDir>/test/support/global-teardown.js',
  testTimeout: 180000,
  maxWorkers: 3,
};
