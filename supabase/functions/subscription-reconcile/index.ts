import { json } from "../_shared/http.ts";
import {
  dbCheck,
  endpoint,
  HttpError,
  requireCron,
} from "../_shared/endpoint.ts";
import { supabaseAdmin as db } from "../_shared/supabaseAdmin.ts";
import { syncSubscription } from "../_shared/subscriptions.ts";

Deno.serve(endpoint(async (req) => {
  requireCron(req);
  const due = await db.from("subscriptions").select("id,purchase_token,user_id")
    .is("superseded_by", null).lte("next_check_at", new Date().toISOString())
    .order("next_check_at").limit(20);
  dbCheck(due.error);
  let synced = 0;
  let failed = 0;
  await Promise.all((due.data ?? []).map(async (row) => {
    try {
      await syncSubscription(row.purchase_token, row.user_id);
      synced++;
    } catch (error) {
      if (
        error instanceof HttpError && error.message === "subscription_sync_busy"
      ) return;
      failed++;
      const retried = await db.from("subscriptions").update({
        next_check_at: new Date(Date.now() + 30 * 60_000).toISOString(),
        sync_error: "provider_sync_failed",
      }).eq("id", row.id);
      dbCheck(retried.error);
    }
  }));
  // Access checks already deny paid_until <= now(); outages never extend access.
  return json({ synced, failed }, failed ? 503 : 200);
}));
