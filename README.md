# CloudLynk

Android app for private cloud storage and subscription video channels, with
backend support for Meta ads (app installs and subscriptions).

Status: **PR1 and PR2 implemented; PR3 implemented locally**: profiles, channels and one access rule
(`docs/api/access-policy.md`), and the private cloud drive with quota
reservation and cleanup (`docs/api/drive.md`), plus plans, Play subscription
verification/RTDN/reconciliation and consent-based Meta tracking.
See `docs/PR3_SETUP.md` for deployment and provider acceptance checks;
PR4 publisher/catalogue, PR5 playback and PR6 release features remain.

## Stack

Taken from `Cloudlynk_PRD_and_Workflow.docx` so it matches the existing app.

| Part | Tech |
| --- | --- |
| Mobile | Expo (SDK 57) + React Native + TypeScript + Expo Router, Android first |
| Backend | Supabase: Postgres, Auth, Storage, Edge Functions (Deno/TypeScript) |
| Video | Cloudflare Stream (signed playback) |
| Payments | Google Play Billing (`expo-iap`) + server verification |
| Ads | Meta SDK (`react-native-fbsdk-next`) + Meta Conversions API from the server |

## Folders

```
cloudlynk/
  mobile/                     Expo app
    app/                      screens (Expo Router)
    src/features/             auth, files, channels, premium, player, upload
    src/services/meta/        Meta App Events (SDK)
    src/services/attribution/ Play install referrer, deep links
    src/services/billing/     Play Billing -> server verification
    src/lib/                  env, Supabase client
  supabase/
    migrations/               SQL migrations
    functions/
      _shared/                env, http, admin client, Meta CAPI client, Google Play API
      track-install/          store install attribution
      verify-play-receipt/    verify purchase, grant access, queue Meta event
      play-rtdn-webhook/      Google Play renewals, cancels, refunds
      meta-capi-dispatch/     send queued events to Meta CAPI (scheduled)
      subscription-reconcile/ refresh subscription state (scheduled)
      drive-cleanup/          remove deleted and abandoned drive uploads (scheduled)
    tests/database/           pgTAP tests (access matrix, drive), run with `supabase test db`
    tests/functions/          provider mapping, attribution and subscription workflow tests
  docs/
    api/                      API contracts the app builds against
    CONTRACT_REVIEW.md        review of the client's terms
    META_ADS_TRACKING.md      how install/subscription tracking works
```

## Setup

```bash
# Mobile
cd mobile
cp .env.example .env          # fill Supabase + Meta app values
npm install
npx expo install --fix        # align versions with the Expo SDK
npx expo run:android          # needs a dev build (Meta SDK + billing are native)

# Backend
cd ../supabase
cp .env.example .env
supabase start
supabase db reset             # applies migrations locally
supabase test db              # database tests (needs Docker)
supabase functions serve
```

Meta SDK and Play Billing do not work in Expo Go. Use a development build.

## Accounts the client must own

Google Play Console, Meta Business Manager (app, dataset, ad account),
Supabase, Cloudflare, and the domain used for App Links. The developer gets
access as a user, not as owner.

## Build order

Follows the PRD: access policy, cloud drive, subscription lifecycle,
publisher and catalogue, premium playback, notifications and release.
Meta tracking is wired inside the subscription lifecycle step.
