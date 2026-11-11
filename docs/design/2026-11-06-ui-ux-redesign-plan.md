# CloudLynk UI/UX redesign: study, research and plan

Status: **plan for review, revision 3.** No app code changes until the decisions in section 9 are settled.

## 0. The product in one paragraph (revision 3, from the owner)

People make **channels** and **upload videos** to them. An **admin approves** each channel before it goes live, and the admin can mark a channel **paid**. Viewers watch free channels freely and watch paid channels **after subscribing, paying by UPI intent** (the phone's UPI apps such as GPay, PhonePe or Paytm open to complete the payment).

How this compares with the backend on `main` today:

| Product rule | Backend today | Gap |
|---|---|---|
| People create channels and upload videos | Yes, but only users an admin has granted publishing permission (`can_publish`) | **Decided 11 Nov:** only creators an admin approves, as the backend does |
| Admin approves a channel before it is live | Yes: channels start as drafts; `moderate_content` publishes them | None |
| Admin makes a channel paid | Yes: the admin picks public, premium (paid) or private when publishing | None |
| Each video is also reviewed | Yes: every title goes through admin review before it is live | Confirm this is wanted |
| Pay by **UPI intent** | **Built 11 Nov** on `feature/upi-subscriptions`: UPI intent, member reports the UTR, an admin confirms it (`docs/api/upi-payments.md`). Google Play billing is removed from the app | A bank or PSP webhook would remove the manual confirmation |
| What a subscription covers | One subscription unlocks **all** paid channels | **Decided 11 Nov:** one subscription for all paid channels |

**Google Play and UPI.** Apps on Google Play must normally sell digital subscriptions through Play Billing. In India, Google's user choice billing lets developers offer another payment system **alongside** Play Billing after enrolling, with Google's fee reduced by 4% [10]. So UPI inside a Play Store app is possible only through that programme, or by distributing the app outside Play. The current status of the programme should be confirmed with Google before building.

The rest of this plan (written for revision 2) still applies: the app is for watching channels, and paying is the main gate. Where it says "Plus" or "Google Play", read "subscription" and the payment method decided in section 9.

Revision 2 follows your direction: **CloudLynk is mainly for watching videos from channels, and most of those channels need a subscription.** The whole plan is now organised around that one job. Cloud storage becomes a secondary benefit.

## 1. What CloudLynk is

| Part | Role | Backend that already exists |
|---|---|---|
| **Watch** (core) | Find channels, open titles, play movies, series and episodes, resume, save | `channels`, `titles`, `seasons`, `my_access`, signed Cloudflare playback, `save_watch_progress`, `set_saved_title` |
| **Plus** (core) | The subscription that unlocks Plus channels | `plans`, Google Play billing, `verify-play-receipt`, `has_active_subscription` |
| **Create** | Owners publish channels and titles for review | `submit_channel`, `save_title`, `generate-stream-upload`, `submit_title_review` |
| **Cloud** (secondary) | Private file storage; Plus raises the quota | `files`, `my_drive_usage`, TUS upload |
| **Run** | Admin review, reports, notices | `moderate_content`, `send_notice` |

### 1.1 How access works today (from `access_decision`)

- **One Plus subscription unlocks every Plus channel.** There is no per-channel subscription in the backend.
- **Every watch needs sign-in**, even on free channels.
- **Every watch also needs the viewer to have joined the channel** (`membership_required`), even after paying for Plus.
- **There is no free preview:** no trailers, free episodes or sample minutes.

So a new viewer arriving from an ad or a shared link hits **four gates before the first frame plays: sign in → subscribe → join → play.** Each is a separate screen or tap today. Cutting these gates is the single biggest UX win available.

## 2. Who it is for (assumptions to confirm)

- **Viewers** are almost everyone: Android, likely India-first (₹ pricing, Google Play only), often arriving signed out from Meta ads or shared links (`/open/watch/<id>`, `/open/channel/<id>`).
- **Creators** are few: they need publishing to feel trustworthy.
- **Admins** are internal staff.

## 3. What is wrong with the current UI (audit)

Ranked by how much each hurts watching and subscribing.

1. **The subscription is an afterthought.** Plus appears as a small sparkle icon, a promo card at the bottom of Explore and a "Explore Plus" button. Locked titles just show a lock and one sentence. Nothing shows what a subscriber gets.
2. **Four gates to the first play** (section 1.1), each a separate step with its own screen.
3. **Storage gets equal billing.** "My cloud" is one of five tabs, although it is a side benefit.
4. **Overlapping tabs.** Explore, My feed and Channels all list videos or channels.
5. **Titles are thin.** Cards show a cover and a type label. There is no title page with season list, description, channel and a clear primary action; the watch screen doubles as the title page.
6. **The plan screen is a list of buttons** with a ✓ inside the label ([live-billing.tsx](../../mobile/src/features/premium/live-billing.tsx)).
7. **Generic look and voice.** Teal + gold, default type, rounded cards everywhere, whimsical titles ("Your little corner.") that say nothing.
8. **Developer-shaped forms.** Date of birth is typed as `YYYY-MM-DD` (and it gates age-rated titles); private-channel invites need a raw user UUID.
9. **Creator, Cloud and Admin screens are stacks of buttons and labels.**
10. **Platform gaps.** No edge-to-edge handling, no dark theme for video, no tablet layout, no data-saving option, no localisation.

## 4. Research findings

### 4.1 Google Play subscription rules (the most important constraint now)

From the Google Play Subscriptions policy [1]:

- Show **price, billing period, automatic renewal terms and what is included** on the plan screen, with no extra step.
- Benefits must be **truthful and accurate**. The app already builds Plus text from the `plans` table and the catalogue; keep that.
- Annual plans must **not** lead with a monthly-equivalent price.
- The **close control must be clearly visible**; don't chain screens that lead to accidental subscribes.
- Explain **how to manage or cancel**, and localise prices and terms.

### 4.2 What makes people subscribe to a video service

- In India, people are **wary of free trials that become recurring charges** and resist long sign-up; phone/OTP login is preferred [2].
- The most-wanted streaming features there are **offline downloads, mobile access and lower data use** [3]; MX Player added a data-saver mode for this [4].
- Patreon's 2023 redesign organised the app **by creator rather than an endless feed** [5], which fits channel-first browsing.
- Without a trailer or free episode, the title page itself must sell: cover, description, season/episode list, channel and a clear "what you get with Plus".

### 4.3 Android platform

From the Android 16 behaviour changes [6]: **edge-to-edge is mandatory**, **predictive back** is on by default, and **large screens** ignore orientation locks, so layouts must adapt. Material 3 Expressive [7] is Google's current direction (bolder shape, colour and motion); we borrow its principles, not stock Material.

### 4.4 Navigation

Bottom navigation should have **three to five** destinations, with secondary items inside primary screens [8].

### 4.5 Device and network reality

Budget phones with limited RAM and patchy data are common [9]. Test on a budget device on a slow network; keep images small; never autoplay on cellular.

## 5. Design principles

1. **Content first.** Covers, titles and channels fill the screen; chrome stays out of the way. Video screens are dark.
2. **Subscribe once, watch everything.** Plus is presented as all-access to every Plus channel, with the real count of channels and titles.
3. **Fewest gates to the first play.** Sign-in, subscription and joining happen inline, in the flow, and return the viewer to the title they wanted.
4. **Honest money.** Every Plus surface states price, period, renewal and cancellation, straight from Play and the `plans` table.
5. **Light on data and phones.** Small images, no autoplay on cellular, a data-saver setting, holds at 200% font size.

## 6. Proposed experience

### 6.1 Navigation (4 tabs)

| Tab | Contains |
|---|---|
| **Home** | Continue watching, new from your channels, featured Plus titles, categories |
| **Channels** | Browse by category, search, joined channels, private invitations |
| **Library** | Saved titles, watch history, (later) downloads |
| **You** | Plus status and plans, notices, settings, My cloud, creator studio, admin |

Cloud moves into **You → My cloud** and is listed as a Plus benefit. Creator and admin tools live under You, shown only to people who have them.

### 6.2 The path to the first play

```
Ad / shared link / Home
        │
   Title page ── cover, description, episodes, channel, "Included with Plus"
        │  tap Play
        ├─ signed out ──► sign-in sheet ──► back to the title
        ├─ no Plus ─────► plan sheet (price, period, renewal, cancel) ──► Play purchase ──► back to the title
        ├─ not joined ──► join automatically (or one confirm tap) ──► play
        └─ allowed ─────► player
```

All gates are **sheets over the title page**, never separate screens that lose the viewer's place. Whether joining happens automatically is decision 3.

### 6.3 Screen priorities

| Priority | Screens | Key change |
|---|---|---|
| P0 | Home, title page, player, series/episodes | Content-first, dark watch experience; one primary action |
| P0 | Plan sheet and Plus page, sign-in sheet | Policy-compliant, inline, returns to the title |
| P0 | Channel page, locked states | Shows what Plus unlocks; one "Subscribe to watch" action |
| P1 | Channels browse/search, Library, deep-link landing | Channel-first browsing |
| P1 | Settings, date-of-birth picker, account deletion | Plain forms |
| P2 | My cloud, upload, creator studio, admin, report, notices | Proper lists, progress and publishing tracker |
| P2 | Empty, offline, error and loading states | One pattern each |

### 6.4 Visual direction

The Figma concept built earlier (<https://www.figma.com/design/LAdBQv80lhM5G9spYomdeJ>) gives Watch and Cloud equal weight and centres its "chain of links" motif on storage. That no longer matches the product. Recommended changes:

- **Dark, cinematic by default** for Home, Channels, title pages and the player; light only for Cloud, forms and settings.
- **One accent for Plus** (the marigold from the concept) so locked and included content is instantly visible.
- Keep the concept's type (Bricolage Grotesque for display, Hanken Grotesk for body) and reuse its components where they fit.
- Drop the storage chain from Home; keep the episode "spine" for series and the 5-step tracker for creators.

### 6.5 Accessibility and quality bar

Touch targets ≥ 48 dp; text contrast ≥ 4.5:1; TalkBack labels on every control; layouts hold at 200% font scale and at tablet width; respect "remove animations".

## 7. Backend gaps that limit the design

Ordered by impact on watching and subscribing.

| Wanted in the UI | Missing today |
|---|---|
| **Free preview** (trailer, first episode free or sample minutes) | No way to sample a Plus title before paying |
| **Join with the subscription** | Watching needs a separate join even after paying (could be done in the app by joining automatically) |
| **Video length** on cards and title pages | Duration is only readable by owners |
| **Phone / OTP sign-in** | Email and password only |
| **Offline downloads** | Signed streaming only |
| **Server-side search and "new episodes" feed** | Search filters the loaded catalogue on the phone |
| Member counts on channels | No public aggregate |
| Languages | No translation layer |

## 8. Delivery plan

Each phase ends with typecheck, unit tests, the live API suite, a browser walkthrough and screenshots for your review.

| Phase | Work |
|---|---|
| 0 | Settle section 9; rework the Figma screens around watching |
| 1 | Foundations: dark/light tokens, fonts, edge-to-edge, core components (cover card, title row, sheet, button, chip, lock badge, empty state) |
| 2 | Navigation (4 tabs), Home, title page, player, series |
| 3 | Gates as sheets: sign-in, plans/purchase, join; deep-link landing |
| 4 | Channels browse/search, channel page, Library |
| 5 | You, settings, notices, account deletion |
| 6 | My cloud, upload, creator studio, admin, report |
| 7 | Quality pass on a budget Android phone: slow network, 200% font, TalkBack, tablet width |

## 9. Decisions needed from you

Decided on 11 November 2026:

- **Payments:** UPI intent only, no Google Play billing and no payment gateway named. Fixed periods, paid again each period (no automatic renewal). An admin confirms each payment against the bank record.
- **Who can create channels:** only people an admin has approved as creators.
- **What a subscription covers:** one subscription for every paid channel.

Still open:

0. **Distribution:** a UPI-only app conflicts with Google Play's billing rule unless it is enrolled in Google's India programme or distributed outside Play. This must be settled before a Play Store submission.
2. **Visual direction:** rework the Figma concept as in 6.4, or start a new direction?
3. **Joining:** join the channel automatically when someone presses Play, or keep a visible Join step?
4. **Free previews:** should the backend add trailers or a free first episode?
5. **Cloud:** OK to move it from a tab into You as a Plus benefit?
6. **Audience and languages:** India-first on budget Android, English only at launch?

## Sources

1. Google Play Console Help, Subscriptions policy — <https://support.google.com/googleplay/android-developer/answer/9900533>
2. Accedo, Adapting your user experience for the Indian market — <https://www.accedo.tv/insights-and-news/adapting-your-user-experience-for-the-indian-market>
3. Amritt, Brightcove study of OTT features wanted in India — <https://amritt.com/?p=55804>
4. Impact, MX Player data saver mode — <https://dev.impactonnet.com/more-from-impact/mx-player-launches-data-saver-mode-to-lessen-broadband-strain-in-india-6813.html>
5. TechCrunch, Patreon launches new features, a redesigned app and a new look — <https://techcrunch.com/2023/10/04/patreon-launches-new-features-a-redesigned-app-and-a-new-look/embed/>
6. Android Developers, Behaviour changes: apps targeting Android 16 — <https://developer.android.com/about/versions/16/behavior-changes-16>
7. Android Central, "Google unveils the most massive Android redesign ever" — <https://www.androidcentral.com/apps-software/google-unveils-the-most-massive-android-redesign-ever>
8. UX Planet, Bottom tab bar navigation design best practices — <https://uxplanet.org/bottom-tab-bar-navigation-design-best-practices-48d46a3b0c36>
9. eChai Ventures, designing for users on cheap Android phones and patchy internet — <https://echai.ventures/startingup/product-design-ux/how-do-i-design-for-users-in-india-who-are-on-cheap-android-phones-and-slow-patchy-internet>
10. Inc42, Following CCI order, Google extends user choice billing to all Indian developers — <https://inc42.com/buzz/following-cci-order-google-extends-user-choice-billing-indian-devs>
