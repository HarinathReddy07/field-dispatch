import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { homeFor } from '@/lib/roles';
import { getMe } from '@/lib/session';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  // Already signed in: go straight to your own area.
  const { me } = await getMe();
  if (me) redirect(homeFor(me.role));
  return <LoginForm />;
}
