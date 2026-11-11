import { useState } from 'react';
import { Share, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Clapperboard, LockKeyhole, Share2, Upload } from 'lucide-react-native';
import {
  Button,
  Caption,
  EmptyState,
  ErrorNote,
  Field,
  IconButton,
  Label,
  PlusBadge,
  Screen,
  Section,
} from '@/components/ui';
import { VideoRow } from '@/components/media-card';
import { PlusOffer } from '@/components/plus-offer';
import { useWorkspace } from '@/state/workspace-provider';
import { gutter } from '@/theme/tokens';
import { usePalette } from '@/theme/tone';
import { call } from '@/data/live/backend';
import { env, shareUrl } from '@/lib/env';
import type { Channel } from '@/domain/models';
import { browsableVideos, count } from '@/features/explore/catalogue';

export default function ChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const channel = state.channels.find((item) => item.id === id);
  if (
    !channel ||
    (channel.status !== 'published' &&
      channel.ownerId !== state.profile?.id &&
      state.profile?.role !== 'admin')
  )
    return (
      <Screen tone="dark" title="Channel" back>
        <EmptyState
          icon={LockKeyhole}
          title="This channel is unavailable"
          body="It may be private or waiting for review."
          action="Browse channels"
          onPress={() => router.replace('/channels')}
        />
      </Screen>
    );
  const owner = channel.ownerId === state.profile?.id;
  const videos = browsableVideos(state, new Set([channel.id]));
  return (
    <Screen
      tone="dark"
      back
      action={
        <IconButton
          icon={Share2}
          label="Share channel"
          onPress={() => {
            void Share.share({
              message: `Watch ${channel.name} on ${env.appName}: ${shareUrl(`/open/channel/${id}`)}`,
            }).catch(() => setError('Sharing is unavailable on this device.'));
          }}
        />
      }
    >
      <Masthead channel={channel} videoCount={videos.length} />
      <ErrorNote message={error} />
      {owner ? (
        <Button
          title="Manage videos"
          icon={Upload}
          onPress={() => router.push({ pathname: '/upload', params: { channelId: id } })}
        />
      ) : (
        <MembershipAction channel={channel} onError={setError} />
      )}
      {(owner ? channel.visibility === 'private' : state.profile?.role === 'admin') && (
        <OwnerTools channel={channel} owner={owner} onError={setError} />
      )}
      <View style={{ gap: 16 }}>
        <Section title="Videos" />
        {videos.length ? (
          videos.map((video) => <VideoRow key={video.id} video={video} channel={channel} />)
        ) : (
          <EmptyState
            icon={Clapperboard}
            title="No videos yet"
            body={
              owner
                ? 'Upload your first video. It goes live after an admin reviews it.'
                : 'New videos appear here as soon as they are published.'
            }
          />
        )}
      </View>
    </Screen>
  );
}

function Masthead({ channel, videoCount }: { channel: Channel; videoCount: number }) {
  const p = usePalette();
  return (
    <View style={{ gap: 14, marginTop: -8 }}>
      <Image
        source={channel.cover}
        style={{ marginHorizontal: -gutter, aspectRatio: 16 / 9, backgroundColor: p.surface }}
        contentFit="cover"
        transition={200}
      />
      <View style={{ gap: 6 }}>
        <Label
          accessibilityRole="header"
          style={{ fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -1 }}
        >
          {channel.name}
        </Label>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {channel.visibility === 'premium' && <PlusBadge />}
          <Caption>
            {[
              channel.visibility === 'private' ? 'Private channel' : channel.category,
              count(videoCount, 'video'),
              channel.status === 'pending' && 'Waiting for review',
              channel.status === 'hidden' && 'Hidden',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Caption>
        </View>
        {!!channel.description && (
          <Caption style={{ fontSize: 15, lineHeight: 22, color: p.ink }}>
            {channel.description}
          </Caption>
        )}
      </View>
    </View>
  );
}

/** Join, leave or subscribe: what a viewer who does not own the channel can do. */
function MembershipAction({
  channel,
  onError,
}: {
  channel: Channel;
  onError: (message: string | null) => void;
}) {
  const { state, join } = useWorkspace();
  const p = usePalette();
  const [busy, setBusy] = useState(false);
  const joined = state.joinedIds.includes(channel.id);
  function toggle() {
    setBusy(true);
    onError(null);
    join(channel.id, !joined)
      .catch((cause: unknown) =>
        onError(cause instanceof Error ? cause.message : 'Please try again.'),
      )
      .finally(() => setBusy(false));
  }
  if (joined)
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Check size={18} color={p.ink} />
          <Label style={{ fontWeight: '600' }}>You joined this channel</Label>
        </View>
        <Button
          title="Leave"
          variant="outline"
          compact
          loading={busy}
          label={`Leave ${channel.name}`}
          onPress={toggle}
        />
      </View>
    );
  if (channel.visibility === 'premium' && !state.subscribed)
    return <PlusOffer title="Subscribe to watch this channel" action="Subscribe to watch" />;
  return (
    <Button title="Join channel" loading={busy} label={`Join ${channel.name}`} onPress={toggle} />
  );
}

function OwnerTools({
  channel,
  owner,
  onError,
}: {
  channel: Channel;
  owner: boolean;
  onError: (message: string | null) => void;
}) {
  const { refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [inviteUser, setInviteUser] = useState('');
  return (
    <View style={{ gap: 12 }}>
      {!owner && (
        <Button
          title="Manage titles and uploads"
          variant="outline"
          onPress={() => router.push({ pathname: '/upload', params: { channelId: channel.id } })}
        />
      )}
      {channel.visibility === 'private' && (
        <>
          <Field
            label="Invite someone to this private channel (user ID)"
            value={inviteUser}
            onChangeText={setInviteUser}
            autoCapitalize="none"
          />
          <Button
            title="Send invitation"
            variant="soft"
            loading={busy}
            onPress={() => {
              setBusy(true);
              onError(null);
              void call('invite_channel_member', {
                p_channel_id: channel.id,
                p_user_id: inviteUser.trim(),
              })
                .then(async () => {
                  setInviteUser('');
                  await refresh();
                })
                .catch((cause: Error) => onError(cause.message))
                .finally(() => setBusy(false));
            }}
          />
        </>
      )}
    </View>
  );
}
