# CloudLynk mobile: design system rules

Rules for building UI in this Expo app, including from Figma designs via the Figma MCP server.
Figma output is a **reference**. It is usually React with Tailwind or web CSS. Rebuild it with the
React Native primitives, tokens and components below, and never paste it in as is.
The design decisions behind these rules are in `docs/superpowers/specs/2026-11-08-ui-foundation-design.md`.

## Stack at a glance

| Concern | What this app uses |
| --- | --- |
| UI framework | React 19.3 + React Native 0.88 (New Architecture, Hermes) on **Expo SDK 58** |
| Routing | `expo-router` 58, file-based in `app/`, typed routes |
| Language | TypeScript (strict), path alias `@/*` → `src/*` |
| Styling | **Inline style objects + tokens.** No `StyleSheet.create`, NativeWind/Tailwind or styled-components |
| Motion | `react-native-reanimated` 4 through the motion kit (`src/components/ui/motion.tsx`) |
| Fonts | Plus Jakarta Sans 600/700/800 (display text) + the system font (reading text), loaded in `app/_layout.tsx` |
| Haptics | `expo-haptics` through `src/lib/haptics.ts` |
| Web | `react-native-web`, `web.output: 'single'` |
| Platforms | Android-first (min SDK 24), portrait, **light theme with dark "cinema" surfaces** |
| Formatting | Prettier: single quotes, trailing commas, width 100 |

There is no Storybook. `src/components/ui/index.ts` is the component catalogue.

## Direction: hybrid

The app has two kinds of surface:
- **Light** for browsing and managing: lists, forms, upload, admin, cloud, settings.
- **Dark cinema** for imagery-led moments: heroes, channel headers, the player.

The brand is teal `#146C60` with gold for Plus. Every screen follows the same UX principles:
- clear hierarchy, with one primary action per view
- a 4-point spacing rhythm
- AA contrast
- immediate press feedback
- motion that explains a change and is never decoration
- touch targets of at least 44 px
- respect for the phone's Reduce Motion setting

## 1. Tokens (`src/theme/tokens.ts`)

```ts
import { colors as c, elevation, layout, motion, radius, space, text } from '@/theme/tokens';
```

| Export | Contents |
| --- | --- |
| `colors` | Semantic colours: light surfaces, text, brand, states, cinema, overlays (table below) |
| `space` | `xxs 2, xs 4, sm 8, md 12, lg 16, xl 20, xxl 24, xxxl 32, section 40, huge 56` |
| `layout` | `gutter 20, sectionGap 32, blockGap 24, cardPadding 16, maxWidth 720, touchTarget 44` |
| `radius` | `xs 6` (badges), `sm 10` (chips, small controls), `md 14` (buttons, inputs, media), `lg 20` (cards), `xl 28` (heroes), `pill 999` |
| `elevation` | `card` (resting) and `floating` (toast, sheets), as `boxShadow` |
| `fonts` / `text` | Type presets (table in §2) |
| `motion` | `fast 120`, `base 200`, `slow 280` ms, `pressScale 0.97` |

**Rules**
- **Never write a hex value outside `tokens.ts`.** If you need a new colour, add a semantically named token.
- Use `space`, `layout` and `radius` instead of literal numbers. Literal values are fine only for one-off geometry, such as an icon box size.
- Translucent colours are 8-digit hex (`#RRGGBBAA`), never `rgba()`.

| Colour token | Role |
| --- | --- |
| `canvas` / `surface` / `surfaceSunken` | Page background / cards, inputs / recessed fills (neutral badges, clear button) |
| `ink` / `muted` | Primary text / secondary text. `muted` is 4.95:1 on canvas |
| `line` | Hairline borders |
| `primary` / `primaryPressed` / `primarySoft` / `focusRing` | Brand actions, links, active tab / pressed / soft fills and selected states / input focus ring |
| `success`, `warning`, `danger` (+ `…Soft`) | States: published or ready, pending, error or destructive |
| `goldSoft` / `goldInk` / `accent` | Plus |
| `disabledSurface` / `disabledInk` | Disabled controls (never use opacity tricks) |
| `skeleton` / `cinemaSkeleton` | Loading placeholders |
| `cinemaCanvas`, `cinemaSurface`, `cinemaLine`, `onCinema`, `onCinemaMuted` | Dark cinema surfaces and the text on them |
| `scrim*`, `glass*` | Overlays on imagery |
| `dark`, `player`, `onDarkMuted` | Older names kept for existing screens. Prefer the `cinema*` tokens |

