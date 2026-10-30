import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Plus, Radio, Users } from 'lucide-react-native';
import {
  Button,
  EmptyState,
  ErrorNote,
  IconButton,
  Label,
  Pill,
  PlusBadge,
  Screen,
  SearchField,
} from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { colors as c } from '@/theme/tokens';
import { compactNumber } from '@/domain/format';

export default function ChannelsScreen() {
  const { state, join, requireIdentity, demo } = useWorkspace();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('Discover');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const channels = state.channels.filter(
    (channel) =>
      channel.status === 'published' &&
      (channel.visibility !== 'private' || (!demo && tab !== 'Discover')) &&
      channel.name.toLowerCase().includes(query.toLowerCase()) &&
      (tab === 'Discover' ||
        (tab === 'Private'
          ? channel.visibility === 'private'
          : state.joinedIds.includes(channel.id))),
  );
  async function handleJoin(id: string) {
    setPending(id);
    setError(null);
    try {
      await join(id, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not join. Please retry.');
    } finally {
      setPending(null);
    }
  }
  return (
    <Screen
      title="Find your people."
      subtitle="A channel for every kind of curious."
      action={
        <IconButton
          icon={Plus}
          label="Create a channel"
          onPress={() => {
            if (requireIdentity()) router.push('/create-channel');
          }}
        />
      }
    >
      <SearchField value={query} onChangeText={setQuery} placeholder="Find a channel" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {['Discover', 'Joined', ...(!demo ? ['Private'] : [])].map((item) => (
          <Pill key={item} title={item} selected={tab === item} onPress={() => setTab(item)} />
        ))}
      </View>
      <ErrorNote message={error} />
      <View style={{ gap: 14 }}>
        {channels.map((channel) => (
          <View
            key={channel.id}
            style={{
              borderRadius: 20,
              backgroundColor: c.surface,
              padding: 13,
              borderWidth: 1,
              borderColor: c.line,
              gap: 14,
            }}
          >
            <Pressable
              accessibilityLabel={`Open ${channel.name}`}
              onPress={() => router.push({ pathname: '/channel/[id]', params: { id: channel.id } })}
            >
              <Image
                source={channel.cover}
                style={{ height: 150, borderRadius: 13 }}
                contentFit="cover"
              />
              <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 13 }}>
                <Label style={{ fontSize: 18, fontWeight: '700', flex: 1 }}>{channel.name}</Label>
                {channel.visibility === 'premium' && <PlusBadge />}
              </View>
              <Label numberOfLines={2} style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>
                {channel.description}
              </Label>
            </Pressable>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Users color={c.muted} size={14} />
                <Label style={{ color: c.muted, fontSize: 11 }}>
                  {demo
                    ? `${compactNumber(channel.members)} members`
                    : channel.visibility === 'private'
                      ? 'Private channel'
                      : channel.category}
                </Label>
              </View>
              <Button
                title={
                  state.joinedIds.includes(channel.id)
                    ? 'Open channel'
                    : channel.visibility === 'premium'
                      ? 'Explore Plus'
                      : 'Join channel'
                }
                variant={state.joinedIds.includes(channel.id) ? 'soft' : 'primary'}
                loading={pending === channel.id}
                onPress={() =>
                  state.joinedIds.includes(channel.id)
                    ? router.push({ pathname: '/channel/[id]', params: { id: channel.id } })
                    : void handleJoin(channel.id)
                }
              />
            </View>
          </View>
        ))}
      </View>
      {!channels.length && (
        <EmptyState
          icon={Radio}
          title={tab === 'Joined' ? 'Your people are out there' : 'No channels found'}
          body={
            tab === 'Joined'
              ? 'Join a channel to collect its latest stories here.'
              : 'Try a different name or clear your search.'
          }
          action="Discover channels"
          onPress={() => {
            setTab('Discover');
            setQuery('');
          }}
        />
      )}
    </Screen>
  );
}
