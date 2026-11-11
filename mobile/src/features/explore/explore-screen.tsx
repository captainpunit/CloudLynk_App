import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Bell, Bookmark, BookmarkCheck, Clapperboard, Play, Search } from 'lucide-react-native';
import { ChannelCard, VideoCard } from '@/components/media-card';
import { PlusOffer } from '@/components/plus-offer';
import {
  Button,
  Caption,
  EmptyState,
  ErrorNote,
  Heading,
  IconButton,
  Pill,
  PlusBadge,
  Rail,
  Screen,
  Section,
} from '@/components/ui';
import { gutter } from '@/theme/tokens';
import { usePalette } from '@/theme/tone';
import { useWorkspace } from '@/state/workspace-provider';
import { shortDate, videoLabel } from '@/domain/format';
import type { Channel, Video } from '@/domain/models';
import { env } from '@/lib/env';
import {
  browsableVideos,
  channelOf,
  continueWatching,
  listedChannels,
  resumeLabel,
} from './catalogue';

export default function HomeScreen() {
  const { state, error, refreshing, refresh } = useWorkspace();
  const [category, setCategory] = useState('All');
  const channels = listedChannels(state);
  const videos = browsableVideos(state);
  const resume = continueWatching(state).slice(0, 10);
  const fromJoined = videos.filter((video) => state.joinedIds.includes(video.channelId));
  const plusChannels = channels.filter((channel) => channel.visibility === 'premium');
  // Categories are owner-chosen text, so the filter list comes from the loaded catalogue.
  const categories = [
    'All',
    ...new Set(channels.map((channel) => channel.category).filter((item) => item !== 'All')),
  ];
  const [hero, ...rest] = videos;
  const latest =
    category === 'All'
      ? rest
      : videos.filter((video) => channelOf(state, video)?.category === category);
  return (
    <Screen
      tone="dark"
      title={env.appName}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      action={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton
            icon={Search}
            label="Search channels and videos"
            onPress={() => router.push('/channels')}
          />
          <View>
            <IconButton
              icon={Bell}
              label={state.noticesRead ? 'Notifications' : 'Notifications, new'}
              onPress={() => router.push('/notifications')}
            />
            {!state.noticesRead && <UnreadDot />}
          </View>
        </View>
      }
    >
      <ErrorNote message={error} />
      {hero ? (
        <Hero video={hero} channel={channelOf(state, hero)} />
      ) : (
        <EmptyState
          icon={Clapperboard}
          title="Nothing to watch yet"
          body="Videos appear here as soon as creators publish them."
          action={channels.length ? 'Browse channels' : undefined}
          onPress={() => router.push('/channels')}
        />
      )}
      {resume.length > 0 && (
        <View style={{ gap: 12 }}>
          <Section title="Continue watching" />
          <Rail>
            {resume.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                channel={channelOf(state, video)}
                meta={resumeLabel(state.progress[video.id] ?? 0)}
                width={248}
                compact
              />
            ))}
          </Rail>
        </View>
      )}
      {fromJoined.length > 0 && (
        <View style={{ gap: 12 }}>
          <Section
            title="New from your channels"
            action="Library"
            onPress={() => router.push('/library')}
          />
          <Rail>
            {fromJoined.slice(0, 10).map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                channel={channelOf(state, video)}
                width={248}
                compact
              />
            ))}
          </Rail>
        </View>
      )}
      {!state.subscribed && !!state.plans?.length && plusChannels.length > 0 && <PlusOffer />}
      {plusChannels.length > 0 && (
        <View style={{ gap: 12 }}>
          <Section title={state.subscribed ? 'Your Plus channels' : 'Included with Plus'} />
          <Rail>
            {plusChannels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </Rail>
        </View>
      )}
      {videos.length > 1 && (
        <View style={{ gap: 14 }}>
          <Section title="Latest" />
          {categories.length > 2 && (
            <Rail gap={8}>
              {categories.map((item) => (
                <Pill
                  key={item}
                  title={item}
                  label={item === 'All' ? 'All categories' : `${item} category`}
                  selected={category === item}
                  onPress={() => setCategory(item)}
                />
              ))}
            </Rail>
          )}
          {latest.length ? (
            <View style={{ gap: 24 }}>
              {latest.map((video) => (
                <VideoCard key={video.id} video={video} channel={channelOf(state, video)} />
              ))}
            </View>
          ) : (
            <Caption>{`Nothing new in ${category} yet.`}</Caption>
          )}
        </View>
      )}
      {channels.length > 0 && (
        <View style={{ gap: 12 }}>
          <Section title="Channels" action="See all" onPress={() => router.push('/channels')} />
          <Rail>
            {channels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </Rail>
        </View>
      )}
    </Screen>
  );
}

function UnreadDot() {
  const p = usePalette();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 10,
        right: 11,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: p.ink,
        borderWidth: 1.5,
        borderColor: p.surface,
      }}
    />
  );
}

/** The newest title, full width: the poster first, then what it is and one way in. */
function Hero({ video, channel }: { video: Video; channel?: Channel }) {
  const { state, bookmark, notify } = useWorkspace();
  const p = usePalette();
  const locked = channel?.visibility === 'premium' && !state.subscribed;
  const saved = state.savedIds.includes(video.id);
  const open = () => router.push({ pathname: '/watch/[id]', params: { id: video.id } });
  return (
    <View style={{ gap: 14 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${video.title}`}
        onPress={open}
        style={{ marginHorizontal: -gutter, aspectRatio: 4 / 3, backgroundColor: p.surface }}
      >
        <Image source={video.cover} style={{ flex: 1 }} contentFit="cover" transition={200} />
      </Pressable>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {channel?.visibility === 'premium' && <PlusBadge />}
          <Caption numberOfLines={1} style={{ flexShrink: 1 }}>
            {[channel?.name, videoLabel(video), shortDate(video.publishedAt)]
              .filter(Boolean)
              .join(' · ')}
          </Caption>
        </View>
        <Heading style={{ fontSize: 30, lineHeight: 36, letterSpacing: -1 }}>{video.title}</Heading>
        {!!video.description && (
          <Caption numberOfLines={2} style={{ fontSize: 14, lineHeight: 21 }}>
            {video.description}
          </Caption>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          {locked ? (
            <Button
              title="Subscribe to watch"
              variant="plus"
              label={`Subscribe to watch ${video.title}`}
              onPress={() => router.push('/premium')}
            />
          ) : (
            <Button title="Play" icon={Play} label={`Play ${video.title}`} onPress={open} />
          )}
        </View>
        <IconButton
          icon={saved ? BookmarkCheck : Bookmark}
          label={saved ? `Remove ${video.title} from saved` : `Save ${video.title}`}
          onPress={() => void bookmark(video.id).catch((cause: Error) => notify(cause.message))}
        />
      </View>
    </View>
  );
}
