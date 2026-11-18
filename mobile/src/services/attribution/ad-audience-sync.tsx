import { useEffect } from 'react';
import { useWorkspace } from '@/state/workspace-provider';
import { rememberAdLink, reportAdAudience } from './ad-audience';

/**
 * Once an organic member is signed in, sends what this device knows about coming from an
 * advert, then reloads so channels meant for ads members appear. Renders nothing.
 */
export function AdAudienceSync() {
  const { state, refresh } = useWorkspace();
  const userId = state.profile?.id;
  const organic = state.profile?.audience !== 'ads';
  useEffect(() => {
    if (!userId || !organic) return;
    let active = true;
    void reportAdAudience()
      .then((changed) => {
        if (changed && active) void refresh();
      })
      // Tried again on the next launch; until then the member simply sees organic channels.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId, organic, refresh]);
  return null;
}

/**
 * For the /open/... routes: remembers an ad link and, when the member is already signed
 * in, applies it at once instead of on the next launch.
 */
export function useAdLink(fromAd: boolean) {
  const { state, refresh } = useWorkspace();
  const signedIn = !!state.profile;
  const organic = state.profile?.audience !== 'ads';
  useEffect(() => {
    if (!fromAd) return;
    void (async () => {
      await rememberAdLink();
      if (signedIn && organic && (await reportAdAudience())) await refresh();
    })().catch(() => undefined);
    // Runs once per link opened; the member's state is read when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAd]);
}
