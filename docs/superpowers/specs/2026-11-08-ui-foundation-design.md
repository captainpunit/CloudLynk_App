# CloudLynk UI redesign: foundation

Date: 2026-11-08 · Branch: `feature/ui-foundation` · Scope: `mobile/`

## Goal

Make the app look professional and feel smooth, following established UI/UX principles:
- clear hierarchy
- consistent spacing
- readable contrast (WCAG AA)
- immediate feedback on every touch
- motion that explains change and is never decorative
- respect for the phone's Reduce Motion setting

The redesign has three phases. This spec covers **phase 1, the foundation**. Phase 2 redesigns the screens, starting with Explore, Channel and Watch. Phase 3 is list virtualisation and image sizing.

## Decisions

| Topic | Decision |
| --- | --- |
| Direction | **Hybrid.** Light, clean screens for browsing and managing; dark "cinema" surfaces for heroes, channel headers and the player. The teal brand `#146C60` and gold Plus stay. |
| Typography | **Plus Jakarta Sans** (600, 700, 800) for display, titles, headings, buttons and overlines. The system font for body, callout and caption. Loaded with `expo-font` through `@expo-google-fonts/plus-jakarta-sans`; the system font is the fallback. |
| Approach | **Upgrade in place.** Existing component names and props keep working, and every screen picks up the new look. New props are additive (`variant`, `tone`, `size`, `level`). |
| Motion | Quick and subtle. Press: spring to 0.97 scale. Fades: 120, 200 and 280 ms on one ease-out curve. Skeleton pulse instead of spinners. All built on Reanimated 4, which is already installed. With Reduce Motion on, motion becomes an instant change. |
| Haptics | `expo-haptics`. A light impact on primary actions; selection feedback on tabs, pills and toggles. Nothing on web, and failures are ignored. |
| No new UI framework | No Tamagui, NativeWind or gluestack. Inline styles plus tokens remain the styling approach. |

## Tokens (`src/theme/tokens.ts`)

**Colours.** The existing keys keep their meaning, with refined values. `muted` darkens from `#718080` (3.9:1 on canvas) to `#5F6E6E` (about 5:1) to pass AA. New keys:
- `primaryPressed`
- `success` / `successSoft`, `warning` / `warningSoft`
- `disabledSurface` / `disabledInk`
- `cinemaCanvas` `#0B1514`, `cinemaSurface` `#13201F`, `cinemaLine`, `onCinema`, `onCinemaMuted` `#A9BDB7`
- `focusRing`

Every colour lives in tokens and none are inlined.

**Spacing.** A 4-point grid: `space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, section: 40, huge: 56 }`. Layout constants: `layout = { gutter: 20, sectionGap: 32, blockGap: 24, cardPadding: 16, maxWidth: 720 }`.

**Radius.** `{ xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 }`. Used as follows:
- 6: badges
- 10: chips and thumbnails
- 14: buttons and inputs
- 20: cards
- 28: heroes

**Elevation.** Two levels, defined as `boxShadow` (works on the new architecture and on web):
- `card`: soft shadow plus a hairline border.
- `floating`: for the toast and sheets.

**Type presets.** Each is a `TextStyle`:

| Preset | Size / line height | Font |
| --- | --- | --- |
| display | 32/38 | Jakarta ExtraBold, tracking −0.6 |
| title | 24/30 | Jakarta Bold, −0.4 |
| headline | 19/26 | Jakarta Bold, −0.2 |
| subhead | 16/22 | Jakarta SemiBold |
| button | 15/20 | Jakarta Bold |
| body | 15/22 | system |
| callout | 14/20 | system |
| caption | 12/16 | system, weight 500 |
| overline | 11/14 | Jakarta Bold, upper case, tracking 0.8 |

Nothing is smaller than 11 pt. Jakarta presets never set `fontWeight`, because the family name carries the weight and Android ignores mixes.

**Motion.** `motion = { fast: 120, base: 200, slow: 280, pressScale: 0.97 }`. The spring and easing live in the motion kit.

## Components

**Motion kit** (`src/components/ui/motion.tsx`):
- `PressableScale`: an animated `Pressable` with spring scale, optional haptic, and accessibility props passed through.
- `FadeIn`: an entering animation, with an optional index stagger capped at 6 items.
- `Skeleton`: a pulsing block.

All three read `useReducedMotion()`.

**Haptics** (`src/lib/haptics.ts`): `tapHaptic()` and `selectHaptic()`, both no-ops on web and both failure-safe.

**Upgraded primitives:**

| Component | Changes |
| --- | --- |
| `Label` | `variant` (type preset) and `tone` (`default`, `muted`, `primary`, `danger`, `success`, `onCinema`, `onCinemaMuted`, `inverse`) |
| `Heading` | `level` (`display`, `title`, `headline`, `subhead`); keeps the header role |
| `Button` | Press scale and haptics; `size` (`md` 52, `sm` 40) and a `ghost` variant; real disabled colours |
| `IconButton` | 44 px target, press scale, `dark` variant on cinema surfaces |
| `Pill` | Animated selection colour, selection haptic, 40 px with hitSlop to 44 |
| `Surface` | `variant` (`card` with shadow, `flat`, `cinema`) |
| `Field`, `SearchField` | Focus state (primary border and soft ring), caption label, `helper` text |
| `Section` | Headline style; ghost action link with a chevron |
| `Screen` | Title preset, 20 gutter. No whole-screen fade: the native slide already animates the change, and a second fade only adds delay. |
| `EmptyState`, `ErrorNote` | Refined layout; `ErrorNote` gets an icon and fades in |
| `PlusBadge` | Overline style |

**New primitive:** `StatusBadge` with tones `neutral`, `primary`, `success`, `warning` and `danger`. It replaces ad-hoc "pending · draft" text.

**App chrome:**
- **Toast:** animated slide-up and fade, on the floating elevation.
- **Tab bar:** sized from the safe-area insets (today it's a fixed 78), Jakarta labels, active icon scale animation, and a selection haptic on tab press.
- **Root loading:** a brand mark with a gentle pulse while the workspace and fonts load.
- **Media cards:** press scale, overline badges, radius tokens, and `VideoCardSkeleton` / `ChannelCardSkeleton`.

## Error handling

- If fonts fail to load, the system font renders and the app continues; loading is gated by `fontsLoaded || fontError`.
- Haptics and animations never throw into the UI.

## Testing and verification

**Checks to run:** `npm run typecheck`, `npm test` (domain tests unchanged), Prettier, and `npx expo export --platform web` to prove the bundle builds with Reanimated and the fonts.

**Visual check:** run on web and screenshot Explore, a channel and the upload form at phone width.

**Contrast check:** recompute contrast for the changed text colours. Done: every token text pair passes AA. Muted text moved from 3.87 to 4.95:1 on canvas, and the status badges measure 4.65 to 5.37:1.

**Release:** a release APK after phase 2.

## Out of scope for phase 1

- Screen layout redesigns (phase 2)
- `FlatList` virtualisation (phase 3)
- Dark mode for the whole app
- Shared-element transitions