All token text pairs pass WCAG AA. Re-check contrast whenever you add one.

## 2. Typography

| Preset | Size / line height | Font | Use for |
| --- | --- | --- | --- |
| `display` | 32/38 | Jakarta ExtraBold | Hero titles |
| `title` | 24/30 | Jakarta Bold | Screen titles (the `Heading` default) |
| `headline` | 19/26 | Jakarta Bold | Section headers |
| `subhead` | 16/22 | Jakarta SemiBold | Card titles |
| `button` | 15/20 | Jakarta Bold | Buttons |
| `body` | 15/22 | System | Paragraphs, inputs (the `Label` default) |
| `callout` | 14/20 | System | Secondary information, field labels (weight 600) |
| `caption` | 12/16 | System, weight 500 | Meta information, helper text |
| `overline` | 11/14 | Jakarta Bold, caps | Badges, eyebrow labels |

```tsx
<Heading level="headline">Continue watching</Heading>
<Label variant="caption" tone="muted">2 days ago</Label>
<Label variant="overline" tone="primary">Latest</Label>
```

- All text goes through `Label` (`variant`, `tone`) or `Heading` (`level`, `tone`). Never use a raw `<Text>`.
- Tones: `default`, `muted`, `primary`, `danger`, `success`, `inverse`, `onCinema`, `onCinemaMuted`.
- **Never set `fontWeight` on a Jakarta preset.** The family name already carries the weight, and Android falls back to the system font when both are set. To change weight, switch preset. `fontWeight` is fine on the system presets (`body`, `callout`, `caption`).
- Nothing smaller than 11 pt. Use `numberOfLines` for truncation.

## 3. Components (`src/components/ui`)

| Component | Key props | Notes |
| --- | --- | --- |
| `Screen` | `title`, `subtitle`, `back`, `action`, `scroll` | Safe area, 20 gutter, 720 max width, `blockGap` between children |
| `Surface` | `variant: 'card' \| 'flat' \| 'cinema'` | Card has a shadow; flat has a border only; cinema is the dark panel |
| `Section` | `title`, `action`, `onPress` | Headline plus a "See all ›" link |
| `Button` | `variant: primary \| soft \| outline \| danger \| ghost`, `size: md \| sm`, `loading`, `disabled`, `icon` | Press scale; tap haptic on primary and danger; real disabled colours |
| `IconButton` | `icon`, `label`, `dark` | 44 px round; `dark` sits on cinema surfaces and imagery |
| `Pill` | `title`, `selected` | Animated selection fill, selection haptic |
| `Field` | TextInput props + `label`, `error`, `helper` | Focus ring, error state |
| `SearchField` | `value`, `onChangeText`, `placeholder` | Focus ring, clear button |
| `EmptyState` | `icon`, `title`, `body`, `action`, `onPress` | Fades in |
| `ErrorNote` | `message` | Icon, alert role, fades in and out |
| `StatusBadge` | `label`, `tone: neutral \| primary \| success \| warning \| danger` | Use for published, pending, processing and similar states, instead of plain text |
| `PlusBadge` | | Premium marker |
| `Divider` | | Hairline |
| `PressableScale` | Pressable props + `haptic: 'tap' \| 'select'`, `scaleTo` | Use for every custom tappable surface (cards, tiles, rows) |
| `FadeIn` | `index`, `style` | Entering animation; `index` staggers list items (capped at 6) |
| `Skeleton` | `width`, `height`, `rounded`, `onCinema`, `style` | Pulsing placeholder; size it with `aspectRatio` through `style` if needed |

Domain composites live in `src/components/`:
- `VideoCard` and `VideoCardSkeleton`
- `ChannelCard` and `ChannelCardSkeleton`
- `CoverImageField`

**Conventions**
- Function components with named exports and inline-typed props. Screens are default exports in `src/features/<area>/<name>-screen.tsx`.
- Every tappable element needs:
  - `accessibilityRole` and `accessibilityLabel`
  - `accessibilityState` for selected, disabled or busy
  - a target of at least 44 px
- Show loading with `Skeleton` shapes that match the final layout, not spinners. Spinners are only for inside buttons.
- Show errors with `ErrorNote` close to the action that failed, and confirm success with `notify()` (the toast).

