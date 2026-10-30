# Frontend API bindings — 28 October 2026

The live frontend now uses the existing PR1–PR6 backend contracts. Preview mode
retains local sample data. Set `EXPO_PUBLIC_DATA_MODE=live` and configure the target
Supabase URL and public key to use the backend. No service-role or provider secret
is included in app code.

| Flow | Backend binding | Frontend entry |
|---|---|---|
| Sign-in/sign-up/sign-out | Supabase Auth; push registration removed before sign-out | Auth, Settings |
| Profile and age declaration | `profiles.display_name`, `profiles.birth_date` | Settings |
| Catalogue and search | Paginated `channels`, published `titles`, `seasons`; client filters on loaded rows | Explore, Channels, series details |
| Private channels | RLS-visible channels, `invite_channel_member` | Channels → Private; owner channel details |
| Membership and access | `my_access`, `join_channel`, `leave_channel` | Channels, Watch |
| Plans and billing | Active `plans`, Google Play offers, account hash, `verify-play-receipt` | Plus |
| Subscription display | Own non-superseded `subscriptions`, paid statuses and future expiry | Shared live state |
| Saved titles | `saved_titles`, `set_saved_title` | Watch, Feed → Saved |
| Watch progress | `watch_progress`, `save_watch_progress` | Player resume, Feed → Continue watching |
| Cloud quota | `my_drive_usage` | Cloud |
| File upload and resume | `reserve_drive_upload`, Storage TUS, `finalize_drive_upload` | Upload, Cloud |
| File download | Authenticated Storage `createSignedUrl` (60 seconds) | File details |
| File delete/cancel | `delete_drive_file` | File details, unfinished upload list |
| Channel submission | `submit_channel` | Profile → New channel |
| Movies, series and episodes | `save_title`, `save_season` | Profile → Add a video / channel → Manage titles |
| Creator video upload | `generate-stream-upload`, allocated TUS URL, `my_stream_uploads` polling | Publisher workspace |
| Creator revisions | `reopen_title`, `reset_stream_upload`, `submit_title_review` | Publisher workspace |
| Signed playback | `stream-playback-token`, HLS, expiry and foreground renewal | Watch |
| Reports | `report_title`, own/admin RLS reads | Watch → Report, Admin → Reports |
| Moderation | `moderate_content` for channels/titles/reports/publishers/accounts | Admin workspace |
| Audit | Paginated `audit_log` | Admin → Audit |
| Inbox | `notices`, `mark_notice_read` | Notifications |
| Push registration | `register_push_token`, `unregister_push_token`, Expo push tokens | Notifications, sign-out lifecycle |
| Admin notices | `send_notice`, stable campaign UUID for retries | Admin → Messages |
| Advertising consent | Explicit `track-install` opt-in/withdrawal; consent-gated Play referrer collection | Settings |
| Account deletion | Recent password sign-in, `delete-account`, accepted queued status | Settings |

Scheduled workers, provider webhooks and private `backend-health` are server
integrations. Their cron/provider credentials deliberately have no frontend binding.

## Behavior and limits

- Live state starts empty and never substitutes preview channels, videos, files,
  prices or entitlements. Account changes clear the previous identity's state;
  stale refresh responses cannot replace the current account's data.
- Catalogue/personal table reads page through the API's row limits. Published
  series open their seasons and ordered episodes instead of requesting playback
  for a nonplayable series container. Private invitations are visible in the
  Private channels tab as allowed by RLS.
- File transfers use measured source sizes, server-selected bucket/object paths,
  6 MiB TUS chunks, server offsets and owner-scoped retry metadata. An interrupted
  transfer can resume when the user selects the same file. No bearer token is
  sent to Cloudflare. Cancel unfinished/expired reservations from Cloud.
- Publisher uploads remain drafts until processing completes and the owner
  explicitly submits them. Admin review remains required. Resetting a video
  requires confirmation and queues the old provider asset for deletion.
- Playback requests only signed URLs and checks expiry. Refresh failures stop
  playback; no public/demo source is substituted. Navigation away/backgrounding
  releases playback. Progress writes are throttled to fifteen seconds.
- Push permission is requested only from the Notifications screen. An opted-in
  device re-registers on account/token changes; sign-out unregisters before the
  session is removed. Notification taps open the authenticated inbox, not an
  arbitrary URL from a push payload. No real user notices were sent during verification.
- Advertising measurement is off unless explicitly allowed. No Meta SDK starts
  at launch. Referrer/consent endpoint binding is implemented; Meta device-data
  enrichment, attribution quality and final Events Manager acceptance remain
  provider validation work.
- Account deletion displays request acceptance, not completed erasure. Canceling
  Google Play billing is a separate user action. Provider cleanup and Auth erasure
  must complete through deployed scheduled workers.
- Folders and file rename are outside the existing flat-drive contract, so those
  controls appear only in preview. Billing currently offers ordinary renewing
  base plans; introductory/installment offers and in-app plan replacement are
  not exposed. Public member/view counters are not supplied by this backend and
  are hidden in live screens.

## Verification

Verified with installed Node 22.23.2 (the repository specifies Node 22):

- TypeScript: `npm run typecheck`.
- Unit tests: `npm test` — 38 passed, including mapping/pagination, TUS recovery,
  purchase verification and account-deletion boundaries.
- Local Supabase API checks: `npm run test:api` creates disposable local accounts,
  exercises RLS/RPCs, transfers a file through real local Storage TUS, finalizes,
  downloads, deletes and cleans up its fixtures. The script accepts only the CLI
  stack at `127.0.0.1`; it never reads production app credentials.
- Extended local Edge checks: 32 integration assertions passed, including RSA
  signature/subject/expiry validation, denied playback, invalid upload size,
  consent withdrawal and a queued deletion request on a dedicated fixture account.
  The video metadata and signing key are synthetic; no Cloudflare upload occurs.
- Expo web and Android/Hermes bundle exports completed in live mode. These are
  JavaScript build checks, not an APK/native build or physical-device acceptance.

To reproduce the extended Edge checks, from `mobile/`:

```powershell
node --import tsx scripts/prepare-edge-smoke.ts
# In a second terminal at the repository root:
npx supabase functions serve --env-file mobile/.expo/integration-edge/local.env
# Back in mobile/:
node --import tsx scripts/check-live-api.ts --edge
```

Start Docker/Supabase first. The preparation script writes temporary synthetic
keys under ignored `.expo/`; it does not configure hosted services. Stop the
temporary function server after testing.

Before release, deploy the backend/functions and schedules, configure the real
Play products, Cloudflare signing/upload secrets, EAS project ID and FCM v1
credentials, and rebuild the native app after adding notifications. Then verify
Play purchase/restore, Cloudflare processing and playback/territory/renewal,
Android push delivery/account switching, and complete erasure with dedicated
provider test accounts. These provider/device checks have not been performed here.
