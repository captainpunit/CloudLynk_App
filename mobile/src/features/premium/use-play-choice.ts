import { useCallback, useEffect, useRef } from 'react';
import { fetchPlayAccountId, verifyPlayProduct } from '@/data/live/payments';
import {
  connectPlayChoice,
  playBillingAvailable,
  type PlayChoice,
  type PlayPurchase,
  type UpiChoice,
} from '@/services/billing/play-choice';

type Callbacks = {
  /** The backend confirmed a Google Play purchase and granted the plan. */
  onGranted: () => void;
  /** The member picked UPI on Google's screen. */
  onUpiChosen: (choice: UpiChoice) => void;
  onError: (message: string) => void;
};

/**
 * Connects the Plus checkout to Google Play's choice screen on Google Play builds.
 * A Google Play purchase is sent to the backend, which confirms it with Google before
 * granting anything. Purchases interrupted earlier are sent again when the screen opens.
 */
export function usePlayChoice(userId: string | undefined, callbacks: Callbacks) {
  const store = useRef<PlayChoice | null>(null);
  const latest = useRef(callbacks);
  latest.current = callbacks;

  useEffect(() => {
    if (!playBillingAvailable || !userId) return;
    let active = true;
    const verifying = new Set<string>();
    const verify = (purchase: PlayPurchase) => {
      if (verifying.has(purchase.purchaseToken)) return;
      verifying.add(purchase.purchaseToken);
      void verifyPlayProduct(purchase.productId, purchase.purchaseToken)
        .then(() => {
          if (active) latest.current.onGranted();
        })
        .catch((cause: Error) => {
          verifying.delete(purchase.purchaseToken);
          if (active) latest.current.onError(cause.message);
        });
    };
    void connectPlayChoice({
      onPurchase: verify,
      onUpiChosen: (choice) => {
        if (active) latest.current.onUpiChosen(choice);
      },
      onError: (message) => {
        if (active) latest.current.onError(message);
      },
    })
      .then(async (connection) => {
        if (!active) return connection.close();
        store.current = connection;
        (await connection.unfinished()).forEach(verify);
      })
      .catch((cause: Error) => {
        if (active) latest.current.onError(cause.message);
      });
    return () => {
      active = false;
      store.current?.close();
      store.current = null;
    };
  }, [userId]);

  const buy = useCallback(
    async (productId: string) => {
      if (!userId || !store.current)
        throw new Error('Google Play billing is not ready yet. Try again in a moment.');
      await store.current.buy(productId, await fetchPlayAccountId(userId));
    },
    [userId],
  );
  return { available: playBillingAvailable, buy };
}
