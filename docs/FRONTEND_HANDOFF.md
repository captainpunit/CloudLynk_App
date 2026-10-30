# Frontend handoff

## Backend update — 26 October 2026

PR1–PR6 backend APIs are implemented locally. See `api/catalogue.md`,
`api/playback.md`, `api/release.md` and `PR4_PR6_SETUP.md`. The original preview
verification remains documented for the preview branch. The live adapter now
binds to these APIs; see [the binding inventory](FRONTEND_API_BINDINGS.md). Publishing requires an
admin or `profiles.can_publish`; channel ownership is `created_by`, private access
uses `is_private` plus invitations, and signed playback enforces the server rule.
Backend drive folders/rename are not part of the flat PR2 contract.

## Product decisions implemented

- Android-first, Explore as the initial guest screen.
- Creator channels with public, premium and private states; new channels require review.
- Admin controls visibility/publication; role changes are never sent directly from the client.
- Membership and entitlement are separate. An admin role does not bypass premium access.
- Personal files are separate from public channel content.
- Preview mode is explicitly labelled, persists locally, and never pretends to charge or back up data.
- Plans/prices/quotas are illustrative in preview. Production values must come from server/Google Play.
- No legacy 30-minute timer, manual UPI approval or acquisition-source access rule was carried over.

## Integration matrix

Update — 28 October 2026: all PR1–PR6 mobile flows are bound to the existing APIs.
Premium joins active backend plans to Play product offers, uses Play prices and
the profile's obfuscated account ID, and sends purchases/restores to server
verification. Pending payments never unlock access locally. Existing purchases
must be restored or managed in Google Play before buying another plan. This UI
offers regular automatically renewing base plans; trials, introductory offers,
installments and in-app plan replacement are not exposed.
Deletion reauthenticates the signed-in email/password user, requires typed `DELETE`,
queues the backend request and clears the displayed identity after acceptance.
It explains that Google Play billing must be canceled separately. Catalogue,
storage, publishing, signed playback, personal state, notices and moderation
are connected as described in the inventory.

Local verification for this update: `npm run typecheck` passed; `npm test`
passed all 38 tests. The local HTTP/Edge harness passed 32 integration checks,
including real local Storage TUS and synthetic RSA playback signing. Expo exports for
web and Android both completed successfully (Android JavaScript/Hermes bundle,
not an APK/native build or a Play transaction). Real provider purchases and
dedicated-account erasure were not performed.

| Feature | Preview implementation | Production dependency |
|---|---|---|
| Explore/search/filter/sort | Sample catalogue; functional filtering and routes | Wired: paginated catalogue/titles/seasons and live filtering |
| Sign-in/profile | Local test identity; persistent | Supabase email auth and profiles implemented |
| Join/leave channel | Tested local access policy | Existing `my_access`, `join_channel`, `leave_channel` RPCs |
| Feed/bookmarks | Joined/saved video collections | Wired: saved titles, progress and continue watching |
| Cloud/files | Native picker, app-local copies, folders, rename/remove/export | Wired: quota, reserve/TUS/finalize/list/download/delete/cancel; live folders/rename outside contract |
| Creator | Channel submission and local video selection | Wired: channel/title/season/episode drafts, allocated TUS, processing, revisions and review |
| Admin | Explicit preview role, approve/hide/visibility and report review | Wired: moderation, publisher/account permissions, reports, notices and audit |
| Premium | Explicit no-charge simulation and local plan restoration | Wired: backend plans, Android Play offers/purchase/restore, server verification. Needs deployed functions, configured Play products and device acceptance |
| Player | Bundled sample/local files, controls, progress, failure/retry | Wired: signed HLS, expiry/foreground renewal, progress |
| Notices | Local workspace notices/read state | Wired: inbox/read state, explicit Expo push registration and lifecycle |
| Reports | Persistent local review queue | Wired: report submission and admin decisions |
| Account deletion | Confirmed local reset | Wired: password reauthentication, typed confirmation, secure queued deletion endpoint. Needs deployed workers and end-to-end erasure acceptance |

## Original access-policy gap (resolved in PR4)

PR4 now defines ownership (`created_by`), private visibility (`is_private`),
invitations and publisher permission (`can_publish`). These are mapped explicitly in the
live adapter. The preview model does not grant real
authorization: the frontend must continue relying on RLS and server access checks.

## Review checklist

1. Start without `.env`; Explore must render before sign-in.
2. Join a free channel signed out; enter a test preview identity and join it.
3. Check Joined and My feed. Save a video and verify it appears in Saved.
4. Open a premium channel; activate preview Plus, join, then open playback.
5. End preview Plus; confirm premium viewing is gated again.
6. Create a channel, switch to local admin preview, approve it, and check discovery.
7. Make the channel private or hidden; verify it disappears from discovery and deep-link playback is denied.
8. Add files and nested folders, restart, rename/export/remove, and test invalid names or quota errors.
9. Submit a report and mark it reviewed in the local admin workspace.
10. Test back navigation, keyboard visibility, long names, no matches and a failed video source.

## Publication is a separate gate

Before Google Play release: finish and test backend contracts, replace sample content, fetch Play prices,
verify receipts/restore/expiry on a test track, supply owned-domain App Links, review policy/legal copy,
resolve dependency advisories, audit accessibility on a physical Android phone, and configure release signing.
No release has been uploaded or published by this task.
