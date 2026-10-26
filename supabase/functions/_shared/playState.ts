// Pure provider mapping shared by receipt verification, RTDN and reconciliation.
export interface PlayLine {
  productId: string;
  expiryTime?: string;
  latestSuccessfulOrderId?: string;
  offerPhase?: { freeTrial?: Record<string, never> };
}
export interface PlayPurchase {
  subscriptionState: string;
  startTime?: string;
  acknowledgementState?: string;
  linkedPurchaseToken?: string;
  testPurchase?: Record<string, never>;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  outOfAppPurchaseContext?: {
    expiredPurchaseToken?: string;
    expiredExternalAccountIdentifiers?: {
      obfuscatedExternalAccountId?: string;
    };
  };
  lineItems: PlayLine[];
}
export interface PlayOrder {
  orderId: string;
  purchaseToken: string;
  state: string;
  createTime: string;
  total?: { units?: string; nanos?: number; currencyCode: string };
}
export type Snapshot = {
  product_id: string;
  status: string;
  paid_until: string | null;
  is_trial: boolean;
  order_id: string | null;
  linked_token: string | null;
};
const states: Record<string, string> = {
  SUBSCRIPTION_STATE_PENDING: "pending",
  SUBSCRIPTION_STATE_ACTIVE: "active",
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "in_grace",
  SUBSCRIPTION_STATE_ON_HOLD: "on_hold",
  SUBSCRIPTION_STATE_PAUSED: "on_hold",
  SUBSCRIPTION_STATE_CANCELED: "cancelled",
  SUBSCRIPTION_STATE_EXPIRED: "expired",
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: "expired",
};
export function mapPurchase(
  purchase: PlayPurchase,
  expectedProduct?: string,
  now = Date.now(),
): Snapshot {
  // Add-ons need separate entitlements and are deliberately rejected.
  if (!Array.isArray(purchase.lineItems) || purchase.lineItems.length !== 1) {
    throw new Error("unsupported_subscription_items");
  }
  const line = purchase.lineItems[0];
  if (
    !line.productId || (expectedProduct && line.productId !== expectedProduct)
  ) throw new Error("product_mismatch");
  let status = states[purchase.subscriptionState];
  if (!status) throw new Error("unknown_subscription_state");
  const expiry = line.expiryTime ? Date.parse(line.expiryTime) : NaN;
  if (!["pending", "expired"].includes(status) && !Number.isFinite(expiry)) {
    throw new Error("invalid_subscription_expiry");
  }
  if (["active", "in_grace", "cancelled"].includes(status) && expiry <= now) {
    status = "expired";
  }
  return {
    product_id: line.productId,
    status,
    paid_until: Number.isFinite(expiry) ? new Date(expiry).toISOString() : null,
    is_trial: line.offerPhase?.freeTrial !== undefined,
    order_id: line.latestSuccessfulOrderId ?? null,
    linked_token: purchase.linkedPurchaseToken ?? null,
  };
}
export function paidOrder(order: PlayOrder, token: string, orderId: string) {
  if (order.purchaseToken !== token || order.orderId !== orderId) {
    throw new Error("order_mismatch");
  }
  if (order.state !== "PROCESSED") return null;
  const total = order.total;
  if (!total || !/^[A-Z]{3}$/.test(total.currencyCode)) {
    throw new Error("invalid_order_currency");
  }
  const value = Number(total.units ?? 0) + Number(total.nanos ?? 0) / 1e9;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("invalid_order_value");
  }
  if (!Number.isFinite(Date.parse(order.createTime))) {
    throw new Error("invalid_order_time");
  }
  return { value, currency: total.currencyCode, time: order.createTime };
}
