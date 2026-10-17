// Verifies a Google Play subscription purchase, grants access, queues the Meta Subscribe event.
import { json, notImplemented } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  // TODO (subscription PR):
  // 1. userFromRequest(req); reject if missing.
  // 2. getSubscriptionV2(purchaseToken); check package, product and linked user.
  // 3. upsert subscriptions (purchase_token unique = idempotent).
  // 4. acknowledgeSubscription.
  // 5. insert meta_event_outbox: StartTrial or Subscribe, event_id = purchase token based.
  return notImplemented("verify-play-receipt");
});
