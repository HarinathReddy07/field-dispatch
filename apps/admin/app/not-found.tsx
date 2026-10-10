import { Compass, Home } from 'lucide-react';
import { Brand } from '@/components/portal/brand';
import { ButtonLink } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-between p-6">
      <header className="w-full max-w-6xl">
        <Brand />
      </header>

      <main className="flex max-w-md flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Compass size={32} strokeWidth={1.75} aria-hidden />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-primary">404 Error</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Page not found</h1>
        <p className="mt-3 text-base text-muted">
          The page or resource you are looking for doesn&apos;t exist or has moved. Check the URL or return to
          home.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink
            href="/"
            variant="primary"
            size="lg"
            icon={<Home size={16} strokeWidth={1.75} aria-hidden />}
          >
            Back to home
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" size="lg">
            Sign in
          </ButtonLink>
        </div>
      </main>

      <footer className="text-xs text-muted">
        &copy; {new Date().getFullYear()} Field Dispatch · Verified on-demand field services
      </footer>
    </div>
  );
}
