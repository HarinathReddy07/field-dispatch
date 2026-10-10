import type { Metadata } from 'next';
import { LiveProvider } from '@/components/live-provider';
import { PortalShell } from '@/components/portal/portal-shell';
import { ServiceUnavailable } from '@/components/portal/service-unavailable';
import { ToastProvider } from '@/components/ui';
import { requireRole } from '@/lib/guard';

export const metadata: Metadata = { title: { default: 'My jobs', template: '%s · Field Dispatch' } };

/** Technician area. The role is whatever the API says (GET /auth/me); other roles are sent to their own area. */
export default async function TechnicianLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole('TECHNICIAN');
  if (!me) return <ServiceUnavailable />;
  return (
    <LiveProvider>
      <ToastProvider>
        <PortalShell role="TECHNICIAN" name={me.name}>
          {children}
        </PortalShell>
      </ToastProvider>
    </LiveProvider>
  );
}
