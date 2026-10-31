import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Bookmark, Flag, LockKeyhole, Share2 } from 'lucide-react-native';
import {
  Button,
  EmptyState,
  ErrorNote,
  Heading,
  IconButton,
  Label,
  Screen,
  Section,
  Surface,
} from '@/components/ui';
import { VideoCard } from '@/components/media-card';
import { useWorkspace } from '@/state/workspace-provider';
import type { AccessDecision } from '@/domain/models';
import { accessMessages } from '@/domain/access';
import { colors as c } from '@/theme/tokens';
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
  useEffect(() => {
    let active = true;
    setDecision(null);
    setError(null);
    if (channel)
      void access(channel.id, 'watch')
        .then((value) => {
          if (active) setDecision(value);
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
      <Screen title="Video" back>
        <EmptyState
          title="This story is unavailable"
          body="It may have been removed or is not published yet."
          action="Back to Explore"
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
  if (video.kind === 'series')
    return (
      <Screen title={video.title} back>
        <Label>{video.description}</Label>
        {(state.seasons ?? [])
          .filter((season) => season.seriesId === id)
          .sort((a, b) => a.number - b.number)
          .map((season) => (
            <View key={season.id} style={{ gap: 12 }}>
              <Section title={`${season.number}. ${season.name}`} />
              {state.videos
                .filter((episode) => episode.seasonId === season.id)
                .sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0))
                .map((episode) => (
                  <VideoCard key={episode.id} video={episode} channel={channel} />
                ))}
            </View>
          ))}
        <Button
          title={state.savedIds.includes(id) ? 'Remove saved series' : 'Save series'}
          onPress={() => void bookmark(id).catch((cause: Error) => setError(cause.message))}
        />
        <ErrorNote message={error} />
      </Screen>
    );
  return (
    <Screen title="Now watching" back>
      <View style={{ gap: 16 }}>
        {decision === 'allowed' ? (
          <LivePlayback titleId={id} />
        ) : (
          <View style={{ gap: 16 }}>
            <Image
              source={video.cover}
              style={{ height: 230, borderRadius: 20 }}
              contentFit="cover"
            />
            <Surface style={{ alignItems: 'center' }}>
              <LockKeyhole size={25} color={c.primary} />
              <Label style={{ textAlign: 'center' }}>
                {decision
                  ? accessMessages[decision] || 'Playback is unavailable.'
                  : error
                    ? 'Access could not be verified.'
                    : 'Checking access…'}
              </Label>
              <Button
                title={
                  decision === 'subscription_required'
                    ? 'Explore Plus'
                    : decision === 'membership_required'
                      ? 'Join and watch'
                      : decision === 'sign_in_required'
                        ? 'Sign in to watch'
                        : 'Retry access check'
                }
                onPress={() => void unlock()}
              />
            </Surface>
          </View>
        )}
        <ErrorNote message={error} />
        {error && <Button title="Retry" onPress={() => setAttempt((value) => value + 1)} />}
        <Heading style={{ fontSize: 26 }}>{video.title}</Heading>
        <Label style={{ color: c.muted, fontSize: 12 }}>
          {video.duration} · {new Date(video.publishedAt).toLocaleDateString()}
        </Label>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <IconButton
            icon={Bookmark}
            label={state.savedIds.includes(id) ? 'Remove from saved videos' : 'Save video'}
            onPress={() => {
              void bookmark(id).catch((cause: Error) => setError(cause.message));
            }}
          />
          <IconButton
            icon={Share2}
            label="Share video"
            onPress={() => {
              void Share.share({
                message: `${video.title} — ${shareUrl(`/open/watch/${id}`)}`,
              }).catch(() => setError('Sharing is unavailable.'));
            }}
          />
          <IconButton
            icon={Flag}
            label="Report this video"
            onPress={() => {
              if (requireIdentity()) router.push({ pathname: '/report', params: { videoId: id } });
            }}
          />
        </View>
        <Surface>
          <Label style={{ fontWeight: '700' }}>{channel.name}</Label>
          <Label style={{ color: c.muted, fontSize: 13 }}>{video.description}</Label>
          <Button
            title="Visit channel"
            variant="soft"
            onPress={() => router.push({ pathname: '/channel/[id]', params: { id: channel.id } })}
          />
        </Surface>
        {related.length > 0 && (
          <>
            <Section title="Stay a little longer" />
            {related.map((item) => (
              <VideoCard key={item.id} video={item} channel={channel} />
            ))}
          </>
        )}
      </View>
    </Screen>
  );
}
