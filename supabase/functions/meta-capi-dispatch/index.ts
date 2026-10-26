import { json } from "../_shared/http.ts";
import { dbCheck, endpoint, requireCron } from "../_shared/endpoint.ts";
import { supabaseAdmin as db } from "../_shared/supabaseAdmin.ts";
import { sendCapiEvents } from "../_shared/metaCapi.ts";
import { getOrder } from "../_shared/googlePlay.ts";
import { paidOrder } from "../_shared/playState.ts";

type OutboxRow = {
  id: string;
  lease_id: string;
  user_id: string | null;
  event_name: string;
  event_id: string;
  payload: {
    orderId?: string;
    purchaseToken?: string;
    eventTime: string;
    metaAnonId?: string;
    extinfo?: string[];
  };
};

Deno.serve(endpoint(async (req) => {
  requireCron(req);
  const claimed = await db.rpc("claim_meta_events", { p_limit: 10 });
  dbCheck(claimed.error);
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  await Promise.all((claimed.data ?? []).map(async (row: OutboxRow) => {
    let error: string | null = null;
    try {
      const install = await db.from("app_installs").select("tracking_consent")
        .eq("user_id", row.user_id).order("updated_at", { ascending: false })
        .limit(1).maybeSingle();
      dbCheck(install.error);
      const payload = row.payload;
      const order = payload.orderId
        ? paidOrder(
          await getOrder(payload.orderId),
          payload.purchaseToken ?? "",
          payload.orderId,
        )
        : null;
      if (
        !row.user_id || !install.data?.tracking_consent ||
        (payload.orderId && (!order || order.value <= 0))
      ) {
        skipped++;
      } else {
        const eventTime = new Date(order?.time ?? payload.eventTime);
        // Do not relabel old restored purchases as new conversions.
        if (
          !Number.isFinite(eventTime.getTime()) ||
          eventTime.getTime() < Date.now() - 7 * 86400_000
        ) {
          skipped++;
        } else {
          const response = await sendCapiEvents([{
            eventName: row.event_name,
            eventId: row.event_id,
            eventTime,
            userId: row.user_id,
            metaAnonId: payload.metaAnonId,
            extinfo: payload.extinfo,
            advertiserTrackingEnabled: true,
            value: order?.value,
            currency: order?.currency,
          }]);
          const result = await response.json();
          if (!response.ok || result.error || result.events_received !== 1) {
            throw new Error("meta_delivery_failed");
          }
          sent++;
        }
      }
    } catch {
      error = "delivery_failed";
      failed++;
    }
    const finished = await db.rpc("finish_meta_event", {
      p_id: row.id,
      p_lease: row.lease_id,
      p_error: error,
    });
    dbCheck(finished.error);
  }));
  return json({ sent, skipped, failed }, failed ? 503 : 200);
}));
