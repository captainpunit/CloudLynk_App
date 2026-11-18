# CloudLynk mobile: design system rules

Rules for building UI in this Expo app, including from Figma designs via the Figma MCP server.
Figma output is a **reference**. It is usually React with Tailwind or web CSS. Rebuild it with the
React Native primitives, tokens and components below, and never paste it in as is.

The look comes from the viewer redesign in `docs/design/2026-11-06-ui-ux-redesign-plan.md`.
The toolkit (motion kit, haptics, type presets, focus rings) comes from
`docs/superpowers/specs/2026-11-08-ui-foundation-design.md`. That spec's teal colours were not
adopted.

## Stack at a glance

| Concern | What this app uses |
| --- | --- |
| UI framework | React 19.3 + React Native 0.88 (New Architecture, Hermes) on **Expo SDK 58** |
| Routing | `expo-router` 58, file-based in `app/`, typed routes |
| Language | TypeScript (strict), path alias `@/*` → `src/*` |
| Styling | **Inline style objects + tokens.** No `StyleSheet.create`, NativeWind/Tailwind or styled-components |
| Colour | Tone-aware palette from `usePalette()` (`src/theme/tone.tsx`) |
| Motion | `react-native-reanimated` 4 through the motion kit (`src/components/ui/motion.tsx`) |
| Fonts | Plus Jakarta Sans 600/700/800 (headings, buttons, tab labels) + the system font (reading text), loaded in `app/_layout.tsx` |
| Haptics | `expo-haptics` through `src/lib/haptics.ts` |
| Web | `react-native-web`, `web.output: 'single'` |
| Platforms | Android-first (min SDK 24), portrait, dark viewer screens and light management screens |
| Formatting | Prettier: single quotes, trailing commas, width 100 |

There is no Storybook. `src/components/ui/index.ts` is the component catalogue.

## Direction: night for watching, light for managing

- **Dark (`night`)** for watching: Watch (Explore), Channels, a channel, the player, Library and You.
  These screens pass `tone="dark"` to `Screen`. The tab bar and the launch screen are always dark.
- **Light (`colors`)** for forms and managing: sign-in, Plus, upload, admin, My cloud, settings.
- The brand is near-black (`colors.primary` `#1F2433`, and `night.ink` as the button fill on dark).
- **Marigold (`plus`) is reserved for Plus.** Nothing else uses it.

Every screen follows the same UX principles:
- clear hierarchy, with one primary action per view
- a 4-point spacing rhythm
- AA contrast
- immediate press feedback
- motion that explains a change and is never decoration
- touch targets of at least 44 px
- respect for the phone's Reduce Motion setting

## 1. Colour and tone

`Screen` wraps its content in a `ToneProvider`. Components read colours with `usePalette()`, so the
same component renders correctly on light and dark screens:

```tsx
const p = usePalette();
<View style={{ backgroundColor: p.surface, borderColor: p.line }} />
```

| Palette key | Role |
| --- | --- |
| `canvas` / `surface` / `raised` | Page background / cards and inputs / soft fills (soft button, neutral badge, image placeholder) |
| `ink` / `muted` / `line` | Primary text / secondary text / hairline borders |
| `action` / `onAction` | Primary button fill and its text |
| `focusRing` | Input focus ring |
| `danger`, `success`, `warning` (+ `…Soft`) | Errors and states (`StatusBadge`, `ErrorNote`) |
| `disabledSurface` / `disabledInk` | Disabled controls (never use opacity tricks) |
| `skeleton` | Loading placeholders |
| `plusInk` / `plusSoft` | Plus text and tint on this tone |

Use the static tokens in `src/theme/tokens.ts` only where a surface is always one tone:
`night` (tab bar, launch screen, toast), `plus` (the Plus badge and button), and `colors` for
overlays on imagery (`scrim*`, `glass*`, `white`).

**Rules**
- **Never write a hex value outside `tokens.ts`.** If you need a new colour, add a named token,
  give it a value for both tones, and expose it in `Palette`.
- Translucent colours are 8-digit hex (`#RRGGBBAA`), never `rgba()`.
- Check WCAG AA (4.5:1 for text) on **both** tones whenever you add a pair.

## 2. Spacing, radius and motion tokens

```ts
import { layout, motion, radius, space } from '@/theme/tokens';
```

| Export | Contents |
| --- | --- |
| `space` | `xxs 2, xs 4, sm 8, md 12, lg 16, xl 20, xxl 24, xxxl 32, section 40, huge 56` |
| `layout` | `gutter 20, blockGap 24, cardPadding 18, maxWidth 720, touchTarget 44` (`gutter` is also exported on its own) |
| `radius` | `xs 5` (badges), `sm 10` (posters, small controls), `md 14` (inputs, notes), `lg 20` (cards), `xl 28` (heroes), `pill 999` (buttons, pills, search) |
| `motion` | `fast 120`, `base 200`, `slow 280` ms, `pressScale 0.97` |

