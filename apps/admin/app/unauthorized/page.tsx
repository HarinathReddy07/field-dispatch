import { Lock, LogOut } from 'lucide-react';
import { Brand } from '@/components/portal/brand';
import { ButtonLink } from '@/components/ui';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-between p-6">
      <header className="w-full max-w-6xl">
        <Brand />
      </header>

      <main className="flex max-w-md flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10 text-warning">
          <Lock size={32} strokeWidth={1.75} aria-hidden />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-warning">403 Forbidden</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Access Restricted</h1>
        <p className="mt-3 text-base text-muted">
          Your current account role does not have authorization to view this section. Please sign in with an
          authorized account or return to your assigned portal.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/login" variant="primary" size="lg">
            Switch Account
          </ButtonLink>
          <ButtonLink
            href="/api/session/logout"
            variant="secondary"
            size="lg"
            icon={<LogOut size={16} strokeWidth={1.75} aria-hidden />}
          >
            Sign Out
          </ButtonLink>
        </div>
      </main>

      <footer className="text-xs text-muted">
        &copy; {new Date().getFullYear()} Field Dispatch · Role-based access control enabled
      </footer>
    </div>
  );
}
