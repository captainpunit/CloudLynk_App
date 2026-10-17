# Meta ads tracking

Goal: Meta ads can optimise for **app installs** and **paid subscriptions**,
and report real revenue only.

## Who sends what

| Event | Sent by | Why |
| --- | --- | --- |
| Install, app open | Meta SDK in the app (automatic) | Meta needs device signals for install ads |
| ViewContent (plans), InitiatedCheckout | Meta SDK in the app | Funnel steps, no money involved |
| StartTrial, Subscribe | Server, Conversions API | Sent only after Google Play verifies the purchase |
| Renewal (Subscribe/Purchase) | Server, from Play RTDN | App may not be open when it renews |
| Refund | Not sent as revenue | Avoids false ROAS |

If the app and server ever log the same event, both use the same
`event_id` so Meta counts it once.

## Flow

1. User taps a Meta ad, installs from Play.
2. App reads the Play install referrer and calls `track-install`.
   Meta install ads put encrypted campaign data in `utm_content`; we store it.
3. User buys a plan with Play Billing.
4. App sends the purchase token to `verify-play-receipt`.
5. Server verifies with Google, saves the subscription, acknowledges it,
   and adds a row to `meta_event_outbox`.
6. `meta-capi-dispatch` (runs on a schedule) sends outbox rows to Meta CAPI
   and retries failures.
7. Renewals, cancels and refunds arrive on `play-rtdn-webhook` and update the
   subscription. Renewals are queued for Meta the same way.

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

Meta App ID, Client Token, Dataset ID, CAPI access token (system user),
the Play package name, and Play Console API access for the service account.
