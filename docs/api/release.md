# Notifications, deletion and monitoring (PR6)

RPC `register_push_token(p_installation_id,p_token)` registers an Expo push token
for an authenticated active user; `unregister_push_token(p_installation_id)` removes it.
Read `notices` (own inbox); `mark_notice_read(p_notice_id)` is idempotent.
Admin RPC `send_notice(p_campaign_id,p_user_ids,p_title,p_body,p_data)` creates inbox
notices and push deliveries atomically. Retry with the same campaign UUID and user
IDs to avoid duplicate notices. Maximum 500 recipients per call. Dispatch and receipts
are handled by scheduled `notification-dispatch`; invalid device tokens are disabled.
Push messages use generic copy and a notice ID. Retrieve private notice content
from the authenticated inbox after opening the app.

POST `delete-account` with a verified bearer token and `{ "confirmation":"DELETE" }`.
A session created within the last 15 minutes is required (sign in again first).
Returns 202 `{ "requestId":"uuid", "status":"queued" }`. This immediately restricts
the account and hides owned content. `account-deletion-worker` removes personal
database rows, storage objects and Auth identity; external video removal runs through
`media-cleanup`. Failed steps retain durable retry state. Deleting an account does
not cancel Google Play billing: direct the user to Play subscriptions before requesting.
Previously issued signed URLs expire within 10 minutes. No deletion is performed by
the implementation task itself: this endpoint acts only on explicit authenticated requests.

Scheduled workers require POST and `x-cron-secret`. `backend-health` uses the same
secret and returns aggregate queue counts and recent worker failures, with HTTP 503
when work is overdue or a required scheduled worker has no recent successful run.
`job_runs` and `audit_log` are server/admin records; no client can write them.
See the release setup guide for schedules, external credentials and provider tests.
