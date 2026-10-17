# Contract review: CloudLynk

## Verdict

The terms are mostly fair to you as the developer. They are **not complete**.
Do not sign until the client confirms the points below. It is fine to start
the project structure now.

## Point by point

| # | Client point | Status | Problem | Fix |
| --- | --- | --- | --- | --- |
| 1 | Exact delivery deadline | Missing | No date is written. | Write a real date per milestone, and say the date moves if the client is late with inputs. |
| 2 | Developer helps fix Google policy rejections | OK, needs limit | No limit on rounds or time. | Free fixes for technical/policy-code issues only, inside the agreed scope. |
| 3 | Content rejection: will developer help? | Unclear | Point 5 says client is responsible, but it does not say if you help. | Say: developer helps with app changes for content rejections as paid change requests (or a small free limit). |
| 4 | No penalty for developer delay | Good for you | Client may later ask for one. | Keep it. Add that delays caused by client, Google or Meta review also do not count. |
| 5 | Client responsible for content rejections | OK | Content means videos, images, text, licences, age ratings. | Add that client owns content rights and licences. |
| 6 | Fix technical rejections in 2 to 3 working days | Needs detail | "Technical" is not defined. When does the clock start? | Clock starts when client shares the full rejection email. Applies only to issues caused by the delivered code. |

## Missing from the contract

1. **Scope.** Attach the PRD feature list. Anything not in it is a change request.
2. **Payment milestones.** For example 30% advance, 40% on beta, 30% on Play Store live.
3. **Change requests.** New features are quoted separately in money and time.
4. **Account ownership.** Client owns Play Console, Meta Business/ad account,
   Supabase, Cloudflare, domain. Developer gets user access only.
5. **Running costs.** Hosting, Cloudflare Stream, Supabase, Google fee
   (15 to 30%), Meta ad spend are paid by the client.
6. **Meta ads.** Developer sets up tracking (SDK, Conversions API,
   subscription events). Developer is **not** responsible for ad results,
   campaigns, or ad spend.
7. **Client inputs.** Logo, content, plan prices, privacy policy, test
   accounts, and their due dates.
8. **Acceptance.** Client tests each milestone within X days. No reply means accepted.
9. **Support after launch.** Free bug fixing period (for example 30 days), then paid.
10. **Source code and IP.** Code handed over after full payment.
11. **Google Play review time.** Store review delays are not developer delay.

## Message you can send to the client

> Hi, thanks for sharing the points. They look fine to me. I want to add a
> few things so both sides are clear:
>
> 1. Please share the exact delivery date. I will split it into milestones.
>    If inputs from your side are late, the date moves by the same days.
> 2. I will fix Google Play rejections caused by the app code, within 2 to 3
>    working days from when you share the full rejection mail.
> 3. Content rejections (videos, images, text, licences, age rating) are your
>    side. If they need app changes, I will help as a change request.
> 4. Scope is the feature list in the PRD. New features will be quoted separately.
> 5. Payment: 30% advance, 40% on beta build, 30% when the app is live on Play Store.
> 6. Play Console, Meta Business, Supabase, Cloudflare and domain accounts will
>    be in your name. Please give me developer access.
> 7. Hosting, Google fees and Meta ad spend are paid by you.
> 8. For Meta ads, I will set up install and subscription tracking in the app
>    and backend. Running campaigns and ad results are not part of my work.
> 9. 30 days of free bug fixes after launch. After that, support is paid.
> 10. Source code will be handed over after the final payment.
>
> Please confirm, and I will start.

Change the percentages and days to what you actually want before sending.
