import { Cog, Zap, type LucideIcon } from 'lucide-react';
import { CATEGORY_RATES_MINOR, type Category } from '@dispatch/contracts';
import { categoryLabel, formatMoney } from '@dispatch/ui-tokens';
import { cn } from '@/lib/cn';

export const CATEGORY_META: Record<Category, { icon: LucideIcon; blurb: string }> = {
  ELECTRICAL_INSPECTION: {
    icon: Zap,
    blurb: 'Panels, wiring, gensets and switchgear checked and photographed.',
  },
  MECHANICAL_INSPECTION: {
    icon: Cog,
    blurb: 'Pumps, motors, compressors and moving parts inspected on site.',
  },
};

const rupees = (minor: number): string => formatMoney(minor).replace(/\.00$/, '');

/** "From ₹450 + ₹15/km": the quote is calculated by the server from these published rates. */
export function rateText(category: Category): string {
  const r = CATEGORY_RATES_MINOR[category];
  return `From ${rupees(r.base)} + ${rupees(r.perKm)}/km`;
}

export function CategoryIcon({
  category,
  size = 'md',
  className,
}: {
  category: string;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const Icon = CATEGORY_META[category as Category]?.icon ?? Cog;
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary',
        size === 'lg' ? 'h-12 w-12' : 'h-10 w-10',
        className,
      )}
    >
      <Icon size={size === 'lg' ? 24 : 20} strokeWidth={1.75} />
    </span>
  );
}

export { categoryLabel };
