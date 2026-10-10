import type { Metadata } from 'next';
import { LiveProvider } from '@/components/live-provider';
import { PortalShell } from '@/components/portal/portal-shell';
import { ServiceUnavailable } from '@/components/portal/service-unavailable';
import { ToastProvider } from '@/components/ui';
import { requireRole } from '@/lib/guard';

export const metadata: Metadata = { title: { default: 'My requests', template: '%s · Field Dispatch' } };

/** Requester area. The role is whatever the API says (GET /auth/me); other roles are sent to their own area. */
export default async function RequesterLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole('REQUESTER');
  if (!me) return <ServiceUnavailable />;
  return (
    <LiveProvider>
      <ToastProvider>
        <PortalShell role="REQUESTER" name={me.name}>
          {children}
        </PortalShell>
      </ToastProvider>
    </LiveProvider>
  );
}
