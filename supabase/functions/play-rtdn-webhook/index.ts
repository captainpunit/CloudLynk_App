import { json } from "../_shared/http.ts";
import {
  body,
  dbCheck,
  endpoint,
  HttpError,
  requiredString,
} from "../_shared/endpoint.ts";
import { env } from "../_shared/env.ts";
import { supabaseAdmin as db } from "../_shared/supabaseAdmin.ts";
import { verifyPubsub } from "../_shared/pubsub.ts";
import { syncSubscription } from "../_shared/subscriptions.ts";

Deno.serve(endpoint(async (req) => {
  await verifyPubsub(req);
  const envelope = await body(req);
  const message = envelope.message as
    | { messageId?: unknown; data?: unknown }
    | undefined;
  const id = requiredString(message?.messageId, 255);
  const encoded = requiredString(message?.data, 24_000);
  let notification;
  try {
    notification = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)),
      ),
    );
  } catch {
    throw new HttpError(400, "invalid_notification");
  }
  if (
    !notification || notification.packageName !== env("ANDROID_PACKAGE_NAME")
  ) throw new HttpError(400, "package_mismatch");
  const sub = notification.subscriptionNotification;
  const voided = notification.voidedPurchaseNotification;
  const token = sub?.purchaseToken ?? voided?.purchaseToken;
  if (sub || voided) requiredString(token, 4096);
  if (token) {
    const erased = await db.rpc("is_erased_purchase_token", { p_token: token });
    dbCheck(erased.error);
    if (erased.data) return json({ ignored: true });
  }
  if (!sub && !voided && !notification.testNotification) {
    return json({ ignored: true });
  }
  const saved = await db.from("payment_events").upsert({
    provider: "google_play",
    provider_event_id: id,
    purchase_token: token ?? null,
    notification_type: sub?.notificationType ?? null,
    payload: notification,
  }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true });
  dbCheck(saved.error);
  const prior = await db.from("payment_events").select("processed_at").eq(
    "provider",
    "google_play",
  ).eq("provider_event_id", id).single();
  dbCheck(prior.error);
  if (prior.data?.processed_at) return json({ duplicate: true });
  let outcome: string | null = null;
  if (token && voided?.productType === 2) {
    // A refunded one-time product. Google's subscription API does not know these tokens.
    const ended = await db.rpc("void_play_purchase", { p_token: token });
    dbCheck(ended.error);
  } else if (token) {
    try {
      // Re-read Google even for delayed notifications. Delivery order is not provider state order.
      await syncSubscription(token);
    } catch (error) {
      // Asking again cannot fix these, so the message is accepted and the reason kept.
      // Anything else is returned as a failure and Pub/Sub delivers it again.
      if (
        !(error instanceof HttpError) ||
        error.message === "subscription_sync_busy" ||
        ![400, 403, 409, 410].includes(error.status)
      ) throw error;
      outcome = error.message;
    }
  }
  const done = await db.from("payment_events").update({
    processed_at: new Date().toISOString(),
  })
    .eq("provider", "google_play").eq("provider_event_id", id);
  dbCheck(done.error);
  return json(
    outcome ? { received: true, skipped: outcome } : { received: true },
  );
}));
