import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Plus, MonitorPlay } from 'lucide-react-native';
import {
  Button,
  EmptyState,
  ErrorNote,
  IconButton,
  Pill,
  Rail,
  Screen,
  SearchField,
  Section,
} from '@/components/ui';
import { ChannelRow, VideoRow } from '@/components/media-card';
import { useWorkspace } from '@/state/workspace-provider';
import type { Channel } from '@/domain/models';
import { browsableVideos, channelOf, count } from '@/features/explore/catalogue';

type Filter = 'All' | 'Joined' | 'Plus' | 'Private';
const filterLabels: Record<Filter, string> = {
  All: 'Show all channels',
  Joined: 'Show channels you joined',
  Plus: 'Show Plus channels',
  Private: 'Show private channels you were invited to',
};

export default function ChannelsScreen() {
  const { state, refresh, refreshing } = useWorkspace();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [error, setError] = useState<string | null>(null);
  const published = state.channels.filter((channel) => channel.status === 'published');
  const filters: Filter[] = [
    'All',
    'Joined',
    'Plus',
    ...(published.some((channel) => channel.visibility === 'private') ? ['Private' as const] : []),
  ];
  const search = query.trim().toLowerCase();
  const channels = published.filter(
    (channel) =>
      inFilter(channel, filter, state.joinedIds) &&
      `${channel.name} ${channel.category} ${channel.description}`.toLowerCase().includes(search),
  );
  const videos = browsableVideos(state, new Set(published.map((channel) => channel.id)));
  const videoCount = (id: string) => videos.filter((video) => video.channelId === id).length;
  const matchingVideos = search
    ? videos
        .filter((video) => `${video.title} ${video.description}`.toLowerCase().includes(search))
        .slice(0, 20)
    : [];
  const canCreate = !!state.profile?.canPublish || state.profile?.role === 'admin';
  const row = (channel: Channel) => (
    <ChannelRow
      key={channel.id}
      channel={channel}
      detail={[
        state.joinedIds.includes(channel.id) && 'Joined',
        channel.visibility === 'private' ? 'Private' : channel.category,
        count(videoCount(channel.id), 'video'),
      ]
        .filter(Boolean)
        .join(' · ')}
      trailing={<ChannelAction channel={channel} onError={setError} />}
    />
  );
  return (
    <Screen
      tone="dark"
      title="Channels"
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      action={
        canCreate && (
          <IconButton
            icon={Plus}
            label="Create a channel"
            onPress={() => router.push('/create-channel')}
          />
        )
      }
    >
      <SearchField value={query} onChangeText={setQuery} placeholder="Search channels and videos" />
      <Rail gap={8}>
        {filters.map((item) => (
          <Pill
            key={item}
            title={item}
            label={filterLabels[item]}
            selected={filter === item}
            onPress={() => setFilter(item)}
          />
        ))}
      </Rail>
      <ErrorNote message={error} />
      {filter === 'All' && !search ? (
        byCategory(channels).map(([category, group]) => (
          <View key={category} style={{ gap: 14 }}>
            <Section title={category} />
            {group.map(row)}
          </View>
        ))
      ) : (
        <View style={{ gap: 14 }}>
          {search && channels.length > 0 && <Section title="Channels" />}
          {channels.map(row)}
        </View>
      )}
      {matchingVideos.length > 0 && (
        <View style={{ gap: 14 }}>
          <Section title="Videos" />
          {matchingVideos.map((video) => (
            <VideoRow key={video.id} video={video} channel={channelOf(state, video)} />
          ))}
        </View>
      )}
      {!channels.length && !matchingVideos.length && (
        <EmptyChannels
          filter={filter}
          searching={!!search}
          onReset={() => {
            setQuery('');
            setFilter('All');
          }}
        />
      )}
    </Screen>
  );
}

function inFilter(channel: Channel, filter: Filter, joinedIds: string[]) {
  switch (filter) {
    case 'All':
      return channel.visibility !== 'private';
    case 'Joined':
      return joinedIds.includes(channel.id);
    case 'Plus':
      return channel.visibility === 'premium';
    case 'Private':
      return channel.visibility === 'private';
  }
}

function byCategory(channels: Channel[]): [string, Channel[]][] {
  const groups = new Map<string, Channel[]>();
  for (const channel of channels)
    groups.set(channel.category, [...(groups.get(channel.category) ?? []), channel]);
  return [...groups].sort(([a], [b]) => a.localeCompare(b));
}

/** The one thing a viewer can do with a channel from the list, if anything. */
function ChannelAction({
  channel,
  onError,
}: {
  channel: Channel;
  onError: (message: string | null) => void;
}) {
  const { state, join } = useWorkspace();
  const [busy, setBusy] = useState(false);
  if (state.profile && channel.ownerId === state.profile.id)
    return (
      <Button
        title="Manage"
        variant="outline"
        compact
        label={`Manage videos in ${channel.name}`}
        onPress={() => router.push({ pathname: '/upload', params: { channelId: channel.id } })}
      />
    );
  if (state.joinedIds.includes(channel.id)) return null;
  if (channel.visibility === 'premium' && !state.subscribed)
    return (
      <Button
        title="Subscribe"
        variant="plus"
        compact
        label={`Subscribe to watch ${channel.name}`}
        onPress={() => router.push('/premium')}
      />
    );
  return (
    <Button
      title="Join"
      compact
      loading={busy}
      label={`Join ${channel.name}`}
      onPress={() => {
        setBusy(true);
        onError(null);
        join(channel.id, true)
          .catch((cause: unknown) =>
            onError(cause instanceof Error ? cause.message : 'Could not join. Please retry.'),
          )
          .finally(() => setBusy(false));
      }}
    />
  );
}

function EmptyChannels({
  filter,
  searching,
  onReset,
}: {
  filter: Filter;
  searching: boolean;
  onReset: () => void;
}) {
  if (searching)
    return (
      <EmptyState
        title="No matches"
        body="Try another name, category or title."
        action="Clear search"
        onPress={onReset}
      />
    );
  if (filter === 'Joined')
    return (
      <EmptyState
        icon={MonitorPlay}
        title="You have not joined any channels"
        body="Join a channel and its new videos show up in your library."
        action="Show all channels"
        onPress={onReset}
      />
    );
  return (
    <EmptyState
      icon={MonitorPlay}
      title={filter === 'Plus' ? 'No Plus channels yet' : 'No channels yet'}
      body="Channels appear here once an admin approves them."
      action={filter === 'All' ? undefined : 'Show all channels'}
      onPress={onReset}
    />
  );
}
