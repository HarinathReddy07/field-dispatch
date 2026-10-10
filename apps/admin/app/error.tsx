'use client';

import { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Brand } from '@/components/portal/brand';
import { Button, ButtonLink } from '@/components/ui';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected client runtime error
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-between p-6">
      <header className="w-full max-w-6xl">
        <Brand />
      </header>

      <main className="flex max-w-md flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/10 text-danger">
          <AlertTriangle size={32} strokeWidth={1.75} aria-hidden />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-danger">Unexpected Error</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Something went wrong</h1>
        <p className="mt-3 text-base text-muted">
          An error occurred while loading this view. You can try reloading or return to the main dashboard.
        </p>

        {error.digest && <p className="mt-2 font-mono text-xs text-muted">Ref: {error.digest}</p>}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            onClick={() => reset()}
            variant="primary"
            size="lg"
            icon={<RefreshCw size={16} strokeWidth={1.75} aria-hidden />}
          >
            Try again
          </Button>
          <ButtonLink
            href="/"
            variant="secondary"
            size="lg"
            icon={<Home size={16} strokeWidth={1.75} aria-hidden />}
          >
            Back to home
          </ButtonLink>
        </div>
      </main>

      <footer className="text-xs text-muted">
        &copy; {new Date().getFullYear()} Field Dispatch · Verified on-demand field services
      </footer>
    </div>
  );
}
