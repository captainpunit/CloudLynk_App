// Google Play Real-time Developer Notifications (Pub/Sub push).
import { json, notImplemented } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  // TODO (subscription PR):
  // 1. Verify the Pub/Sub OIDC bearer token (audience = RTDN_PUSH_AUDIENCE).
  // 2. Decode message.data (base64 JSON), store in payment_events (unique id = idempotent).
  // 3. Re-read state with getSubscriptionV2 (provider truth wins), update subscriptions.
  // 4. On renewal queue a Meta "Subscribe"/"Purchase" event; on refund do not.
  return notImplemented("play-rtdn-webhook");
});
