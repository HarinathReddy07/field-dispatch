'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button, ConnectionBadge } from './ui';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/jobs', label: 'Live jobs' },
  { href: '/technicians', label: 'Technicians' },
  { href: '/audit', label: 'Audit' },
];

export function Shell({ name, children }: { name: string; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await fetch('/api/session/logout', { method: 'POST' });
    router.replace('/login');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold">Dispatch Ops</span>
          <nav aria-label="Primary" className="flex flex-wrap gap-1">
            {NAV.map((n) => {
              const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-brand text-brand-ink' : 'text-soft hover:bg-muted'}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <ConnectionBadge />
            <span className="hidden text-sm text-soft sm:inline">{name}</span>
            <Button onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
