'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-muted',
  ghost: 'text-ink hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:opacity-90 dark:text-[#0B1220]',
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
};

/** While `loading` the button is disabled and shows a spinner, so a double click can never submit twice. */
export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sm text-sm font-medium whitespace-nowrap',
        'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'md' ? 'min-h-9 px-3.5' : 'min-h-11 px-5 text-base',
        VARIANT[variant],
        className,
      )}
    >
      {loading ? (
        <Loader2
          aria-hidden
          size={16}
          strokeWidth={1.75}
          className="animate-spin motion-reduce:animate-none"
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

/** A link that looks like a Button (navigation, not an action). */
export function ButtonLink({
  href,
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...props
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: React.ReactNode;
}) {
  return (
    <Link
      {...props}
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sm text-sm font-medium whitespace-nowrap',
        'transition-colors duration-150',
        size === 'md' ? 'min-h-9 px-3.5' : 'min-h-11 px-5 text-base',
        VARIANT[variant],
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
