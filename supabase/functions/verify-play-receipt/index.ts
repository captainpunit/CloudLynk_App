import { json } from "../_shared/http.ts";
import {
  body,
  dbCheck,
  endpoint,
  HttpError,
  requiredString,
} from "../_shared/endpoint.ts";
import { supabaseAdmin, userFromRequest } from "../_shared/supabaseAdmin.ts";
import { syncSubscription } from "../_shared/subscriptions.ts";

Deno.serve(endpoint(async (req) => {
  const user = await userFromRequest(req);
  if (!user) throw new HttpError(401, "sign_in_required");
  const decision = await supabaseAdmin.rpc("access_decision", {
    p_user_id: user.id,
    p_action: "purchase",
  });
  dbCheck(decision.error);
  if (decision.data !== "allowed") throw new HttpError(403, decision.data);
  const input = await body(req);
  return json(
    await syncSubscription(
      requiredString(input.purchaseToken, 4096),
      user.id,
      requiredString(input.productId, 255),
    ),
  );
}));
