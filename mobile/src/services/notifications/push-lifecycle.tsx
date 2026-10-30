import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useWorkspace } from '@/state/workspace-provider';
import { enablePush, pushEnabled } from './push';

export function PushLifecycle() {
  const { demo, state, refresh } = useWorkspace();
  useEffect(() => {
    if (demo || !state.profile || Platform.OS !== 'android') return;
    let disposed = false;
    const subscriptions: { remove(): void }[] = [];
    void (async () => {
      // Import the native module only in a live Android session. Permission is
      // requested from the inbox, never automatically on launch.
      const notifications = await import('expo-notifications');
      if (disposed) return;
      const openInbox = () => {
        if (!disposed) {
          void refresh();
          router.push('/notifications');
        }
      };
      subscriptions.push(
        notifications.addNotificationReceivedListener(() => {
          if (!disposed) void refresh();
        }),
      );
      subscriptions.push(notifications.addNotificationResponseReceivedListener(openInbox));
      subscriptions.push(
        notifications.addPushTokenListener(() => {
          void pushEnabled()
            .then((enabled) => {
              if (enabled && !disposed) return enablePush(false);
            })
            .catch(() => {});
        }),
      );
      if (await pushEnabled()) await enablePush(false);
      const last = await notifications.getLastNotificationResponseAsync();
      if (last && !disposed) {
        await notifications.clearLastNotificationResponseAsync();
        openInbox();
      }
    })().catch(() => {
      /* Permission/configuration errors remain retryable in the inbox. */
    });
    return () => {
      disposed = true;
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [demo, state.profile?.id, refresh]);
  return null;
}
