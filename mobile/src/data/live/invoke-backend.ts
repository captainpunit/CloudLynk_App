import { supabase } from '@/lib/supabase';

const messages: Record<string, string> = {
  publisher_required: 'Publishing permission is required. Ask an administrator for access.',
  title_unavailable: 'This title is unavailable or is not published.',
  age_restricted:
    'Set your date of birth in Settings. You must meet the age rating to watch this title.',
  video_processing: 'The video is still processing. Please try again later.',
  subscription_required: 'An active Plus subscription is required to watch this title.',
  membership_required: 'Join this channel before watching.',
  private_channel: 'An invitation to this private channel is required.',
  channel_unavailable: 'This channel is unavailable.',
  territory_unavailable: 'This title is unavailable in your region.',
  recent_sign_in_required: 'Sign in again, then request account deletion within 15 minutes.',
  sign_in_required: 'Please sign in again.',
  account_restricted: 'Your account is restricted. Contact support if you need help.',
  purchase_owner_mismatch:
    'This purchase belongs to another CloudLynk account. Sign in to the original account.',
  purchase_owner_missing:
    'Google Play could not link this purchase to your account. Contact support.',
  purchase_erased: 'This purchase was associated with a deleted account.',
  subscription_sync_busy: 'Your purchase is being verified. Try Restore purchases shortly.',
  temporarily_unavailable: 'The service is temporarily unavailable. Please try again.',
};

export async function invokeBackend<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let response;
  try {
    response = await supabase.functions.invoke(name, { body, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  const { data, error } = response;
  if (error) {
    let code: string | undefined;
    try {
      const context = (error as { context?: Response }).context;
      if (context instanceof Response) code = (await context.clone().json()).error;
    } catch {
      /* Never expose raw provider responses or tokens. */
    }
    throw new Error(
      (code && messages[code]) || 'The request could not be completed. Please try again.',
    );
  }
  if (!data || typeof data !== 'object')
    throw new Error('The server returned an invalid response.');
  return data as T;
}
