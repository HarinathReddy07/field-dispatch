import { defineConfig, devices } from '@playwright/test';

// Smoke + UI QA against a RUNNING stack (see docs/runbook.md): API on :3000, admin on :3001, seeded database.
export default defineConfig({
  testDir: './tests',
  testMatch: ['smoke/**/*.spec.ts', 'ui/**/*.spec.ts'],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.ADMIN_URL ?? 'http://localhost:3001',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
