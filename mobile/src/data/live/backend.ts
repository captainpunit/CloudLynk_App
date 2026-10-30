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
