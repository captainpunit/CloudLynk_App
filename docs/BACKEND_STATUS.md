# Backend implementation status — 26 October 2026

| Phase | Implemented locally |
| --- | --- |
| PR1 | Profiles, roles, account standing, channels, shared purchase/join/watch rule |
| PR2 | Private drive reservation/finalization, quotas, ownership, signed downloads, cleanup |
| PR3 | Plans, Play verification/acknowledgement, RTDN, reconciliation, consent-based attribution and Meta outbox |
| PR4 | Approved publishers, private invitations, reviewed movies/series/seasons/episodes, TUS allocation, Stream processing/recovery, reports and audit |
| PR5 | Signed playback, subscription-bounded expiry, age and country rules, progress and saved titles |
| PR6 | Inbox notices, Expo delivery/receipts, explicit queued account erasure, durable provider cleanup, worker history and health |

Validation: 231 database assertions, 46 Deno tests, endpoint type-checks, Deno lint,
SQL lint (no schema errors), and explicit compilation of all 70 mobile TypeScript
source files with no diagnostics. Local HTTP smoke checks verified private health
aggregates, rejection of unauthenticated deletion and browser preflight handling.

The local Supabase config now enables API, Auth, Storage and Edge Runtime alongside
Postgres 17. No production deployment, provider transaction, user notification or
real-user erasure was performed. Tests create dummy users inside rolled-back fixtures.

Update — 28 October 2026: the mobile API bindings are implemented; see
[frontend API bindings](FRONTEND_API_BINDINGS.md) for the inventory and local evidence.

Remaining release work is configuration and provider acceptance: owned provider accounts,
confirmed product/age/territory rules, production secrets, function deployment,
schedules/alerts and physical-device/provider acceptance. The existing preview
remains a preview. Drive folders/rename are
outside the flat PR2 contract; comments, live streaming and offline video are FR11,
a later phase.

Start with [PR4–PR6 setup](PR4_PR6_SETUP.md), [PR3 setup](PR3_SETUP.md),
[catalogue](api/catalogue.md), [playback](api/playback.md) and [release APIs](api/release.md).
