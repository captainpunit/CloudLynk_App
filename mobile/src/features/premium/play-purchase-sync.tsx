import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useWorkspace } from '@/state/workspace-provider';
import { playBillingAvailable } from '@/services/billing/play-choice';
import { syncUnfinishedPlayPurchases } from './use-play-choice';

/**
 * Grants Google Play purchases that were paid but never confirmed with CloudLynk, when a
 * member signs in, opens the app, or comes back to it. Renders nothing.
 */
export function PlayPurchaseSync() {
  const { state, refresh, notify } = useWorkspace();
  const userId = state.profile?.id;
  useEffect(() => {
    if (!playBillingAvailable || !userId) return;
    let active = true;
    const run = () =>
      void syncUnfinishedPlayPurchases()
        .then((granted) => {
          if (!active || granted === 0) return;
          notify('Your Google Play purchase is confirmed. Plus is on.');
          void refresh();
        })
        .catch(() => undefined);
    run();
    const foreground = AppState.addEventListener('change', (status) => {
      if (status === 'active') run();
    });
    return () => {
      active = false;
      foreground.remove();
    };
  }, [userId, refresh, notify]);
  return null;
}
