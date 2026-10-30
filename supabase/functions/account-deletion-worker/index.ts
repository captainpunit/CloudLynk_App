import { dbCheck } from "../_shared/endpoint.ts";
import { json } from "../_shared/http.ts";
import { supabaseAdmin as db } from "../_shared/supabaseAdmin.ts";
import { scheduled } from "../_shared/scheduled.ts";
import { pool } from "../_shared/pool.ts";

type RequestRow = { id: string; user_id: string; lease_id: string };
Deno.serve(scheduled("account-deletion-worker", async () => {
  const claimed = await db.rpc("claim_account_deletions", { p_limit: 5 });
  dbCheck(claimed.error);
  let completed = 0, pending = 0, failed = 0;
  await pool((claimed.data ?? []) as RequestRow[], 2, async (row) => {
    let done = false, error: string | null = null;
    try {
      const prepared = await db.rpc("prepare_account_erasure", {
        p_user_id: row.user_id,
        p_request_id: row.id,
        p_lease: row.lease_id,
      });
      dbCheck(prepared.error);
      // Remove objects through Storage, never by deleting storage.objects rows.
      for (let batch = 0; batch < 5; batch++) {
        const objects = await db.rpc("account_erasure_objects", {
          p_user_id: row.user_id,
          p_request_id: row.id,
          p_lease: row.lease_id,
          p_limit: 100,
        });
        dbCheck(objects.error);
        if (!objects.data?.length) break;
        const buckets = new Map<string, string[]>();
        for (const object of objects.data) {
          const paths = buckets.get(object.bucket_id) ?? [];
          paths.push(object.name);
          buckets.set(object.bucket_id, paths);
        }
        for (const [bucket, paths] of buckets) {
          const removed = await db.storage.from(bucket).remove(paths);
          dbCheck(removed.error);
        }
      }
      const remaining = await db.rpc("account_erasure_objects", {
        p_user_id: row.user_id,
        p_request_id: row.id,
        p_lease: row.lease_id,
        p_limit: 1,
      });
      dbCheck(remaining.error);
      const media = await db.from("stream_deletion_queue").select(
        "stream_uid",
        { count: "exact", head: true },
      ).eq("owner_id", row.user_id);
      dbCheck(media.error);
      const allocations = await db.from("stream_allocation_intents").select(
        "id",
        { count: "exact", head: true },
      ).eq("owner_id", row.user_id);
      dbCheck(allocations.error);
      if (remaining.data?.length || media.count || allocations.count) pending++;
      else {
        const deleted = await db.auth.admin.deleteUser(row.user_id);
        if (deleted.error && deleted.error.status !== 404) {
          throw new Error("auth_delete_failed");
        }
        done = true;
        completed++;
      }
    } catch {
      error = "account_erasure_failed";
      failed++;
    }
    const saved = await db.rpc("finish_account_deletion", {
      p_id: row.id,
      p_lease: row.lease_id,
      p_complete: done,
      p_error: error,
    });
    dbCheck(saved.error);
  });
  const pruned = await db.rpc("prune_operational_records");
  dbCheck(pruned.error);
  return json({ completed, pending, failed }, failed ? 503 : 200);
}));
