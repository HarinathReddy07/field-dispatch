'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Camera,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { isRole } from '@/lib/roles';

// ─── Demo login tiles ─────────────────────────────────────────────────────

const DEMOS = [
  {
    label: 'C1',
    email: 'requester1@dispatch.test',
    name: 'Ravi Requester',
    role: 'Customer',
    color:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700',
  },
  {
    label: 'C2',
    email: 'requester2@dispatch.test',
    name: 'Rhea Requester',
    role: 'Customer',
    color:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700',
  },
  {
    label: 'T1',
    email: 'tech1@dispatch.test',
    name: 'Anil Tech',
    role: 'Technician',
    color:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700',
  },
  {
    label: 'T2',
    email: 'tech2@dispatch.test',
    name: 'Bhavna Tech',
    role: 'Technician',
    color:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700',
  },
  {
    label: 'A1',
    email: 'admin@dispatch.test',
    name: 'Admin Ops',
    role: 'Admin',
    color:
      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-700',
  },
];

const POINTS = [
  { icon: MapPin, text: 'Book the nearest verified technician.' },
  { icon: KeyRound, text: 'OTP-proven on-site arrival.' },
  { icon: Camera, text: 'Mandatory photo evidence before approval.' },
  { icon: Shield, text: 'Pay only when you approve the work.' },
];

// ─── Component ───────────────────────────────────────────────────────────

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent, overrideEmail?: string, overridePassword?: string) => {
    e.preventDefault();
    const finalEmail = overrideEmail ?? email;
    const finalPassword = overridePassword ?? password;
    if (!finalEmail) {
      setError('Please enter your email.');
      return;
    }
    if (!finalPassword) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/session/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: finalEmail, password: finalPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Sign in failed. Check your credentials.');
        return;
      }
      const role = data.user?.role ?? '';
      router.replace(isRole(role) ? (data.home ?? '/') : '/');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (demo: (typeof DEMOS)[0]) => async (e: React.MouseEvent) => {
    e.preventDefault();
    setEmail(demo.email);
    setPassword('Passw0rd!dev');
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/session/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: demo.email, password: 'Passw0rd!dev' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Quick login failed.');
        return;
      }
      const role = data.user?.role ?? '';
      router.replace(isRole(role) ? (data.home ?? '/') : '/');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      {/* ── Left panel (brand + trust points) ── */}
      <div className="hidden bg-[var(--color-primary)] lg:flex lg:w-1/2 lg:flex-col lg:justify-between p-10 text-white">
        <Link href="/" className="flex items-center gap-2 font-bold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-sm font-bold">
            F
          </span>
          FieldDispatch
        </Link>

        <div>
          <ShieldCheck size={48} strokeWidth={1.25} className="mb-6 opacity-80" />
          <h2 className="text-3xl font-extrabold leading-snug">
            Verified technicians.
            <br />
            Transparent pricing.
            <br />
            Photo proof.
          </h2>
          <p className="mt-4 text-sm opacity-75 leading-relaxed max-w-xs">
            Every job is OTP-verified, server-timed, and backed by mandatory photo evidence before you pay.
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => {
              const Icon = p.icon;
              return (
                <li key={p.text} className="flex items-center gap-3 text-sm opacity-90">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
                    <Icon size={16} strokeWidth={1.75} />
                  </span>
                  {p.text}
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-xs opacity-50">© {new Date().getFullYear()} FieldDispatch</p>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-12">
        {/* Mobile logo */}
        <Link href="/" className="mb-8 flex items-center gap-2 font-bold text-[var(--color-text)] lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white">
            F
          </span>
          FieldDispatch
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-[var(--color-text)]">Welcome back</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Don't have an account?{' '}
              <Link href="/register" className="font-semibold text-[var(--color-primary)] hover:underline">
                Sign up free
              </Link>
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-9 pr-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)] transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
              >
                Password
              </label>
              <div className="relative">
                <KeyRound
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                />
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-9 pr-10 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)] transition-all"
                />
                <button
                  type="button"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white transition-all hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--color-border)]" />
            <span className="text-xs text-[var(--color-text-muted)]">or try a demo account</span>
            <div className="h-px flex-1 bg-[var(--color-border)]" />
          </div>

          {/* Demo quick-login tiles */}
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-text-muted)]">
              Password for all demo accounts:{' '}
              <code className="rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-mono">
                Passw0rd!dev
              </code>
            </p>
            <div className="grid grid-cols-5 gap-2">
              {DEMOS.map((d) => (
                <button
                  key={d.label}
                  onClick={quickLogin(d)}
                  disabled={loading}
                  title={`Login as ${d.name} (${d.role})`}
                  className={`flex flex-col items-center rounded-xl border p-2 text-xs font-bold transition-all hover:scale-105 hover:shadow-md disabled:opacity-50 ${d.color}`}
                >
                  <span className="text-base font-extrabold">{d.label}</span>
                  <span className="mt-0.5 text-[10px] font-medium opacity-70 truncate w-full text-center">
                    {d.role}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-[var(--color-text-muted)]">
            By signing in you agree to our{' '}
            <a href="#" className="underline hover:text-[var(--color-primary)]">
              Terms
            </a>{' '}
            and{' '}
            <a href="#" className="underline hover:text-[var(--color-primary)]">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