Prefer these over literal numbers in new code. Literal values are fine for one-off geometry, such
as an icon box size.

## 3. Typography

| Preset | Size / line height | Font | Use for |
| --- | --- | --- | --- |
| `display` | 32/38 | Jakarta ExtraBold | Hero titles |
| `title` | 26/34 | Jakarta Bold | Screen titles (the `Heading` default) |
| `headline` | 20/27 | Jakarta Bold | Section headers, empty states |
| `subhead` | 16/22 | Jakarta SemiBold | Card titles |
| `button` | 15/20 | Jakarta Bold | Buttons |
| `body` | 15/23 | System | Paragraphs, inputs (the `Label` default) |
| `callout` | 14/20 | System | Secondary information, notes |
| `caption` | 13/19 | System | Meta information (the `Caption` default, muted) |
| `overline` | 11/14 | Jakarta Bold, caps | Badges, eyebrow labels |

```tsx
<Heading level="headline">Continue watching</Heading>
<Caption>2 days ago</Caption>
<Label variant="callout" tone="danger">Upload failed</Label>
```

- All text goes through `Label` (`variant`, `tone`), `Caption` or `Heading` (`level`, `tone`).
  Never use a raw `<Text>`.
- Tones follow the current palette: `default`, `muted`, `danger`, `success`, `warning`, `plus`.
- **Never set `fontWeight` on a Jakarta preset.** The family name already carries the weight, and
  Android falls back to the system font when both are set. To change weight, switch preset.
  `fontWeight` is fine on the system presets (`body`, `callout`, `caption`).
- Nothing smaller than 11 pt. Use `numberOfLines` for truncation.

## 4. Components (`src/components/ui`)

| Component | Key props | Notes |
| --- | --- | --- |
| `Screen` | `title`, `subtitle`, `back`, `action`, `scroll`, `tone`, `refreshing`, `onRefresh` | Safe area, 20 gutter, 720 max width, tone for everything inside, light status bar on dark |
| `Surface` | `style` | Card with a hairline border in the current tone |
| `Section` | `title`, `action`, `onPress` | Headline plus a "See all ›" link |
| `Rail` | `gap` | Horizontal row that runs to the screen edges |
| `ListRow` | `icon`, `title`, `detail`, `onPress`, `marker` | Navigation row with a chevron |
| `Button` | `variant: primary \| soft \| outline \| danger \| plus`, `compact`, `loading`, `disabled`, `icon`, `label` | Pill shape; press scale; tap haptic on primary, danger and plus; real disabled colours |
| `IconButton` | `icon`, `label`, `dark` | 46 px round; `dark` is glass for buttons over images |
| `Pill` | `title`, `selected`, `label` | Fill fades on selection, selection haptic |
| `Field` | TextInput props + `label`, `error`, `helper` | Focus ring, error state |
| `SearchField` | `value`, `onChangeText`, `placeholder` | Focus ring, clear button |
| `EmptyState` | `icon`, `title`, `body`, `action`, `onPress` | Fades in |
| `ErrorNote` | `message` | Icon, alert role, fades in and out |
| `StatusBadge` | `label`, `tone: neutral \| success \| warning \| danger` | Use for published, pending, processing and similar states, instead of plain text |
| `PlusBadge` | | The one Plus marker, marigold on every tone |
| `Divider` | | Hairline |
| `PressableScale` | Pressable props + `haptic: 'tap' \| 'select'`, `scaleTo` | Use for every custom tappable surface. Cards use the default; full-width rows use `scaleTo={0.98}` |
| `FadeIn` | `index`, `style` | Entering animation; `index` staggers list items (capped at 6) |
| `Skeleton` | `width`, `height`, `rounded`, `style` | Pulsing placeholder in the current tone; size it with `aspectRatio` through `style` if needed |

Domain composites live in `src/components/`:
- `VideoCard`, `VideoRow`, `ChannelCard` and `ChannelRow` (`media-card.tsx`)
- `PlusOffer`, `CoverImageField` and `LegalLinks`

**Conventions**
- Function components with named exports and inline-typed props. Screens are default exports in
  `src/features/<area>/<name>-screen.tsx`.
- Every tappable element needs:
  - `accessibilityRole` and `accessibilityLabel`
  - `accessibilityState` for selected, disabled or busy
  - a target of at least 44 px
- Show loading with `Skeleton` shapes that match the final layout, not spinners. Spinners are only
  for inside buttons and the launch screen.
- Show errors with `ErrorNote` close to the action that failed, and confirm success with
  `notify()` (the toast).

