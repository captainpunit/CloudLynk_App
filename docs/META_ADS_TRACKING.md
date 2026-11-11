# Meta ads tracking

Goal: Meta ads can optimise for **app installs** and **paid subscriptions**,
and report real revenue only.

## Who sends what

| Event | Sent by | Why |
| --- | --- | --- |
| Install, app open | Meta SDK in the app (automatic) | Meta needs device signals for install ads |
| ViewContent (plans), InitiatedCheckout | Meta SDK in the app | Funnel steps, no money involved |
| Subscribe (first UPI payment), Purchase (later ones) | Server, Conversions API | Queued in the same transaction in which an administrator confirms the payment; value is the order amount in INR |
| StartTrial, Subscribe | Server, Conversions API | Sent only after Google Play verifies the purchase |
| Renewal (Subscribe/Purchase) | Server, from Play RTDN | App may not be open when it renews |
| Refund | Not sent as revenue | Avoids false ROAS |

If the app and server ever log the same event, both use the same
`event_id` so Meta counts it once.

## Flow

1. User taps a Meta ad, installs from Play.
2. App reads the Play install referrer and calls `track-install` after sign-in,
   with explicit consent (see `api/track-install.md`).
   Meta install ads put encrypted campaign data in `utm_content`; we store it.
3. User buys a plan with Play Billing.
4. App sends the purchase token to `verify-play-receipt`.
5. Server verifies with Google, saves the subscription, acknowledges it,
   and atomically adds a row to `meta_event_outbox` when consent permits.
6. `meta-capi-dispatch` (runs on a schedule) sends outbox rows to Meta CAPI
   and retries failures.
7. Renewals, cancels and refunds arrive on `play-rtdn-webhook` and update the
   subscription. Renewals are queued for Meta the same way.

Dispatch reads the actual processed order total from Google's Orders API,
not the plan's recurring price. Test purchases and refunded orders are excluded.
See `api/subscriptions.md` and `PR3_SETUP.md` for retry behavior, ownership,
scheduled jobs and the remaining provider acceptance checks.

## UPI payments

Migration `20261113000000_upi_meta_events.sql`. The trigger `upi_order_paid_meta_event`
adds one row to `meta_event_outbox` when a UPI order becomes `paid` and the member's
latest `app_installs` row has `tracking_consent`. Event ID `upi-order-<order id>`; value
= `amount_paise / 100`. `meta-capi-dispatch` sends it with the stored value (there is no
Google order to look up) and checks consent again. A rejected payment sends nothing.
There is no refund event; refunds are made from the bank.

## Consent in the app

`AdConsentPrompt` (mounted in `app/_layout.tsx`) asks each signed-in member once, on
Android builds made with `EXPO_PUBLIC_NATIVE_INTEGRATIONS=true`. "Allow" reads the Play
install referrer, starts the Meta SDK and calls `track-install` with the referrer, Meta's
anonymous ID and device details (`extinfo`). "No thanks" records the refusal and the SDK
is never loaded. The same choice is in Settings. On later launches the SDK starts only
for members who allowed it. With the SDK running the app logs `ViewContent` on the Plus
screen and `InitiatedCheckout` when a payment is started; it never logs money events.

Without consent Meta receives nothing, so campaigns optimise on the members who agree.

## Deep links

- App Links: `https://<domain>/open/...` (needs `assetlinks.json` on the domain).
- Custom scheme: `cloudlynk://`.
- Meta deferred deep links: read after first launch (TODO).

## Privacy and policy

- Ask for tracking consent before `initMetaSdk()`. Update Play **Data safety**
  form for Meta SDK data (device ids, app activity, purchases).
- Hash email and user id (SHA-256) before sending to CAPI.
- Privacy policy must mention Meta SDK and ad measurement.

## Client needs to provide

Meta App ID, Client Token, Dataset ID, CAPI access token (system user) — as build
variables `META_APP_ID`, `META_CLIENT_TOKEN` and function secrets `META_DATASET_ID`,
`META_CAPI_ACCESS_TOKEN`, `META_GRAPH_VERSION` —
the Play package name, and Play Console API access for the service account.
