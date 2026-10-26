# PR3 setup and validation

## Local checks

```powershell
npx supabase start
npx supabase migration up --local
npx supabase test db
npx deno task --config supabase/functions/deno.json test
npx deno task --config supabase/functions/deno.json check
```

Tests use fake users/provider payloads and roll back their database fixtures.
They do not call Google or Meta or charge a payment method.

## Configure production

1. Apply migrations through your normal reviewed release process. Populate `plans`
   with the client's exact Play product IDs, billing periods, confirmed quotas and
   benefits, then enable those rows. Checkout prices come from Play Billing. Check
   drive free quota, bucket limit and the Supabase project upload limit separately.
2. Set `.env.example` secrets in the target project, including the Play service
   account with permission to verify/acknowledge purchases and read orders. Set
   `RTDN_SERVICE_ACCOUNT_EMAIL` to the account used for Pub/Sub push authentication.
   Keep `META_TEST_EVENT_CODE` only for staging. Do not expose these in the app.
3. Deploy `verify-play-receipt`, `play-rtdn-webhook`, `track-install`,
   `subscription-reconcile`, `meta-capi-dispatch` and `drive-cleanup`.
4. Enable Play RTDN to a Pub/Sub topic. Create an authenticated wrapped push
   subscription to the deployed webhook with the configured audience and service
   account; grant the Pub/Sub service agent token-creator access. Configure retry
   and dead-letter handling. Send a Play Console test notification.
5. Enable `pg_cron`, `pg_net` and Vault. Store `CRON_SECRET` as `cron_secret`.
   Use the SQL below for PR3 jobs and the existing drive contract for drive cleanup.
6. Mobile integration: pass `profiles.play_account_id` to Play Billing as the
   obfuscated account ID; submit every purchase/restore token to verification;
   send install attribution after sign-in with explicit consent and device info.

```sql
-- Replace <project-ref>; never embed the actual secret in a migration.
select cron.schedule('subscription-reconcile', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/subscription-reconcile',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);
select cron.schedule('meta-capi-dispatch', '* * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/meta-capi-dispatch',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);
```

## Provider acceptance checks before launch

- Play license tester: pending purchase, trial, paid purchase, acknowledgement,
  restore on the original account, rejected restore on another account, renewal,
  grace, hold, cancellation, expiry, replacement and refund/revocation.
- Duplicate and delayed Pub/Sub messages preserve correct entitlement and do not
  create duplicate conversion IDs. Invalid audience/email/signature is rejected.
- Disconnect Google and Meta temporarily: purchased access is not extended past
  expiry, verification can retry, and conversion backlog drains after recovery.
- Confirm actual amount/currency in Events Manager using staging test events;
  test purchases are excluded automatically, so use a controlled real transaction
  for final revenue acceptance. Do not send historical restores as new revenue.
- Without consent and after withdrawal, no conversion is sent. Check app privacy
  disclosures and validate complete Android `extinfo` with Meta's current schema.
- Alert on unprocessed payment events, `subscriptions.sync_error`, overdue
  `next_check_at`, queued/failed outbox rows, function failures, and cron HTTP results.

Reference APIs: [Google subscription resource](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2),
[acknowledgement](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions/acknowledge),
[Orders API](https://developers.google.com/android-publisher/api-ref/rest/v3/orders),
[authenticated Pub/Sub push](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions).
