'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return; // double-submit protection
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/session/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Sign-in failed');
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-semibold">Dispatch Operations</h1>
          <p className="text-sm text-soft">Admin sign-in</p>
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-10 w-full rounded-md border border-line bg-surface px-3"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-10 w-full rounded-md border border-line bg-surface px-3"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-[var(--tone-bad-ink)]">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={busy} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  );
}
