import { LiveProvider } from '@/components/live-provider';
import { ServiceUnavailable } from '@/components/portal/service-unavailable';
import { Shell } from '@/components/shell';
import { ToastProvider } from '@/components/ui';
import { requireRole } from '@/lib/guard';

/**
 * Server-side gate for every console page. The role is whatever the API says (GET /auth/me);
 * anyone who is not an ADMIN is sent to their own area (or to sign in).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole('ADMIN');
  if (!me) return <ServiceUnavailable />;
  return (
    <LiveProvider>
      <ToastProvider>
        <Shell name={me.name}>{children}</Shell>
      </ToastProvider>
    </LiveProvider>
  );
}
