# UPI subscription payments

Migrations `20261111000000_upi_subscriptions.sql` and `20261112000000_flexible_plan_periods.sql`. Implemented and tested on the local
stack; nothing is deployed and no real payee, plan or price is seeded.

Plus is sold for a fixed period and paid by UPI intent. A period is an ISO 8601 duration
in days, months or one year (`P2D`, `P7D`, `P1M`, `P6M`, `P1Y`; rule: `valid_plan_period`). It
does not renew by itself: the member pays again, and paying early adds to the time left.
One subscription unlocks every paid channel (the existing `access_decision` rule).

## How a payment becomes access

```
member                      backend                         administrator
  │  create_upi_order(plan) ──▶ order `created` + upi://pay link
  │  opens UPI app, pays
  │  submit_upi_payment(utr) ─▶ order `submitted` ──────────▶ review queue
  │                                                          finds UTR + amount in the bank statement
  │                            order `paid`, subscriptions ◀─ decide_upi_order(approve)
  │  ◀── notice + push         row inserted, audit_log
```

A `upi://pay` intent has no server callback, and whatever the UPI app returns to the
phone can be forged. The app is therefore never trusted about money: **only an
administrator's confirmation grants access**. Confirmation inserts a normal
`subscriptions` row (`provider='upi'`, `status='active'`, `paid_until` = later of now and
the current end date, plus the period), so access checks, signed playback expiry and
storage quota work unchanged. `next_check_at='infinity'` keeps `subscription-reconcile`
(Google Play) from ever selecting these rows.

If the merchant bank or a PSP later provides a webhook or status API, it can confirm
orders automatically by calling the same grant path with the order `reference` (sent as
`tr` in the link). The app and the tables do not change.

## Tables

`plans.price_paise` (integer, nullable): the price. A plan can be bought only when it is
`active` and priced. Guests and members read active plans; administrators read all.

`payment_settings` (one row): `upi_vpa`, `payee_name`, `merchant_code` (optional 4-digit
MCC), `upi_enabled`. Readable by administrators only; written through
`save_payment_settings`.

`upi_orders`: one row per payment attempt. It stores the plan name, period, amount, payee
and full `pay_uri` it was issued with, so later plan or payee edits never change an
existing order. `status`: `created` → `submitted` → `paid` | `rejected`; `created` lapses
to `expired` after one day. Members read their own orders, administrators read all, and
nobody writes the table directly.

Limits enforced in the database:

- one `created` and one `submitted` order per member (partial unique indexes), so the
  review queue cannot be flooded;
- a UTR can be attached to one `submitted`/`paid` order only (`utr_already_used`);
- 10 orders per member per day (`too_many_orders`), 3 UTR reports per order
  (`too_many_attempts`);
- a payment can be reported for 7 days after the order was created, including on an
  order that lapsed or was replaced before the member came back from the UPI app.

## Member calls

| Call | Result |
| --- | --- |
| `rpc('create_upi_order', { p_product_id })` | The order row. Repeating the call for the same offer returns the same open order. Choosing another plan closes the previous open order. |
| `rpc('submit_upi_payment', { p_order_id, p_utr })` | The order, now `submitted`. Spaces in the UTR are ignored; repeating the same UTR is not a new attempt. |
| `from('upi_orders').select('*').eq('user_id', id)` | Own orders (status, `decision_reason` after a rejection). |

Open `pay_uri` with `Linking.openURL`. Its shape is
`upi://pay?pa=<vpa>&pn=<payee>&mc=<mcc>&tr=<reference>&tn=<plan>&am=<rupees.paise>&cu=INR`.

Errors: `sign_in_required`, `account_restricted`, `payments_unavailable` (no payee set or
payments paused), `plan_unavailable`, `payment_in_review`, `too_many_orders`,
`invalid_utr`, `order_not_found`, `order_closed`, `too_many_attempts`, `utr_already_used`.

## Administrator calls

| Call | Result |
| --- | --- |
| `from('upi_orders').select('*, profiles(display_name)').eq('status','submitted').order('submitted_at')` | Review queue, oldest first. Page with `.range()`. |
| `rpc('decide_upi_order', { p_order_id, p_action: 'approve' \| 'reject', p_reason })` | Confirms (grants Plus) or rejects (reason required, shown to the member). Writes `audit_log` and sends an inbox notice and push. A decided order cannot be decided again (`order_not_pending`). |
| `rpc('save_payment_settings', { p_upi_vpa, p_payee_name, p_merchant_code?, p_enabled? })` | Sets the payee. Audited. |
| `rpc('save_plan', { p_product_id, p_name, p_billing_period, p_price_paise, p_quota_bytes, p_active })` | Creates or updates a plan. Audited. Retire a plan with `p_active=false`; do not delete it. |

