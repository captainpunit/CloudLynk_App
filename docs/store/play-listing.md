# Google Play listing and declarations

Draft text and answers for Play Console. Anything in `[brackets]` is the client's to fill.

## Store listing

**App name (30):** CloudLynk

**Short description (80):**
Watch channels from creators you follow. One Plus plan opens every paid channel.

**Full description (4000):**

CloudLynk is a home for video channels. Follow the creators you like, watch on your
phone, and pick up where you stopped.

Watch
- Browse free and Plus channels, and join the ones you like
- Smooth streaming that adapts to your connection
- Continue watching from where you left off
- Save videos to your library

Plus
- One plan opens every paid channel
- Choose the length that suits you: 2 days, 7 days, 1 month, 6 months or 1 year
- Plans do not renew by themselves; pay again only when you want to
- Pay with Google Play or UPI

Create
- Apply to become a creator, set up your channel and upload videos
- Every channel and video is reviewed before it goes public

My cloud
- Private storage for your own files

Your account
- Notifications when a payment is confirmed or your video is approved
- Delete your account at any time from Settings

**Category:** Entertainment (alternative: Video Players & Editors)
**Tags:** video, streaming, creators
**Contact email:** [support email] · **Website:** [url] · **Privacy policy:** [url]

**Graphics needed:** icon 512×512 (export `mobile/assets/icon.png`), feature graphic
1024×500, at least 4 phone screenshots (Home, a channel, the player, Plus plans).

## App content declarations

| Section | Answer |
| --- | --- |
| Privacy policy | URL of `privacy-policy.md` once published |
| Ads | **No** — the app shows no advertisements (it is advertised, which is different) |
| App access | Parts are restricted. Give reviewers a test login with Plus active: [email / password created for review only] |
| Target audience | 18 and over |
| News app | No |
| Financial features | None |
| Government app | No |
| Data safety → delete account URL | URL of `account-deletion.md` once published |

**Content rating questionnaire:** category "Entertainment / streaming". The app shows
user-generated video that is moderated before publication; users can report content;
answer the violence/sexuality/language questions for the content the client intends to
allow. If any channel will carry mature content, say so here — a wrong answer is a
common reason for removal.

**User-generated content policy:** the app meets Play's requirements: terms that define
prohibited content, in-app reporting, review before publication, and the ability to
remove content and block accounts.

## Data safety form

Data is encrypted in transit: **Yes**. Users can request deletion: **Yes**.

| Data type | Collected | Shared | Purpose | Required |
| --- | --- | --- | --- | --- |
| Email address | Yes | No | Account management | Required |
| Name (display name) | Yes | No | Account management, app functionality | Required |
| User IDs | Yes | Yes (Meta, with consent) | Account management; advertising measurement | Required / optional for Meta |
| Purchase history | Yes | Yes (Meta, with consent: value and time only) | App functionality; advertising measurement | Required for purchases |
| Other financial info (UPI reference number) | Yes | No | App functionality (confirming payment) | Required for UPI |
| Approximate location (state, UPI in Play build only) | Yes | Yes (Google, tax reporting) | Legal compliance | Required for UPI in the Play build |
| Videos | Yes | No | App functionality | Optional (creators) |
| Files and docs | Yes | No | App functionality | Optional |
| App interactions (watch progress, events) | Yes | Yes (Meta, with consent) | App functionality; advertising measurement | Required / optional for Meta |
| Device or other IDs (advertising ID, push token) | Yes | Yes (Meta, with consent) | Notifications; advertising measurement | Optional |
| Diagnostics | No | — | — | — |

"Shared with Meta" applies only after the user taps **Allow** on the ad measurement
question; say so in the form's optional notes.

## Advertising ID declaration

The Play build uses the advertising ID (Meta SDK) for **advertising or marketing
measurement**. Declare "Yes, uses advertising ID" with purpose "Analytics / Advertising".

## Payments declaration

Enrol the app in **user choice billing** for India before release (Play Console →
Monetisation setup → Alternative billing). Create the five one-time products with the IDs
`trial`, `silver`, `gold`, `platinum`, `diamond` and prices matching the plans.
