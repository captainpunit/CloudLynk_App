/** A one-time product purchase, as returned by purchases.products.get. */
export type PlayProductPurchase = {
  purchaseState?: number; // 0 purchased, 1 cancelled, 2 pending
  consumptionState?: number; // 0 not yet consumed, 1 consumed
  purchaseType?: number; // 0 licence-tester purchase; absent for a real one
  orderId?: string;
  obfuscatedExternalAccountId?: string;
};

/** Why a one-time product purchase cannot be granted, or null when it can. */
export function productPurchaseProblem(
  purchase: PlayProductPurchase,
  playAccountId: string | null,
): { status: number; code: string } | null {
  // Pending (a payment method Google has not collected from yet) is not paid.
  if (purchase.purchaseState === 2) {
    return { status: 409, code: "purchase_pending" };
  }
  if (purchase.purchaseState !== 0) {
    return { status: 400, code: "invalid_purchase" };
  }
  // The app sets this to the account's billing ID when it starts the purchase, so a
  // token copied from another account is refused.
  if (
    !playAccountId || purchase.obfuscatedExternalAccountId !== playAccountId
  ) return { status: 403, code: "purchase_owner_mismatch" };
  return null;
}

/** The purchase in a one-time product notification, or null for anything else. */
export function purchasedProduct(
  notification: unknown,
): { productId: string; token: string } | null {
  const product = (notification as {
    oneTimeProductNotification?: {
      notificationType?: unknown;
      purchaseToken?: unknown;
      sku?: unknown;
    };
  })?.oneTimeProductNotification;
  // 1 = ONE_TIME_PRODUCT_PURCHASED (also sent when a pending payment completes);
  // 2 = ONE_TIME_PRODUCT_CANCELED, a pending purchase that never got paid.
  if (
    !product || product.notificationType !== 1 ||
    typeof product.purchaseToken !== "string" ||
    typeof product.sku !== "string" || !product.purchaseToken ||
    !product.sku
  ) return null;
  return { productId: product.sku, token: product.purchaseToken };
}
