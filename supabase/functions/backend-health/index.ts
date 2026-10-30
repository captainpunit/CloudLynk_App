import { dbCheck, endpoint, requireCron } from "../_shared/endpoint.ts";
import { json } from "../_shared/http.ts";
import { supabaseAdmin as db } from "../_shared/supabaseAdmin.ts";

Deno.serve(endpoint(async (req) => {
  requireCron(req);
  const result = await db.rpc("backend_health");
  dbCheck(result.error);
  const data = result.data;
  const degraded = Object.entries(data).some(([key, value]) =>
    key !== "checked_at" &&
    (Array.isArray(value)
      ? value.length > 0
      : typeof value === "number" && value > 0)
  );
  return json(
    { status: degraded ? "degraded" : "ok", ...data },
    degraded ? 503 : 200,
  );
}));
