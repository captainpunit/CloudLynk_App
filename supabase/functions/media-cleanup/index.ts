import { dbCheck } from "../_shared/endpoint.ts";
import { json } from "../_shared/http.ts";
import { supabaseAdmin as db } from "../_shared/supabaseAdmin.ts";
import { streamClient } from "../_shared/stream.ts";
import { scheduled } from "../_shared/scheduled.ts";
import { pool } from "../_shared/pool.ts";

Deno.serve(scheduled("media-cleanup", async () => {
  const claimed = await db.rpc("claim_media_deletions", { p_limit: 20 });
  dbCheck(claimed.error);
  let removed = 0, failed = 0;
  await pool(
    (claimed.data ?? []) as { stream_uid: string; lease_id: string }[],
    5,
    async (row) => {
      let error = null;
      try {
        await streamClient().remove(row.stream_uid);
        removed++;
      } catch {
        error = "media_delete_failed";
        failed++;
      }
      const saved = await db.rpc("finish_media_deletion", {
        p_uid: row.stream_uid,
        p_lease: row.lease_id,
        p_error: error,
      });
      dbCheck(saved.error);
    },
  );
  return json({ removed, failed }, failed ? 503 : 200);
}));
