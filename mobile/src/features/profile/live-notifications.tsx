import { useState } from 'react';
import { Button, EmptyState, ErrorNote, Label, Screen, Surface } from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { call } from '@/data/live/backend';
import { disablePush, enablePush } from '@/services/notifications/push';

export default function LiveNotifications() {
  const { state, requireIdentity, refresh, refreshing, error: loadError, notify } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(work: () => Promise<unknown>, message: string) {
    if (busy || !requireIdentity()) return;
    setBusy(true);
    setError(null);
    try {
      await work();
      await refresh();
      notify(message);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Your notifications" back>
      <ErrorNote message={error ?? loadError} />
      {!state.profile ? (
        <Button title="Sign in to view notifications" onPress={requireIdentity} />
      ) : (
        <>
          <Button
            title="Enable device notifications"
            disabled={busy}
            onPress={() => void run(() => enablePush(), 'Device notifications enabled.')}
          />
          <Button
            title="Disable device notifications"
            variant="outline"
            disabled={busy}
            onPress={() => void run(disablePush, 'Device notifications disabled.')}
          />
          <Button
            title="Refresh inbox"
            variant="soft"
            loading={refreshing || busy}
            onPress={() => void refresh()}
          />
          {!(state.notices ?? []).length && (
            <EmptyState title="All caught up" body="Your account notices will appear here." />
          )}
          {(state.notices ?? []).map((notice) => (
            <Surface key={notice.id}>
              <Label style={{ fontWeight: '700' }}>{notice.title}</Label>
              <Label>{notice.body}</Label>
              <Label>
                {new Date(notice.createdAt).toLocaleString()} · {notice.readAt ? 'Read' : 'Unread'}
              </Label>
              {!notice.readAt && (
                <Button
                  title="Mark read"
                  variant="soft"
                  disabled={busy}
                  onPress={() =>
                    void run(
                      () => call('mark_notice_read', { p_notice_id: notice.id }),
                      'Notice marked read.',
                    )
                  }
                />
              )}
            </Surface>
          ))}
        </>
      )}
    </Screen>
  );
}
