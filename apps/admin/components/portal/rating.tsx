import { Star } from 'lucide-react';

/** Star rating as text and icon together, so it never relies on the icon alone. */
export function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium">
      <Star aria-hidden size={14} strokeWidth={1.75} className="fill-current text-warning" />
      <span className="tabular">{value.toFixed(1)}</span>
      <span className="sr-only"> out of 5</span>
    </span>
  );
}

/** Round initials badge used where there is no photo. */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-ink ${
        size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm'
      }`}
    >
      {initials || '?'}
    </span>
  );
}
