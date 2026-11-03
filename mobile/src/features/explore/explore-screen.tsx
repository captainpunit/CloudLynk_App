import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowUpRight, Bell, Cloud, Play, Sparkles } from 'lucide-react-native';
import { ChannelCard, VideoCard } from '@/components/media-card';
import {
  EmptyState,
  ErrorNote,
  Heading,
  IconButton,
  Label,
  Pill,
  SearchField,
  Section,
} from '@/components/ui';
import { colors as c } from '@/theme/tokens';
import { useWorkspace } from '@/state/workspace-provider';
import { kindLabels, plusSummary, videoLabel } from '@/domain/format';
import { env } from '@/lib/env';

export default function ExploreScreen() {
  const { state, error, refreshing, refresh } = useWorkspace();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [kind, setKind] = useState('all');
  const channels = state.channels.filter(
    (channel) => channel.status === 'published' && channel.visibility !== 'private',
  );
  // Categories are owner-chosen text, so the filter list comes from the loaded catalogue.
  const categories = [
    'All',
    ...new Set(channels.map((channel) => channel.category).filter((item) => item !== 'All')),
  ];
  const videos = useMemo(
    () =>
      state.videos
        .filter((video) => {
          const channel = state.channels.find((item) => item.id === video.channelId);
          return (
            channel?.status === 'published' &&
            channel.visibility !== 'private' &&
            (category === 'All' || channel.category === category) &&
            (kind === 'all' || video.kind === kind) &&
            `${video.title} ${video.description} ${channel.name}`
              .toLowerCase()
              .includes(query.toLowerCase())
          );
        })
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    [state.channels, state.videos, category, query, kind],
  );
  const hero = videos[0];
  const plus = plusSummary(state);
  // Only offer title types the catalogue actually has.
  const kinds = [
    'all' as const,
    ...new Set(state.videos.flatMap((video) => (video.kind ? [video.kind] : []))),
  ];
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.canvas }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={c.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        <View
          style={{
            paddingHorizontal: 22,
            paddingTop: 14,
            gap: 22,
            maxWidth: 760,
            alignSelf: 'center',
            width: '100%',
          }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center' }}>
              <View style={{ backgroundColor: c.primary, borderRadius: 12, padding: 8 }}>
                <Cloud size={23} color={c.white} strokeWidth={2} />
              </View>
              <Label style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.9 }}>
                {env.appName}
              </Label>
            </View>
            <View style={{ flexDirection: 'row', gap: 9 }}>
              {plus && (
                <IconButton
                  icon={Sparkles}
                  label={`Explore ${env.appName} Plus`}
                  onPress={() => router.push('/premium')}
                />
              )}
              <View>
                <IconButton
                  icon={Bell}
                  label="Notifications"
                  onPress={() => router.push('/notifications')}
                />
                {!state.noticesRead && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 9,
                      right: 11,
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: c.primary,
                    }}
                  />
                )}
              </View>
            </View>
          </View>
          <SearchField value={query} onChangeText={setQuery} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {categories.map((item) => (
              <Pill
                key={item}
                title={item}
                selected={category === item}
                onPress={() => setCategory(item)}
              />
            ))}
          </ScrollView>
          <ErrorNote message={error} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {kinds.map((value) => (
              <Pill
                key={value}
                title={value === 'all' ? 'All titles' : kindLabels[value]}
                selected={kind === value}
                onPress={() => setKind(value)}
              />
            ))}
          </View>
          {hero && !query && category === 'All' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Watch featured: ${hero.title}`}
              onPress={() => router.push({ pathname: '/watch/[id]', params: { id: hero.id } })}
              style={{ height: 310, borderRadius: 24, overflow: 'hidden', backgroundColor: c.dark }}
            >
              <Image
                source={hero.cover}
                style={{ position: 'absolute', inset: 0 }}
                contentFit="cover"
              />
              <LinearGradient
                colors={[c.scrimClear, c.scrimHero]}
                style={{ position: 'absolute', inset: 0 }}
              />
              <View
                style={{
                  position: 'absolute',
                  top: 20,
                  left: 20,
                  backgroundColor: c.glass,
                  paddingVertical: 5,
                  paddingHorizontal: 9,
                  borderRadius: 6,
                }}
              >
                <Label
                  style={{
                    fontSize: 9,
                    lineHeight: 14,
                    color: c.primary,
                    letterSpacing: 1.2,
                    fontWeight: '800',
                  }}
                >
                  LATEST
                </Label>
              </View>
              <View style={{ position: 'absolute', bottom: 22, left: 22, right: 22, gap: 10 }}>
                <Heading style={{ color: c.white, fontSize: 28, lineHeight: 33, maxWidth: 240 }}>
                  {hero.title}
                </Heading>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Label style={{ color: c.onDarkMuted, fontSize: 11 }}>
                    {`${channels.find((channel) => channel.id === hero.channelId)?.name ?? ''} · ${videoLabel(hero)}`}
                  </Label>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      backgroundColor: c.white,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Play size={16} color={c.ink} fill={c.ink} />
                  </View>
                </View>
              </View>
            </Pressable>
          )}
          <View style={{ gap: 15 }}>
            <Section title={query ? 'Search results' : 'Latest'} />
            {videos.length ? (
              <View style={{ gap: 22 }}>
                {Array.from({ length: Math.ceil(videos.length / 2) }, (_, index) => (
                  <View key={index} style={{ flexDirection: 'row', gap: 14 }}>
                    {videos.slice(index * 2, index * 2 + 2).map((video) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        channel={channels.find((channel) => channel.id === video.channelId)}
                        compact
                      />
                    ))}
                    {videos.length % 2 !== 0 && index === Math.floor(videos.length / 2) && (
                      <View style={{ flex: 1 }} />
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState
                title={query ? 'No matches just yet' : 'Fresh stories are on their way'}
                body={
                  query
                    ? 'Try another word or explore a different category.'
                    : 'Published videos will appear here when the catalogue is ready.'
                }
                action="Reset filters"
                onPress={() => {
                  setQuery('');
                  setCategory('All');
                  setKind('all');
                }}
              />
            )}
          </View>
          {!query && (
            <>
              <Section
                title="Find your people"
                action="All channels"
                onPress={() => router.push('/channels')}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 15 }}
              >
                {channels.map((channel) => (
                  <ChannelCard key={channel.id} channel={channel} />
                ))}
              </ScrollView>
              {plus && !state.subscribed && (
                <Pressable
                  onPress={() => router.push('/premium')}
                  style={{
                    borderRadius: 22,
                    backgroundColor: c.dark,
                    padding: 23,
                    flexDirection: 'row',
                    gap: 15,
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flex: 1, gap: 7 }}>
                    <Heading style={{ color: c.white, fontSize: 23 }}>Get Plus</Heading>
                    <Label style={{ color: c.onDarkMuted, fontSize: 12 }}>{plus}</Label>
                  </View>
                  <ArrowUpRight color={c.accent} size={26} />
                </Pressable>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
