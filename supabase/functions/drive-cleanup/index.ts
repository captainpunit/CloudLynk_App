// Scheduled worker: removes stored drive objects for deleted files, expired
// uploads and orphans, then drops their rows. Safe to run often and in parallel.
import { scheduled } from "../_shared/scheduled.ts";
import { json } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const BUCKET = "user-files";
const BATCH = 100; // the Storage API removes at most 1000 paths per call
const MAX_BATCHES = 10; // keeps one run well inside the function time limit

type CleanupRow = { file_id: string | null; storage_path: string };

Deno.serve(scheduled("drive-cleanup", async () => {
  let removedObjects = 0;
  let removedRows = 0;
  const errors: string[] = [];

  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await supabaseAdmin.rpc("drive_cleanup_batch", {
      p_limit: BATCH,
    });
    if (error) {
      errors.push(error.message);
      break;
    }
    const batch = (data ?? []) as CleanupRow[];
    if (!batch.length) break;

    const { error: removeError } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove(batch.map((row) => row.storage_path));
    if (removeError) {
      // Rows stay 'deleting'; the next run retries them.
      errors.push(removeError.message);
      break;
    }
    removedObjects += batch.length;

    const fileIds = batch.flatMap((row) => (row.file_id ? [row.file_id] : []));
    if (fileIds.length) {
      const { data: count, error: finishError } = await supabaseAdmin.rpc(
        "drive_cleanup_finish",
        {
          p_file_ids: fileIds,
        },
      );
      if (finishError) {
        errors.push(finishError.message);
        break;
      }
      removedRows += count ?? 0;
    }

    if (batch.length < BATCH) break;
  }

  return json({
    removed_objects: removedObjects,
    removed_rows: removedRows,
    errors,
  }, errors.length ? 500 : 200);
}));
