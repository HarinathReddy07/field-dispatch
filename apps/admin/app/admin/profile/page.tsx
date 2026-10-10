'use client';

import { LogOut, Mail, Shield, Sliders } from 'lucide-react';
import { ButtonLink, Card, PageHeader } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';

interface AdminMeInfo {
  id: string;
  name: string;
  email?: string;
  role: string;
}

export default function AdminProfilePage() {
  const me = useQuery<AdminMeInfo>('auth/me');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administrator account"
        description="Operations command credentials, system permissions, and session audit tracking."
        breadcrumbs={[{ label: 'Operations', href: '/admin' }, { label: 'Admin Profile' }]}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Operator identity">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-lg">
                {me.data?.name?.[0] ?? 'A'}
              </span>
              <div>
                <h3 className="font-semibold text-base text-ink">{me.data?.name ?? 'Asha Admin'}</h3>
                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 mt-0.5">
                  <Shield size={12} /> Operations Administrator
                </span>
              </div>
            </div>

            <div className="divide-y divide-line border-t border-line pt-2 text-sm">
              <div className="flex justify-between py-2.5">
                <span className="text-muted flex items-center gap-1.5">
                  <Mail size={15} /> Operational Email
                </span>
                <span className="font-medium text-ink">{me.data?.email ?? 'admin@dispatch.test'}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted flex items-center gap-1.5">
                  <Shield size={15} /> Role Level
                </span>
                <span className="font-medium text-ink">Superadmin (All Routes)</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted flex items-center gap-1.5">
                  <Sliders size={15} /> Override Rights
                </span>
                <span className="font-medium text-emerald-600">Reassign & Cancel Authorized</span>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Console access & audit session">
          <p className="text-sm text-muted">
            Privileged session active. Every administrative modification is permanently appended to the
            immutable audit ledger.
          </p>

          <div className="mt-4 rounded-lg border border-line bg-surface-muted p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Console Status</span>
              <span className="font-semibold text-emerald-600">Connected & Synced</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Socket.IO Subscriptions</span>
              <span className="text-ink">Full Event Stream Active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Session Lifetime</span>
              <span className="text-ink">1 Hour Rolling Expiry</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-line flex flex-wrap gap-3">
            <ButtonLink href="/api/session/logout" variant="secondary" icon={<LogOut size={16} />}>
              Sign out
            </ButtonLink>
            <ButtonLink href="/admin" variant="primary">
              Return to Operations
            </ButtonLink>
          </div>
        </Card>
      </div>
    </div>
  );
}
