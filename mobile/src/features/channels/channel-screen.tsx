import { useState } from 'react';
import { Share, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { LockKeyhole, Share2, Users } from 'lucide-react-native';
import {
  Button,
  EmptyState,
  ErrorNote,
  IconButton,
  Label,
  PlusBadge,
  Screen,
  Section,
  Field,
  Surface,
} from '@/components/ui';
import { VideoCard } from '@/components/media-card';
import { compactNumber } from '@/domain/format';
import { useWorkspace } from '@/state/workspace-provider';
import { colors as c } from '@/theme/tokens';
import { call } from '@/data/live/backend';

export default function ChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, join, demo, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUser, setInviteUser] = useState('');
  const channel = state.channels.find((item) => item.id === id);
  if (
    !channel ||
    (channel.status !== 'published' &&
      channel.ownerId !== state.profile?.id &&
      state.profile?.role !== 'admin') ||
    (demo && channel.visibility === 'private' && channel.ownerId !== state.profile?.id)
  )
    return (
      <Screen title="Channel" back>
        <EmptyState
          icon={LockKeyhole}
          title="This channel is unavailable"
          body="It may be private or waiting for review. Explore the published catalogue instead."
          action="Explore channels"
          onPress={() => router.replace('/channels')}
        />
      </Screen>
    );
  const joined = state.joinedIds.includes(channel.id);
  const premium = channel.visibility === 'premium';
  async function toggleJoin() {
    setBusy(true);
    setError(null);
    try {
      await join(id, !joined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="The channel"
      back
      action={
        <IconButton
          icon={Share2}
          label="Share channel"
          onPress={() => {
            void Share.share({
              message: `Discover ${channel.name} on CloudLynk: https://cloudlynk.app/open/channel/${id}`,
            }).catch(() => setError('Sharing is unavailable on this device.'));
          }}
        />
      }
    >
      <Image source={channel.cover} style={{ height: 230, borderRadius: 23 }} contentFit="cover" />
      <View style={{ gap: 10 }}>
        {premium && (
          <View style={{ alignSelf: 'flex-start' }}>
            <PlusBadge />
          </View>
        )}
        <Label
          accessibilityRole="header"
          style={{ fontSize: 29, lineHeight: 36, fontWeight: '700', letterSpacing: -0.9 }}
        >
          {channel.name}
        </Label>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Users size={14} color={c.muted} />
          <Label style={{ color: c.muted, fontSize: 12 }}>
            {demo ? `${compactNumber(channel.members)} members · ` : ''}
            {channel.category}
          </Label>
        </View>
        <Label style={{ color: c.muted }}>{channel.description}</Label>
      </View>
      <ErrorNote message={error} />
      <Button
        title={
          joined
            ? 'Leave channel'
            : premium && !(demo ? state.demoPlanId : state.subscribed)
              ? 'Unlock with Plus'
              : 'Join channel'
        }
        variant={joined ? 'outline' : 'primary'}
        loading={busy}
        onPress={() => void toggleJoin()}
      />
      <Section title="Inside this channel" />
      {!demo && (channel.ownerId === state.profile?.id || state.profile?.role === 'admin') && (
        <Surface>
          <Button
            title="Manage titles and uploads"
            onPress={() => router.push({ pathname: '/upload', params: { channelId: id } })}
          />
          <Field
            label="Invite a user to this private channel (user ID)"
            value={inviteUser}
            onChangeText={setInviteUser}
            autoCapitalize="none"
          />
          <Button
            title="Send invitation"
            loading={busy}
            onPress={() => {
              setBusy(true);
              setError(null);
              void call('invite_channel_member', { p_channel_id: id, p_user_id: inviteUser.trim() })
                .then(async () => {
                  setInviteUser('');
                  await refresh();
                })
                .catch((cause: Error) => setError(cause.message))
                .finally(() => setBusy(false));
            }}
          />
        </Surface>
      )}
      {state.videos
        .filter((video) => video.channelId === id)
        .map((video) => (
          <VideoCard key={video.id} video={video} channel={channel} />
        ))}
      {!state.videos.some((video) => video.channelId === id) && (
        <EmptyState
          title="First story coming soon"
          body="This channel has not published any videos yet."
        />
      )}
      {demo && (
        <Label style={{ fontSize: 11, color: c.muted }}>
          Sample channel and editorial artwork. Preview video footage is illustrative.
        </Label>
      )}
    </Screen>
  );
}
