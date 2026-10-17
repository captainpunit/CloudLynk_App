// Stores install attribution (Play install referrer, Meta campaign data) for the user/device.
import { json, notImplemented } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  // TODO: parse referrer (utm_source, utm_campaign, utm_content = Meta encrypted data),
  // insert into app_installs, link to user once signed in.
  return notImplemented("track-install");
});
