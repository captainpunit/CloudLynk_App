import {
  mapPurchase,
  paidOrder,
  type PlayPurchase,
} from "../../functions/_shared/playState.ts";
import { installRecord } from "../../functions/_shared/attribution.ts";
import { body, endpoint, HttpError } from "../../functions/_shared/endpoint.ts";
import { sha256 } from "../../functions/_shared/hash.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}
function throws(action: () => unknown, message: string) {
  try {
    action();
  } catch (e) {
    equal((e as Error).message, message);
    return;
  }
  throw new Error("Expected failure");
}
const now = Date.parse("2026-10-26T00:00:00Z");
function purchase(state: string): PlayPurchase {
  return {
    subscriptionState: `SUBSCRIPTION_STATE_${state}`,
    lineItems: [{
      productId: "premium",
      expiryTime: "2026-11-26T00:00:00Z",
      latestSuccessfulOrderId: "GPA.1",
    }],
  };
}
for (
  const [state, expected] of Object.entries({
    ACTIVE: "active",
    IN_GRACE_PERIOD: "in_grace",
    CANCELED: "cancelled",
    ON_HOLD: "on_hold",
    PAUSED: "on_hold",
    EXPIRED: "expired",
    PENDING: "pending",
  })
) {
  Deno.test(`Google state ${state} maps to ${expected}`, () =>
    equal(mapPurchase(purchase(state), "premium", now).status, expected));
}
Deno.test("paid cancellation keeps its end date", () =>
  equal(
    mapPurchase(purchase("CANCELED"), undefined, now).paid_until,
    "2026-11-26T00:00:00.000Z",
  ));
Deno.test("expired paid periods never grant access", () => {
  for (const state of ["ACTIVE", "IN_GRACE_PERIOD", "CANCELED"]) {
    equal(
      mapPurchase(purchase(state), undefined, now + 60 * 86400_000).status,
      "expired",
    );
  }
});
Deno.test("pending purchase without expiry is valid and never paid", () => {
  const p = purchase("PENDING");
  delete p.lineItems[0].expiryTime;
  equal(mapPurchase(p, undefined, now).paid_until, null);
});
Deno.test("cancelled pending purchase without expiry is terminal", () => {
  const p = purchase("PENDING_PURCHASE_CANCELED");
  delete p.lineItems[0].expiryTime;
  equal(mapPurchase(p, undefined, now).status, "expired");
});
Deno.test("unexpected product, multi-item and unknown states fail closed", () => {
  throws(
    () => mapPurchase(purchase("ACTIVE"), "other", now),
    "product_mismatch",
  );
  throws(
    () => mapPurchase({ ...purchase("ACTIVE"), lineItems: [] }, undefined, now),
    "unsupported_subscription_items",
  );
  throws(
    () => mapPurchase(purchase("NEW_STATE"), undefined, now),
    "unknown_subscription_state",
  );
});
Deno.test("invalid active expiry fails closed", () => {
  const p = purchase("ACTIVE");
  p.lineItems[0].expiryTime = "invalid";
  throws(() => mapPurchase(p, undefined, now), "invalid_subscription_expiry");
});
Deno.test("trial detection uses the provider offer phase", () => {
  const p = purchase("ACTIVE");
  p.lineItems[0].offerPhase = { freeTrial: {} };
  equal(mapPurchase(p, undefined, now).is_trial, true);
});
const order = {
  orderId: "GPA.1",
  purchaseToken: "token",
  state: "PROCESSED",
  createTime: "2026-10-26T00:00:00Z",
  total: { units: "99", nanos: 500_000_000, currencyCode: "INR" },
};
Deno.test("revenue uses the actual processed order total", () =>
  equal(paidOrder(order, "token", "GPA.1")?.value, 99.5));
Deno.test("refunds and pending charges are never reported as revenue", () => {
  for (
    const state of [
      "REFUNDED",
      "PARTIALLY_REFUNDED",
      "PENDING_REFUND",
      "CANCELED",
      "PENDING",
    ]
  ) equal(paidOrder({ ...order, state }, "token", "GPA.1"), null);
});
Deno.test("order identity must match the verified token", () =>
  throws(() => paidOrder(order, "stolen", "GPA.1"), "order_mismatch"));
Deno.test("absent money cannot become fake zero revenue", () =>
  throws(
    () => paidOrder({ ...order, total: undefined }, "token", "GPA.1"),
    "invalid_order_currency",
  ));
Deno.test("attribution is opt in and retries use one legacy row", async () => {
  const input = {
    installReferrer: "utm_source=meta&utm_content=encrypted",
    metaAnonId: "anon",
  };
  const a = await installRecord(input, "alice"),
    b = await installRecord(input, "alice");
  equal(a.installation_id, b.installation_id);
  equal(a.install_referrer, null);
  equal(a.meta_anon_id, null);
  const opted = await installRecord(
    { ...input, trackingConsent: true },
    "alice",
  );
  equal(opted.utm_source, "meta");
  equal(opted.meta_campaign_data, { utm_content: "encrypted" });
});
Deno.test("malformed consent and device payload rejected", async () => {
  for (
    const input of [{ trackingConsent: "true" }, { extinfo: [123] }, {
      installationId: "bad",
    }]
  ) {
    let rejected = false;
    try {
      await installRecord(input, "alice");
    } catch (e) {
      rejected = e instanceof HttpError;
    }
    equal(rejected, true);
  }
});
Deno.test("HTTP JSON parser rejects arrays and oversized bodies", async () => {
  for (
    const text of ["[]", "null", "{", JSON.stringify({ x: "a".repeat(33_000) })]
  ) {
    let rejected = false;
    try {
      await body(new Request("http://local", { method: "POST", body: text }));
    } catch (e) {
      rejected = e instanceof HttpError;
    }
    equal(rejected, true);
  }
});
Deno.test("endpoint rejects unsupported methods and preserves expected errors", async () => {
  const handler = endpoint(() =>
    Promise.reject(new HttpError(403, "account_restricted"))
  );
  equal((await handler(new Request("http://local"))).status, 405);
  equal(
    await (await handler(new Request("http://local", { method: "POST" })))
      .json(),
    { error: "account_restricted" },
  );
});
Deno.test("hashes normalize account UUIDs", async () =>
  equal(await sha256(" ABC "), await sha256("abc")));
