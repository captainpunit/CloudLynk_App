# Access policy: profile, channels, join, access checks

PRD: PR1 (FR01, FR05). Status: **implemented** (migrations `20261015000000` to `20261015000200`).

One rule decides who may **buy**, **join a channel** and **watch**. The server
uses it everywhere (join, purchase verification, playback tokens), so the app
and the server can never disagree. The app never decides access on its own;
it asks the server.

All calls below use the normal Supabase client (`@/lib/supabase`) with the
user's session. No edge function is involved.

## Decisions

Every access check returns one of these strings. Treat the list as a closed
set; a new value is a contract change.

| Decision | Meaning | What the app shows |
| --- | --- | --- |
| `allowed` | Action may go ahead | Unlocked state |
| `sign_in_required` | No signed-in user | Sign in / sign up |
| `account_restricted` | Account suspended or banned | "Account restricted, contact support" |
| `channel_unavailable` | Channel missing or not published | "This channel is not available" |
| `subscription_required` | Premium channel, no paid unexpired subscription | Plans screen |
| `membership_required` | Watch only: user has not joined the channel | Join button |
| `private_channel` | Private channel without an invitation/membership | Invitation required |

```ts
export type AccessDecision =
  | "allowed"
  | "sign_in_required"
  | "account_restricted"
  | "channel_unavailable"
  | "subscription_required"
  | "membership_required"
  | "private_channel";
```

Rules, in the order they are checked:

1. Signed in, else `sign_in_required`.
2. Account `active`, else `account_restricted`.
3. `purchase` stops here: `allowed`. There is no approval step before buying.
4. Channel exists and is `published`, else `channel_unavailable`.
   Private channels also require an invitation or existing membership, else
   `private_channel` (PR4). An invitation permits joining; watching still requires membership.
5. Premium channel (`requires_subscription = true`) needs a subscription with
   status `active`, `in_grace` or `cancelled` and `paid_until` in the future,
   else `subscription_required`. Cancelled means auto-renew is off; access lasts
   until the paid date.
6. `watch` also needs membership, else `membership_required`.

Admins follow the same rules for viewing. Being an admin gives no free access.

## `my_access` (RPC): check before showing a screen

```ts
const { data: decision, error } = await supabase.rpc("my_access", {
  p_action: "join",                 // "purchase" | "join" | "watch"
  p_channel_id: channelId,          // omit for "purchase"
});
// decision: one of the strings in the table above
```

Works signed out too (returns `sign_in_required`). Use it for locked /
unlocked states. It is a read; it changes nothing.

## `join_channel` (RPC)

```ts
const { error } = await supabase.rpc("join_channel", { p_channel_id: channelId });
```

| Result | Meaning |
| --- | --- |
| `error === null` | Joined. Joining a channel you are already in also succeeds. |
| `error.code === "42501"` | Denied. `error.message` is the decision (`subscription_required`, `channel_unavailable`, ...). |

Signed out users cannot call it (permission error). Check `my_access` first to
avoid the call.

## `leave_channel` (RPC)

```ts
const { error } = await supabase.rpc("leave_channel", { p_channel_id: channelId });
```

Always succeeds for a signed-in user, also if not a member.

## Reading data

| Table | Who can read | Notes |
| --- | --- | --- |
| `channels` | Everyone, signed in or not | Published channels only. Columns: `id, name, description, requires_subscription, status, created_at, updated_at`. |
| `channel_members` | Signed-in user | Own memberships only: `channel_id, user_id, joined_at`. |
| `profiles` | Signed-in user | Own row only: `id, display_name, avatar_url, role, account_status, created_at, updated_at`. |
| `subscriptions` | Signed-in user | Own rows only. Read-only. Written by the server after Google Play verifies a purchase (PR3). |

```ts
// Catalogue (works signed out)
await supabase.from("channels").select("id, name, description, requires_subscription").order("created_at");

// My memberships
await supabase.from("channel_members").select("channel_id");
```

## Writing data

| What | How |
| --- | --- |
| Edit own `display_name`, `avatar_url` | `supabase.from("profiles").update({ display_name }).eq("id", userId)` |
| Anything else on `profiles` (`role`, `account_status`) | Not allowed. Permission error. Changed by admin tools (FR09). |
| `subscriptions`, `channel_members` | Not allowed directly. Use the RPCs above / purchase verification (PR3). |
| `channels` | Admins only (admin screens, PR4). |

A profile row is created automatically when the user signs up. With Google
sign-in, `display_name` starts as the Google name.

## For server code (Member 1)

Edge functions call the same rule with the service role:

```ts
const { data: decision } = await supabaseAdmin.rpc("access_decision", {
  p_user_id: user.id, p_action: "watch", p_channel_id: channelId,
});
if (decision !== "allowed") return json({ error: decision }, 403);
```

`access_decision` and `has_active_subscription` are not callable by the app.
Title checks (published state, age rating) added in PR4/PR5 must call
`access_decision`, not copy it.
