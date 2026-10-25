# CloudLynk mobile

An Android-first Expo SDK 57 / React Native / strict TypeScript frontend.

## Commands

```sh
npm ci                  # reproducible dependencies
npm start               # Metro development server
npm run web             # browser preview
npx expo start --go --android
npm run typecheck
npm test
npm run format:check
npm run build:web
npm run doctor
```

On Windows, if the emulator cannot connect because `localhost` resolves to IPv6:

```sh
node --dns-result-order=ipv4first node_modules/expo/bin/cli start --go --android --localhost
```

## Read the code in this order

1. `src/domain/models.ts` — the app's vocabulary: channel, video, file, profile and plan.
2. `src/domain/access.ts` — the preview access rules and user-facing denial messages.
3. `src/data/demo/seed.ts` — illustrative content. No real users or purchases.
4. `src/state/workspace-reducer.ts` — pure, testable state transitions.
5. `src/state/workspace-provider.tsx` — hydration, ordered persistence and live refresh.
6. `src/features/<feature>/` — one screen responsibility per file.
7. `src/data/live/cloud-api.ts` — implemented Supabase contract calls.
8. `app/` — route-only entry points and navigation layouts.

```text
app/                        Expo Router entry points
  (tabs)/                   Explore, feed, channels, cloud, profile
  channel/[id].tsx          Channel detail route
  watch/[id].tsx            Access-checked player route
  file/[id].tsx             File detail route
src/
  components/
    ui/                     Typography, actions, forms, feedback, layout
    media-card.tsx          Shared video/channel cards
  data/
    demo/                   Sample catalogue
    live/                   Server adapters
  domain/                   Models, access policy, validation, formatting
  features/
    auth/ channels/ drive/ explore/ feed/
    moderation/ player/ premium/ profile/ upload/
  state/                    Workspace provider, reducer and tests
  theme/                    Shared design tokens
  lib/                      Environment, Supabase and generated database types
  services/                 Existing billing/attribution/Meta integration scaffolds
assets/video/               Bundled preview playback clip
```

## Preview mode (default)

No environment file is required. State is saved under `cloudlynk.demo-workspace.v1`.
Android copies selected files to its app document directory. Browser file references are session-local;
use Android for durable file-copy tests. Removing a library entry leaves the original device file unchanged.
Resetting the workspace clears metadata; orphaned preview copies can be removed by clearing the app's storage.

Creator channels start **private and pending**. To review them, open You → Settings → Use admin preview,
then return to You → Admin review workspace. This is explicitly a local role simulation.
An admin does not automatically receive premium viewing access.

## Live mode

Copy `.env.example` to `.env`, provide the newer project's public Supabase URL/anon key, and set:

```dotenv
EXPO_PUBLIC_DATA_MODE=live
```

The existing PR1 contract supports catalogue reads, email authentication, profile name edits, membership RPCs,
and server access checks. Empty live catalogues stay empty; sample videos are never substituted for live data.

The remaining storage, creator, plans, receipts, playback and moderation endpoints must be implemented before release.
Those actions show a clear unavailable state and never silently fall back to simulated access.
Do not use an older CloudLynk database without a separate contract adapter.

`EXPO_PUBLIC_NATIVE_INTEGRATIONS=true` enables the existing Meta/Play config plugins for a configured native build.
It does not implement billing or grant an entitlement. No advertising SDK starts automatically.
Never put service-role keys, signing credentials or Cloudflare secrets in an `EXPO_PUBLIC_` value.

## Build an Android package

```sh
npx expo prebuild --platform android
npx expo run:android
```

EAS profiles in `eas.json` remain available for preview APKs and production AABs.
Production signing, Play Console configuration and publication require the owner's accounts.

On Windows, install **CMake 3.31.6** from Android Studio's SDK Tools (Show Package Details),
and use JDK 17. The local Expo config plugin pins this CMake version to use a newer Ninja
with long-path support. This keeps native compilation usable in the requested Desktop folder.

For a standalone **locally signed review APK**, set `CLOUDLYNK_EMBED_PREVIEW=true` before prebuild
and run `android/gradlew.bat -p android :app:assembleDebug`. This embeds JavaScript and disables
developer-server startup for that build. Clear the variable for normal development. This is not
a Play Store release; it retains the generated debug signing key. Its `.preview` application ID
and “CloudLynk Preview” label let it install alongside an existing CloudLynk app.

On Windows, `./scripts/build-preview.ps1` runs these steps, detects an installed Temurin JDK 17,
and restores its temporary environment variables afterwards. Pass `-JavaHome` for another JDK 17 installation.

## Visual system

Off-white canvas, deep green accents, dark ink typography, generous media artwork, and restrained gold Plus indicators.
Design tokens live in `src/theme/tokens.ts`; reusable controls have accessibility labels, selected/busy states
and minimum touch dimensions. Android system back navigation and safe areas are preserved.

## Checks and release boundaries

Policy/reducer tests cover guest restrictions, restricted accounts, premium membership, admin access,
private/unpublished channels, idempotent membership, folder descendants and preview-plan removal.
See `../docs/FRONTEND_HANDOFF.md` for integration and QA status.

The SDK 57 dependency tree currently reports upstream npm audit advisories. A forced audit fix would downgrade
or change the Expo major version; it was not applied. Review and update the SDK/dependencies in a separate,
tested release task before shipping. `npm ci` is reproducible via the included lockfile.
