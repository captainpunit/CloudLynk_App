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
 * The store library holds one connection for the whole app. Each checkout waits for the
 * one before it to close, so a connection that finishes opening late (after an account
 * switch) cannot end the connection of the checkout that replaced it.
 */
let lastClosed: Promise<void> = Promise.resolve();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    const opened = lastClosed.then(() =>
      connectPlayChoice({
        onPurchase: verify,
        onUpiChosen: (choice) => {
          if (active) latest.current.onUpiChosen(choice);
        },
        onError: (message) => {
          if (active) latest.current.onError(message);
        },
      }),
    );
    void opened
      .then(async (connection) => {
        if (!active) return;
        store.current = connection;
        // A purchase paid for earlier but not yet granted must be found, so listing is
        // tried a few times. If it still fails, the store reports it when buying.
        for (let attempt = 0; active && attempt < 3; attempt++) {
          try {
            (await connection.unfinished()).forEach(verify);
            return;
          } catch {
            await wait(4000);
          }
        }
      })
      .catch((cause: Error) => {
        if (active) latest.current.onError(cause.message);
      });
    return () => {
      active = false;
      store.current = null;
      lastClosed = opened.then(
        (connection) => connection.close(),
        () => undefined,
      );
    };
  }, [userId]);

  const buy = useCallback(
    async (productId: string) => {
      const connection = store.current;
      if (!userId || !connection)
        throw new Error('Google Play billing is not ready yet. Try again in a moment.');
      const accountId = await fetchPlayAccountId(userId);
      // The account may have changed while its ID was fetched; never buy for the old one.
      if (store.current !== connection)
        throw new Error('Google Play billing is not ready yet. Try again in a moment.');
      await connection.buy(productId, accountId);
    },
    [userId],
  );
  return { available: playBillingAvailable, buy };
}
