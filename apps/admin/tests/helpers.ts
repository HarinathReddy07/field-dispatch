import { expect, request as pwRequest } from '@playwright/test';

export const API = (process.env.API_URL ?? 'http://localhost:3000') + '/api/v1';
export const PASSWORD = process.env.SEED_PASSWORD ?? 'Passw0rd!dev';

export async function apiLogin(email: string) {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/auth/login`, { data: { email, password: PASSWORD } });
  expect(res.ok(), `login ${email}`).toBeTruthy();
  return { ctx, token: (await res.json()).accessToken as string };
}

/**
 * Seeded technician positions go stale after the freshness window (a technician who stops reporting is not
 * matchable). Real technicians ping continuously; tests do the same once, from where the seed puts them.
 */
export async function refreshTechnicianLocations(): Promise<void> {
  const where: Record<string, { lat: number; lon: number }> = {
    'tech1@dispatch.test': { lat: 12.9756, lon: 77.6068 },
    'tech2@dispatch.test': { lat: 12.9784, lon: 77.6408 },
    'tech3@dispatch.test': { lat: 12.9352, lon: 77.6245 },
    'tech4@dispatch.test': { lat: 12.925, lon: 77.5938 },
    'tech8@dispatch.test': { lat: 13.0035, lon: 77.5646 },
  };
  for (const [email, position] of Object.entries(where)) {
    const { ctx, token } = await apiLogin(email);
    await ctx.post(`${API}/technicians/me/location`, {
      headers: { Authorization: `Bearer ${token}` },
      data: position,
    });
    await ctx.dispose();
  }
}
