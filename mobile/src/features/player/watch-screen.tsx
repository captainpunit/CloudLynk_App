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
import { compactNumber } from '@/domain/format';
import { colors as c } from '@/theme/tokens';
import { VideoPlayback } from './video-playback';

export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, demo, access, join, dispatch, requireIdentity, notify } = useWorkspace();
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
    state.demoPlanId,
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
  return (
    <Screen title="Now watching" back>
      <View style={{ gap: 16 }}>
        {decision === 'allowed' && demo && video.demoUri ? (
          <VideoPlayback
            uri={video.demoUri}
            resumeAt={state.progress[id] ?? 0}
            onProgress={(seconds) => dispatch({ type: 'progress', id, seconds })}
          />
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
                  ? accessMessages[decision] ||
                    'Signed playback is not available from the current backend.'
                  : error
                    ? 'Access could not be verified.'
                    : 'Checking access…'}
              </Label>
              {decision !== 'allowed' && (
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
              )}
            </Surface>
          </View>
        )}
        <ErrorNote message={error} />
        {error && <Button title="Retry" onPress={() => setAttempt((value) => value + 1)} />}
        <Heading style={{ fontSize: 26 }}>{video.title}</Heading>
        <Label style={{ color: c.muted, fontSize: 12 }}>
          {compactNumber(video.views)} views · {video.duration} ·{' '}
          {new Date(video.publishedAt).toLocaleDateString()}
        </Label>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <IconButton
            icon={Bookmark}
            label={state.savedIds.includes(id) ? 'Remove from saved videos' : 'Save video'}
            onPress={() => {
              if (requireIdentity()) {
                dispatch({ type: 'bookmark', id });
                notify(
                  state.savedIds.includes(id)
                    ? 'Removed from saved videos'
                    : 'Saved for a little later',
                );
              }
            }}
          />
          <IconButton
            icon={Share2}
            label="Share video"
            onPress={() => {
              void Share.share({
                message: `${video.title} — https://cloudlynk.app/open/watch/${id}`,
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
        {demo && (
          <Label style={{ color: c.muted, fontSize: 11 }}>
            Sample footage for interaction testing. Artwork and editorial titles are illustrative.
          </Label>
        )}
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
