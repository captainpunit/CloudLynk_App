# Catalogue, publishers and moderation (PR4)

New backend contract. All RPC calls use the caller's Supabase session.
Publishing is limited to active admins and users explicitly granted `can_publish`.
Regular users cannot grant themselves permission. Admins review every publication.

| RPC | Arguments | Result |
| --- | --- | --- |
| `submit_channel` | `p_name`, `p_description`, `p_category`, `p_cover_url` | Draft channel, initially private |
| `save_title` | `p_channel_id`, `p_kind` (`movie`,`series`,`episode`), `p_name`, `p_description`, `p_min_age`, optional `p_title_id`, `p_season_id`, `p_episode_number`, `p_cover_url`, `p_countries` | Draft title; only drafts/rejections can be edited |
| `save_season` | `p_series_id`, `p_number`, `p_name` | Season |
| `submit_title_review` | `p_title_id` | Pending title; video must be processed |
| `reopen_title` | `p_title_id` | Hidden/rejected title returns to draft for another review |
| `reset_stream_upload` | `p_title_id` | Remove a draft's ready/failed/expired asset and queue external cleanup before replacement |
| `moderate_content` | `p_kind` (`channel`,`title`,`report`,`publisher`,`account`), `p_id`, `p_action`, optional `p_reason`, `p_visibility` | Admin operation with audit record |
| `invite_channel_member` | `p_channel_id`, `p_user_id` | Owner/admin invitation for a private channel |
| `report_title` | `p_title_id`, `p_reason`, `p_details` | Report ID |

Channels expose existing fields plus `is_private`, `category`, `cover_url`.
`created_by` is the owner. Draft channels need admin publication. Public and
premium channels are discoverable only while published; private channels appear
only to their owner, admins and invited/joined users. Joining a private channel
requires an invitation. Premium still requires a paid subscription, including for admins.
`private_channel` extends the PR1 access decision set.

Read `titles` (movies, series, episodes) and `seasons` through normal table queries.
Seasons become visible with an approved episode; creators cannot rewrite reviewed
season names while their episodes are in review or published.
Publication visibility follows the channel and, for episodes, the parent series.
Paginate using `.range()` and order by `published_at`/`id`; filter by channel, kind,
season, or name. Series contain seasons; seasons contain uniquely numbered episodes.
Provider asset IDs and upload URLs are never public catalogue fields.

POST `generate-stream-upload`: authenticated JSON `{ "titleId":"uuid", "sizeBytes":1234 }`.
Returns `{ "uploadURL":"https://...", "assetId":"uuid", "expiresAt":"...", "protocol":"tus" }`.
Use this URL as the TUS client's `uploadUrl` (already allocated), not its creation
endpoint. Uploads always require signed playback URLs. Existing valid upload
allocations are returned on retry; concurrent allocation returns 409. Poll
`my_stream_uploads` for processing state. `stream-webhook` verifies Cloudflare's
raw-body HMAC and re-reads the provider before updating processing state.

Admin actions: channels `publish`,`hide` with visibility `public`,`premium`,`private`;
titles `publish`,`reject`,`hide`; reports `resolve`,`dismiss`; publishers `grant`,`revoke`;
accounts `suspend`,`ban`,`restore`. Reasons are required for rejection, restriction,
and report decisions. Owner editing never publishes content. Audit records are admin-only.

Standard errors: 401 sign-in, 403 restricted/not publisher/not owner/not admin,
400 invalid metadata/state, 404 unavailable resource, 409 upload busy, 503 provider
failure. SQL uses stable messages documented by the function definitions.

Age ratings and territory lists are explicit title metadata: minimum age 0 is
unrestricted; empty countries means all territories. Set these deliberately during
review. Client-confirmed content policy and publishing rights remain release inputs.
