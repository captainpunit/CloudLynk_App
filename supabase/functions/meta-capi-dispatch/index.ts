// Scheduled worker: sends queued rows from meta_event_outbox to Meta CAPI with retries.
import { env } from "../_shared/env.ts";
import { json, notImplemented } from "../_shared/http.ts";

Deno.serve((req) => {
  if (req.headers.get("x-cron-secret") !== env("CRON_SECRET")) return json({ error: "forbidden" }, 403);
  // TODO: select queued rows (limit 100), sendCapiEvents, mark sent or bump attempts/last_error.
  return notImplemented("meta-capi-dispatch");
});
