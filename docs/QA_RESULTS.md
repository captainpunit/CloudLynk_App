# Frontend verification — 25 October 2026

For the 28 October live API integration update, see
[frontend API bindings and verification](FRONTEND_API_BINDINGS.md).
The checks below describe the earlier preview build.

## Passed

- TypeScript: `npm run typecheck`.
- Formatting: `npm run format:check`.
- Unit tests: all 18 pass. Coverage includes access rules, membership transitions, recursive folder removal,
  preview entitlement removal and validation/migration of persisted workspace snapshots.
- Expo dependency doctor: 21/21 checks pass.
- Production web export: `npm run build:web` succeeds.
- Standalone Android build succeeds with JDK 17 and CMake 3.31.6, targeting ARM64 and x86-64.
- APK inspection confirms `com.cloudlynk.app.preview`, “CloudLynk Preview”, Android API 24 minimum,
  bundled JavaScript and WebM sample footage, with developer-server startup disabled.
- APK installs and cold-launches in the Android 34 test emulator. React Native starts `main`,
  the process stays alive, and Android reports a visible window with 339 rendered views.
- No fatal AndroidRuntime or JavaScript error appears in the startup check.
- Browser review at 412 × 915: Explore, channel details, sign-in gate and local test identity.
- Joining a free channel persists after a hard reload.
- Built preview video decodes and plays: HTML video readyState 4 and advancing currentTime.
- Save video/bookmark, creator submission, pending review and admin approval work locally.
- A newly approved public channel appears in discovery after navigation/reload.
- Preview Plus activation permits premium membership/playback; ending Plus gates playback again.
- Document picker accepts an agent-created text fixture and saves it to My cloud without a server upload.

## Limits of these checks

Browser verification uses the same React Native feature code but does not verify Android-specific picker,
durable file copying, permissions or video controls. Those need emulator/device verification.
The native startup log includes a non-crashing React Native lifecycle warning before the context is ready.
The emulator uses software rendering; its first-start frame timings are not a physical-phone performance audit.
Live authentication/RLS, cloud uploads, signed playback, server moderation, notifications and paid billing
have not been verified against deployed services. Existing repository stubs prevent claiming production completion.

The dependency tree has upstream npm audit advisories. No forced Expo major-version change was applied.
Release signing, owned-domain App Links, licensed production media, real Play pricing and legal copy remain release gates.
