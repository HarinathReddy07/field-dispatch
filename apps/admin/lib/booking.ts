import { CreateRequestSchema, type Category, type CreateRequestDto } from '@dispatch/contracts';
import { fromLocalInput, isValidLatLon, type LatLon } from './location.ts';

export interface BookingForm {
  assetId: string;
  category: Category;
  site: LatLon | null;
  /** `datetime-local` values (browser local time). */
  start: string;
  end: string;
  notes: string;
}

export type BookingErrors = Partial<Record<'assetId' | 'site' | 'start' | 'end' | 'notes' | 'form', string>>;

/** A booking may start up to this long ago (clock drift, a form left open a few minutes). */
const PAST_GRACE_MS = 5 * 60_000;

/** Checks the form the way a person would read it, then confirms with the shared contract schema. */
export function validateBooking(
  f: BookingForm,
  now: Date = new Date(),
): { ok: true; dto: CreateRequestDto } | { ok: false; errors: BookingErrors } {
  const errors: BookingErrors = {};
  const assetId = f.assetId.trim();
  if (!assetId) errors.assetId = 'Enter the asset ID, for example PANEL-BLR-0042.';
  else if (assetId.length > 64) errors.assetId = 'The asset ID can be at most 64 characters.';

  if (!f.site || !isValidLatLon(f.site)) errors.site = 'Choose the site on the map, or use a quick pick.';

  const start = fromLocalInput(f.start);
  const end = fromLocalInput(f.end);
  if (!start) errors.start = 'Choose when the technician can start.';
  else if (Date.parse(start) < now.getTime() - PAST_GRACE_MS)
    errors.start = 'The start time can’t be in the past.';
  if (!end) errors.end = 'Choose when the window ends.';
  else if (start && Date.parse(end) <= Date.parse(start)) errors.end = 'The window must end after it starts.';

  if (f.notes.trim().length > 1000) errors.notes = 'Notes can be at most 1000 characters.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const parsed = CreateRequestSchema.safeParse({
    assetId,
    category: f.category,
    location: { lat: f.site!.lat, lon: f.site!.lon },
    windowStart: start,
    windowEnd: end,
    ...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
  });
  if (!parsed.success) return { ok: false, errors: { form: 'Please check the details you entered.' } };
  return { ok: true, dto: parsed.data };
}
