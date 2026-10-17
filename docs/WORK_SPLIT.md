# Work split: Member 1 and Member 2

Two developers. One rule: **Member 1 owns the server, Member 2 owns the app.**

| Person | Owns | Folders |
| --- | --- | --- |
| **Member 1** | Backend: Supabase schema, RLS, Edge Functions, Play billing verification, Play RTDN webhook, Meta Conversions API, Cloudflare Stream tokens, scheduled jobs | `supabase/`, `docs/` |
| **Member 2** | Mobile app: all screens and app features (login, drive, channels, plans, player, upload UI), Meta SDK events in the app, install referrer, deep links | `mobile/` |

This is a default split (server vs app). If one of you is stronger in some
area, swap that row and update this file.

Features come from the PRD (`Cloudlynk_PRD_and_Workflow.docx`, FR01 to FR11)
and follow its build order (PR1 to PR6).

## Feature owners

| PRD | Feature | Member 1 (backend) | Member 2 (app) |
| --- | --- | --- | --- |
| FR01 | Login, session restore, sign out, delete account | Delete-account function, profile table and RLS | Login, sign up, session restore, settings, delete-account screen |
| FR02 | Private cloud drive | Quota reserve and finalize functions, file rows, cleanup job, signed download | Drive list, search by category, upload with progress and retry, download, delete, storage meter |
| FR03 | Plans screen | Plans table or endpoint (price, period, quota, benefits) | Plans screen reading server plans |
| FR04 | Purchase, restore, renew, cancel, refund, expiry | `verify-play-receipt`, `play-rtdn-webhook`, `subscriptions` and `payment_events`, expiry reconcile job | Play Billing flow (`expo-iap`), send token to server, Pending / Active / Expired states, Restore button |
| FR05 | Channels and premium access | Access rule (one function for join and playback), channel and membership tables | Catalogue, channel page, join button, locked / unlocked states |
| FR06 | Publisher upload and review | `generate-stream-upload`, Stream webhook, title states (draft to published), moderation | Admin upload screen: metadata form, resumable upload, status list |
| FR07 | Playback and continue watching | `stream-playback-token` (10 to 15 min tokens), watch progress upsert | Player: seek, pause, fullscreen, retry, save and resume progress |
| FR08 | Movies, series, seasons, episodes | Title, season, episode tables | Title page, season picker, episode list, next episode |
| FR09 | Reports, moderation, roles, audit | Reports and audit tables, admin functions | Report button, simple admin review screen |
| FR10 | Notices and push | Notification dispatch, token cleanup | Push permission, token register, in-app notices |
| Ads | Install and subscription tracking | `track-install`, `meta_event_outbox`, `meta-capi-dispatch` | Meta SDK init after consent, ViewContent / InitiatedCheckout events, install referrer, deep links |
| FR11 | Comments, live, offline | Later phase | Later phase |

## Order of work

Each step matches a PRD pull request. Member 1 starts each step one step ahead,
so the API exists (or at least its contract does) before Member 2 needs it.

| Step | PRD | Member 1 | Member 2 | Member 2 waits on |
| --- | --- | --- | --- | --- |
| 0 | Setup | Supabase project, run migrations, deploy stub functions | Expo dev build runs on a phone, Supabase client, navigation shell | Supabase URL and anon key |
| 1 | PR1 Access policy | One access rule for purchase, join and playback; remove approval gate | Login, sign up, session restore, sign out | Nothing (Supabase Auth is ready) |
| 2 | PR2 Cloud drive | Quota reserve / finalize, cleanup job | Drive screens, upload and retry, storage meter | Quota API contract |
| 3 | PR3 Subscriptions + Meta | Verify receipt, RTDN webhook, expiry job, Meta CAPI outbox and dispatch, track-install | Plans screen, Play Billing, restore, purchase states, Meta SDK events, install referrer | Plans endpoint and `verify-play-receipt` contract |
| 4 | PR4 Publisher and catalogue | Stream upload URL, processing webhook, title / episode tables, moderation | Catalogue, channel page, title page, admin upload screen | Catalogue and upload API contracts |
| 5 | PR5 Premium playback | Playback token, token renewal, watch progress | Player, continue watching, next episode | `stream-playback-token` contract |
| 6 | PR6 Release | Push dispatch, monitoring, delete account | Push, notices, delete-account screen, signed release build | Delete-account and push contracts |

While Member 2 waits for a real API, Member 2 builds the screen against a **mock** that
returns the agreed JSON. No one should be blocked for long.

## API contracts (how you avoid waiting)

Before Member 1 writes a function, Member 1 writes its contract and Member 2 says OK.

1. Member 1 adds the contract to `docs/api/<function-name>.md`: URL, method,
   request JSON, response JSON, error codes.
2. Member 2 reviews it on the PR. Once merged, the contract is fixed.
3. Member 2 mocks it in `mobile/src/services/` and builds the screen.
4. Member 1 ships the real function. Member 2 removes the mock.
5. Changing a merged contract needs a message to the other person first.

Shared TypeScript types: after any migration Member 1 regenerates
`mobile/src/lib/database.types.ts`. This is the **only** file in `mobile/`
that Member 1 edits.

Contracts needed, in order:

| Contract | Needed by step |
| --- | --- |
| Quota reserve / finalize, file list, signed download | 2 |
| Plans list | 3 |
| `verify-play-receipt` (token in, subscription state out) | 3 |
| `track-install` (referrer in) | 3 |
| Catalogue, channel, title, episodes | 4 |
| `generate-stream-upload` and upload status | 4 |
| `stream-playback-token`, watch progress | 5 |
| Delete account, push token register | 6 |

## Git branch rules

1. `main` is always working. No direct pushes. Merge only through a pull request.
2. Branch from latest `main`. Name: `<name>/<area>-<short-topic>`.
   Examples: `member1/be-verify-receipt`, `member2/app-drive-screen`.
3. Stay in your folders: Member 1 in `supabase/` and `docs/`, Member 2 in `mobile/`.
   If you must touch the other side, ask first and tag them on the PR.
4. Small PRs, one feature each. Open a draft PR early so the other person sees it.
5. The other person reviews every PR before merge. Use squash merge.
6. Before you push, pull `main` into your branch (`git pull origin main`)
   and fix conflicts on your branch, not on `main`.
7. Migrations: only Member 1 adds them. File name is a new timestamp. Never edit
   a migration that is already merged; add a new one.
8. Never commit `.env` files or keys. Only `.env.example`.
9. Delete your branch after merge.

## Before work starts

These are open PRD decisions. Ask the client so neither of you builds the wrong thing:

- Plan prices, billing periods, storage quotas, file size limit.
- Admin-only publishing, or approved creators too.
- Downgrade and file retention rules.
- Age rules and content territories.
