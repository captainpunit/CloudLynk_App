# What we still need before CloudLynk can go live

The code is finished and tested on a local backend. Going live is blocked only by the
accounts and details below. Each row says who has to get it and where the value goes.
The order of work is in [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md).

Status on 12 November 2026: **only Cloudflare exists** (held by the team). Everything
else is still to be created.

**Never put a secret in git, in chat or in the app.** Server secrets go in
`supabase secrets set --env-file supabase/.env` (names in `supabase/.env.example`).
Build values go in EAS secrets (names in `mobile/.env.example`).

## 1. Accounts to create

| # | Account | Who | Cost and time | Status |
| --- | --- | --- | --- | --- |
| 1 | Supabase production project (Pro plan advised: backups, no pausing) | Team | about $25 a month | Needed |
| 2 | Cloudflare with Stream enabled | Team | Stream is paid by minutes stored and watched | **Have** |
| 3 | Google Play Console developer account | Owner | $25 once; identity check takes days. A personal account must run a closed test with 12 testers for 14 days before production. An organisation account skips that but needs a D-U-N-S number. | Needed |
| 4 | Google Cloud project linked to Play Console, with a service account | Team | free | Needed |
| 5 | Meta Business account, Meta app and dataset (pixel) | Owner or marketing | free | Needed |
| 6 | Firebase project (push notifications) | Team | free | Needed |
| 7 | Expo (EAS) account for building the app | Team | free tier is enough to start | Needed |
| 8 | Email sending service (SMTP), for example Resend, with a verified domain | Team | free tier to start | Needed |
| 9 | A domain with a small website | Owner | domain price | Needed |
| 10 | Merchant (business) UPI ID | Owner, from the bank | bank dependent | Needed |

## 2. Values from each account and where they go

### Supabase (team)

| Value | Goes to |
| --- | --- |
| Project URL | EAS: `EXPO_PUBLIC_SUPABASE_URL`; Vault: `supabase_project_url` |
| Anon (publishable) key | EAS: `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| A long random string you generate | Function secret `CRON_SECRET` and Vault `cron_secret` |
| Service role key | Stays in Supabase. Never in the app or in git. |
| Package name `com.cloudlynk.app` | Function secret `ANDROID_PACKAGE_NAME` |

My cloud files are kept in Supabase Storage (bucket `user-files`, created by the
migrations), not in Cloudflare.

Also in the dashboard: enable `pg_cron` and `pg_net`; Auth → SMTP settings; Auth →
Email templates → Reset password = `supabase/templates/recovery.html`.

### Cloudflare Stream (team, account exists)

| Value | Function secret |
| --- | --- |
| Account ID | `CLOUDFLARE_ACCOUNT_ID` |
| API token with Stream edit permission | `CLOUDFLARE_STREAM_API_TOKEN` |
| Stream signing key ID and its JWK (base64) from the keys API | `CLOUDFLARE_STREAM_SIGNING_KEY_ID`, `CLOUDFLARE_STREAM_SIGNING_JWK_BASE64` |
| Playback host, like `customer-xxxx.cloudflarestream.com` | `CLOUDFLARE_STREAM_PLAYBACK_HOST` |
| Webhook secret, after pointing the Stream webhook at the `stream-webhook` function | `CLOUDFLARE_STREAM_WEBHOOK_SECRET` |
| Largest upload and longest video allowed (defaults: 10 GB, 4 hours) | `STREAM_MAX_UPLOAD_BYTES`, `STREAM_MAX_DURATION_SECONDS` (both required) |

### Google Play (owner creates the account, team does the setup)

| Step or value | Goes to |
| --- | --- |
| Create the app with package `com.cloudlynk.app` | Play Console |
| Enrol in alternative billing (user choice billing) for India | Play Console → Monetization settings |
| Five one-time products: `trial` ₹69, `silver` ₹129, `gold` ₹259, `platinum` ₹599, `diamond` ₹999 | Play Console → Products |
| Service account JSON key, invited in Play Console with "View financial data" and "Manage orders and subscriptions" | Function secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` |
| Licence tester emails | Play Console → Licence testing |
| SHA-256 of the app signing key | `assetlinks.json` on the website |

### Meta (owner or marketing)

| Value | Goes to |
| --- | --- |
| App ID | EAS: `META_APP_ID` |
| Client token | EAS: `META_CLIENT_TOKEN` |
| Dataset (pixel) ID | Function secret `META_DATASET_ID` |
| Conversions API access token | Function secret `META_CAPI_ACCESS_TOKEN` |
| Graph API version, for example `v21.0` | Function secret `META_GRAPH_VERSION` |

In the Meta app, add the Android platform with package `com.cloudlynk.app` and the key
hash of the Play signing key.

### Firebase and Expo (team)

| Value | Goes to |
| --- | --- |
| `google-services.json` for package `com.cloudlynk.app` | EAS file secret named `GOOGLE_SERVICES_JSON`; do not commit |
| FCM v1 service account key | Uploaded to EAS credentials (push) |
| EAS project ID | EAS: `EXPO_PUBLIC_EAS_PROJECT_ID` |
| Expo access token (optional, for push security) | Function secret `EXPO_ACCESS_TOKEN` |

### Website (owner)

Four public https addresses on the domain:

| Page | Draft text | Goes to |
| --- | --- | --- |
| Privacy policy | `docs/store/privacy-policy.md` | EAS: `EXPO_PUBLIC_PRIVACY_URL`; Play listing |
| Terms | `docs/store/terms.md` | EAS: `EXPO_PUBLIC_TERMS_URL` |
| Account deletion instructions | `docs/store/account-deletion.md` | Play Console → Data safety |
| `/.well-known/assetlinks.json` | generated from the signing key | App links (`EXPO_PUBLIC_APP_LINK_HOST`) |

## 3. Details and decisions from the owner

- [ ] Merchant UPI ID and the payee name shown in UPI apps. The ID shared so far looks
      personal; banks limit or block personal IDs that collect app payments.
- [ ] GST: is the business registered, and what rate is included in the prices (the
      database default is 18%)?
- [ ] Legal business name, address, support email and phone, grievance officer name
      (Indian IT rules). These fill the `[brackets]` in `docs/store/`.
- [ ] A lawyer's review of the privacy policy and terms.
- [ ] Who is the first administrator (email). They sign up in the app, then the team
      sets `role = 'admin'` on that profile.
- [ ] Should new accounts confirm their email before signing in? (Off now.)
- [ ] Store listing: app icon 512 px, feature graphic 1024×500, at least four phone
      screenshots, short and full description (draft in `docs/store/play-listing.md`).

## 4. What happens once these exist

1. Team deploys the backend: [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) section 3.
2. Team builds the app: `eas build --platform android --profile production`.
3. Upload to Play's internal track, then test on a real phone: video upload and
   playback, a real UPI payment, a Play purchase, a refund, push, account deletion.
4. Closed test (12 testers for 14 days on a personal account), then production.
