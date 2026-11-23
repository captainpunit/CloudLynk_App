import { dbCheck, HttpError } from "./endpoint.ts";
import { supabaseAdmin as db } from "./supabaseAdmin.ts";
import { consumeProduct, getProductPurchase, PlayError } from "./googlePlay.ts";
import { productPurchaseProblem } from "./playProduct.ts";

/**
 * Grants a plan bought as a one-time Google Play product, after Google confirms it.
 *
 * Used by the app right after a purchase (the signed-in member is the buyer) and by
 * Google's purchase notification (the buyer is the account whose billing ID the app
 * attached to the purchase). The second path grants purchases the app never reported:
 * the app closed during checkout, or a pending payment that cleared later.
 *
 * Granting is idempotent per purchase token. Consuming tells Google the purchase was
 * delivered; an unconsumed purchase is refunded by Google after three days. When
 * `retryConsume` is "throw", a failed consume is raised so the caller is asked again
 * (Pub/Sub redelivers); otherwise access stays granted and the app retries on next start.
 */
export async function grantPlayProduct(
  productId: string,
  token: string,
  options: { userId?: string; retryConsume: "throw" | "later" },
): Promise<{ expiresAt: string; consumed: boolean }> {
  let purchase;
  try {
    purchase = await getProductPurchase(productId, token);
  } catch (cause) {
    if (
      cause instanceof PlayError && [400, 404, 410].includes(cause.status)
    ) throw new HttpError(400, "invalid_purchase");
    throw cause;
  }
  const query = db.from("profiles").select(
    "id,play_account_id,account_status",
  );
  const profile = options.userId
    ? await query.eq("id", options.userId).maybeSingle()
    : purchase.obfuscatedExternalAccountId
    ? await query.eq("play_account_id", purchase.obfuscatedExternalAccountId)
      .maybeSingle()
    : { data: null, error: null };
  dbCheck(profile.error);
  if (!profile.data) throw new HttpError(403, "purchase_owner_mismatch");
  if (profile.data.account_status !== "active") {
    throw new HttpError(403, "account_restricted");
  }
  const problem = productPurchaseProblem(
    purchase,
    profile.data.play_account_id,
  );
  if (problem) throw new HttpError(problem.status, problem.code);
  const granted = await db.rpc("grant_play_product", {
    p_user_id: profile.data.id,
    p_product_id: productId,
    p_token: token,
    p_order_id: purchase.orderId ?? null,
    p_test: purchase.purchaseType === 0,
  });
  if (granted.error?.message === "plan_unavailable") {
    throw new HttpError(400, "plan_unavailable");
  }
  dbCheck(granted.error);
  if (purchase.consumptionState === 1) {
    return { expiresAt: granted.data as string, consumed: true };
  }
  try {
    await consumeProduct(productId, token);
    return { expiresAt: granted.data as string, consumed: true };
  } catch (cause) {
    // Plus is already granted; only telling Google is left to retry.
    if (options.retryConsume === "throw") throw cause;
    console.error(
      "play_consume_failed",
      cause instanceof Error ? cause.message : cause,
    );
    return { expiresAt: granted.data as string, consumed: false };
  }
}
