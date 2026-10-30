import { useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import type { Purchase } from 'expo-iap';
import { Button, ErrorNote, Label, Surface } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { fileSize } from '@/domain/format';
import { billingIdentity, verifyPurchaseOnServer } from '@/services/billing/playBilling';
import {
  billingOffers,
  hasVerifiedAccess,
  verifyStorePurchase,
  type BillingOffer,
} from '@/services/billing/purchase-policy';
import { useWorkspace } from '@/state/workspace-provider';

type Store = typeof import('expo-iap');
const periods: Record<string, string> = {
  P1M: 'month',
  P3M: '3 months',
  P6M: '6 months',
  P1Y: 'year',
};

export default function LiveBilling() {
  const { state, requireIdentity, refresh, notify } = useWorkspace();
  const [offers, setOffers] = useState<BillingOffer[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  const store = useRef<Store | null>(null);
  const process = useRef<((purchase: Purchase) => Promise<void>) | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android' || !state.profile) return;
    let disposed = false;
    let sdk: Store | undefined;
    let updates: { remove(): void } | undefined;
    let failures: { remove(): void } | undefined;
    const pending = new Map<string, Promise<void>>();
    const userId = state.profile.id;
    setReady(false);
    setError(null);
    setBusy(true);
    setOffers([]);
    setSelected('');
    const verify = async (purchase: Purchase) => {
      const key = purchase.purchaseToken ?? purchase.id;
      if (pending.has(key)) return pending.get(key)!;
      const task = (async () => {
        const identity = await billingIdentity();
        if (disposed || identity.userId !== userId)
          throw new Error('Your account changed. Reopen billing.');
        const result = await verifyStorePurchase(purchase, verifyPurchaseOnServer);
        if (disposed) return;
        if (!result || typeof result.status !== 'string')
          throw new Error('Purchase verification failed. Try Restore purchases.');
        // The server acknowledges Play purchases after committing entitlement.
        await refresh();
        if (!disposed)
          notify(
            hasVerifiedAccess(result)
              ? 'Your subscription is verified and active.'
              : result.status === 'pending'
                ? 'Payment is pending. Access will begin after Google Play confirms payment.'
                : 'Purchase checked. No active subscription was found for this purchase.',
          );
      })();
      pending.set(key, task);
      try {
        await task;
      } finally {
        pending.delete(key);
      }
    };
    process.current = verify;
    void (async () => {
      try {
        sdk = await import('expo-iap');
        if (disposed) return;
        updates = sdk.purchaseUpdatedListener((purchase) => {
          if (disposed) return;
          setBusy(true);
          void verify(purchase)
            .catch(() => {
              if (!disposed)
                setError('Purchase verification did not finish. Tap Restore purchases to retry.');
            })
            .finally(() => {
              if (!disposed) setBusy(false);
            });
        });
        failures = sdk.purchaseErrorListener((failure) => {
          if (disposed) return;
          setBusy(false);
          if (failure.code !== 'user-cancelled')
            setError('Google Play could not complete the purchase. Please try again.');
        });
        if (!(await sdk.initConnection()))
          throw new Error('Google Play billing could not connect.');
        if (disposed) {
          await sdk.endConnection();
          return;
        }
        store.current = sdk;
        // Allow restores even if the active plan catalogue is temporarily unavailable.
        setReady(true);
        const plans = await supabase
          .from('plans')
          .select('product_id,name,billing_period,quota_bytes');
        if (plans.error) throw plans.error;
        const ids = (plans.data ?? []).map((plan) => plan.product_id);
        const products = ids.length ? await sdk.fetchProducts({ skus: ids, type: 'subs' }) : [];
        const available = billingOffers(
          plans.data ?? [],
          (products ?? []) as import('expo-iap').ProductSubscription[],
        );
        if (!disposed) {
          setOffers(available);
          setSelected(available[0]?.id ?? '');
        }
      } catch {
        if (!disposed)
          setError(
            'Plans could not load. Use an Android build with Google Play billing and try again.',
          );
      } finally {
        if (!disposed) setBusy(false);
      }
    })();
    return () => {
      disposed = true;
      updates?.remove();
      failures?.remove();
      store.current = null;
      process.current = null;
      if (sdk) void sdk.endConnection().catch(() => {});
    };
  }, [state.profile?.id, reload, refresh, notify]);

  async function buy() {
    if (!requireIdentity() || busy) return;
    const offer = offers.find((item) => item.id === selected);
    if (!store.current || !offer) return;
    setBusy(true);
    setError(null);
    try {
      const identity = await billingIdentity();
      if (identity.userId !== state.profile?.id)
        throw new Error('Your account changed. Reopen billing.');
      const existing = await store.current.getAvailablePurchases();
      if (existing.some((purchase) => ['purchased', 'pending'].includes(purchase.purchaseState))) {
        throw new Error(
          'A Google Play purchase already exists. Restore it or manage your subscription in Google Play before choosing another plan.',
        );
      }
      await store.current.requestPurchase({
        type: 'subs',
        request: {
          google: {
            skus: [offer.productId],
            obfuscatedAccountId: identity.accountId,
            subscriptionOffers: [{ sku: offer.productId, offerToken: offer.token }],
          },
        },
      });
      // Completion/cancellation arrives through the listeners.
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Purchase could not start. Please try again.',
      );
      setBusy(false);
    }
  }
  async function restore() {
    if (!requireIdentity() || busy || !store.current || !process.current) return;
    setBusy(true);
    setError(null);
    try {
      const purchases = await store.current.getAvailablePurchases();
      if (!purchases.length) notify('No Google Play purchases were found.');
      // Include retired products: the server still verifies their existing tokens.
      for (const purchase of purchases) await process.current(purchase);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Restoration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  if (Platform.OS !== 'android')
    return (
      <Surface>
        <Label>Purchase and restore subscriptions in the CloudLynk Android app.</Label>
      </Surface>
    );
  if (!state.profile) return <Button title="Sign in to view plans" onPress={requireIdentity} />;
  return (
    <Surface>
      {offers.map((offer) => (
        <Button
          key={offer.id}
          title={`${selected === offer.id ? '✓ ' : ''}${offer.name}: ${offer.price} / ${periods[offer.period]} · ${fileSize(offer.quotaBytes)}`}
          variant={selected === offer.id ? 'soft' : 'outline'}
          disabled={busy}
          onPress={() => setSelected(offer.id)}
        />
      ))}
      {ready && !offers.length && (
        <Label>No subscription plans are currently available for purchase.</Label>
      )}
      <ErrorNote message={error} />
      <Button
        title="Subscribe with Google Play"
        onPress={() => void buy()}
        loading={busy}
        disabled={!ready || !selected}
      />
      <Button
        title="Restore purchases"
        variant="outline"
        onPress={() => void restore()}
        disabled={!ready || busy}
      />
      <Button
        title="Reload plans"
        variant="soft"
        onPress={() => setReload((value) => value + 1)}
        disabled={busy}
      />
      <Button
        title="Manage Google Play subscription"
        variant="outline"
        onPress={() =>
          void Linking.openURL('https://play.google.com/store/account/subscriptions').catch(() =>
            setError('Google Play could not open.'),
          )
        }
      />
      <Label>
        Subscriptions renew automatically unless canceled in Google Play. Review the price and
        billing period before confirming payment.
      </Label>
    </Surface>
  );
}
