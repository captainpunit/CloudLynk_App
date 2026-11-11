import { Platform } from 'react-native';
import type { Purchase } from 'expo-iap';

/**
 * Google Play user choice billing. On builds for Google Play, buying a plan opens
 * Google's screen where the member picks Google Play billing or CloudLynk's UPI checkout.
 * This file only talks to the store; the app never unlocks access by itself. A Google
 * Play purchase is verified by the backend, and a UPI payment by an administrator.
 *
 * Builds distributed outside Google Play leave EXPO_PUBLIC_PLAY_BILLING unset and go
 * straight to UPI; the store library is not loaded.
 */
export const playBillingAvailable =
  Platform.OS === 'android' && process.env.EXPO_PUBLIC_PLAY_BILLING === 'true';

export type PlayPurchase = { productId: string; purchaseToken: string };
/** The member chose UPI. Google requires the token when the payment is reported. */
export type UpiChoice = { productId: string; externalTransactionToken: string };

export type PlayChoiceHandlers = {
  onPurchase: (purchase: PlayPurchase) => void;
  onUpiChosen: (choice: UpiChoice) => void;
  /** Called with a message for the member; not called when they cancel. */
  onError: (message: string) => void;
};

export type PlayChoice = {
  /** Opens Google's choice screen for a plan. The result arrives through the handlers. */
  buy: (productId: string, playAccountId: string) => Promise<void>;
  /** Purchases Google holds that the backend has not consumed yet (interrupted earlier). */
  unfinished: () => Promise<PlayPurchase[]>;
  close: () => void;
};

const paid = (purchase: Purchase): PlayPurchase | null =>
  purchase.purchaseState === 'purchased' && purchase.purchaseToken
    ? { productId: purchase.productId, purchaseToken: purchase.purchaseToken }
    : null;

export async function connectPlayChoice(handlers: PlayChoiceHandlers): Promise<PlayChoice> {
  const store = await import('expo-iap');
  const listeners = [
    store.purchaseUpdatedListener((purchase) => {
      const result = paid(purchase);
      if (result) handlers.onPurchase(result);
      else if (purchase.purchaseState === 'pending')
        handlers.onError(
          'Google Play is still collecting the payment. Plus starts once it is paid.',
        );
    }),
    store.purchaseErrorListener((failure) => {
      if (failure.code !== store.ErrorCode.UserCancelled)
        handlers.onError('Google Play could not complete the purchase. Please try again.');
    }),
    store.userChoiceBillingListenerAndroid((details) => {
      const productId = details.products[0];
      if (productId)
        handlers.onUpiChosen({
          productId,
          externalTransactionToken: details.externalTransactionToken,
        });
    }),
  ];
  const close = () => {
    listeners.forEach((listener) => listener.remove());
    void store.endConnection().catch(() => undefined);
  };
  try {
    if (!(await store.initConnection({ enableBillingProgramAndroid: 'user-choice-billing' })))
      throw new Error('not connected');
  } catch {
    close();
    throw new Error('Google Play billing could not connect. Check your connection and try again.');
  }
  return {
    close,
    async buy(productId, playAccountId) {
      let listed = false;
      try {
        const products = await store.fetchProducts({ skus: [productId], type: 'in-app' });
        listed = !!products?.length;
        // The account ID lets the backend refuse a purchase made by a different account.
        if (listed)
          await store.requestPurchase({
            request: { google: { skus: [productId], obfuscatedAccountId: playAccountId } },
            type: 'in-app',
          });
      } catch {
        // The library's own messages ("Store service is not connected") mean nothing to members.
        throw new Error(
          'Google Play is not available right now. Check that Google Play Store is signed in and up to date, then try again.',
        );
      }
      if (!listed) throw new Error('This plan is not available on Google Play yet.');
    },
    async unfinished() {
      const purchases = await store.getAvailablePurchases();
      return purchases.flatMap((purchase) => paid(purchase) ?? []);
    },
  };
}
