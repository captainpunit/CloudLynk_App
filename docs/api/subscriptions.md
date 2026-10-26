# Subscriptions and plans (PR3)

Implemented locally; production requires Play Console products, secrets, authenticated
Pub/Sub, deployed functions and scheduled jobs. No production products or prices are seeded.

## Plans

Read `supabase.from("plans").select("product_id,name,billing_period,quota_bytes,benefits")`.
Guests and signed-in users see active plans only. `billing_period` is ISO 8601
(`P1M`, `P3M`, `P6M`, `P1Y`). Prices, localized currency, base plan and offer tokens
come from Google Play Billing product details, never from a hardcoded backend price.
Backend `product_id` must match the Play subscription product. All base plans of
one product share its quota; create different products for different storage tiers.
The same plan row remains after retirement (`active=false`) so existing purchases
can reconcile and restore. Single-item subscriptions are supported; add-ons are rejected.

## Associate purchases with an account

Before opening Billing, read the signed-in profile's `play_account_id` (SHA-256 of
the lowercase user UUID) and pass it as Play Billing's **obfuscated account ID**.
The server checks Google's returned `obfuscatedExternalAccountId`. An unclaimed
token without a verified account association is rejected; knowing a token alone
never lets someone claim another user's purchase. Reuse the same account ID for
purchase, restore and plan changes. Account deletion does not transfer old purchases.

## POST `/functions/v1/verify-play-receipt`

Authenticated Supabase bearer token required. Uses the shared purchase access rule.

```json
{"productId":"your_play_product","purchaseToken":"token_from_play_billing"}
```

```json
{"status":"active","expiresAt":"2026-11-26T12:00:00.000Z","productId":"your_play_product","isTrial":false}
```

Restore sends each token returned by Play through the same endpoint. Tokens are
bound to an immutable owner. Verification, RTDN and reconciliation share a per-token
lease; retries and parallel requests cannot duplicate an outbox event. Active
replacement tokens retire the previous entitlement; pending replacements preserve it.

Status: `pending`, `active`, `in_grace`, `on_hold`, `cancelled`, `expired`, `refunded`
(the last remains compatible with existing administrative records). Google paused
subscriptions map to `on_hold`; provider-revoked/expired purchases map to `expired`.
Cancellation keeps access until `expiresAt`. No access for pending, held or expired
purchases. All paid states additionally require a future expiry in the shared policy.
The server commits entitlement before acknowledging a purchase; acknowledgement
failures return 503 and safely retry on verification, RTDN or reconciliation.

| HTTP | `error` | App behavior |
| --- | --- | --- |
| 400 | `invalid_json`, `invalid_request`, `product_mismatch`, `unknown_product`, `unsupported_subscription_items`, `invalid_purchase` | Correct input; unsupported/retired new products cannot be bought |
| 401 | `sign_in_required` | Sign in |
| 403 | `account_restricted`, `purchase_owner_mismatch` | Show restriction or switch to original account |
| 409 | `purchase_owner_missing` | Billing must supply the account ID; retain token for support/retry |
| 409 | `subscription_sync_busy` | Retry with backoff |
| 413 | `request_too_large` | Correct input |
| 503 | `temporarily_unavailable` | Retain purchase token and retry; never unlock locally |

405 rejects non-POST requests. Never log purchase tokens on the client.

## POST `/functions/v1/play-rtdn-webhook`

Google Pub/Sub wrapped push envelope (`message.messageId`, base64 `message.data`).
Verifies Google's signature, issuer, expiry, audience, and the exact configured
verified service-account email. Notification package must match the server package.
Subscription and voided-purchase notifications trigger a fresh provider lookup;
notification order is never used as entitlement truth. Test notifications return
success. Message IDs deduplicate processing; failed processing is left unprocessed
and returns a non-2xx response so Pub/Sub retries. Configure a Pub/Sub dead-letter
topic for malformed or permanently unresolvable messages.

## Scheduled endpoints

`subscription-reconcile` and `meta-capi-dispatch`: POST with `x-cron-secret`.
Reconciliation processes up to 20 due purchases per run, normally every six hours
per purchase; failures retry after 30 minutes. Expiry checks never extend access
when Google is unavailable. Monitor backlog and increase run frequency as needed.

Meta delivery claims up to 10 events per run with a three-minute lease. It uses a
stable event ID per successful order (including renewals), or per trial token.
It fetches **actual processed order totals** from Google's Orders API at dispatch;
pending, partially refunded, refunded, canceled and test purchases are not revenue.
Plan recurring prices are never used as transaction values. Trials carry no revenue.
Events older than seven days are skipped rather than redated on restore. Consent
is checked when queuing and sending. Failed deliveries back off and become `failed`
after ten attempts. Monitor and manually replay corrected failures by setting
`status='queued', attempts=0, next_attempt_at=now(), lease_id=null, lease_until=null`.
`sent` means delivered or intentionally skipped (e.g. withdrawn consent or refund).

Meta delivery is at least once. A timeout after successful receipt may resend the
same stable event ID; Meta deduplicates it. Initial purchase and renewal events use
`Subscribe`. If the mobile SDK also emits these events, use the same server event
IDs; by default the app should emit only funnel events, as described in tracking docs.
