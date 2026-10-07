import type { AvailabilityStatus, Category, NearbyTechnician } from '@dispatch/contracts';
import { calculateQuote } from './pricing';

export interface Candidate {
  technicianId: string;
  name: string;
  rating: number;
  distanceKm: number;
  availability: AvailabilityStatus;
}

/** Nearest first; ties broken by higher rating, then id for a fully deterministic order. */
export function rankCandidates<T extends Pick<Candidate, 'technicianId' | 'rating' | 'distanceKm'>>(
  candidates: readonly T[],
  limit = Infinity,
): T[] {
  return [...candidates]
    .sort(
      (a, b) =>
        a.distanceKm - b.distanceKm || b.rating - a.rating || a.technicianId.localeCompare(b.technicianId),
    )
    .slice(0, limit);
}

/** Public view of a candidate: only name, rating, distance, quote and availability (plus the id to confirm). */
export function toNearby(c: Candidate, category: Category): NearbyTechnician {
  return {
    technicianId: c.technicianId,
    name: c.name,
    rating: c.rating,
    distanceKm: c.distanceKm,
    quoteMinor: calculateQuote(category, c.distanceKm),
    availability: c.availability,
  };
}
