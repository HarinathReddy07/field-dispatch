import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { API, PASSWORD, apiLogin, refreshTechnicianLocations } from '../helpers';

/**
 * Accessibility and keyboard QA against a RUNNING stack (see docs/runbook.md): axe on every page in light and dark,
 * at desktop and phone width, plus drawer focus handling and the reassign reason gate.
 */
const STATE_FILE = path.resolve(__dirname, '../../test-results/admin-session.json');

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

test.describe.configure({ mode: 'serial' });

let confirmedJob = '';
let settledJob = '';

async function contextFor(browser: Browser, theme: 'light' | 'dark', size: keyof typeof VIEWPORTS) {
  const context = await browser.newContext({
    storageState: STATE_FILE,
    viewport: VIEWPORTS[size],
    reducedMotion: 'reduce',
  });
  await context.addInitScript((t) => localStorage.setItem('theme', t), theme);
  return context;
}

async function settle(page: Page) {
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-status', 'live');
  await page.evaluate(() => document.fonts.ready);
}

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });

  // one browser sign-in, reused by every context below (the login endpoint is rate limited)
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@dispatch.test');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await ctx.storageState({ path: STATE_FILE });
  await ctx.close();

  await refreshTechnicianLocations();

  // data for the screenshots: a CONFIRMED job (technician on the map) and the seeded SETTLED job
  const requester = await apiLogin('requester1@dispatch.test');
  const auth = { Authorization: `Bearer ${requester.token}` };
  const created = await requester.ctx.post(`${API}/requests`, {
    headers: auth,
    data: {
      assetId: `UI-${Date.now()}`,
      category: 'ELECTRICAL_INSPECTION',
      location: { lat: 12.9748, lon: 77.6033 },
      windowStart: new Date(Date.now() + 3600e3).toISOString(),
      windowEnd: new Date(Date.now() + 3 * 3600e3).toISOString(),
    },
  });
  confirmedJob = (await created.json()).id as string;
  const nearby = await requester.ctx.get(`${API}/requests/${confirmedJob}/nearby-technicians`, {
    headers: auth,
  });
  const options = (await nearby.json()) as { technicianId: string }[];
  await requester.ctx.post(`${API}/requests/${confirmedJob}/confirm`, {
    headers: { ...auth, 'Idempotency-Key': `ui-${Date.now()}` },
    data: { technicianId: options[0]!.technicianId },
  });

  const admin = await apiLogin('admin@dispatch.test');
  const jobs = await admin.ctx.get(`${API}/admin/jobs?state=SETTLED&pageSize=1`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  settledJob = ((await jobs.json()).items[0]?.id as string | undefined) ?? '';
});

const PAGES: { name: string; url: () => string; ready: (p: Page) => Promise<void>; shot?: 'viewport' }[] = [
  {
    name: 'dashboard',
    url: () => '/dashboard',
    ready: async (p) => {
      await expect(p.getByText('Active requests')).toBeVisible();
      await expect(p.getByLabel('Counts by state')).toBeVisible();
    },
  },
  {
    name: 'live-board',
    url: () => '/live',
    ready: async (p) => {
      await expect(p.getByTestId('jobs-table')).toBeVisible();
      await p.waitForTimeout(800); // map fits its bounds
    },
  },
  {
    name: 'job-drawer-overview',
    url: () => `/live?job=${confirmedJob}`,
    ready: async (p) => {
      await expect(p.getByRole('dialog').getByRole('tab', { name: 'Overview' })).toBeVisible();
      await expect(p.getByRole('dialog').getByText('Technician', { exact: true })).toBeVisible();
    },
    shot: 'viewport',
  },
  {
    name: 'job-drawer-settlement',
    url: () => `/live?job=${settledJob}`,
    ready: async (p) => {
      await p.getByRole('tab', { name: 'Settlement' }).click();
      await expect(p.getByTestId('settlement')).toBeVisible();
    },
    shot: 'viewport',
  },
  {
    name: 'technicians',
    url: () => '/technicians',
    ready: async (p) => {
      await expect(p.getByTestId('technicians-table')).toBeVisible();
    },
  },
  {
    name: 'audit',
    url: () => '/audit',
    ready: async (p) => {
      await expect(p.getByTestId('audit-table')).toBeVisible();
    },
  },
  {
    name: 'components',
    url: () => '/dev/components',
    ready: async (p) => {
      await expect(p.getByRole('heading', { name: 'Components' })).toBeVisible();
    },
  },
];

for (const theme of ['light', 'dark'] as const) {
  for (const size of ['desktop', 'mobile'] as const) {
    test(`axe: ${theme} ${size}`, async ({ browser }) => {
      test.setTimeout(240_000);
      const context: BrowserContext = await contextFor(browser, theme, size);
      const page = await context.newPage();
      try {
        for (const spec of PAGES) {
          if (spec.name.startsWith('job-drawer-settlement') && !settledJob) continue;
          await page.goto(spec.url());
          await settle(page);
          await spec.ready(page);
          expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
            theme === 'dark',
          );

          const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .exclude('.leaflet-container') // third-party map widget
            .analyze();
          const blocking = results.violations.filter(
            (v) => v.impact === 'serious' || v.impact === 'critical',
          );
          expect(
            blocking.map(
              (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
            ),
            `${spec.name} ${theme} ${size}`,
          ).toEqual([]);
        }
      } finally {
        await context.close();
      }
    });
  }
}

test('keyboard: Enter opens the drawer, focus stays inside, Esc closes and restores focus', async ({
  browser,
}) => {
  const context = await contextFor(browser, 'light', 'desktop');
  const page = await context.newPage();
  await page.goto('/live');
  await settle(page);
  const row = page.getByTestId('jobs-table').locator('tbody tr').first();
  await row.focus();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog').first();
  await expect(drawer).toBeVisible();

  // Tab many times: focus never leaves the drawer
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/live$/);
  await expect(row).toBeFocused();
  await context.close();
});

test('reassign cannot be submitted without a technician and a reason; the audit entry then appears', async ({
  browser,
}) => {
  const context = await contextFor(browser, 'light', 'desktop');
  const page = await context.newPage();
  await page.goto(`/live?job=${confirmedJob}`);
  await settle(page);
  await page.getByRole('button', { name: 'Reassign…' }).click();

  const dialog = page.getByRole('dialog', { name: 'Reassign technician' });
  const submit = dialog.getByRole('button', { name: 'Reassign', exact: true });
  await expect(submit).toBeDisabled();

  await dialog.getByLabel('New technician').selectOption({ index: 1 });
  await expect(submit).toBeDisabled(); // technician chosen, reason still missing
  await dialog.getByLabel(/Reason/).fill('abc');
  await expect(submit).toBeDisabled();
  await dialog.getByLabel(/Reason/).fill('Technician stuck in traffic, moving to a closer one');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByRole('status').filter({ hasText: 'Technician reassigned' })).toBeVisible();

  await page.goto('/audit');
  await page.getByLabel('Job ID').fill(confirmedJob);
  const row = page
    .getByTestId('audit-table')
    .getByRole('row')
    .filter({ hasText: 'request.admin_reassign' })
    .filter({ hasText: confirmedJob.slice(0, 8) });
  await expect(row).toContainText('Technician stuck in traffic');
  await context.close();
});
