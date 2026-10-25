# Frontend handoff

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

| Feature | Preview implementation | Production dependency |
|---|---|---|
| Explore/search/filter/sort | Sample catalogue; functional filtering and routes | Catalogue/title API |
| Sign-in/profile | Local test identity; persistent | Supabase email auth and profiles implemented |
| Join/leave channel | Tested local access policy | Existing `my_access`, `join_channel`, `leave_channel` RPCs |
| Feed/bookmarks | Joined/saved video collections | Server watchlist/content API |
| Cloud/files | Native picker, app-local copies, folders, rename/remove/export | Reserve/finalize/list/signed download APIs |
| Creator | Channel submission and local video selection | Creator submission, upload URL, processing and moderation APIs |
| Admin | Explicit preview role, approve/hide/visibility and report review | Secure moderation API and audit trail |
| Premium | Explicit no-charge simulation and local plan restoration | Play plan catalogue, billing flow, receipt verification, RTDN |
| Player | Bundled sample/local files, controls, progress, failure/retry | Signed playback URLs and token renewal |
| Notices | Local workspace notices/read state | Notifications API and push registration |
| Reports | Persistent local review queue | Reports API |
| Account deletion | Confirmed local reset | Secure server deletion endpoint |

## Access-policy gap requiring backend design

The newer PR1 schema does not yet define channel ownership or a private/invitation visibility field.
The frontend's preview model expresses the requested product behaviour, but the live adapter must not invent
an authorization column. Backend owners must define ownership, private-channel membership and publishing contracts.
The frontend relies on RLS and server access checks; it never grants a real subscription locally.

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
