import { expect, request as pwRequest, test, type Page } from '@playwright/test';
import { API, PASSWORD, apiLogin, cancelLeftoverTestJobs, refreshTechnicianLocations } from '../helpers';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@dispatch.test');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('only admins can sign in; protected pages redirect to login', async ({ page }) => {
  await page.goto('/live');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('Email').fill('requester1@dispatch.test');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('admins only');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('Email').fill('admin@dispatch.test');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('Invalid credentials');
});

test('live board: a new job and its transitions appear without reloading; cancel needs a reason and is audited', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Live board', exact: true }).click();
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-status', 'live');
  await expect(page.getByTestId('jobs-table')).toBeVisible();

  // --- API-triggered transitions (as the requester) ---
  await cancelLeftoverTestJobs();
  await refreshTechnicianLocations();
  const asset = `E2E-${Date.now()}`;
  const requester = { Authorization: `Bearer ${(await apiLogin('requester1@dispatch.test')).token}` };
  const api = await pwRequest.newContext();
  const created = await api.post(`${API}/requests`, {
    headers: requester,
    data: {
      assetId: asset,
      category: 'ELECTRICAL_INSPECTION',
      location: { lat: 12.9748, lon: 77.6033 },
      windowStart: new Date(Date.now() + 3600e3).toISOString(),
      windowEnd: new Date(Date.now() + 3 * 3600e3).toISOString(),
    },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).id as string;

  // new row appears live, no navigation
  await expect(page.getByTestId(`job-row-${asset}`)).toBeVisible();
  await expect(page.getByTestId(`job-state-${asset}`)).toContainText(/finding technician/i);

  const nearby = await api.get(`${API}/requests/${id}/nearby-technicians`, { headers: requester });
  const options = (await nearby.json()) as { technicianId: string }[];
  await expect(page.getByTestId(`job-state-${asset}`)).toContainText(/choose technician/i);

  const confirm = await api.post(`${API}/requests/${id}/confirm`, {
    headers: { ...requester, 'Idempotency-Key': `e2e-confirm-${Date.now()}` },
    data: { technicianId: options[0]!.technicianId },
  });
  expect(confirm.status()).toBe(200);
  await expect(page.getByTestId(`job-state-${asset}`)).toContainText(/assigned/i);

  // --- row opens the drawer (deep-linkable); admin exception action: reason is mandatory ---
  await page.getByTestId(`job-row-${asset}`).click();
  await expect(page).toHaveURL(new RegExp(`/live\\?job=${id}`));
  const drawer = page.getByRole('dialog', { name: asset });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'Cancel job…' }).click();

  const dialog = page.getByRole('dialog', { name: 'Cancel this job?' });
  const confirmButton = dialog.getByRole('button', { name: 'Cancel job' });
  await expect(confirmButton).toBeDisabled(); // no reason yet
  await dialog.getByLabel(/Reason/).fill('abc');
  await expect(confirmButton).toBeDisabled(); // too short
  await dialog.getByLabel(/Reason/).fill('Customer asked to cancel by phone');
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();
  await expect(page.getByRole('status').filter({ hasText: 'Job cancelled' })).toBeVisible();
  await expect(page.getByTestId(`job-state-${asset}`)).toContainText(/cancelled/i);

  // --- the audit view shows the privileged action with its reason ---
  await page.goto('/audit');
  await page.getByLabel('Job ID').fill(id);
  const row = page
    .getByTestId('audit-table')
    .getByRole('row')
    .filter({ hasText: 'request.admin_cancel' })
    .filter({ hasText: id.slice(0, 8) }); // this job's entry (filter result replaces the unfiltered list)
  await expect(row).toContainText('Customer asked to cancel by phone');
});
