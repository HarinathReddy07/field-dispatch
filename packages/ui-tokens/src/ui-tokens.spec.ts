import { REQUEST_STATES } from '@dispatch/contracts';
import {
  JOURNEY_STEPS,
  SEMANTIC_COLORS,
  colors,
  contrastRatio,
  formatDistanceKm,
  formatDuration,
  formatMoney,
  generateCssVariables,
  journeyOf,
  relativeTime,
  stateStyle,
  stateStyles,
  tailwindPreset,
  tailwindThemeCss,
} from './index';

const AA = 4.5;

describe('state styles', () => {
  it.each(REQUEST_STATES)('%s has a label and both themes', (state) => {
    const s = stateStyles[state];
    expect(s.label.length).toBeGreaterThan(2);
    for (const theme of ['light', 'dark'] as const) {
      expect(s[theme].bg).toMatch(/^#[0-9A-F]{6}$/);
      expect(s[theme].text).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it.each(REQUEST_STATES.flatMap((s) => (['light', 'dark'] as const).map((t) => [s, t] as const)))(
    '%s (%s) text on background is at least 4.5:1',
    (state, theme) => {
      const { bg, text } = stateStyles[state][theme];
      expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(AA);
    },
  );

  it('uses the exact colours from the design plan', () => {
    expect(stateStyles.CONFIRMED).toMatchObject({
      label: 'Assigned',
      light: { bg: '#E0E7FF', text: '#3730A3' },
      dark: { bg: '#1E1B4B', text: '#C7D2FE' },
    });
    expect(stateStyles.UNDER_REVIEW.label).toBe('Awaiting review');
    expect(stateStyles.REWORK.light).toEqual({ bg: '#FFEDD5', text: '#9A3412' });
  });

  it('falls back to a neutral style for an unknown state', () => {
    expect(stateStyle('SOMETHING_NEW', 'dark')).toMatchObject({ label: 'something new', bg: '#1E293B' });
  });
});

describe('palette contrast', () => {
  it.each(['light', 'dark'] as const)('%s: key text pairs reach AA', (theme) => {
    const c = colors[theme];
    expect(contrastRatio(c.text, c.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(c.text, c.bg)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(c.textMuted, c.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(c.primary, c.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(c.danger, c.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(c.success, c.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(c.warning, c.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(c.text, c.primarySoft)).toBeGreaterThanOrEqual(AA);
  });

  it('light and dark define the same tokens', () => {
    expect(Object.keys(colors.light).sort()).toEqual([...SEMANTIC_COLORS].sort());
    expect(Object.keys(colors.dark).sort()).toEqual([...SEMANTIC_COLORS].sort());
  });

  it('computes the WCAG formula (black on white is 21:1)', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777', '#777')).toBe(1);
  });
});

describe('formatMoney', () => {
  it.each([
    [0, '₹0.00'],
    [5, '₹0.05'],
    [46500, '₹465.00'],
    [99999, '₹999.99'],
    [100000, '₹1,000.00'],
    [12345678, '₹1,23,456.78'],
    [123456789012, '₹1,23,45,67,890.12'],
    [-2550, '-₹25.50'],
    [46500.4, '₹465.00'],
    [46500.6, '₹465.01'],
  ])('%s gives %s', (minor, text) => expect(formatMoney(minor)).toBe(text));

  it('shows a dash for missing values', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney(NaN)).toBe('—');
  });
});

describe('formatters', () => {
  it('distance', () => {
    expect(formatDistanceKm(0.85)).toBe('850 m');
    expect(formatDistanceKm(1.24)).toBe('1.2 km');
    expect(formatDistanceKm(12)).toBe('12.0 km');
    expect(formatDistanceKm(null)).toBe('—');
  });

  it('duration', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(725)).toBe('12:05');
    expect(formatDuration(3729)).toBe('1:02:09');
    expect(formatDuration(-4)).toBe('0:00');
    expect(formatDuration(null)).toBe('—');
  });

  it('relative time', () => {
    const now = Date.parse('2026-01-01T12:00:00Z');
    expect(relativeTime('2026-01-01T11:59:58Z', now)).toBe('just now');
    expect(relativeTime('2026-01-01T11:59:18Z', now)).toBe('42s ago');
    expect(relativeTime('2026-01-01T11:57:00Z', now)).toBe('3m ago');
    expect(relativeTime('2026-01-01T10:00:00Z', now)).toBe('2h ago');
    expect(relativeTime('2025-12-28T12:00:00Z', now)).toBe('4d ago');
    expect(relativeTime('2026-01-01T13:00:00Z', now)).toBe('just now'); // clock skew never goes negative
    expect(relativeTime(null, now)).toBe('never');
    expect(relativeTime('garbage', now)).toBe('—');
  });
});

describe('journey', () => {
  it('maps every backend state onto a stepper position', () => {
    for (const state of REQUEST_STATES) {
      const j = journeyOf(state);
      expect(j.current).toBeGreaterThanOrEqual(-1);
      expect(j.current).toBeLessThan(JOURNEY_STEPS.length);
    }
    expect(journeyOf('CONFIRMED').current).toBe(1);
    expect(journeyOf('SETTLED').current).toBe(5);
    expect(journeyOf('REWORK')).toEqual({ current: 3, note: 'Rework requested' });
    expect(journeyOf('CANCELLED')).toEqual({ current: -1, note: 'Cancelled' });
  });
});

describe('css generation', () => {
  const css = generateCssVariables();

  it('emits a light :root block and a .dark block', () => {
    expect(css).toContain(':root {');
    expect(css).toContain('.dark {');
    expect(css).toContain('--color-primary: #1D4ED8;');
    expect(css).toContain('--color-primary: #60A5FA;');
    expect(css).toContain('--state-in-progress-bg: #FEF3C7;');
  });

  it('defines a variable for every colour token and every state in both themes', () => {
    const [light, dark] = css.split('.dark {') as [string, string];
    for (const k of SEMANTIC_COLORS) {
      const name = `--color-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:`;
      expect(light).toContain(name);
      expect(dark).toContain(name);
    }
    for (const s of REQUEST_STATES) {
      const name = `--state-${s.toLowerCase().replace(/_/g, '-')}-bg:`;
      expect(light).toContain(name);
      expect(dark).toContain(name);
    }
  });

  it('exposes Tailwind utilities and a class-based dark variant', () => {
    expect(tailwindThemeCss()).toContain('@custom-variant dark');
    expect(tailwindThemeCss()).toContain('--color-surface-muted: var(--color-surface-muted);');
    expect(tailwindPreset.darkMode).toBe('class');
    expect(tailwindPreset.theme.extend.colors['primary-soft']).toBe('var(--color-primary-soft)');
  });
});
