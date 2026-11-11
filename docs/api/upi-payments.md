# UPI subscription payments

Migration `20261111000000_upi_subscriptions.sql`. Implemented and tested on the local
stack; nothing is deployed and no real payee, plan or price is seeded.

Plus is sold for a fixed period (`P1M`, `P3M`, `P6M`, `P1Y`) and paid by UPI intent. It
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
- Google Play requires Play Billing for digital subscriptions sold inside apps
  distributed on Play, with a separate enrolment programme for alternative billing in
  India. An app whose only payment method is UPI needs that enrolment or distribution
  outside Play. Confirm the current policy with the Play Console before submitting.

## Tests

`supabase/tests/database/upi_payments.test.sql` (70 assertions: permissions, limits, both
decisions, renewal stacking, monitoring, erasure) and the UPI block in
`mobile/scripts/check-live-api.ts` (15 assertions over HTTP with real sessions).
