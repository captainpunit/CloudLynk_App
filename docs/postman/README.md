# CloudLynk Postman API collection

Import both files into Postman:

- `CloudLynk.postman_collection.json` — 99 requests in 15 folders, covering PR1–PR6.
- `CloudLynk.local.postman_environment.json` — local URL, empty credentials and workflow variables.

Select **CloudLynk - Local** as the active environment. Use the current Postman desktop
app; folder skip scripts and the Stream signature helper use modern sandbox APIs.

## Start and authenticate

From the repository root, with Docker Desktop running:

```powershell
npx supabase start
npx supabase migration up --local
npx supabase functions serve --env-file supabase/.env
```

In another terminal, run `npx supabase status`. Copy its **anon JWT key** into
`supabase_anon_key`. Keep `base_url=http://127.0.0.1:54321` for local testing.
For a hosted environment, use that project's URL and legacy anon JWT key. The
collection's anonymous REST requests use that JWT as their bearer token; a newer
non-JWT publishable key is not interchangeable in those particular requests.
No service-role key belongs in this collection.

Set `email` and `password` locally in Postman. Run **Sign up test user**, then
**Sign in user** in folder 01. Login automatically stores `access_token`,
`refresh_token` and `user_id`. Profile/access, drive and other normal requests
inherit this user token. Local signup does not require email confirmation;
hosted signup may require it. Only the signup request creates a user: importing
the JSON never sends requests.

For admin operations, set `admin_email` and `admin_password`, then use **Sign in
admin**. It saves a separate `admin_access_token`; it does not replace the normal
user's session or grant any roles. Bootstrap the first admin through trusted SQL
or the server's administrative tooling as described in `../PR4_PR6_SETUP.md`.
Use local/secret values for credentials and do not commit a populated export.

## Request workflows

Run individual requests in the required order. This is an interactive API toolbox,
not one unconditional Collection Runner test: content creation, approval, real
video processing, provider tokens and test identities require explicit inputs.

**Drive:** folder 05 → usage → reserve sample → upload sample → finalize → list →
create signed URL → download. The raw sample is exactly ten bytes (`CloudLynk`
followed by a line feed). Reservation captures `file_id`, `drive_bucket` and
`storage_path`. Signed URL creation captures `download_url`. For another file,
reserve its measured size and use a binary body with the matching MIME type.
For large drive files, use the Supabase TUS flow in `../api/drive.md`.

**Publishing:** set `target_user_id` to the regular user's `user_id`, sign in an
existing admin, set `enable_admin_operations=true`, and grant publishing permission.
As the normal user, submit a channel. Publish that channel as admin, choosing
`channel_visibility=public`, `premium` or `private`. Create a movie/series/season/
episode with the publisher requests. The returned IDs are stored automatically.
Series containers need review/publication before their episodes can be published.

**Video transfer:** set `video_size_bytes` to the actual video size before allocating
an upload. Allocation captures `stream_upload_url`; set `enable_stream_binary_upload=true`
and choose the real video under **PATCH video bytes → Body → binary**. HEAD captures
the current TUS offset. A single-file PATCH requires offset zero and a file no larger
than 200 MiB. Large/resumed files need a TUS client and correct chunk sizes; repeatedly
sending the whole file at a nonzero offset is not a valid resume. Poll upload state,
submit the ready title for review, and publish it as admin. Generic upload/playback
requests use `title_id`; copy `episode_id` into it when testing an episode.

**Playback:** join the published channel, then request signed playback URLs. The
response captures `hls_url`. Membership, subscription, age and territory restrictions
still apply to admins. The collection also has progress, continue-watching,
bookmarks and report requests.

**Subscriptions:** use a genuine `purchase_token` and configured `product_id`.
Read `play_account_id` from the profile and pass it as the Billing obfuscated account
ID when making the purchase in the app. A made-up token cannot grant access.
Google Play, Cloudflare, Meta and Expo operations require server-side setup; requests
are examples of real APIs, not mocked provider responses.

**Notices:** register a genuine Expo push token, then send a notice as admin to
`target_user_id`. `campaign_id` and `installation_id` are generated once and retained
for idempotency. Clear `campaign_id` to generate a new campaign. Read the inbox to
capture the latest `notice_id`. Actual delivery and receipts require the push worker.

## Manual folders and variables

| Folder | Enable variable | Additional values |
| --- | --- | --- |
| 08 Stream binary upload | `enable_stream_binary_upload=true` | Actual selected video; allocated URL and exact offset |
| 11 Admin operations | `enable_admin_operations=true` | Existing admin login, target IDs |
| 13 Scheduled workers | `enable_worker_requests=true` | `cron_secret` matching the server |
| 14 Provider webhooks | `enable_provider_webhooks=true` | Stream signing secret/UID or genuine Google OIDC token |
| 15 Cleanup/deletion | `enable_destructive_requests=true` | Target IDs; erasure additionally needs `delete_confirmation=DELETE` |

These flags default to false; their folders skip requests until enabled. Worker
requests process real queues and may call providers, send pushes or erase queued
accounts. Account deletion requires signing in again within fifteen minutes and
does not cancel Google Play billing. Use dedicated test accounts.

The Stream webhook helper signs the expanded raw body with
`pm.require('npm:crypto-js@4.2.0')`; importing that package may require network access.
The backend re-reads the actual provider video. The Pub/Sub example generates a
base64 test notification, but requires a Google-issued `pubsub_oidc_token` matching
the server's configured audience and service-account email. User/admin JWTs do not
authenticate that webhook. No OIDC or service-account private key is included.

**Backend health** is read-only and needs `cron_secret`; HTTP 503 with
`status=degraded` is expected until all required scheduled workers have recently
succeeded. Other requests assert 2xx success, so missing configuration, permission
or workflow prerequisites appear as failed checks with the actual API error body.

Reference contracts: `../api/access-policy.md`, `../api/drive.md`,
`../api/subscriptions.md`, `../api/track-install.md`, `../api/catalogue.md`,
`../api/playback.md`, `../api/release.md`.
