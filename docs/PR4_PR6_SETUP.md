# PR4–PR6 backend setup and handoff

The backend implementation is available on `member1/be-publishing-playback-release`.
This does not deploy production services or wire the mobile feature screens to the
new APIs. Shared database types are regenerated; all existing migrations are retained.

## Local validation

Start Docker Desktop. From the repository root:

```powershell
npx supabase start
npx supabase migration up --local
npx supabase test db
npx supabase db lint --local --level warning
npx deno task --config supabase/functions/deno.json check
npx deno task --config supabase/functions/deno.json test
npx deno task --config supabase/functions/deno.json lint
npx supabase functions serve --env-file supabase/.env
```

The local config explicitly enables API, Auth, Storage and Edge Runtime, with
Postgres 17 and API port 54321. If the old database-only stack is already running,
run `npx supabase stop` (keeps local data) and then `npx supabase start` once to
activate the additional services. Do not use `db reset` or delete Docker volumes
to apply these changes. Local email confirmation is disabled only for development.

No tests use real provider accounts. Database fixtures roll back, including dummy
Auth users used to verify erasure. Stream HMACs, playback signatures, timestamps,
TUS metadata, Expo responses and provider failures use local/mock data.
Use the existing mobile preview independently, or have the app developer consume
the API contracts in `docs/api/catalogue.md`, `playback.md` and `release.md`.

## Publishing and video setup

1. Apply migrations to the chosen environment before deploying the updated functions.
   Bootstrap the first admin via trusted SQL/service role, using the intended user's
   UUID. Regular accounts have `can_publish=false`; grant publishing with
   `moderate_content('publisher', user_id, 'grant')` as an admin. Creator ownership
   uses `channels.created_by`. Admin role management remains a trusted operation;
   no mobile role-change endpoint is exposed.
2. Configure `CLOUDFLARE_ACCOUNT_ID`, a Stream API token with read/write/delete
   permissions, upload byte/duration limits, and the customer playback hostname.
   R2 is not required for this implementation: private files use Supabase Storage.
3. Create a Stream signing key using Cloudflare's keys API. Store its ID and the
   returned base64 JWK in `CLOUDFLARE_STREAM_SIGNING_KEY_ID` and
   `CLOUDFLARE_STREAM_SIGNING_JWK_BASE64`. Do not decode/re-encode an already base64
   value. The PEM is not used. Keep all signing material server-side.
4. Configure the Stream account webhook to the deployed `stream-webhook` endpoint.
   Save the returned secret as `CLOUDFLARE_STREAM_WEBHOOK_SECRET`. The endpoint
   verifies timestamped HMAC-SHA256 over exact body bytes and fetches current video
   state. Cloudflare needs a public HTTPS endpoint; local mock tests do not validate
   real webhook routing.
5. Deploy `generate-stream-upload`, `stream-webhook`, `stream-reconcile`,
   `stream-playback-token`, and `media-cleanup`. New video allocations require
   signed URLs from the beginning. Clients use the returned TUS URL directly
   (`uploadUrl`), choose provider-compatible chunk sizes, and never receive API keys.
6. Create draft channels/titles through the authenticated RPCs. For a series,
   create the series and seasons, submit/review the series, then review episodes.
   Once a video is ready, explicitly submit it for review; provider readiness alone
   never publishes. Admins publish reviewed content and select channel visibility.
   Missing birth dates deny age-rated playback; country restrictions are enforced
   by Cloudflare's signed token. Confirm actual age and territory policy with the owner.

## Push and account deletion

1. Configure Expo/EAS FCM v1 credentials for the production Android application.
   If Expo enhanced push security is enabled, set its matching `EXPO_ACCESS_TOKEN`.
   The app must add `expo-notifications`, request permission and register its Expo
   token/installation UUID. The backend accepts Expo tokens, not raw FCM tokens.
