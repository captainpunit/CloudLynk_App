# Launch checklist (Google Play, India)

What must happen, in order, to put CloudLynk on Google Play. Everything in the code is
built and passes its tests on a local stack; nothing has run against production, Google
Play, Cloudflare or Meta. Written 11 November 2026 for branch `feature/upi-subscriptions`.

## 1. Review and merge

- [ ] Backend owner reviews migrations `20261111000000` (UPI orders), `20261112000000`
      (plan periods), `20261113000000` (Meta events), `20261114000000` (Google Play
      choice) and `20261115000000` (refunds). Earlier backend notes said manual UPI approval was left out on purpose;
      the client has since asked for it.
- [ ] Merge the branch after review.

## 2. Accounts and decisions the client must supply

The full list, with who gets each item and where each value goes, is in
[WHAT_WE_NEED.md](WHAT_WE_NEED.md).

- [ ] **Merchant UPI ID and payee name.** The ID given so far looks personal; banks often
      block or limit personal IDs for app payments.
- [ ] **GST rate** included in the plan prices (default in the database is 18).
- [ ] **Google Play Console** developer account, the app created with package
      `com.cloudlynk.app`, and enrolment in alternative billing (Play Console → Manage
      account → Play apps settings → Monetization settings → Alternative billing). Google
      asks for PCI DSS compliance and a way for users to report fraud.
- [ ] **Google Cloud service account** with Play Developer API access (orders and
      financial data permissions) for `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.
- [ ] **Cloudflare Stream** account: account ID, API token, signing key, customer
      playback host, webhook secret.
- [ ] **Meta**: App ID, client token, dataset ID, Conversions API access token.
- [ ] **Firebase** project for push notifications (`google-services.json`, FCM key).
- [ ] **Web pages** on the client's domain: privacy policy, terms, account deletion
      instructions, and `/.well-known/assetlinks.json` for app links. Drafts of the three
      texts and of the Play listing and Data safety answers are in `docs/store/`; they
      need the business details filled in and a lawyer's review.
- [ ] **Email sending (SMTP)** for the Supabase project. The built-in sender allows only
      a few emails an hour, and password reset depends on email.

## 3. Backend deployment (client's team)

1. Create the production Supabase project. Enable `pg_cron` and `pg_net`.
2. `supabase db push` to apply every migration, then run
   `supabase/scripts/seed-plans.sql` once to create the five plans below.
   In Auth → Email templates → Reset password, paste `supabase/templates/recovery.html`
   (the app resets passwords with the code in that email), and configure SMTP.
3. Set every function secret named in `supabase/.env.example` (Cloudflare including
   the two `STREAM_MAX_*` limits, Google Play, Meta, push, `CRON_SECRET`,
   `ANDROID_PACKAGE_NAME`). The two `RTDN_*` values are only for auto-renewing Play
   subscriptions, which the launch plans do not use.
4. Deploy all functions in `supabase/functions`, including the new
   `verify-play-product`, `play-external-report` and `play-voided-sync`.
5. Add `cron_secret` and `supabase_project_url` to Vault, then run
   `supabase/scripts/schedule-jobs.sql`.
6. Make the first administrator: set `role = 'admin'` on that profile with the service
   role. Use a new password; the one shared in chat earlier must be changed.
7. In the app, Admin → Payments: enter the UPI ID, payee name and GST rate, check
   the five plans below, and switch payments on.
8. Call `backend-health` with the header `x-cron-secret: <CRON_SECRET>` and confirm it
   returns 200.

| Plan ID | Name | Period | Price |
| --- | --- | --- | --- |
| `trial` | Trial | `P2D` | ₹69 |
| `silver` | Silver | `P7D` | ₹129 |
| `gold` | Gold | `P1M` | ₹259 |
| `platinum` | Platinum | `P6M` | ₹599 |
| `diamond` | Diamond | `P1Y` | ₹999 |

## 4. Google Play setup

- [ ] Create five **one-time products** with the same IDs and prices as the plans.
- [ ] Add licence testers. On a test build check both paths of the choice screen:
      Google Play purchase grants Plus; UPI stores the token, and after an admin
      confirms, `play_external_reports` shows `sent`.
- [ ] Data safety form: account details, purchase history, device IDs and app activity
      shared with Meta when the user allows it; videos and files stored.
- [ ] Content rating, target audience, store listing text, screenshots, feature graphic.
- [ ] Account deletion URL (required by Play) pointing at the deletion page.

## 5. App build

Build variables (EAS secrets or `.env`): `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_EAS_PROJECT_ID`, `EXPO_PUBLIC_APP_LINK_HOST`,
`EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`, `META_APP_ID`, `META_CLIENT_TOKEN`.
The `production` profile in `eas.json` turns on the Meta SDK and Google Play's choice
screen. The `direct` profile builds an APK for distribution outside Google Play, with
UPI only; never upload that one to Play.

- [ ] `eas build --platform android --profile production` (signed app bundle; EAS keeps
      the upload key).
- [ ] Upload to the internal track, then a closed test. New personal developer accounts
      need 12 testers for 14 days before production access.

## 6. Check on a real phone before production

- [ ] Creator uploads a real video; it processes and plays (Cloudflare Stream).
- [ ] A UPI payment with a real UPI app, confirmed by an admin from the bank record.
- [ ] Push notification arrives when the payment is confirmed.
- [ ] Meta Events Manager shows the install and, after a confirmed payment, Subscribe.
- [ ] Account deletion completes and removes the account's data.

## Known gaps

- Refunds are full refunds only, and Meta is not told about them. The money itself is
  returned by hand from the bank or UPI app before the payment is marked refunded.
- "Trial" is an ordinary plan and can be bought repeatedly (client's decision).
- Each UPI payment is confirmed by hand from the bank record. A bank or payment
  provider webhook can replace this without changing the app.
- The admin People tab shows names only; two members without a display name look the same.