**Mapping Figma components:** button → `Button` (variant by fill); chip or segmented toggle →
`Pill`; card → `Surface`; input → `Field`; search → `SearchField`; round icon action →
`IconButton`; screen header → `Screen`; empty state → `EmptyState`; error banner → `ErrorNote`;
status tag → `StatusBadge`; video or channel tile → `VideoCard` / `ChannelCard`. Extend a
component with a new variant before creating a lookalike.

## 5. Motion and haptics

- Use only the motion kit and the `motion` durations: press scale 0.97 on a spring, entering
  280 ms on the shared ease-out curve (`easeOut`), state changes 120–200 ms.
- Reanimated follows Reduce Motion by default (`ReduceMotion.System`). Don't override that.
- Animate `transform` and `opacity` only. Don't animate width, height or layout properties.
- Haptics: `tapHaptic()` for primary or destructive confirmations and `selectHaptic()` for
  selection changes (tabs, pills). Never on scroll or on every tap.
- Don't animate whole screens: the native stack slide already handles navigation.

## 6. Styling and layout

- Use inline style objects and arrays (`[base, conditional && extra, style]`). There are no global
  styles beyond the root `Stack` `contentStyle`.
- Layout uses flexbox with `gap`. Overlays use `position: 'absolute', inset: 0`.
  - On web, a positioned element paints over an unpositioned SVG. Wrap icons in a `View` when you
    layer them over an absolute background.
- Layouts are single-column and mobile-first. Content is centred and capped with
  `width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center'`.
- Size media with `aspectRatio` (16:9 for video and covers). Grids use `flexWrap` with
  `flex: 1, minWidth: 0` children.
- Platform differences go through `Platform.OS`. Inputs hide the browser outline
  (`outlineStyle: 'solid', outlineWidth: 0`) because the focus ring replaces it.
- Respect safe areas through `react-native-safe-area-context`. The tab bar height includes the
  bottom inset.

## 7. Icons and assets

- **Only `lucide-react-native`**, with named PascalCase imports. Don't export SVGs from Figma.
- Icon sizes:

  | Size | Where |
  | --- | --- |
  | 24 | Tab bar (stroke 2.2 when active, 1.7 otherwise) |
  | 20 | `IconButton` (stroke 1.8) |
  | 18 | `Button` (16 when `compact`), `ErrorNote` |
  | 26 | `EmptyState` |
  | 14–16 | Inline icons |

  Always colour icons from the palette or tokens.
- `assets/` holds only the app icon and splash mark. The app bundles no catalogue artwork.
- Covers live in the public Supabase `covers` bucket (JPEG, PNG or WebP, 5 MB maximum, added with
  `CoverImageField`). Render them with `expo-image` (`contentFit="cover"`, `transition`,
  `recyclingKey`) on a `p.raised` placeholder background.
- Video is Cloudflare Stream HLS with signed URLs, played by `expo-video`.
- Import fonts **per weight** (`@expo-google-fonts/plus-jakarta-sans/700Bold`). The package root
  bundles all 16 files.

## 8. Project structure

```
mobile/
  app/                      expo-router routes: thin re-export files
    _layout.tsx             fonts, providers, Stack, launch screen, toast, ErrorBoundary
    (tabs)/_layout.tsx      tab bar: Watch, Channels, add button, Cloud, You
  src/
    components/ui/          primitives + motion kit (barrel index.ts)
    components/             media cards, Plus offer, cover field, legal links
    features/<area>/        screens (*-screen.tsx, default export)
    theme/tokens.ts         design tokens
    theme/tone.tsx          ToneProvider and usePalette()
    domain/                 pure models and rules (node:test)
    data/live/              Supabase and edge-function adapters
    services/               uploads, billing, push, attribution
    state/                  WorkspaceProvider: useWorkspace()
    lib/                    supabase, env, navigation, haptics
```

To add a screen:
1. Create `src/features/<area>/<name>-screen.tsx` wrapped in `<Screen>` (with `tone="dark"` for a
   watching screen).
2. Add `app/<route>.tsx` containing `export { default } from '@/features/…';`.
3. Read data from `useWorkspace()`.

## 9. Checklist (Figma or any UI change)

1. Reuse primitives first, then add variants, then new components.
2. Use the palette and tokens for colour, spacing, radius and type. Use `Label`, `Caption` and
   `Heading` for text.
3. Use the motion kit for feedback and entrances, skeletons for loading, `ErrorNote` and the toast
   for outcomes.
4. Check accessibility on both tones: roles, labels, 44 px targets, AA contrast.
5. Run the checks:
   - `npm run typecheck`
   - `npm test`
   - `npx prettier --check --end-of-line auto app src plugins app.config.ts`. Use
     `--end-of-line auto` on Windows because of CRLF checkouts.
6. Look at the result on web at 390 px wide and at a wide window, and on Android. When you start a
   test server, **don't set `CI=1`**: it turns off file watching and serves stale bundles.
