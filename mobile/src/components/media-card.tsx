import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowUpRight, Play } from 'lucide-react-native';
import { Label, PlusBadge, PressableScale, Skeleton } from './ui';
import { colors as c, radius, space } from '@/theme/tokens';
import { videoLabel } from '@/domain/format';
import type { Channel, Video } from '@/domain/models';

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
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Watch ${video.title}`}
      onPress={() => router.push({ pathname: '/watch/[id]', params: { id: video.id } })}
      style={{ flex: 1, minWidth: 0, gap: space.sm }}
    >
      <View
        style={{
          aspectRatio: compact ? 0.94 : 16 / 9,
          borderRadius: radius.md,
          overflow: 'hidden',
          backgroundColor: c.primarySoft,
        }}
      >
        <Image
          source={video.cover}
          recyclingKey={video.id}
          style={{ flex: 1 }}
          contentFit="cover"
          transition={200}
          accessibilityLabel={video.title}
        />
        <LinearGradient
          colors={['transparent', c.scrimSoft]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }}
        />
        {channel?.visibility === 'premium' && (
          <View style={{ position: 'absolute', top: space.sm, left: space.sm }}>
            <PlusBadge />
          </View>
        )}
        <View
          style={{
            position: 'absolute',
            bottom: space.sm,
            left: space.sm,
            width: 30,
            height: 30,
            borderRadius: radius.pill,
            backgroundColor: c.glassSoft,
            borderWidth: 1,
            borderColor: c.glassLine,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Play fill={c.white} color={c.white} size={13} style={{ marginLeft: 2 }} />
        </View>
        <View
          style={{
            position: 'absolute',
            bottom: space.sm,
            right: space.sm,
            backgroundColor: c.scrim,
            borderRadius: radius.xs,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Label variant="overline" tone="inverse">
            {videoLabel(video)}
          </Label>
        </View>
      </View>
      <View style={{ gap: 2 }}>
        <Label
          variant={compact ? 'callout' : 'subhead'}
          numberOfLines={2}
          style={compact && { fontWeight: '600' }}
        >
          {video.title}
        </Label>
        {channel?.name ? (
          <Label variant="caption" tone="muted" numberOfLines={1}>
            {channel.name}
          </Label>
        ) : null}
      </View>
    </PressableScale>
  );
}

export function VideoCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: space.sm }}>
      <Skeleton rounded={radius.md} style={{ aspectRatio: compact ? 0.94 : 16 / 9 }} />
      <Skeleton width="80%" height={16} />
      <Skeleton width="45%" height={12} />
    </View>
  );
}

export function ChannelCard({ channel }: { channel: Channel }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Open ${channel.name}`}
      onPress={() => router.push({ pathname: '/channel/[id]', params: { id: channel.id } })}
      style={{ width: 220, gap: space.sm }}
    >
      <View
        style={{
          height: 132,
          borderRadius: radius.md,
          overflow: 'hidden',
          backgroundColor: c.primarySoft,
        }}
      >
        <Image
          source={channel.cover}
          recyclingKey={channel.id}
          style={{ flex: 1 }}
          contentFit="cover"
          transition={200}
        />
        <View
          style={{
            position: 'absolute',
            right: space.sm,
            bottom: space.sm,
            width: 30,
            height: 30,
            borderRadius: radius.pill,
            backgroundColor: c.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowUpRight size={15} color={c.ink} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Label variant="subhead" numberOfLines={1} style={{ flex: 1 }}>
          {channel.name}
        </Label>
        {channel.visibility === 'premium' && <PlusBadge />}
      </View>
      <Label variant="caption" tone="muted" numberOfLines={1}>
        {channel.category}
      </Label>
    </PressableScale>
  );
}

export function ChannelCardSkeleton() {
  return (
    <View style={{ width: 220, gap: space.sm }}>
      <Skeleton height={132} rounded={radius.md} />
      <Skeleton width="70%" height={16} />
      <Skeleton width="40%" height={12} />
    </View>
  );
}
