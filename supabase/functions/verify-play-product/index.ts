import { json } from "../_shared/http.ts";
import {
  body,
  dbCheck,
  endpoint,
  HttpError,
  requiredString,
} from "../_shared/endpoint.ts";
import { supabaseAdmin, userFromRequest } from "../_shared/supabaseAdmin.ts";
import { grantPlayProduct } from "../_shared/grantPlayProduct.ts";

// Grants a plan bought as a one-time Google Play product. The app is never trusted:
// Google must confirm the purchase, and it must belong to the signed-in account.
Deno.serve(endpoint(async (req) => {
  const user = await userFromRequest(req);
  if (!user) throw new HttpError(401, "sign_in_required");
  const input = await body(req);
  const productId = requiredString(input.productId, 255);
  const token = requiredString(input.purchaseToken, 4096);
  const profile = await supabaseAdmin.from("profiles").select("account_status")
    .eq("id", user.id).single();
  dbCheck(profile.error);
  if (profile.data!.account_status !== "active") {
    throw new HttpError(403, "account_restricted");
  }
  // Plus is granted even if telling Google fails; the app sends the purchase again on
  // its next start and only the consume is repeated.
  const result = await grantPlayProduct(productId, token, {
    userId: user.id,
    retryConsume: "later",
  });
  return json({ status: "active", expiresAt: result.expiresAt });
}));
