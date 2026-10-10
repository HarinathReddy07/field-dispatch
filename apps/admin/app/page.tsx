import type { Metadata } from 'next';
import { Landing } from '@/components/landing/landing';
import { getMe } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'FieldDispatch — Enterprise Field Engineering & Dispatch' },
  description:
    'Book verified on-demand field technicians, track arrivals with 6-digit OTP verification, review photo evidence, and settle securely.',
};

export default async function Home() {
  const { me } = await getMe();
  return <Landing user={me ? { name: me.name, role: me.role } : null} />;
}
