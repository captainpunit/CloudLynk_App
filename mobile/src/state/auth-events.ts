/**
 * What the workspace does when Supabase reports an auth event.
 *
 * - reset: the signed-in identity changed, so everything loaded belongs to someone else.
 * - reload: load the workspace again.
 *
 * A reset is always followed by a reload. At launch, Supabase restores the stored session and
 * reports SIGNED_IN, or TOKEN_REFRESHED when the stored token had expired; either one replaces
 * the launch load, so skipping the reload left a signed-in member with an empty app.
 */
export function planAuthEvent(
  event: string,
  userId: string | null,
  loadedId: string | null,
): { reset: boolean; reload: boolean } {
  // The launch load already reads the restored session.
  if (event === 'INITIAL_SESSION') return { reset: false, reload: false };
  const reset = userId !== loadedId || event === 'SIGNED_OUT';
  // A routine token refresh for the same member changes nothing that was loaded.
  return { reset, reload: reset || event !== 'TOKEN_REFRESHED' };
}
