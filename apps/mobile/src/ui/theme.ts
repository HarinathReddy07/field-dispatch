import type { Tone } from '../lib/state-ui';

/** Theme tokens: every screen/component takes colours and sizes from here. */
export const theme = {
  color: {
    bg: '#f4f6f8',
    surface: '#ffffff',
    border: '#dde2e8',
    ink: '#16202a',
    soft: '#5b6876',
    brand: '#1d4ed8',
    brandInk: '#ffffff',
    danger: '#b91c1c',
  },
  tone: {
    neutral: { bg: '#eceff3', ink: '#3a4654' },
    info: { bg: '#dbeafe', ink: '#1e40af' },
    warn: { bg: '#fef3c7', ink: '#92400e' },
    good: { bg: '#dcfce7', ink: '#166534' },
    bad: { bg: '#fee2e2', ink: '#991b1b' },
  } satisfies Record<Tone, { bg: string; ink: string }>,
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { sm: 8, md: 12, pill: 999 },
  /** Minimum touch target (Apple HIG / Material): 44pt. */
  touch: 44,
  font: { body: 16, small: 13, title: 22, hero: 40 },
} as const;
