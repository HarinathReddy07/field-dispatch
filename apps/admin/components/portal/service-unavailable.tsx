import { WifiOff } from 'lucide-react';

/** Shown by a layout when the API cannot be reached, instead of bouncing the user around the sign-in flow. */
export function ServiceUnavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-8 text-center">
        <WifiOff aria-hidden size={32} strokeWidth={1.5} className="mx-auto text-subtle" />
        <h1 className="mt-3 text-lg font-semibold">We can’t reach the service</h1>
        <p className="mt-1 text-sm text-muted">
          This is usually brief. Your work is safe; try again in a moment.
        </p>
        {/* a plain link on purpose: it reloads the page and re-checks the session */}
        <a
          href=""
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-sm bg-primary px-5 text-base font-medium text-on-primary hover:bg-primary-hover"
        >
          Try again
        </a>
      </div>
    </main>
  );
}
