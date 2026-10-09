import { useColorScheme } from 'react-native';
import { colors, type Palette, type ThemeName } from '@dispatch/ui-tokens';

/**
 * Theme: colours come from @dispatch/ui-tokens (same values as the admin console) and follow the system light/dark
 * setting. Sizes are static. No component should contain a hex colour; read `useTheme().c` instead.
 */
export const theme = {
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 8, md: 12, pill: 999 },
  /** Minimum touch target (Apple HIG / Material): 44pt. */
  touch: 44,
  font: { caption: 12, small: 14, body: 16, heading: 18, title: 22, display: 28, otp: 36 },
} as const;

export interface ThemeValue {
  scheme: ThemeName;
  c: Palette;
}

export function useTheme(): ThemeValue {
  const scheme: ThemeName = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, c: colors[scheme] };
}

/**
 * Inter ships one file per weight. React Native on Android ignores `fontWeight` for custom families, so components
 * choose the family by weight instead (see `fontFor`). The files are loaded once in App.tsx.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const fontFor = (weight: '400' | '500' | '600' | '700' = '400'): string =>
  ({ '400': fonts.regular, '500': fonts.medium, '600': fonts.semibold, '700': fonts.bold })[weight];
