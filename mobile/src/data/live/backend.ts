import { supabase } from '@/lib/supabase';
import { invokeBackend } from './invoke-backend';
import type { Database } from '@/lib/database.types';

const errors: Record<string, string> = {
  publisher_required: 'Publishing permission is required. Ask an administrator for access.',
  admin_required: 'Administrator access is required.',
  account_restricted: 'Your account is restricted.',
  quota_exceeded: 'Your storage is full. Remove files or choose a larger plan.',
  file_too_large: 'This file exceeds the maximum upload size.',
  too_many_uploads: 'Finish or cancel an unfinished upload before starting another.',
  invalid_name: 'Use a file name without slashes or control characters.',
  upload_expired: 'This upload expired. Cancel it and start again.',
  upload_incomplete: 'The upload is incomplete. Select the same file to resume.',
  size_mismatch: 'The uploaded file does not match the reserved size. Select the original file.',
  video_processing: 'The video is still processing. Refresh its status before submitting it.',
  title_not_editable: 'Reopen this title before editing it.',
  title_unavailable: 'This title is unavailable.',
  series_unavailable: 'Publish the parent series before publishing this episode.',
  reason_required: 'Enter a reason for this action.',
  report_rate_limit: 'You have reached the daily report limit. Please try again tomorrow.',
  sign_in_required: 'Sign in to continue.',
  payments_unavailable: 'Payments are not open yet. Please try again later.',
  plan_unavailable: 'This plan is no longer available. Choose another plan.',
  payment_in_review:
    'We are still checking your last payment. You can pay again once it is decided.',
  too_many_orders: 'Too many payment attempts today. Please try again tomorrow.',
  invalid_utr: 'Enter the 12-digit UTR shown in your UPI app.',
  utr_already_used: 'This UTR has already been used for another payment.',
  invalid_state: 'Choose your state from the list.',
  invalid_play_token: 'Google Play did not return a valid choice. Start again from the plan list.',
  play_token_already_used:
    'This Google Play choice was already used. Start again from the plan list.',
  invalid_tax_percent: 'Enter a GST percentage between 0 and 50.',
  order_not_found: 'This payment request was not found. Start again from the plan list.',
  order_closed: 'This payment request is closed. Start again from the plan list.',
  too_many_attempts: 'This payment request has been reported too many times. Contact support.',
  order_not_pending: 'This payment has already been decided.',
  invalid_upi_address: 'Enter a valid UPI ID, for example business@bank.',
  invalid_payee_name: 'Use letters, numbers, spaces, dots or hyphens for the payee name.',
  invalid_merchant_code: 'The merchant category code is four digits.',
  invalid_plan_id: 'Use lowercase letters, numbers, dots or underscores for the plan ID.',
  invalid_plan_name: 'Use a plan name of 2 to 40 characters.',
  invalid_billing_period: 'Choose a billing period.',
  invalid_price: 'Enter a price of at least ₹1.',
  invalid_quota: 'Enter the storage included with this plan.',
};
export function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error)
    throw new Error(
      errors[result.error.message] ?? 'The request could not be completed. Refresh and try again.',
    );
  return result.data;
}
type Functions = Database['public']['Functions'];
export async function call<N extends keyof Functions>(name: N, args: Functions[N]['Args']) {
  return checked(await supabase.rpc(name, args));
}
export function playbackToken(titleId: string) {
  return invokeBackend<{ hlsUrl: string; dashUrl: string; expiresAt: string }>(
    'stream-playback-token',
    { titleId },
  );
}
export function allocateVideo(titleId: string, sizeBytes: number) {
  return invokeBackend<{ assetId: string; uploadURL: string; expiresAt: string; protocol: string }>(
    'generate-stream-upload',
    { titleId, sizeBytes },
  );
}
