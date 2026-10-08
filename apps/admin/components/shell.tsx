'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  Moon,
  ScrollText,
  Sun,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, ConnectionPill } from './ui';
import { useDialog, useIsClient } from './ui/use-dialog';

const NAV: { href: string; label: string; title: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Dashboard', title: 'Operations dashboard', icon: LayoutDashboard },
  { href: '/live', label: 'Live board', title: 'Live job board', icon: MapIcon },
  { href: '/technicians', label: 'Technicians', title: 'Technicians', icon: Users },
  { href: '/audit', label: 'Audit', title: 'Audit log', icon: ScrollText },
];

function NavLinks({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1 p-3">
      {NAV.map((n) => {
        const active = path === n.href || path.startsWith(`${n.href}/`);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-10 items-center gap-3 rounded-sm px-3 text-sm font-medium transition-colors duration-150',
              active ? 'bg-primary-soft text-ink' : 'text-muted hover:bg-surface-muted hover:text-ink',
            )}
          >
            <Icon aria-hidden size={20} strokeWidth={1.75} className={active ? 'text-primary' : undefined} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2 border-b border-line px-5">
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-sm font-bold text-on-primary"
      >
        D
      </span>
      <span className="text-base font-semibold">Dispatch Ops</span>
    </div>
  );
}

function MobileNav({ path, onClose }: { path: string; onClose: () => void }) {
  const ref = useDialog<HTMLDivElement>(onClose);
  const client = useIsClient();
  if (!client) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] lg:hidden">
      <div aria-hidden className="fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        tabIndex={-1}
        className="drawer-in absolute inset-y-0 left-0 w-64 border-r border-line bg-surface shadow-popover"
      >
        <div className="flex items-center justify-between pr-2">
          <Brand />
          <Button variant="ghost" aria-label="Close navigation" onClick={onClose} className="!px-2">
            <X aria-hidden size={20} strokeWidth={1.75} />
          </Button>
        </div>
        <NavLinks path={path} onNavigate={onClose} />
      </div>
    </div>,
    document.body,
  );
}

export function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch {
      /* private mode: the theme just will not persist */
    }
  };
  return (
    <Button variant="ghost" onClick={toggle} aria-label="Toggle dark mode" className="!px-2">
      <Sun aria-hidden size={20} strokeWidth={1.75} className="hidden dark:block" />
      <Moon aria-hidden size={20} strokeWidth={1.75} className="dark:hidden" />
    </Button>
  );
}

function AdminMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const signOut = async () => {
    await fetch('/api/session/logout', { method: 'POST' });
    router.replace('/login');
  };

  return (
    <div ref={box} className="relative">
      <Button
        variant="ghost"
        aria-label={`Account menu for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-32 truncate sm:inline">{name}</span>
        <ChevronDown aria-hidden size={16} strokeWidth={1.75} />
      </Button>
      {open && (
        <div
          role="menu"
          className="fade-in absolute right-0 z-50 mt-1 w-44 rounded-md border border-line bg-surface p-1 shadow-popover"
        >
          <button
            role="menuitem"
            onClick={signOut}
            className="flex min-h-9 w-full items-center gap-2 rounded-sm px-3 text-sm hover:bg-surface-muted"
          >
            <LogOut aria-hidden size={16} strokeWidth={1.75} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Shell({ name, children }: { name: string; children: React.ReactNode }) {
  const path = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const title = NAV.find((n) => path === n.href || path.startsWith(`${n.href}/`))?.title ?? 'Dispatch Ops';

  return (
    <div className="relative min-h-screen">
      <aside className="absolute inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-surface lg:block">
        <div className="sticky top-0">
          <Brand />
          <NavLinks path={path} />
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:px-6">
          <Button
            variant="ghost"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
            className="!px-2 lg:hidden"
          >
            <Menu aria-hidden size={20} strokeWidth={1.75} />
          </Button>
          <p className="min-w-0 flex-1 truncate text-base font-semibold">{title}</p>
          <ConnectionPill />
          <ThemeToggle />
          <AdminMenu name={name} />
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 lg:px-6">{children}</main>
      </div>

      {navOpen && <MobileNav path={path} onClose={() => setNavOpen(false)} />}
    </div>
  );
}
