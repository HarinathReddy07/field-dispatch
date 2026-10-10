import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Wordmark used by the landing page, sign-in and both portals. Pure markup, safe in server components. */
export function Brand({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn('flex items-center gap-2.5 rounded-sm group', className)}>
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-sky-700 text-white shadow-sm shadow-primary/25 transition-transform duration-200 group-hover:scale-105"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.5" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="text-base font-bold tracking-tight text-ink">Field Dispatch</span>
    </Link>
  );
}
