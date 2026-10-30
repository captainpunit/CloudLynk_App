import type { ProductSubscription, Purchase } from 'expo-iap';

export interface BillingPlan {
  product_id: string;
  name: string;
  billing_period: string;
  quota_bytes: number;
}
export interface BillingOffer {
  id: string;
  productId: string;
  token: string;
  name: string;
  price: string;
  period: string;
  quotaBytes: number;
}

// Offer phases must match the displayed terms. Trial/introductory and installment
// offers need additional disclosures and are intentionally excluded here.
export function billingOffers(
  plans: BillingPlan[],
  products: ProductSubscription[],
): BillingOffer[] {
  return plans.flatMap((plan) => {
    const product = products.find((item) => item.id === plan.product_id);
    if (!product || product.platform !== 'android') return [];
    return product.subscriptionOffers.flatMap((offer) => {
      const phases = offer.pricingPhasesAndroid?.pricingPhaseList ?? [];
      const phase = phases[0];
      if (
        !offer.offerTokenAndroid ||
        offer.installmentPlanDetailsAndroid ||
        phases.length !== 1 ||
        !phase ||
        phase.billingPeriod !== plan.billing_period ||
        phase.recurrenceMode !== 1
      )
        return [];
      return [
        {
          id: `${plan.product_id}:${offer.offerTokenAndroid}`,
          productId: plan.product_id,
          token: offer.offerTokenAndroid,
          name: plan.name,
          price: phase.formattedPrice,
          period: phase.billingPeriod,
          quotaBytes: plan.quota_bytes,
        },
      ];
    });
  });
}

export interface VerifiedPurchase {
  status: string;
  expiresAt: string | null;
}
export async function verifyStorePurchase(
  purchase: Pick<Purchase, 'purchaseState' | 'purchaseToken' | 'productId'>,
  verify: (productId: string, token: string) => Promise<VerifiedPurchase>,
): Promise<VerifiedPurchase> {
  if (purchase.purchaseState === 'pending') return { status: 'pending', expiresAt: null };
  if (purchase.purchaseState !== 'purchased' || !purchase.purchaseToken) {
    throw new Error('Google Play has not completed this purchase. Try restoring purchases later.');
  }
  return verify(purchase.productId, purchase.purchaseToken);
}

export function hasVerifiedAccess(result: VerifiedPurchase, now = Date.now()) {
  return (
    ['active', 'in_grace', 'cancelled'].includes(result.status) &&
    !!result.expiresAt &&
    Date.parse(result.expiresAt) > now
  );
}
