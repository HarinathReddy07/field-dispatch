import { redirect } from 'next/navigation';
import { LiveProvider } from '@/components/live-provider';
import { Shell } from '@/components/shell';
import { serverApi } from '@/lib/session';

/**
 * Server-side gate for every console page. The role is whatever the API says (GET /auth/me);
 * anything that is not an ADMIN session is dropped and sent to the login page.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { status, data } = await serverApi<{ id: string; name: string; role: string }>('auth/me');
  if (status === 401) redirect('/api/session/refresh'); // expired access token: refresh and come back
  if (!data || data.role !== 'ADMIN') redirect('/api/session/logout');
  return (
    <LiveProvider>
      <Shell name={data.name}>{children}</Shell>
    </LiveProvider>
  );
}