**Mapping Figma components:** button → `Button` (variant by fill); chip or segmented toggle → `Pill`; card → `Surface`; input → `Field`; search → `SearchField`; round icon action → `IconButton`; screen header → `Screen`; empty state → `EmptyState`; error banner → `ErrorNote`; status tag → `StatusBadge`; video or channel tile → `VideoCard` / `ChannelCard`. Extend a component with a new variant before creating a lookalike.

## 4. Motion and haptics

- Use only the motion kit and the `motion` durations: press scale 0.97 on a spring, entering 280 ms on the shared ease-out curve (`easeOut`), state changes 120–200 ms.
- Reanimated follows Reduce Motion by default (`ReduceMotion.System`). Don't override that.
- Animate `transform` and `opacity` only. Don't animate width, height or layout properties.
- Haptics: `tapHaptic()` for primary or destructive confirmations and `selectHaptic()` for selection changes. Never on scroll or on every tap.
- Don't animate whole screens: the native stack slide already handles navigation.

## 5. Styling and layout

- Use inline style objects and arrays (`[base, conditional && extra, style]`). There are no global styles beyond the root `Stack` `contentStyle`.
- Layout uses flexbox with `gap`. Overlays use `position: 'absolute', inset: 0`.
  - On web, a positioned element paints over an unpositioned SVG. Wrap icons in a `View` when you layer them over an absolute background.
- Layouts are single-column and mobile-first. Content is centred and capped with `width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center'`.
- Size media with `aspectRatio` (16:9 for video and covers). Grids use `flexWrap` with `flex: 1, minWidth: 0` children.
- Platform differences go through `Platform.OS`. Inputs hide the browser outline (`outlineStyle: 'solid', outlineWidth: 0`) because the focus ring replaces it.
- Respect safe areas through `react-native-safe-area-context`. The tab bar height includes the bottom inset.

## 6. Icons and assets

- **Only `lucide-react-native`**, with named PascalCase imports. Don't export SVGs from Figma.
- Icon sizes:

  | Size | Where |
  | --- | --- |
  | 20 | Tab bar and `IconButton` (stroke 1.8) |
  | 18 | `Button` (16 for `sm`) |
  | 28 | `EmptyState` |
  | 14–16 | Inline icons |
  | 11 | Badges |

  Always colour icons with tokens.
- `assets/` holds only the app icon. The app bundles no catalogue artwork.
- Covers live in the public Supabase `covers` bucket (JPEG, PNG or WebP, 5 MB maximum, added with `CoverImageField`). Render them with `expo-image` (`contentFit="cover"`, `transition={200}`, `recyclingKey`) on a tinted placeholder background.
- Video is Cloudflare Stream HLS with signed URLs, played by `expo-video`.
- Import fonts **per weight** (`@expo-google-fonts/plus-jakarta-sans/700Bold`). The package root bundles all 16 files.

## 7. Project structure

```
mobile/
  app/                      expo-router routes: thin re-export files
    _layout.tsx             fonts, providers, Stack, opening state, toast, ErrorBoundary
    (tabs)/_layout.tsx      tab bar (animated indicator, selection haptic)
  src/
    components/ui/          primitives + motion kit (barrel index.ts)
    components/             media cards, cover field
    features/<area>/        screens (*-screen.tsx, default export)
    theme/tokens.ts         design tokens
    domain/                 pure models and rules (node:test)
    data/live/              Supabase and edge-function adapters
    services/               uploads, billing, push, attribution
    state/                  WorkspaceProvider: useWorkspace()
    lib/                    supabase, env, navigation, haptics
```

To add a screen:
1. Create `src/features/<area>/<name>-screen.tsx` wrapped in `<Screen>`.
2. Add `app/<route>.tsx` containing `export { default } from '@/features/…';`.
3. Read data from `useWorkspace()`.

## 8. Checklist (Figma or any UI change)

1. Reuse primitives first, then add variants, then new components.
2. Use tokens for colour, spacing, radius, type and elevation. Use `Label` and `Heading` presets for text.
3. Use the motion kit for feedback and entrances, skeletons for loading, `ErrorNote` and the toast for outcomes.
4. Check accessibility: roles, labels, 44 px targets, AA contrast.
5. Run the checks:
   - `npm run typecheck`
   - `npm test`
   - `npx prettier --check --end-of-line auto app src plugins app.config.ts`. Use `--end-of-line auto` on Windows because of CRLF checkouts.
6. Look at the result on web at 390 px wide and at a wide window, and on Android. When you start a test server, **don't set `CI=1`**: it turns off file watching and serves stale bundles.
