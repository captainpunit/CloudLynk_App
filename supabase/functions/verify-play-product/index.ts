import { json } from "../_shared/http.ts";
import {
  body,
  dbCheck,
  endpoint,
  HttpError,
  requiredString,
} from "../_shared/endpoint.ts";
import { supabaseAdmin, userFromRequest } from "../_shared/supabaseAdmin.ts";
import {
  consumeProduct,
  getProductPurchase,
  PlayError,
} from "../_shared/googlePlay.ts";
import { productPurchaseProblem } from "../_shared/playProduct.ts";

// Grants a plan bought as a one-time Google Play product. The app is never trusted:
// Google must confirm the purchase, and it must belong to the signed-in account.
Deno.serve(endpoint(async (req) => {
  const user = await userFromRequest(req);
  if (!user) throw new HttpError(401, "sign_in_required");
  const input = await body(req);
  const productId = requiredString(input.productId, 255);
  const token = requiredString(input.purchaseToken, 4096);
  const profile = await supabaseAdmin.from("profiles").select(
    "play_account_id,account_status",
  ).eq("id", user.id).single();
  dbCheck(profile.error);
  if (profile.data!.account_status !== "active") {
    throw new HttpError(403, "account_restricted");
  }
  let purchase;
  try {
    purchase = await getProductPurchase(productId, token);
  } catch (cause) {
    if (
      cause instanceof PlayError && [400, 404, 410].includes(cause.status)
    ) throw new HttpError(400, "invalid_purchase");
    throw cause;
  }
  const problem = productPurchaseProblem(
    purchase,
    profile.data!.play_account_id,
  );
  if (problem) throw new HttpError(problem.status, problem.code);
  const granted = await supabaseAdmin.rpc("grant_play_product", {
    p_user_id: user.id,
    p_product_id: productId,
    p_token: token,
    p_order_id: purchase.orderId ?? null,
  });
  if (granted.error?.message === "plan_unavailable") {
    throw new HttpError(400, "plan_unavailable");
  }
  dbCheck(granted.error);
  // Access is already granted. If consuming fails, the app sends the purchase again
  // on its next start; the grant is idempotent, so only the consume is repeated.
  if (purchase.consumptionState !== 1) await consumeProduct(productId, token);
  return json({ status: "active", expiresAt: granted.data });
}));
