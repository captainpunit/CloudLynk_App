import { useState } from 'react';
import { View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import {
  Button,
  EmptyState,
  ErrorNote,
  Label,
  Pill,
  Screen,
  Section,
  Surface,
} from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { colors as c } from '@/theme/tokens';
import type { ChannelStatus, ChannelVisibility } from '@/domain/models';
import LiveAdmin from './live-admin';

export default function AdminScreen() {
  const { state, demo, dispatch, notify } = useWorkspace();
  const [tab, setTab] = useState('Channels');
  const [error, setError] = useState<string | null>(null);
  if (!demo) return <LiveAdmin />;
  if (state.profile?.role !== 'admin')
    return (
      <Screen title="Admin workspace" back>
        <EmptyState
          icon={ShieldCheck}
          title="Admin access required"
          body="Only an administrator can review channels or change their visibility."
        />
      </Screen>
    );
  function update(id: string, changes: { visibility?: ChannelVisibility; status?: ChannelStatus }) {
    try {
      dispatch({ type: 'channel-updated', id, changes });
      notify('Channel review updated in preview');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Update failed.');
    }
  }
  return (
    <Screen
      title="A thoughtful community."
      subtitle="Review submissions and keep the space welcoming."
      back
    >
      <Surface style={{ backgroundColor: c.primarySoft }}>
        <ShieldCheck color={c.primary} size={24} />
        <Label style={{ color: c.primary }}>
          {demo
            ? 'Local admin simulation. No production permissions or records are changed.'
            : 'Admin actions require the production moderation API.'}
        </Label>
      </Surface>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {['Channels', 'Reports'].map((item) => (
          <Pill key={item} title={item} selected={tab === item} onPress={() => setTab(item)} />
        ))}
      </View>
      <ErrorNote message={error} />
      {tab === 'Channels' ? (
        <>
          <Section title="Channel review" />
          {[...state.channels]
            .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'))
            .map((channel) => (
              <Surface key={channel.id}>
                <Label
                  style={{ color: c.primary, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}
                >
                  {channel.status.toUpperCase()} · {channel.visibility.toUpperCase()}
                </Label>
                <Label style={{ fontWeight: '700', fontSize: 18 }}>{channel.name}</Label>
                <Label style={{ color: c.muted, fontSize: 12 }}>{channel.description}</Label>
                <Label style={{ fontWeight: '600', fontSize: 12 }}>Visibility</Label>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {(['public', 'premium', 'private'] as const).map((visibility) => (
                    <Pill
                      key={visibility}
                      title={visibility}
                      selected={channel.visibility === visibility}
                      onPress={() => update(channel.id, { visibility })}
                    />
                  ))}
                </View>
                <View style={{ gap: 8 }}>
                  <Button
                    title={
                      channel.status === 'published' ? 'Unpublish channel' : 'Approve and publish'
                    }
                    variant={channel.status === 'published' ? 'outline' : 'primary'}
                    onPress={() =>
                      update(channel.id, {
                        status: channel.status === 'published' ? 'hidden' : 'published',
                      })
                    }
                  />
                </View>
              </Surface>
            ))}
        </>
      ) : (
        <>
          <Section title="Content reports" />
          {state.reports.length ? (
            state.reports.map((report) => (
              <Surface key={report.id}>
                <Label style={{ fontWeight: '700' }}>{report.reason}</Label>
                <Label style={{ color: c.muted, fontSize: 12 }}>
                  {state.videos.find((video) => video.id === report.videoId)?.title ??
                    'Removed video'}
                </Label>
                <Label>{report.details || 'No extra details provided.'}</Label>
                <Label style={{ color: c.primary, fontSize: 11 }}>
                  {report.resolved ? 'Reviewed' : 'Needs review'}
                </Label>
                {!report.resolved && (
                  <Button
                    title="Mark reviewed"
                    variant="soft"
                    onPress={() => {
                      dispatch({ type: 'report-resolved', id: report.id });
                    }}
                  />
                )}
              </Surface>
            ))
          ) : (
            <EmptyState
              icon={ShieldCheck}
              title="All quiet here"
              body="Content reports will appear here for your review."
            />
          )}
        </>
      )}
    </Screen>
  );
}
