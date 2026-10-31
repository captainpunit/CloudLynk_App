import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Button, Label } from '@/components/ui';
import { colors as c } from '@/theme/tokens';

/** Mounted only after access checks. Progress listeners are released on unmount. */
export function VideoPlayback({
  uri,
  resumeAt,
  onProgress,
  privateStream = false,
  onRetry,
}: {
  uri: string;
  resumeAt: number;
  onProgress: (seconds: number) => void;
  privateStream?: boolean;
  onRetry?: () => void;
}) {
  const resumed = useRef(false);
  const callback = useRef(onProgress);
  callback.current = onProgress;
  const source = uri.includes('/manifest/video.m3u8')
    ? ({ uri, contentType: 'hls', useCaching: false } as const)
    : uri;
  const player = useVideoPlayer(source, (instance) => {
    instance.timeUpdateEventInterval = 5;
    instance.muted = Platform.OS === 'web';
  });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });
  useEffect(() => {
    const subscription = player.addListener('timeUpdate', (event) =>
      callback.current(event.currentTime),
    );
    return () => {
      subscription.remove();
    };
  }, [player]);
  useEffect(() => {
    if (status === 'readyToPlay' && !resumed.current) {
      resumed.current = true;
      if (resumeAt > 0) player.currentTime = resumeAt;
      player.play();
    }
  }, [player, status, resumeAt]);
  return (
    <View style={{ gap: 12 }}>
      <VideoView
        player={player}
        style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#071413', borderRadius: 17 }}
        nativeControls
        contentFit="contain"
        allowsPictureInPicture={!privateStream}
      />
      {status === 'loading' && <Label style={{ color: c.muted }}>Getting your video ready…</Label>}
      {status === 'error' && (
        <View style={{ gap: 10 }}>
          <Label accessibilityRole="alert" style={{ color: c.danger }}>
            {privateStream
              ? 'The video could not be loaded. Retry to check playback access.'
              : (error?.message ?? 'The video could not be loaded. Check your connection.')}
          </Label>
          <Button
            title="Retry playback"
            onPress={() => {
              if (onRetry) {
                onRetry();
                return;
              }
              resumed.current = false;
              void player.replaceAsync(source).catch(() => {
                // expo-video exposes replacement failures through statusChange.
              });
            }}
          />
        </View>
      )}
    </View>
  );
}
