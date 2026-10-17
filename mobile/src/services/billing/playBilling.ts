import { supabase } from "@/lib/supabase";

/**
 * Google Play Billing glue. The app never unlocks access by itself:
 * it sends the purchase token to verify-play-receipt and waits for the
 * server entitlement. Purchase UI (expo-iap) is wired in the subscription PR.
 */
export async function verifyPurchaseOnServer(productId: string, purchaseToken: string) {
  const { data, error } = await supabase.functions.invoke("verify-play-receipt", {
    body: { productId, purchaseToken },
  });
  if (error) throw error;
  return data as { status: string; expiresAt: string | null };
}
