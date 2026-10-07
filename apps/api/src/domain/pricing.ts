import { CATEGORY_RATES_MINOR, Category } from '@dispatch/contracts';

/** Meters -> km rounded to 2 decimals. Single rounding rule shared by nearby search, quote and confirm. */
export const metersToKm = (meters: number): number => Math.round(meters / 10) / 100;

/**
 * Server-authoritative quote in minor units (paise): fixed category base + per-km travel charge.
 * Clients never supply or influence this value.
 */
export function calculateQuote(category: Category, distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0)
    throw new RangeError('distanceKm must be a finite number >= 0');
  const rate = CATEGORY_RATES_MINOR[category];
  if (!rate) throw new RangeError(`Unknown category: ${category}`);
  return rate.base + Math.round(distanceKm * rate.perKm);
}
