import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Share, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Bookmark,
  BookmarkCheck,
  Clapperboard,
  Flag,
  LockKeyhole,
  Share2,
  type LucideIcon,
} from 'lucide-react-native';
import {
  Button,
  Caption,
  EmptyState,
  ErrorNote,
  Heading,
  IconButton,
  Label,
  PlusBadge,
  Screen,
  Section,
} from '@/components/ui';
import { ChannelRow, VideoRow } from '@/components/media-card';
import { PlusOffer } from '@/components/plus-offer';
import { useWorkspace } from '@/state/workspace-provider';
import type { AccessDecision, Channel, Video } from '@/domain/models';
import { accessMessages } from '@/domain/access';
import { shortDate, videoLabel } from '@/domain/format';
import { colors as c } from '@/theme/tokens';
import { usePalette } from '@/theme/tone';
import LivePlayback from './live-playback';
import { shareUrl } from '@/lib/env';

export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, access, join, requireIdentity, bookmark } = useWorkspace();
  const video = state.videos.find((item) => item.id === id);
  const channel = state.channels.find((item) => item.id === video?.channelId);
  const [decision, setDecision] = useState<AccessDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const autoJoined = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    setDecision(null);
    setError(null);
    if (channel)
      void access(channel.id, 'watch')
        .then((value) => {
          if (!active) return;
          // Opening a video is the intent to watch, so a viewer who only lacks membership
          // joins without an extra tap. One attempt per channel: a failed join shows the button.
          if (value === 'membership_required' && autoJoined.current !== channel.id) {
            autoJoined.current = channel.id;
            void join(channel.id, true).catch(() => {
              if (active) setDecision(value);
            });
          } else setDecision(value);
        })
        .catch(() => {
          if (active) setError('Could not check access. Check your connection and retry.');
        });
    return () => {
      active = false;
    };
  }, [
    channel?.id,
    channel?.status,
    channel?.visibility,
    state.profile?.id,
    state.profile?.accountStatus,
    state.subscribed,
    state.joinedIds.join(','),
    attempt,
  ]);
  if (!video || !channel)
    return (
      <Screen tone="dark" title="Video" back>
        <EmptyState
          icon={Clapperboard}
          title="This video is unavailable"
          body="It may have been removed or is not published yet."
          action="Back to Home"
          onPress={() => router.replace('/')}
        />
      </Screen>
    );
  async function unlock() {
    if (decision === 'sign_in_required') {
      router.push('/auth');
      return;
    }
    if (decision === 'subscription_required') {
      router.push('/premium');
      return;
    }
    if (decision === 'membership_required') {
      try {
        await join(channel!.id, true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not join channel.');
      }
    } else setAttempt((value) => value + 1);
  }
  const related = state.videos.filter((item) => item.id !== id && item.channelId === channel.id);
  const saved = state.savedIds.includes(id);
  const toggleSaved = () => void bookmark(id).catch((cause: Error) => setError(cause.message));
  const share = () => {
    void Share.share({
      message: `${video.title} — ${shareUrl(`/open/watch/${id}`)}`,
    }).catch(() => setError('Sharing is unavailable.'));
  };
  const channelRow = (
    <ChannelRow
      channel={channel}
      detail={channel.visibility === 'private' ? 'Private channel' : channel.category}
    />
  );
  if (video.kind === 'series') {
    const seasons = (state.seasons ?? [])
      .filter((season) => season.seriesId === id)
      .sort((a, b) => a.number - b.number);
    return (
      <Screen
        tone="dark"
        back
        action={<IconButton icon={Share2} label="Share series" onPress={share} />}
      >
        <Poster uri={video.cover} />
        <TitleBlock video={video} channel={channel} />
        <Button
          title={saved ? 'Remove from saved' : 'Save series'}
          icon={saved ? BookmarkCheck : Bookmark}
          variant={saved ? 'outline' : 'primary'}
          onPress={toggleSaved}
        />
        <ErrorNote message={error} />
        {seasons.length ? (
          seasons.map((season) => (
            <View key={season.id} style={{ gap: 14 }}>
              <Section title={`Season ${season.number}: ${season.name}`} />
              {state.videos
                .filter((episode) => episode.seasonId === season.id)
                .sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0))
                .map((episode) => (
                  <VideoRow key={episode.id} video={episode} channel={channel} />
                ))}
            </View>
          ))
        ) : (
          <EmptyState
            icon={Clapperboard}
            title="No episodes yet"
            body="Episodes appear here as soon as they are published."
          />
        )}
        {channelRow}
      </Screen>
    );
  }
  return (
    <Screen tone="dark" back>
      {decision === 'allowed' ? (
        <LivePlayback titleId={id} />
      ) : (
        <Gate
          video={video}
          channel={channel}
          decision={decision}
          failed={!!error}
          onUnlock={() => void unlock()}
        />
      )}
      <ErrorNote message={error} />
      <TitleBlock video={video} channel={channel} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Action
          icon={saved ? BookmarkCheck : Bookmark}
          title={saved ? 'Saved' : 'Save'}
          label={saved ? 'Remove from saved videos' : 'Save video'}
          onPress={toggleSaved}
        />
        <Action icon={Share2} title="Share" label="Share video" onPress={share} />
        <Action
          icon={Flag}
          title="Report"
          label="Report this video"
          onPress={() => {
            if (requireIdentity()) router.push({ pathname: '/report', params: { videoId: id } });
          }}
        />
      </View>
      {channelRow}
      {related.length > 0 && (
        <View style={{ gap: 14 }}>
          <Section title={`More from ${channel.name}`} />
          {related.map((item) => (
            <VideoRow key={item.id} video={item} channel={channel} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function Poster({ uri, children }: { uri: string; children?: ReactNode }) {
  const p = usePalette();
  return (
    <View
      style={{
        aspectRatio: 16 / 9,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: p.surface,
      }}
    >
      <Image source={uri} style={{ flex: 1 }} contentFit="cover" transition={200} />
      {children}
    </View>
  );
}

function TitleBlock({ video, channel }: { video: Video; channel: Channel }) {
  const p = usePalette();
  return (
    <View style={{ gap: 8 }}>
      <Heading style={{ fontSize: 26, lineHeight: 32, letterSpacing: -0.8 }}>{video.title}</Heading>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {channel.visibility === 'premium' && <PlusBadge />}
        <Caption>
          {[videoLabel(video), shortDate(video.publishedAt)].filter(Boolean).join(' · ')}
        </Caption>
      </View>
      {!!video.description && (
        <Caption style={{ color: p.ink, fontSize: 15, lineHeight: 22 }}>
          {video.description}
        </Caption>
      )}
    </View>
  );
}

/** The poster and the one step between the viewer and the first frame. */
function Gate({
  video,
  channel,
  decision,
  failed,
  onUnlock,
}: {
  video: Video;
  channel: Channel;
  decision: AccessDecision | null;
  failed: boolean;
  onUnlock: () => void;
}) {
  const checking = !decision && !failed;
  return (
    <View style={{ gap: 16 }}>
      <Poster uri={video.cover}>
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: c.scrimSoft,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {checking ? (
            <>
              <ActivityIndicator color={c.white} />
              <Label style={{ color: c.white, fontSize: 14 }}>Checking access…</Label>
            </>
          ) : (
            <LockKeyhole size={28} color={c.white} />
          )}
        </View>
      </Poster>
      {!checking && <GatePanel channel={channel} decision={decision} onUnlock={onUnlock} />}
    </View>
  );
}

function GatePanel({
  channel,
  decision,
  onUnlock,
}: {
  channel: Channel;
  decision: AccessDecision | null;
  onUnlock: () => void;
}) {
  if (decision === 'subscription_required')
    return <PlusOffer title="Subscribe to watch" action="Subscribe to watch" />;
  const premium = channel.visibility === 'premium';
  const panel =
    decision === 'sign_in_required'
      ? {
          title: 'Sign in to watch',
          body: premium
            ? 'This channel is part of Plus. Sign in, then subscribe to watch.'
            : 'This channel is free to watch with an account.',
          action: 'Sign in to watch',
        }
      : decision === 'membership_required'
        ? {
            title: `Join ${channel.name} to watch`,
            body: 'Joining is free and adds its new videos to your library.',
            action: 'Join and watch',
          }
        : {
            title: decision ? 'You cannot watch this video' : 'Access could not be checked',
            body: decision
              ? accessMessages[decision] || 'Playback is unavailable.'
              : 'Check your connection and try again.',
            action: 'Check again',
          };
  return (
    <View style={{ gap: 10, alignItems: 'flex-start' }}>
      <Label style={{ fontSize: 18, lineHeight: 24, fontWeight: '700' }}>{panel.title}</Label>
      <Caption style={{ fontSize: 14, lineHeight: 21 }}>{panel.body}</Caption>
      <Button title={panel.action} compact onPress={onUnlock} />
    </View>
  );
}

function Action({
  icon: Icon,
  title,
  label,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  label: string;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 76,
        minHeight: 56,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: p.surface,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon size={20} color={p.ink} strokeWidth={1.8} />
      <Caption style={{ color: p.ink, fontSize: 12, lineHeight: 16 }}>{title}</Caption>
    </Pressable>
  );
}
