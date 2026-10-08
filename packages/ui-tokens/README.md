# @dispatch/ui-tokens

Single source of truth for the visual design of the admin console (Tailwind) and the mobile app (React Native).
Pure TypeScript, no runtime dependencies (types only from `@dispatch/contracts`).

## Tokens

| Export                       | Contents                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `colors.light` / `.dark`     | `bg surface surfaceMuted border borderStrong text textMuted textSubtle primary primaryHover primarySoft onPrimary success warning danger focus`            |
| `stateStyles`                | for every `RequestState`: `label`, `light {bg,text}`, `dark {bg,text}`; typed against the contract, so a new backend state is a compile error              |
| `stateStyle(state, theme)`   | same lookup for any string; unknown states fall back to neutral                                                                                            |
| `JOURNEY_STEPS`, `journeyOf` | the six-step stepper (Requested, Assigned, On site, In progress, Review, Done) and the position of each state (rework and cancelled are notes)             |
| `space`                      | 4pt scale: 4, 8, 12, 16, 20, 24, 32, 40, 48                                                                                                                |
| `radius`                     | `sm 8`, `md 12`, `lg 16`, `pill 999`                                                                                                                       |
| `type`                       | `display 28/34/700`, `title 22/28/600`, `heading 18/24/600`, `body 16/24/400`, `bodySm 14/20/400`, `label 14/20/500`, `caption 12/16/500`, `otp 36/44/600` |
| `shadow`, `motion`, `hit`    | popover shadow (CSS and RN), `fast 150ms` / `base 220ms`, touch target 44 (mobile) / 36 (admin)                                                            |
| `formatMoney`                | minor units to `₹465.00` with Indian grouping (`₹1,23,456.78`); no `Intl`, so Hermes and Node agree                                                        |
| `formatDistanceKm`           | `850 m`, `1.2 km`                                                                                                                                          |
| `formatDuration`             | `12:05`, `1:02:09`                                                                                                                                         |
| `relativeTime(date, now)`    | `just now`, `42s ago`, `3m ago`, `2h ago`, `4d ago`                                                                                                        |
| `contrastRatio(a, b)`        | WCAG 2.x ratio; the tests assert at least 4.5:1 for every state in both themes and for the key text pairs                                                  |

State names: the design plan's names map onto the backend machine (ADR 0006). CREATED is DRAFT, MATCHING is REQUESTED/MATCHED, ASSIGNED is CONFIRMED, REWORK_REQUESTED is REWORK, COMPLETED covers COMPLETED and SETTLED.
State is never conveyed by colour alone: every badge also carries its label.

## Admin (Tailwind v4)

`pnpm build` writes `css/tokens.css` (`:root` light variables, a `.dark` block, and an `@theme inline` block that creates the utilities `bg-surface`, `bg-surface-muted`, `border-line`, `text-ink`, `text-muted`, `bg-primary`, `text-on-primary`, `bg-primary-soft`, `text-danger`, ...).

```css
@import 'tailwindcss';
@import '../../../packages/ui-tokens/css/tokens.css';
```

Dark mode is class based: add `dark` to `<html>`. `tailwindPreset` is the same mapping as a v3-style preset for projects with a JS config.
State badges read `var(--state-<state>-bg)` / `var(--state-<state>-text)` (for example `--state-under-review-bg`).

## Mobile (React Native)

Import the objects and choose a palette from the system colour scheme:

```ts
import { colors, stateStyle, type, space, radius, formatMoney } from '@dispatch/ui-tokens';
const palette = colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
const { label, bg, text } = stateStyle(request.state, 'light');
```

No component should contain a hex colour; the app's `ThemeProvider` hands out the palette.