Errors: `admin_required`, `reason_required`, `invalid_action`, `order_not_found`,
`order_not_pending`, `invalid_upi_address`, `invalid_payee_name`, `invalid_merchant_code`,
`invalid_plan_id`, `invalid_plan_name`, `invalid_billing_period`, `invalid_price`,
`invalid_quota`.

## Operations

- `backend_health` reports `unreviewed_upi_payments`: payments reported more than a day
  ago and still undecided. A non-zero value makes the health check return 503.
- `prune_operational_records` (already run by `account-deletion-worker`) lapses unpaid
  orders and removes ones older than 30 days that never carried a UTR.
- Orders, subscriptions and notices are removed with the account. The audit record of a
  decision is kept without the member's name.

## What the business must do

- Use a **merchant** UPI ID from a bank or UPI business app. Personal IDs are often
  blocked or limited for app-initiated payments.
- Check the bank statement for each reported UTR and exact amount before confirming.
  This is manual work that grows with the number of subscribers; a bank or PSP webhook
  removes it.
- Refunds are made from the bank or UPI app; there is no refund call. To end access
  early, set the subscription's `paid_until` or `status` with the service role.

## Launch plans (from the client, 11 November 2026)

| Plan ID | Name | Period | Price |
| --- | --- | --- | --- |
| `trial` | Trial | `P2D` | ₹69 |
| `silver` | Silver | `P7D` | ₹129 |
| `gold` | Gold | `P1M` | ₹259 |
| `platinum` | Platinum | `P6M` | ₹599 |
| `diamond` | Diamond | `P1Y` | ₹999 |

Enter them, and the UPI ID, in the app under Admin → Payments after deployment (each
change is audited). No plan includes extra storage (`quota_bytes = 0`), so members keep
the free quota. "Trial" is an ordinary plan: nothing stops a member buying it again.

## Google Play: alternative billing in India

The client intends to enrol in Google's alternative billing programme for India. Per
Google's programme page (read 11 November 2026; confirm in the Play Console):

- The alternative system is offered **alongside** Google Play's billing, not instead of
  it. Google Play renders a choice screen through the alternative billing APIs, so the
  app must integrate the Play Billing Library and sell the same plans as Play products.
- Every alternative-billing payment by a user in India must be **reported to Google
  within 24 hours** through the APIs. Google still charges its service fee on those
  payments, reduced by 4 percentage points.
- The developer certifies **PCI DSS** compliance and gives users a way to report
  fraudulent transactions.
- Enrolment: Play Console → Manage account → Play apps settings → Monetization
  settings → Alternative billing.

**How this codebase meets it** (migration `20261114000000_play_user_choice_billing.sql`;
built and tested locally, not yet run against Google):

- The Google Play build (`EXPO_PUBLIC_PLAY_BILLING=true`) opens Google's choice screen
  when a member subscribes (`services/billing/play-choice.ts`, expo-iap user choice
  billing). Plans are sold on Play as **one-time products** whose product IDs equal the
  plan IDs, because Play's prepaid subscription lengths do not include 2 days.
- **Google Play chosen:** the app sends the purchase token to `verify-play-product`,
  which confirms it with Google, checks it belongs to the account, grants the plan
  period (`grant_play_product`, provider `google_play_product`) and consumes the
  purchase so the plan can be bought again.
- **UPI chosen:** Google returns an external transaction token. The member picks their
  state (Google needs it for GST), and `attach_play_choice` stores both on the order.
  When an administrator confirms the payment, a trigger queues a row in
  `play_external_reports`; `play-external-report` (every 5 minutes) sends it to
  `externaltransactions.createexternaltransaction` as a one-time transaction with the
  pre-tax and GST amounts, and retries failures.
- GST rate: `payment_settings.tax_percent` (default 18), set in Admin → Payments → UPI
  details. Confirm the rate with the client's accountant.
- A build without the flag (for distribution outside Play) keeps the direct UPI checkout
  and reports nothing.

Not covered: refunds are not reported to Google (`refundexternaltransaction`) and Play
refunds/chargebacks of one-time products do not end access automatically; both need a
manual step until built. The 24-hour limit runs from the payment, so payments must be
confirmed within a day (`backend_health` already flags older ones). PCI DSS
certification is the client's responsibility.

Sources: <https://support.google.com/googleplay/android-developer/answer/13306652>,
<https://developer.android.com/google/play/billing/alternative/backend>

## Tests

`supabase/tests/database/upi_payments.test.sql` (75 assertions: permissions, limits, both
decisions, renewal stacking, monitoring, erasure) and the UPI block in
`mobile/scripts/check-live-api.ts` (15 assertions over HTTP with real sessions);
`play_user_choice.test.sql` (25) and `upi_meta_events.test.sql` (9);
`supabase/tests/functions/play_choice_test.ts`.
