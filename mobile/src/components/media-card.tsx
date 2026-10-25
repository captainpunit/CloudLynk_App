import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowUpRight, Play } from 'lucide-react-native';
import { Label, PlusBadge } from './ui';
import { colors as c } from '@/theme/tokens';
import type { Channel, Video } from '@/domain/models';
import { compactNumber } from '@/domain/format';

export function VideoCard({
  video,
  channel,
  compact = false,
}: {
  video: Video;
  channel?: Channel;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Watch ${video.title}`}
      onPress={() => router.push({ pathname: '/watch/[id]', params: { id: video.id } })}
      style={({ pressed }) => ({ flex: 1, minWidth: 0, gap: 10, opacity: pressed ? 0.8 : 1 })}
    >
      <View
        style={{
          aspectRatio: compact ? 0.94 : 1.7,
          borderRadius: 17,
          overflow: 'hidden',
          backgroundColor: c.primarySoft,
        }}
      >
        <Image
          source={video.cover}
          style={{ flex: 1 }}
          contentFit="cover"
          transition={180}
          accessibilityLabel={video.title}
        />
        <LinearGradient
          colors={['transparent', '#00000070']}
          style={{ position: 'absolute', inset: 0 }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            backgroundColor: '#00000080',
            borderRadius: 5,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Label style={{ color: c.white, fontSize: 10, lineHeight: 15 }}>{video.duration}</Label>
        </View>
        {channel?.visibility === 'premium' && (
          <View style={{ position: 'absolute', top: 10, left: 10 }}>
            <PlusBadge />
          </View>
        )}
        <View style={{ position: 'absolute', bottom: 12, left: 12 }}>
          <Play fill="white" color="white" size={17} />
        </View>
      </View>
      <Label
        numberOfLines={2}
        style={{
          fontWeight: '700',
          fontSize: compact ? 14 : 16,
          lineHeight: compact ? 20 : 24,
          letterSpacing: -0.25,
        }}
      >
        {video.title}
      </Label>
      <Label numberOfLines={1} style={{ color: c.muted, fontSize: 11, lineHeight: 16 }}>
        {channel?.name ?? 'CloudLynk'} · {compactNumber(video.views)} views
      </Label>
    </Pressable>
  );
}
export function ChannelCard({ channel }: { channel: Channel }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${channel.name}`}
      onPress={() => router.push({ pathname: '/channel/[id]', params: { id: channel.id } })}
      style={{ width: 220, gap: 10 }}
    >
      <View style={{ height: 135, borderRadius: 18, overflow: 'hidden' }}>
        <Image source={channel.cover} style={{ flex: 1 }} contentFit="cover" transition={180} />
        <View
          style={{
            position: 'absolute',
            right: 10,
            bottom: 10,
            borderRadius: 20,
            padding: 7,
            backgroundColor: c.white,
          }}
        >
          <ArrowUpRight size={15} color={c.ink} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Label numberOfLines={1} style={{ flex: 1, fontWeight: '700', fontSize: 14 }}>
          {channel.name}
        </Label>
        {channel.visibility === 'premium' && <PlusBadge />}
      </View>
      <Label style={{ color: c.muted, fontSize: 11 }}>
        {channel.category} · {compactNumber(channel.members)} members
      </Label>
    </Pressable>
  );
}
