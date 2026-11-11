import { json } from "../_shared/http.ts";
import { dbCheck } from "../_shared/endpoint.ts";
import { scheduled } from "../_shared/scheduled.ts";
import { supabaseAdmin as db } from "../_shared/supabaseAdmin.ts";
import { listVoidedProductTokens } from "../_shared/googlePlay.ts";

// Ends the Plus time bought by Google Play purchases that Google has refunded or
// reversed. Looks back three days on every run, so a missed run loses nothing;
// void_play_purchase ignores purchases it has already ended.
Deno.serve(scheduled("play-voided-sync", async () => {
  const tokens = await listVoidedProductTokens(
    new Date(Date.now() - 3 * 86400_000),
  );
  let ended = 0;
  for (const token of tokens) {
    const result = await db.rpc("void_play_purchase", { p_token: token });
    dbCheck(result.error);
    if (result.data) ended++;
  }
  return json({ voided: tokens.length, ended });
}));
