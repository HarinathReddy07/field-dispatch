'use client';

import { useState } from 'react';
import { LogOut, Mail, MapPin, Shield, Star, Wrench } from 'lucide-react';
import { AvailabilityPill, Button, ButtonLink, Card, PageHeader } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';

interface TechMeInfo {
  id: string;
  name: string;
  email?: string;
  role: string;
}

export default function TechnicianProfilePage() {
  const me = useQuery<TechMeInfo>('auth/me');
  const [availability, setAvailability] = useState<'AVAILABLE' | 'OFFLINE'>('AVAILABLE');
  const [busy, setBusy] = useState(false);

  const toggleAvailability = async () => {
    setBusy(true);
    try {
      const next = availability === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
      await fetch('/api/proxy/technicians/availability', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      setAvailability(next);
    } catch {
      // optimistic toggle fallback
      setAvailability((prev) => (prev === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My technician profile"
        description="Operational identity, service categories, and dispatch availability status."
        breadcrumbs={[{ label: 'My jobs', href: '/tech' }, { label: 'Profile' }]}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Technician credentials">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-lg">
                {me.data?.name?.[0] ?? 'T'}
              </span>
              <div>
                <h3 className="font-semibold text-base text-ink">{me.data?.name ?? 'Anil Kumar'}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    <Wrench size={12} /> Verified Field Engineer
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-amber-500">
                    <Star size={13} fill="currentColor" /> 4.8 Rating
                  </span>
                </div>
              </div>
            </div>

            <div className="divide-y divide-line border-t border-line pt-2 text-sm">
              <div className="flex justify-between py-2.5">
                <span className="text-muted flex items-center gap-1.5">
                  <Mail size={15} /> Account Email
                </span>
                <span className="font-medium text-ink">{me.data?.email ?? 'tech1@dispatch.test'}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted flex items-center gap-1.5">
                  <Wrench size={15} /> Supported Services
                </span>
                <span className="font-medium text-ink">Electrical & Mechanical</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted flex items-center gap-1.5">
                  <MapPin size={15} /> Base Location
                </span>
                <span className="font-mono text-xs text-ink">12.9756° N, 77.6068° E</span>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Availability & dispatch controls">
          <p className="text-sm text-muted">
            Set your status to Available to receive real-time proximity dispatch requests.
          </p>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-surface-muted p-4">
            <div>
              <span className="text-xs text-muted block">Current Status</span>
              <div className="mt-1">
                <AvailabilityPill status={availability} />
              </div>
            </div>
            <Button
              type="button"
              variant={availability === 'AVAILABLE' ? 'secondary' : 'primary'}
              loading={busy}
              onClick={toggleAvailability}
            >
              {availability === 'AVAILABLE' ? 'Go Offline' : 'Go Available'}
            </Button>
          </div>

          <div className="mt-6 pt-4 border-t border-line flex flex-wrap gap-3">
            <ButtonLink href="/api/session/logout" variant="secondary" icon={<LogOut size={16} />}>
              Sign out
            </ButtonLink>
            <ButtonLink href="/tech" variant="primary">
              Back to My Jobs
            </ButtonLink>
          </div>
        </Card>
      </div>
    </div>
  );
}
