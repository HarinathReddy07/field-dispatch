export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** Sizes in px; mobile reads the numbers, admin reads the CSS custom properties. */
export const type = {
  display: { size: 28, line: 34, weight: 700 },
  title: { size: 22, line: 28, weight: 600 },
  heading: { size: 18, line: 24, weight: 600 },
  body: { size: 16, line: 24, weight: 400 },
  bodySm: { size: 14, line: 20, weight: 400 },
  label: { size: 14, line: 20, weight: 500 },
  caption: { size: 12, line: 16, weight: 500 },
  otp: { size: 36, line: 44, weight: 600, letterSpacingEm: 0.2 },
} as const;

export const shadow = {
  popover: '0 8px 24px rgba(15,23,42,.12)',
  /** React Native equivalent of `popover` */
  popoverNative: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

export const motion = { fast: 150, base: 220 } as const;

/** Touch target for mobile (44pt) and control height for admin (36px). */
export const hit = { mobile: 44, admin: 36 } as const;
