import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProductSubscription } from 'expo-iap';
import { billingOffers, hasVerifiedAccess, verifyStorePurchase } from '../purchase-policy';

const plan = { product_id: 'plus', name: 'Plus', billing_period: 'P1M', quota_bytes: 1024 };
const phase = {
  billingCycleCount: 0,
  billingPeriod: 'P1M',
  formattedPrice: '₹199.00',
  priceAmountMicros: '199000000',
  priceCurrencyCode: 'INR',
  recurrenceMode: 1,
};
const offer = {
  id: 'monthly',
  displayPrice: '₹199.00',
  price: 199,
  offerTokenAndroid: 'store-token',
  pricingPhasesAndroid: { pricingPhaseList: [phase] },
};
const product = {
  id: 'plus',
  platform: 'android',
  subscriptionOffers: [offer],
} as ProductSubscription;

test('live offers use the store price and token for the published billing period', () => {
  const [result] = billingOffers([plan], [product]);
  assert.equal(result.price, '₹199.00');
  assert.equal(result.token, 'store-token');
  assert.equal(billingOffers([{ ...plan, billing_period: 'P1Y' }], [product]).length, 0);
  assert.equal(billingOffers([{ ...plan, product_id: 'other' }], [product]).length, 0);
});
test('trial, installment, and missing-token offers cannot be advertised as regular plans', () => {
  for (const item of [
    { ...offer, pricingPhasesAndroid: { pricingPhaseList: [phase, phase] } },
    { ...offer, offerTokenAndroid: null },
    { ...offer, installmentPlanDetailsAndroid: { commitmentPaymentsCount: 12 } },
  ]) {
    assert.deepEqual(
      billingOffers([plan], [{ ...product, subscriptionOffers: [item] } as ProductSubscription]),
      [],
    );
  }
});
test('pending payment never invokes verification or grants access', async () => {
  const result = await verifyStorePurchase(
    { purchaseState: 'pending', productId: 'plus' },
    async () => {
      throw new Error('must not verify');
    },
  );
  assert.equal(result.status, 'pending');
  assert.equal(hasVerifiedAccess(result), false);
});
test('purchase verification sends the exact Play token and uses the server result', async () => {
  const expected = { status: 'active', expiresAt: '2099-01-01T00:00:00Z' };
  const result = await verifyStorePurchase(
    { purchaseState: 'purchased', purchaseToken: 'play-token', productId: 'plus' },
    async (productId, token) => {
      assert.equal(productId, 'plus');
      assert.equal(token, 'play-token');
      return expected;
    },
  );
  assert.equal(result, expected);
});
test('a failed server verification is not converted to successful access', async () => {
  await assert.rejects(
    verifyStorePurchase(
      { purchaseState: 'purchased', purchaseToken: 'token', productId: 'plus' },
      async () => {
        throw new Error('verification failed');
      },
    ),
    /verification failed/,
  );
  await assert.rejects(
    verifyStorePurchase({ purchaseState: 'purchased', productId: 'plus' }, async () => {
      throw new Error('must not verify');
    }),
    /not completed/,
  );
});
test('only paid server states with a future expiry are reported as active', () => {
  for (const status of ['active', 'in_grace', 'cancelled']) {
    assert.equal(hasVerifiedAccess({ status, expiresAt: '2099-01-01T00:00:00Z' }), true);
    assert.equal(hasVerifiedAccess({ status, expiresAt: '2000-01-01T00:00:00Z' }), false);
  }
  for (const status of ['pending', 'on_hold', 'expired', 'refunded', 'unknown']) {
    assert.equal(hasVerifiedAccess({ status, expiresAt: '2099-01-01T00:00:00Z' }), false);
  }
});
