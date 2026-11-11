import { json } from "../_shared/http.ts";
import { dbCheck } from "../_shared/endpoint.ts";
import { scheduled } from "../_shared/scheduled.ts";
import { supabaseAdmin as db } from "../_shared/supabaseAdmin.ts";
import {
  createExternalTransaction,
  PlayError,
  refundExternalTransaction,
} from "../_shared/googlePlay.ts";
import {
  externalRefundBody,
  type ExternalReport,
  externalTransactionBody,
} from "../_shared/externalTransaction.ts";

// Reports confirmed UPI payments made through Google Play's user choice screen, and
// refunds of them.
// Google requires each one within 24 hours, so this runs every few minutes and retries.
Deno.serve(scheduled("play-external-report", async () => {
  const claimed = await db.rpc("claim_play_reports", { p_limit: 20 });
  dbCheck(claimed.error);
  let sent = 0;
  let failed = 0;
  for (const report of (claimed.data ?? []) as ExternalReport[]) {
    let error: string | null = null;
    try {
      if (report.kind === "refund") {
        await refundExternalTransaction(
          report.external_transaction_id,
          externalRefundBody(report),
        );
      } else {
        await createExternalTransaction(
          report.external_transaction_id,
          externalTransactionBody(report),
        );
      }
      sent++;
    } catch (cause) {
      // 409: Google already holds this transaction ID from an earlier attempt.
      if (cause instanceof PlayError && cause.status === 409) sent++;
      else {
        error = cause instanceof PlayError ? cause.message : "report_failed";
        failed++;
      }
    }
    const finished = await db.rpc("finish_play_report", {
      p_id: report.id,
      p_lease: report.lease_id,
      p_error: error,
    });
    dbCheck(finished.error);
  }
  return json({ sent, failed }, failed ? 503 : 200);
}));
