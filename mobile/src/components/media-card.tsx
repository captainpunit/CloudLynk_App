import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Caption, Label, PlusBadge } from './ui';
import { colors as c } from '@/theme/tokens';
import { usePalette } from '@/theme/tone';
import { videoLabel } from '@/domain/format';
import type { Channel, Video } from '@/domain/models';

function openVideo(id: string) {
  router.push({ pathname: '/watch/[id]', params: { id } });
}
function openChannel(id: string) {
  router.push({ pathname: '/channel/[id]', params: { id } });
}
/** The name a screen reader announces for a title: what it is, where it is from and its status. */
function videoName(video: Video, channel?: Channel, meta?: string) {
  return [video.title, channel?.name, channel?.visibility === 'premium' && 'Plus', meta]
    .filter(Boolean)
    .join(', ');
}

function Poster({
  uri,
  premium,
  tag,
  radius = 10,
}: {
  uri: string;
  premium: boolean;
  tag?: string;
  radius?: number;
}) {
  const p = usePalette();
  return (
    <View
      style={{
        aspectRatio: 16 / 9,
        borderRadius: radius,
        overflow: 'hidden',
        backgroundColor: p.raised,
      }}
    >
      <Image source={uri} style={{ flex: 1 }} contentFit="cover" transition={180} />
      {premium && (
        <View style={{ position: 'absolute', top: 8, left: 8 }}>
          <PlusBadge />
        </View>
      )}
      {!!tag && (
        <View
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            backgroundColor: c.scrim,
            borderRadius: 5,
            paddingHorizontal: 6,
          }}
        >
          <Label style={{ color: c.white, fontSize: 12, lineHeight: 18, fontWeight: '600' }}>
            {tag}
          </Label>
        </View>
      )}
    </View>
  );
}

/** A poster with the title under it, for grids and rails. */
export function VideoCard({
  video,
  channel,
  compact = false,
  meta,
  width,
}: {
  video: Video;
  channel?: Channel;
  compact?: boolean;
  /** One extra line, such as where to resume. */
  meta?: string;
  /** Fixed width inside a rail; otherwise the card fills its column. */
  width?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={videoName(video, channel, meta)}
      onPress={() => openVideo(video.id)}
      style={({ pressed }) => ({
        ...(width ? { width } : { flex: 1 }),
        minWidth: 0,
        gap: 8,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Poster
        uri={video.cover}
        premium={channel?.visibility === 'premium'}
        tag={videoLabel(video)}
      />
      <Label
        numberOfLines={2}
        style={{
          fontWeight: '700',
          fontSize: compact ? 15 : 17,
          lineHeight: compact ? 20 : 23,
          letterSpacing: -0.2,
        }}
      >
        {video.title}
      </Label>
      <Caption numberOfLines={1} style={{ marginTop: -4 }}>
        {[channel?.name, meta].filter(Boolean).join(' · ')}
      </Caption>
    </Pressable>
  );
}

/** A small thumbnail beside the title, for lists of a channel's or a member's videos. */
export function VideoRow({
  video,
  channel,
  meta,
}: {
  video: Video;
  channel?: Channel;
  meta?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={videoName(video, channel, meta)}
      onPress={() => openVideo(video.id)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: 14,
        alignItems: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ width: 144 }}>
        <Poster uri={video.cover} premium={channel?.visibility === 'premium'} radius={8} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Label numberOfLines={2} style={{ fontWeight: '700', fontSize: 15, lineHeight: 20 }}>
          {video.title}
        </Label>
        <Caption numberOfLines={1}>
          {[channel?.name, videoLabel(video)].filter(Boolean).join(' · ')}
        </Caption>
        {meta && <Caption numberOfLines={1}>{meta}</Caption>}
      </View>
    </Pressable>
  );
}

/** A channel cover with its name, for rails. */
export function ChannelCard({ channel, width = 168 }: { channel: Channel; width?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        channel.name,
        channel.category,
        channel.visibility === 'premium' && 'Plus',
      ]
        .filter(Boolean)
        .join(', ')}
      onPress={() => openChannel(channel.id)}
      style={({ pressed }) => ({ width, gap: 8, opacity: pressed ? 0.8 : 1 })}
    >
      <Poster uri={channel.cover} premium={channel.visibility === 'premium'} />
      <View>
        <Label numberOfLines={1} style={{ fontWeight: '700', fontSize: 15, lineHeight: 20 }}>
          {channel.name}
        </Label>
        <Caption numberOfLines={1}>{channel.category}</Caption>
      </View>
    </Pressable>
  );
}

/** A channel in a list: its cover, name and one line of detail, with an optional action. */
export function ChannelRow({
  channel,
  detail,
  trailing,
}: {
  channel: Channel;
  detail: string;
  trailing?: ReactNode;
}) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[channel.name, channel.visibility === 'premium' && 'Plus', detail]
          .filter(Boolean)
          .join(', ')}
        onPress={() => openChannel(channel.id)}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 64,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Image
          source={channel.cover}
          style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: p.raised }}
          contentFit="cover"
          transition={180}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Label
              numberOfLines={1}
              style={{ flexShrink: 1, fontWeight: '700', fontSize: 16, lineHeight: 22 }}
            >
              {channel.name}
            </Label>
            {channel.visibility === 'premium' && <PlusBadge />}
          </View>
          <Caption numberOfLines={1}>{detail}</Caption>
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}
