'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Crosshair, LocateFixed, MapPin } from 'lucide-react';
import type { Category, RequestView } from '@dispatch/contracts';
import { CATEGORY_META, categoryLabel, rateText } from '@/components/portal/category';
import { SiteMap } from '@/components/portal/site-map-loader';
import { Button, Card, ErrorState, Input, PageHeader, Skeleton, TextArea } from '@/components/ui';
import { api } from '@/lib/client';
import { validateBooking, type BookingErrors } from '@/lib/booking';
import { correlationOf, friendlyMessage } from '@/lib/errors';
import { PLACES, defaultWindow, formatLatLon, type LatLon } from '@/lib/location';
import { CATEGORY_OPTIONS } from '@/lib/portal';
import { cn } from '@/lib/cn';

function NewRequestForm() {
  const router = useRouter();
  const params = useSearchParams();
  const preset = params.get('category');
  const initialCategory: Category = CATEGORY_OPTIONS.find((c) => c === preset) ?? 'ELECTRICAL_INSPECTION';

  const [assetId, setAssetId] = useState('');
  const [category, setCategory] = useState<Category>(initialCategory);
  const [site, setSite] = useState<LatLon | null>(null);
  const [{ start, end }, setWindow] = useState(() => defaultWindow(new Date()));
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<BookingErrors>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState<'idle' | 'busy'>('idle');
  const [geoNote, setGeoNote] = useState<string | null>(null);

  const siteLabel = useMemo(() => (site ? formatLatLon(site) : 'No site chosen yet'), [site]);

  const useMyLocation = () => {
    setGeoNote(null);
    if (!('geolocation' in navigator)) {
      setGeoNote('This browser can’t share its location. Use the map or a quick pick.');
      return;
    }
    setLocating('busy');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setSite({ lat: p.coords.latitude, lon: p.coords.longitude });
        setErrors((e) => ({ ...e, site: undefined }));
        setLocating('idle');
      },
      (err) => {
        setLocating('idle');
        setGeoNote(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Choose the site on the map instead.'
            : 'We couldn’t get your location. Choose the site on the map instead.',
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return; // double-submit protection
    setSubmitError(null);
    const result = validateBooking({ assetId, category, site, start, end, notes });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const created = await api<RequestView>('requests', { method: 'POST', body: result.dto });
      router.push(`/app/requests/${created.id}/technicians`);
    } catch (err) {
      setSubmitError(err);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <PageHeader
        title="New request"
        description="Tell us what needs inspecting. You’ll choose a technician in the next step."
        breadcrumbs={[{ label: 'My requests', href: '/app' }, { label: 'New request' }]}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card title="1. Asset and service">
            <div className="space-y-4">
              <Input
                label="Asset ID"
                placeholder="e.g. PANEL-BLR-0042"
                hint="The ID on the asset tag."
                value={assetId}
                maxLength={64}
                autoCapitalize="characters"
                autoComplete="off"
                onChange={(e) => setAssetId(e.target.value)}
                error={errors.assetId}
              />
              <fieldset>
                <legend className="mb-1 text-sm font-medium">Service</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CATEGORY_OPTIONS.map((c) => {
                    const Icon = CATEGORY_META[c].icon;
                    return (
                      <label key={c} className="relative block cursor-pointer">
                        <input
                          type="radio"
                          name="category"
                          value={c}
                          checked={category === c}
                          onChange={() => setCategory(c)}
                          className="peer sr-only"
                        />
                        <span
                          className={cn(
                            'flex h-full items-start gap-3 rounded-md border bg-surface p-3 transition-colors duration-150',
                            'peer-checked:border-primary peer-checked:bg-primary-soft',
                            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
                            'border-line-strong hover:border-primary',
                          )}
                        >
                          <span
                            aria-hidden
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface text-primary"
                          >
                            <Icon size={20} strokeWidth={1.75} />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium">{categoryLabel(c)}</span>
                            <span className="block text-xs text-muted">{CATEGORY_META[c].blurb}</span>
                            <span className="mt-1 block text-xs font-medium">{rateText(c)}</span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </Card>

          <Card title="2. Site location">
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div
                className={cn(
                  'h-64 overflow-hidden rounded-md border md:h-72',
                  errors.site ? 'border-danger' : 'border-line',
                )}
              >
                <SiteMap
                  site={site}
                  label="Map: click to choose the site"
                  onPick={(p) => {
                    setSite(p);
                    setErrors((e) => ({ ...e, site: undefined }));
                  }}
                />
              </div>
              <div className="space-y-3">
                <Button
                  className="w-full"
                  loading={locating === 'busy'}
                  onClick={useMyLocation}
                  icon={<LocateFixed aria-hidden size={16} strokeWidth={1.75} />}
                >
                  Use my location
                </Button>
                <div role="group" aria-label="Quick picks">
                  <p className="mb-1 text-xs font-medium text-muted">Quick picks</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PLACES.map((p) => {
                      const on = site?.lat === p.location.lat && site?.lon === p.location.lon;
                      return (
                        <button
                          key={p.name}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            setSite(p.location);
                            setErrors((e) => ({ ...e, site: undefined }));
                          }}
                          className={cn(
                            'min-h-9 rounded-full border px-3 text-sm transition-colors duration-150',
                            on
                              ? 'border-primary bg-primary-soft font-medium'
                              : 'border-line-strong bg-surface hover:border-primary',
                          )}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <p className="flex items-start gap-1.5 text-sm" aria-live="polite">
                  <MapPin aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-primary" />
                  <span>
                    <span className="block font-medium">Selected site</span>
                    <span className="tabular text-muted">{siteLabel}</span>
                  </span>
                </p>
                {geoNote && <p className="text-xs text-warning">{geoNote}</p>}
              </div>
            </div>
            {errors.site && (
              <p role="alert" className="mt-2 text-xs text-danger">
                {errors.site}
              </p>
            )}
          </Card>

          <Card title="3. Time window">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Earliest start"
                type="datetime-local"
                value={start}
                onChange={(e) => setWindow((w) => ({ ...w, start: e.target.value }))}
                error={errors.start}
              />
              <Input
                label="Latest finish"
                type="datetime-local"
                value={end}
                onChange={(e) => setWindow((w) => ({ ...w, end: e.target.value }))}
                error={errors.end}
              />
            </div>
          </Card>

          <Card title="4. Notes (optional)">
            <TextArea
              label="Anything the technician should know?"
              rows={3}
              maxLength={1000}
              placeholder="Access instructions, known faults, who to ask for…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              error={errors.notes}
            />
          </Card>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card title="Summary">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted">Service</dt>
                <dd className="font-medium">{categoryLabel(category)}</dd>
              </div>
              <div>
                <dt className="text-muted">Asset</dt>
                <dd className="font-medium break-words">{assetId.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted">Site</dt>
                <dd className="tabular font-medium">{site ? formatLatLon(site) : '—'}</dd>
              </div>
              <div>
                <dt className="text-muted">Price</dt>
                <dd className="font-medium">{rateText(category)}</dd>
                <dd className="text-xs text-muted">
                  The exact quote is set by the server once you choose a technician.
                </dd>
              </div>
            </dl>
            {errors.form && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {errors.form}
              </p>
            )}
            {submitError ? (
              <div className="mt-3">
                <ErrorState
                  message={friendlyMessage(submitError)}
                  correlationId={correlationOf(submitError)}
                />
              </div>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={busy}
              className="mt-4 w-full"
              icon={<Crosshair aria-hidden size={18} strokeWidth={1.75} />}
            >
              {busy ? 'Creating request…' : 'Find technicians'}
            </Button>
          </Card>
        </aside>
      </div>
    </form>
  );
}

export default function NewRequestPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <NewRequestForm />
    </Suspense>
  );
}