2. Deploy `notification-dispatch`, `delete-account`, `account-deletion-worker`
   and `backend-health`. Admin notices are durable inbox rows even without a device
   token. Device pushes contain generic copy and a notice ID; retrieve private copy
   from the authenticated inbox after opening the app. Device account switches clear
   the previous account's pending pushes. The client should deduplicate by notice ID.
3. Deletion requires a newly signed-in session (15-minute window) and explicit
   `DELETE` confirmation. The account is restricted and owned content hidden first.
   Erasure then deletes content metadata, attribution and pending conversions,
   removes Storage objects through the Storage API, waits for Stream cleanup and
   removes Auth identity. Existing signed playback URLs last at most ten minutes.
   Google Play billing is not canceled by account deletion: the app must explain
   cancellation in Play before requesting erasure. No real users were deleted by tests.
4. A provider allocation whose response is lost has a durable correlation intent.
   Stream reconciliation finds it by the exact server-generated video name, keeps
   correctly bound media and queues unbound media for deletion. Uncertain empty
   allocations are retried for up to 24 hours before expiry; account erasure waits
   for these intents. The provider credentials must remain valid during erasure.
   External deletion failures are visible and retained for retry, never reported
   as successful erasure. Investigate and replay failed media rows before closing
   overdue deletion requests.
5. Late Play notifications for erased purchases are recognized by opaque SHA-256
   tombstones (90 days) and cannot recreate raw payment payloads during that period.
   Worker runs and completed anonymized erasure requests retain 30 days of history.
   Audit records retain administrative actions with deleted actor IDs nulled out.
   Confirm any separate legal retention/backup policy before launch.

## Schedules and monitoring

Configure all server secrets (see `supabase/.env.example`). Enable `pg_cron`,
`pg_net` and Vault. Add Vault entries named `cron_secret` and `supabase_project_url`,
then run `supabase/scripts/schedule-jobs.sql` on the target environment. This schedules
all seven workers with the correct secret header and avoids duplicate named jobs.
Redeploy the three PR3/drive workers as well: they now record worker heartbeats.

Call `backend-health` from your monitoring service using POST and `x-cron-secret`.
It returns 503 for missing recent successful worker runs, overdue queues, unresolved
delivery failures or unprocessed payment events. A fresh environment is degraded
until each required job has run. The response contains aggregate counts, not user data.
Inspect `job_runs`, cron history and `net._http_response`; monitor database storage,
provider limits and function errors using Supabase/Cloudflare/Expo dashboards.
No monitoring account, alert destination or paging service has been configured by code.

Push retries are at least once. A lost provider response may create duplicate device
notifications; use `noticeId` for client deduplication. Tickets are polled after fifteen
minutes, with receipt retries before Expo's 24-hour retention boundary. Invalid device
tokens are disabled; credential or payload failures need an operator correction.
Media/push send failures become terminal after ten attempts. After investigating,
reset `state='queued', attempts=0, next_attempt_at=now(), lease_id=null, lease_until=null`
in the affected queue. Do not replay raw push requests or expose token values in logs.

## Provider acceptance before release

- Real approved creator upload: TUS resume, interruption, processing failure,
  lost webhook recovery, rejection, file replacement and fresh review.
- Anonymous/private/paid/membership/age/territory access matrix, signed HLS/DASH
  playback and renewal on a physical Android device. Confirm public UID playback
  is blocked at Cloudflare. Verify the token expiry after cancellation/plan expiry.
- Device registration, account switch, sign-out removal, ticket and receipt errors,
  and restored provider service after a temporary outage.
- Explicit erasure of dedicated test accounts with files and owned videos; prove
  provider objects and Auth identity are removed and retries recover each failed step.
- Confirm play pricing, content rights/age rules, storage limits, privacy disclosures,
  legal retention, release signing and owned-domain App Links. PR3 provider acceptance
  remains required as documented in `PR3_SETUP.md`.

References: [Cloudflare direct uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/),
[signed playback](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/),
[webhook authentication](https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/),
[video lookup](https://developers.cloudflare.com/api/resources/stream/methods/list/),
[Expo push receipts](https://docs.expo.dev/push-notifications/sending-notifications/).
