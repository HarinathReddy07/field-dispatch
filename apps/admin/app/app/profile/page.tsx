'use client';

import { LogOut, Mail, Shield, User } from 'lucide-react';
import { ButtonLink, Card, PageHeader } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';

interface MeInfo {
  id: string;
  name: string;
  email?: string;
  role: string;
}

export default function CustomerProfilePage() {
  const me = useQuery<MeInfo>('auth/me');

  return (
    <div className="space-y-6">
      <PageHeader
        title="My account"
        description="View your customer profile, registered email, and active authentication session."
        breadcrumbs={[{ label: 'My requests', href: '/app' }, { label: 'Profile' }]}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Account details">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary font-bold text-lg">
                {me.data?.name?.[0] ?? 'C'}
              </span>
              <div>
                <h3 className="font-semibold text-base text-ink">{me.data?.name ?? 'Loading...'}</h3>
                <span className="inline-flex items-center gap-1 rounded bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                  <User size={12} /> Requester / Customer
                </span>
              </div>
            </div>

            <div className="divide-y divide-line border-t border-line pt-2 text-sm">
              <div className="flex justify-between py-2.5">
                <span className="text-muted flex items-center gap-1.5">
                  <Mail size={15} /> Account Email
                </span>
                <span className="font-medium text-ink">{me.data?.email ?? 'requester1@dispatch.test'}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted flex items-center gap-1.5">
                  <Shield size={15} /> Access Level
                </span>
                <span className="font-medium text-ink">Asset Owner & Requester</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted">Account ID</span>
                <span className="font-mono text-xs text-muted truncate max-w-[200px]">
                  {me.data?.id ?? '—'}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Session & security">
          <p className="text-sm text-muted">
            Your session is secured with HTTP-only cookies and expires after 1 hour of inactivity.
          </p>

          <div className="mt-4 rounded-lg border border-line bg-surface-muted p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Session Status</span>
              <span className="font-semibold text-emerald-600">Active (Authorized)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Token Scope</span>
              <span className="text-ink">Full Customer API Access</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Security Audit</span>
              <span className="text-ink">All mutations recorded</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-line flex flex-wrap gap-3">
            <ButtonLink href="/api/session/logout" variant="secondary" icon={<LogOut size={16} />}>
              Sign out
            </ButtonLink>
            <ButtonLink href="/app" variant="primary">
              Back to Requests
            </ButtonLink>
          </div>
        </Card>
      </div>
    </div>
  );
}
