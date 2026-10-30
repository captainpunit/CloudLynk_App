import { dbCheck } from "../_shared/endpoint.ts";
import { json } from "../_shared/http.ts";
import { supabaseAdmin as db } from "../_shared/supabaseAdmin.ts";
import {
  mapStreamVideo,
  streamClient,
  StreamError,
} from "../_shared/stream.ts";
import { scheduled } from "../_shared/scheduled.ts";
import { pool } from "../_shared/pool.ts";

Deno.serve(scheduled("stream-reconcile", async () => {
  const due = await db.from("stream_assets").select(
    "stream_uid,upload_expires_at,state",
  ).in("state", ["uploading", "processing"])
    .lte("next_check_at", new Date().toISOString()).order("next_check_at")
    .limit(20);
  dbCheck(due.error);
  let synced = 0, failed = 0;
  const intents = await db.from("stream_allocation_intents").select(
    "id,asset_id,owner_id,created_at",
  )
    .lte("next_check_at", new Date().toISOString()).order("next_check_at")
    .limit(10);
  dbCheck(intents.error);
  await pool(intents.data ?? [], 3, async (intent) => {
    try {
      const matches = await streamClient().findAllocation(intent.id);
      const current = await db.from("stream_assets").select(
        "stream_uid,lease_id,lease_until",
      ).eq("id", intent.asset_id).maybeSingle();
      dbCheck(current.error);
      if (
        current.data && current.data.lease_id === intent.id &&
        Date.parse(current.data.lease_until) > Date.now()
      ) return;
      for (const uid of matches) {
        if (current.data?.stream_uid === uid) continue;
        const queued = await db.from("stream_deletion_queue").upsert({
          stream_uid: uid,
          owner_id: intent.owner_id,
        }, { onConflict: "stream_uid", ignoreDuplicates: true });
        dbCheck(queued.error);
      }
      if (
        matches.length ||
        Date.parse(intent.created_at) < Date.now() - 24 * 3600_000
      ) {
        const finished = await db.from("stream_allocation_intents").delete().eq(
          "id",
          intent.id,
        );
        dbCheck(finished.error);
      } else {
        const retry = await db.from("stream_allocation_intents").update({
          next_check_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        }).eq("id", intent.id);
        dbCheck(retry.error);
      }
    } catch {
      failed++;
    }
  });
  await pool(due.data ?? [], 5, async (asset) => {
    try {
      const client = streamClient();
      let update;
      try {
        update = mapStreamVideo(await client.get(asset.stream_uid));
      } catch (error) {
        if (error instanceof StreamError && error.status === 404) {
          update = {
            p_uid: asset.stream_uid,
            p_state: "error",
            p_duration: null,
            p_signed: true,
            p_error: "provider_missing",
          };
        } else throw error;
      }
      if (
        update.p_state === "uploading" &&
        Date.parse(asset.upload_expires_at) < Date.now()
      ) update = { ...update, p_state: "error", p_error: "upload_expired" };
      const saved = await db.rpc("apply_stream_state", update);
      dbCheck(saved.error);
      synced++;
    } catch {
      failed++;
      const retry = await db.from("stream_assets").update({
        next_check_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      }).eq("stream_uid", asset.stream_uid);
      dbCheck(retry.error);
    }
  });
  return json({ synced, failed }, failed ? 503 : 200);
}));
