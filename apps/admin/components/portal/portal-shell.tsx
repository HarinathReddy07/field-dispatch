'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, ClipboardList, History, PlusCircle, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AccountMenu, ThemeToggle } from '../shell';
import { ConnectionPill } from '../ui';
import { Brand } from './brand';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Paths (besides `href`) under which this item counts as active. */
  match: (path: string) => boolean;
}

const REQUESTER_NAV: NavItem[] = [
  {
    href: '/app',
    label: 'Requests',
    icon: ClipboardList,
    match: (p) => p === '/app' || (p.startsWith('/app/requests/') && !p.endsWith('/receipt')),
  },
  { href: '/app/new', label: 'New request', icon: PlusCircle, match: (p) => p === '/app/new' },
  {
    href: '/app/history',
    label: 'History',
    icon: History,
    match: (p) => p === '/app/history' || p.endsWith('/receipt'),
  },
  {
    href: '/app/profile',
    label: 'Profile',
    icon: User,
    match: (p) => p === '/app/profile',
  },
];

const TECHNICIAN_NAV: NavItem[] = [
  {
    href: '/tech',
    label: 'My jobs',
    icon: Briefcase,
    match: (p) => p === '/tech' || p.startsWith('/tech/jobs'),
  },
  { href: '/tech/profile', label: 'Profile & Status', icon: User, match: (p) => p === '/tech/profile' },
];

/**
 * Chrome for the requester and technician portals: a top bar everywhere and, below the md breakpoint, a thumb-reach
 * tab bar (only when the role has more than one place to go). Mobile-first: content is a single column by default.
 */
export function PortalShell({
  role,
  name,
  children,
}: {
  role: 'REQUESTER' | 'TECHNICIAN';
  name: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const nav = role === 'REQUESTER' ? REQUESTER_NAV : TECHNICIAN_NAV;
  const home = role === 'REQUESTER' ? '/app' : '/tech';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
          <Brand href={home} />
          <nav aria-label="Primary" className="ml-4 hidden items-center gap-1 md:flex">
            {nav.map((n) => {
              const active = n.match(path);
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-9 items-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors duration-150',
                    active ? 'bg-primary-soft text-ink' : 'text-muted hover:bg-surface-muted hover:text-ink',
                  )}
                >
                  <Icon aria-hidden size={18} strokeWidth={1.75} className={active ? 'text-primary' : ''} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ConnectionPill />
            <ThemeToggle />
            <AccountMenu name={name} />
          </div>
        </div>
      </header>

      <main
        className={cn(
          'mx-auto w-full max-w-5xl flex-1 px-4 py-6',
          nav.length > 1 && 'pb-24 md:pb-6', // clear the tab bar on small screens
        )}
      >
        {children}
      </main>

      {nav.length > 1 && (
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
        >
          <ul className="mx-auto flex max-w-md">
            {nav.map((n) => {
              const active = n.match(path);
              const Icon = n.icon;
              return (
                <li key={n.href} className="flex-1">
                  <Link
                    href={n.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium',
                      active ? 'text-primary' : 'text-muted',
                    )}
                  >
                    <Icon aria-hidden size={22} strokeWidth={active ? 2.25 : 1.75} />
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
