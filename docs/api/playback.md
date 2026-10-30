# Playback and progress (PR5)

POST `stream-playback-token` with a Supabase bearer token and `{ "titleId":"uuid" }`.
Returns `{ "hlsUrl":"https://...", "dashUrl":"https://...", "expiresAt":"..." }`.
Requests always recheck account standing, channel publication, private invitations,
subscription, membership, title/series publication, age and asset readiness. Series
containers are not playable. Tokens last at most 10 minutes and never beyond the
current subscription expiry. Renew by requesting this endpoint before expiry.
Country restrictions are signed into Cloudflare's token, not trusted from client input.
No public fallback playback URL is returned.

Set `profiles.birth_date` for age-gated content. This is a self-declared age gate;
verified age assurance requires a separately agreed policy/provider. Unknown age
fails closed for rated content. Errors add `title_unavailable`, `age_restricted`,
`video_processing`, `subscription_required`, and existing PR1 decisions.

RPC `save_watch_progress(p_title_id,p_position_seconds)` validates current playback
access, clamps the position to the provider duration and upserts the caller's row.
Read `watch_progress` (own rows only) with title IDs for resume/continue watching.
RPC `set_saved_title(p_title_id,p_saved)` manages bookmarks; read `saved_titles`.
Progress and bookmarks never grant playback rights. The title ID is stable across
renewal requests. Already-issued URLs can work until expiry after an access change.
