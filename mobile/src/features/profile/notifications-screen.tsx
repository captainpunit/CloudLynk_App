import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Bell } from 'lucide-react-native';
import {
  Button,
  Caption,
  EmptyState,
  ErrorNote,
  Heading,
  Label,
  Screen,
  StatusBadge,
  Surface,
} from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { call } from '@/data/live/backend';
import { disablePush, enablePush, pushEnabled } from '@/services/notifications/push';

export default function NotificationsScreen() {
  const { state, requireIdentity, refresh, refreshing, error: loadError, notify } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // null while the phone's setting is being read.
  const [phoneOn, setPhoneOn] = useState<boolean | null>(null);
  const signedIn = !!state.profile;

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void pushEnabled().then((on) => live && setPhoneOn(on));
    return () => {
      live = false;
    };
  }, [signedIn]);

  async function run(work: () => Promise<unknown>, message: string) {
    if (busy || !requireIdentity()) return false;
    setBusy(true);
    setError(null);
    try {
      await work();
      notify(message);
      return true;
    } catch (cause) {
      setError((cause as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function togglePhone() {
    const turnOn = !phoneOn;
    const done = await run(
      turnOn ? () => enablePush() : disablePush,
      turnOn ? 'Notifications turned on.' : 'Notifications turned off.',
    );
    if (done) setPhoneOn(turnOn);
  }

  // Unread first, newest first within each group.
  const notices = [...(state.notices ?? [])].sort(
    (a, b) =>
      Number(!!a.readAt) - Number(!!b.readAt) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <Screen
      title="Notifications"
      back
      refreshing={refreshing}
      onRefresh={signedIn ? () => void refresh() : undefined}
    >
      <ErrorNote message={error ?? loadError} />
      {!signedIn ? (
        <EmptyState
          icon={Bell}
          title="Sign in to see notifications"
          body="Payment confirmations, creator reviews and replies to your reports show up here."
          action="Sign in"
          onPress={requireIdentity}
        />
      ) : (
        <>
          <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Label variant="subhead">Notifications on this phone</Label>
              <Caption>
                {phoneOn === null
                  ? 'Checking…'
                  : phoneOn
                    ? 'On. You hear about payments and reviews right away.'
                    : 'Off. You will only see them here.'}
              </Caption>
            </View>
            <Button
              compact
              variant={phoneOn ? 'outline' : 'primary'}
              title={phoneOn ? 'Turn off' : 'Turn on'}
              loading={busy}
              disabled={phoneOn === null || busy}
              onPress={() => void togglePhone()}
            />
          </Surface>
          {notices.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications yet"
              body="Payment confirmations, creator reviews and replies to your reports show up here."
            />
          ) : (
            notices.map((notice) => (
              <Surface key={notice.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Heading level="subhead" style={{ flex: 1 }}>
                    {notice.title}
                  </Heading>
                  {!notice.readAt && <StatusBadge label="New" tone="warning" />}
                </View>
                <Label variant="callout">{notice.body}</Label>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Caption style={{ flex: 1 }}>
                    {new Date(notice.createdAt).toLocaleString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Caption>
                  {!notice.readAt && (
                    <Button
                      compact
                      variant="soft"
                      title="Mark as read"
                      disabled={busy}
                      onPress={() =>
                        void run(async () => {
                          await call('mark_notice_read', { p_notice_id: notice.id });
                          await refresh();
                        }, 'Marked as read.')
                      }
                    />
                  )}
                </View>
              </Surface>
            ))
          )}
        </>
      )}
    </Screen>
  );
}
