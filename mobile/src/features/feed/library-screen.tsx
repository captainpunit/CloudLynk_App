import type { ReactNode } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Cloud, Library } from 'lucide-react-native';
import { ChannelCard, VideoRow } from '@/components/media-card';
import { Button, Caption, EmptyState, ListRow, Rail, Screen, Section } from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { fileSize } from '@/domain/format';
import {
  browsableVideos,
  channelOf,
  continueWatching,
  count,
  resumeLabel,
} from '@/features/explore/catalogue';

/** A member's own shelf: what they were watching, what they saved and their channels. */
export default function LibraryScreen() {
  const { state, refresh, refreshing } = useWorkspace();
  if (!state.profile)
    return (
      <Screen tone="dark" title="Library">
        <EmptyState
          icon={Library}
          title="Your library lives in your account"
          body="Sign in to pick up where you stopped, keep saved videos and follow channels."
          action="Sign in"
          onPress={() => router.push('/auth')}
        />
      </Screen>
    );
  const resume = continueWatching(state);
  const saved = state.videos.filter((video) => state.savedIds.includes(video.id));
  const joinedChannels = state.channels.filter(
    (channel) => channel.status === 'published' && state.joinedIds.includes(channel.id),
  );
  const fromJoined = browsableVideos(state, new Set(joinedChannels.map((item) => item.id))).slice(
    0,
    20,
  );
  const empty = !resume.length && !saved.length && !joinedChannels.length;
  return (
    <Screen tone="dark" title="Library" refreshing={refreshing} onRefresh={() => void refresh()}>
      {empty && (
        <EmptyState
          icon={Library}
          title="Nothing here yet"
          body="Join channels, save videos and start watching. They all collect here."
          action="Browse channels"
          onPress={() => router.push('/channels')}
        />
      )}
      {resume.length > 0 && (
        <Shelf title="Continue watching">
          {resume.map((video) => (
            <VideoRow
              key={video.id}
              video={video}
              channel={channelOf(state, video)}
              meta={resumeLabel(state.progress[video.id] ?? 0)}
            />
          ))}
        </Shelf>
      )}
      {saved.length > 0 && (
        <Shelf title="Saved">
          {saved.map((video) => (
            <VideoRow key={video.id} video={video} channel={channelOf(state, video)} />
          ))}
        </Shelf>
      )}
      {joinedChannels.length > 0 && (
        <Shelf title="Your channels">
          <Rail>
            {joinedChannels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} width={148} />
            ))}
          </Rail>
          {fromJoined.length ? (
            fromJoined.map((video) => (
              <VideoRow key={video.id} video={video} channel={channelOf(state, video)} />
            ))
          ) : (
            <Caption>Your channels have not published any videos yet.</Caption>
          )}
        </Shelf>
      )}
      {!empty && !saved.length && <Caption>Tap the bookmark on any video to keep it here.</Caption>}
      <ListRow
        icon={Cloud}
        title="My cloud"
        detail={cloudDetail(state.files.length, state.driveUsage)}
        onPress={() => router.push('/cloud')}
      />
      {!joinedChannels.length && !empty && (
        <Button
          title="Find channels to join"
          variant="soft"
          onPress={() => router.push('/channels')}
        />
      )}
    </Screen>
  );
}

function Shelf({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 14 }}>
      <Section title={title} />
      {children}
    </View>
  );
}

function cloudDetail(files: number, usage?: { used_bytes: number; quota_bytes: number }) {
  const stored = count(files, 'file');
  return usage
    ? `${stored} · ${fileSize(usage.used_bytes)} of ${fileSize(usage.quota_bytes)} used`
    : `${stored} in your private storage`;
}
