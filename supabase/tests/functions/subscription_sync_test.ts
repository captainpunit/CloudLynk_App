import { createClient } from "@supabase/supabase-js";
import { createSubscriptionSync } from "../../functions/_shared/subscriptionSync.ts";
import { sha256 } from "../../functions/_shared/hash.ts";
import { HttpError } from "../../functions/_shared/endpoint.ts";
import type { PlayPurchase } from "../../functions/_shared/playState.ts";

const user = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
function assert(
  condition: unknown,
  message = "Assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}
async function rejected(fn: () => Promise<unknown>, message: string) {
  try {
    await fn();
  } catch (e) {
    assert(e instanceof HttpError && e.message === message, String(e));
    return;
  }
  throw new Error("Expected rejection");
}
async function fixture(options: {
  existing?: boolean;
  owner?: string | null;
  account?: string;
  consent?: boolean;
  activePlan?: boolean;
  missingPlan?: boolean;
  state?: string;
  busy?: boolean;
  test?: boolean;
  ackFails?: boolean;
} = {}) {
  const calls: string[] = [];
  let committed: Record<string, unknown> | undefined;
  const purchase: PlayPurchase = {
    subscriptionState: `SUBSCRIPTION_STATE_${options.state ?? "ACTIVE"}`,
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    externalAccountIdentifiers: {
      obfuscatedExternalAccountId: options.account ?? await sha256(user),
    },
    lineItems: [{
      productId: "premium",
      expiryTime: new Date(Date.now() + 86400_000).toISOString(),
      latestSuccessfulOrderId: "order-1",
    }],
    ...(options.test ? { testPurchase: {} } : {}),
  };
  const db = createClient("https://test.invalid", "test-key", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
            ? input.href
            : input.url,
        );
        const route = url.pathname.split("/").pop()!;
        calls.push(route);
        let result: unknown;
        switch (route) {
          case "claim_subscription_sync":
            result = options.busy ? null : "lease-1";
            break;
          case "release_subscription_sync":
            result = null;
            break;
          case "subscriptions":
            result = options.existing
              ? { user_id: options.owner ?? user, superseded_by: null }
              : null;
            break;
          case "resolve_play_owner":
            result = options.owner === undefined ? user : options.owner;
            break;
          case "plans":
            result = options.missingPlan
              ? null
              : { product_id: "premium", active: options.activePlan ?? true };
            break;
          case "app_installs":
            result = {
              tracking_consent: options.consent ?? false,
              meta_anon_id: "anon",
              extinfo: [],
            };
            break;
          case "apply_play_snapshot": {
            committed = JSON.parse(init?.body as string);
            const snapshot = committed!.p_snapshot as Record<string, unknown>;
            result = {
              status: snapshot.status,
              paid_until: snapshot.paid_until,
              product_id: snapshot.product_id,
              is_trial: false,
            };
            break;
          }
          default:
            throw new Error(`Unexpected database request ${route}`);
        }
        return Promise.resolve(
          new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      },
    },
  });
  const sync = createSubscriptionSync({
    db,
    getSubscriptionV2: () => {
      calls.push("google-read");
      return Promise.resolve(purchase);
    },
    acknowledgeSubscription: () => {
      calls.push("google-ack");
      return options.ackFails
        ? Promise.reject(new Error("provider unavailable"))
        : Promise.resolve();
    },
  });
  return { sync, calls, purchase, committed: () => committed };
}

Deno.test("verified purchase commits entitlement before acknowledgement", async () => {
  const f = await fixture();
  const result = await f.sync("token", user, "premium");
  assert(result.status === "active");
  assert(
    f.calls.indexOf("apply_play_snapshot") < f.calls.indexOf("google-ack"),
  );
  assert(f.calls.at(-1) === "release_subscription_sync");
  assert(f.committed()?.p_event === null, "no consent means no conversion");
});
Deno.test("consented purchase queues a stable order event without blocking on Meta", async () => {
  const f = await fixture({ consent: true });
  await f.sync("token", user);
  const event = f.committed()?.p_event as {
    event_id: string;
    payload: { orderId: string };
  };
  assert(event.event_id === `play-order-${await sha256("order-1")}`);
  assert(event.payload.orderId === "order-1");
});
Deno.test("test purchases cannot queue conversions", async () => {
  const f = await fixture({ consent: true, test: true });
  await f.sync("token", user);
  assert(f.committed()?.p_event === null);
});
Deno.test("pending payment never acknowledged", async () => {
  const f = await fixture({ state: "PENDING", consent: true });
  await f.sync("token", user);
  assert(!f.calls.includes("google-ack"));
  assert(f.committed()?.p_event === null);
});
Deno.test("another caller cannot restore an owned token", async () => {
  const f = await fixture({ existing: true });
  await rejected(() => f.sync("token", other), "purchase_owner_mismatch");
  assert(!f.calls.includes("google-read"));
  assert(f.calls.at(-1) === "release_subscription_sync");
});
Deno.test("unclaimed purchase must match the provider's account hash", async () => {
  const f = await fixture({ account: await sha256(other) });
  await rejected(() => f.sync("token", user), "purchase_owner_mismatch");
  assert(!f.calls.includes("apply_play_snapshot"));
});
Deno.test("unassociated provider purchase is never claimed from caller input", async () => {
  const f = await fixture({ owner: null });
  await rejected(() => f.sync("token", user), "purchase_owner_missing");
});
Deno.test("busy token does not read Google or release another lease", async () => {
  const f = await fixture({ busy: true });
  await rejected(() => f.sync("token", user), "subscription_sync_busy");
  assert(f.calls.length === 1);
});
Deno.test("unknown product cannot grant entitlement", async () => {
  const f = await fixture({ missingPlan: true });
  await rejected(() => f.sync("token", user), "unknown_product");
  assert(!f.calls.includes("apply_play_snapshot"));
});
Deno.test("retired product can restore an existing subscription", async () => {
  const f = await fixture({ existing: true, activePlan: false });
  await f.sync("token", user);
  assert(f.calls.includes("apply_play_snapshot"));
});
Deno.test("acknowledgement outage preserves commit and releases lease for retry", async () => {
  const f = await fixture({ ackFails: true });
  let failed = false;
  try {
    await f.sync("token", user);
  } catch {
    failed = true;
  }
  assert(failed);
  assert(f.committed());
  assert(f.calls.at(-1) === "release_subscription_sync");
});
