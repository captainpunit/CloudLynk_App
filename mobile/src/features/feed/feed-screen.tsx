import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Bookmark, Radio } from 'lucide-react-native';
import { EmptyState, Pill, Screen, Section } from '@/components/ui';
import { VideoCard } from '@/components/media-card';
import { useWorkspace } from '@/state/workspace-provider';

export default function FeedScreen() {
  const { state } = useWorkspace();
  const [tab, setTab] = useState('Following');
  const videos = state.videos.filter((video) => {
    const channel = state.channels.find((item) => item.id === video.channelId);
    return (
      channel?.status === 'published' &&
      channel.visibility !== 'private' &&
      (tab === 'Saved'
        ? state.savedIds.includes(video.id)
        : state.joinedIds.includes(video.channelId))
    );
  });
  return (
    <Screen title="Your daily dose." subtitle="Fresh stories from the creators you follow.">
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {['Following', 'Saved'].map((item) => (
          <Pill key={item} title={item} selected={tab === item} onPress={() => setTab(item)} />
        ))}
      </View>
      {!videos.length ? (
        <EmptyState
          icon={tab === 'Saved' ? Bookmark : Radio}
          title={tab === 'Saved' ? 'Save something good' : 'Make this feed yours'}
          body={
            tab === 'Saved'
              ? 'Tap the bookmark on any video to find it here later.'
              : 'Join channels you love and their latest uploads will appear here.'
          }
          action="Start exploring"
          onPress={() => router.push('/channels')}
        />
      ) : (
        <>
          <Section title={tab === 'Saved' ? 'Worth coming back to' : 'From your channels'} />
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              channel={state.channels.find((channel) => channel.id === video.channelId)}
            />
          ))}
        </>
      )}
    </Screen>
  );
}
