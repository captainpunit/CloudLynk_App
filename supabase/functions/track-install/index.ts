import { json } from "../_shared/http.ts";
import { body, dbCheck, endpoint, HttpError } from "../_shared/endpoint.ts";
import { supabaseAdmin, userFromRequest } from "../_shared/supabaseAdmin.ts";
import { installRecord } from "../_shared/attribution.ts";

Deno.serve(endpoint(async (req) => {
  const user = await userFromRequest(req);
  if (!user) throw new HttpError(401, "sign_in_required");
  const record = await installRecord(await body(req), user.id);
  const saved = await supabaseAdmin.from("app_installs").upsert(record, {
    onConflict: "user_id,installation_id",
  });
  dbCheck(saved.error);
  return json({ recorded: true, installationId: record.installation_id });
}));
