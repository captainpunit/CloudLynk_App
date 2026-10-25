# CloudLynk — start here

This folder is the **new Android frontend workspace**. Open this folder in your editor.

## What to open

- `mobile/` is the app. This is where frontend development happens.
- `mobile/src/features/` contains the actual screen code, grouped by feature.
- `mobile/app/` contains short route files, not business logic.
- `mobile/README.md` explains how to run and review it.
- `docs/REPOSITORY_MAP.md` explains your three GitHub repositories.
- `docs/FRONTEND_HANDOFF.md` separates working preview features from backend work still required.
- `deliverables/CloudLynk-preview.apk` is the standalone Android review build.
- `supabase/` is the newer repository's existing backend. Its migrations have not been rewritten or deployed.

## Run the preview

Open a terminal in `mobile`, then run:

```sh
npm ci
npm run web
```

For Android with Expo Go:

```sh
npx expo start --go --android
```

Explore is the first screen. You do not need an API key or a real account to try the preview.
When asked to enter the preview workspace, use a test name and email. No password is needed.

## Android review APK

The APK is labelled **CloudLynk Preview** and installs alongside an older CloudLynk app.
It includes ARM64 phone and x86-64 emulator builds. It contains its JavaScript and sample video;
you do not need Metro running. Cover photographs still need an internet connection.
This is a locally signed review build. It has not been submitted to Google Play.

## Important distinction

The preview is interactive and persists on the device, but it is **not a deployed cloud service**.
Preview Plus does not charge money. Uploaded preview files are local copies, not cloud backups.
Real payments, cloud uploads and signed playback depend on backend endpoints which are still stubs in the starting repository.

The old mobile app and old website have not been modified. No Google Play release has been published.
