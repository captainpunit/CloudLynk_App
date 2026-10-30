import { supabase } from '@/lib/supabase';
import { invokeBackend } from '@/data/live/invoke-backend';

/**
 * Google Play Billing glue. The app never unlocks access by itself:
 * it sends the purchase token to verify-play-receipt and waits for the
 * server entitlement. The Android screen obtains offers through expo-iap.
 */
export async function verifyPurchaseOnServer(productId: string, purchaseToken: string) {
  return invokeBackend<{ status: string; expiresAt: string | null }>('verify-play-receipt', {
    productId,
    purchaseToken,
  });
}

export async function billingIdentity() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Sign in before using Google Play billing.');
  const profile = await supabase
    .from('profiles')
    .select('play_account_id,account_status')
    .eq('id', user.id)
    .single();
  if (profile.error) throw profile.error;
  if (profile.data.account_status !== 'active')
    throw new Error('Your account cannot make purchases.');
  if (!profile.data.play_account_id)
    throw new Error('Your billing account is not ready. Try again later.');
  return { userId: user.id, accountId: profile.data.play_account_id };
}
