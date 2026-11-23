import { dbCheck } from "../_shared/endpoint.ts";
import { json } from "../_shared/http.ts";
import { supabaseAdmin as db } from "../_shared/supabaseAdmin.ts";
import { scheduled } from "../_shared/scheduled.ts";
import { pool } from "../_shared/pool.ts";
import { pushClient, pushFailure } from "../_shared/push.ts";

type Delivery = {
  id: string;
  lease_id: string;
  notice_id: string;
  token_id: string;
  state: string;
  ticket_id: string | null;
  submitted_at: string | null;
};
// Runs every minute. It keeps claiming batches for most of that minute, so a broadcast
// (up to 500 people) is sent in about a minute and payment notices queued behind it are
// not held up; one batch of 20 per run took tens of minutes.
const RUN_FOR_MS = 45_000;

Deno.serve(scheduled("notification-dispatch", async () => {
  const started = Date.now();
  let submitted = 0, delivered = 0, failed = 0, waiting = 0;
  while (Date.now() - started < RUN_FOR_MS) {
    const claimed = await db.rpc("claim_push_deliveries", { p_limit: 100 });
    dbCheck(claimed.error);
    const batch = (claimed.data ?? []) as Delivery[];
    if (!batch.length) break;
    await pool(batch, 10, deliver);
  }
  return json({ submitted, delivered, waiting, failed }, failed ? 503 : 200);

  async function deliver(row: Delivery) {
    let state = row.state === "waiting" ? "waiting" : "queued",
      ticket: string | null = null,
      error: string | null = null,
      disable = false;
    try {
      const [notice, device] = await Promise.all([
        db.from("notices").select("user_id").eq("id", row.notice_id)
          .maybeSingle(),
        db.from("push_tokens").select("user_id,token,enabled").eq(
          "id",
          row.token_id,
        ).maybeSingle(),
      ]);
      dbCheck(notice.error);
      dbCheck(device.error);
      const owner = notice.data?.user_id;
      const profile = owner
        ? await db.from("profiles").select("account_status").eq("id", owner)
          .maybeSingle()
        : null;
      dbCheck(profile?.error ?? null);
      if (
        !owner || !device.data || device.data.user_id !== owner ||
        !device.data.enabled ||
        profile?.data?.account_status !== "active"
      ) {
        state = "failed";
        error = "registration_unavailable";
      } else {
        const client = pushClient();
        const result = row.state === "waiting"
          ? await client.receipt(row.ticket_id!)
          : await client.send(device.data.token, row.notice_id);
        if (!result) {
          if (Date.parse(row.submitted_at ?? "") < Date.now() - 23 * 3600_000) {
            state = "failed";
            error = "receipt_expired";
          } else {
            state = "waiting";
            waiting++;
          }
        } else if (result.status === "ok") {
          if (row.state === "waiting") {
            state = "delivered";
            delivered++;
          } else {
            if (!result.id) throw new Error("missing_push_ticket");
            state = "waiting";
            ticket = result.id;
            submitted++;
          }
        } else {
          const failure = pushFailure(result.details?.error);
          disable = failure.disable;
          error = failure.error;
          state = failure.terminal ? "failed" : "queued";
          failed++;
        }
      }
    } catch {
      error = "push_provider_unavailable";
      failed++;
    }
    const saved = await db.rpc("finish_push_delivery", {
      p_id: row.id,
      p_lease: row.lease_id,
      p_state: state,
      p_ticket: ticket,
      p_error: error,
      p_disable: disable,
    });
    dbCheck(saved.error);
  }
}));
