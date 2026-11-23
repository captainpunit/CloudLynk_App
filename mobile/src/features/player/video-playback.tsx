import { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { Button, Label } from '@/components/ui';
import { clampSeek, shouldSaveProgress } from '@/domain/playback';
import { colors as c } from '@/theme/tokens';
import { PlayerControls } from './player-controls';
import { useFullscreenLayer } from './fullscreen-host';

function toSource(uri: string): VideoSource {
  return uri.includes('/manifest/video.m3u8')
    ? { uri, contentType: 'hls', useCaching: false }
    : uri;
}

/** Landscape with the system bars hidden while full screen; portrait again afterwards. */
async function setImmersive(on: boolean) {
  if (Platform.OS === 'web') return;
  await Promise.all([
    ScreenOrientation.lockAsync(
      on
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ),
    Platform.OS === 'android' ? NavigationBar.setVisibilityAsync(on ? 'hidden' : 'visible') : null,
  ]).catch(() => undefined);
}

/**
 * The video player. Mounted only after the access check.
 *
 * - The stream address can change (renewal); the picture keeps going at the same place.
 * - It starts at `resumeAt`, and nothing is reported as progress until it gets there, so a
 *   slow start never overwrites the member's place with 0.
 * - It pauses when the app goes to the background and reports where it stopped.
 */
export function VideoPlayback({
  uri,
  title,
  resumeAt,
  onProgress,
  onFinished,
  privateStream = false,
  onRetry,
}: {
  uri: string;
  title?: string;
  resumeAt: number;
  /** Reports the position; `final` asks for an immediate save (pause, leaving, background). */
  onProgress: (seconds: number, duration: number, final?: boolean) => void;
  onFinished?: (duration: number) => void;
  privateStream?: boolean;
  onRetry?: () => void;
}) {
  const start = useRef(resumeAt);
  const resumed = useRef(false);
  const loadedUri = useRef<string | null>(null);
  const report = useRef(onProgress);
  report.current = onProgress;
  const finished = useRef(onFinished);
  finished.current = onFinished;

  const player = useVideoPlayer(null, (instance) => {
    instance.timeUpdateEventInterval = 0.5;
    instance.keepScreenOnWhilePlaying = true;
    instance.staysActiveInBackground = false;
    // Browsers only start sound after a tap.
    instance.muted = Platform.OS === 'web';
  });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const [position, setPosition] = useState(resumeAt);
  const [buffered, setBuffered] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ended, setEnded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Load the stream, or swap a renewed address in place at the same moment.
  useEffect(() => {
    if (loadedUri.current === uri) return;
    const first = loadedUri.current === null;
    const at = first ? 0 : player.currentTime;
    const wasPlaying = first || player.playing;
    loadedUri.current = uri;
    void player
      .replaceAsync(toSource(uri))
      .then(() => {
        if (!first) {
          player.currentTime = at;
          if (wasPlaying) player.play();
        }
      })
      .catch(() => undefined); // Failures arrive through statusChange.
  }, [player, uri]);

  // First frame ready: jump to the resume point and start. "Ready" with no length yet is
  // the empty player before the stream arrives (web reports that), not the video.
  useEffect(() => {
    if (status !== 'readyToPlay' || !(player.duration > 0)) return;
    setDuration(player.duration);
    if (!resumed.current && loadedUri.current) {
      if (start.current > 0) player.currentTime = start.current;
      else resumed.current = true;
      player.play();
    }
  }, [player, status]);

  useEffect(() => {
    const time = player.addListener('timeUpdate', (event) => {
      setPosition(event.currentTime);
      setBuffered(event.bufferedPosition);
      if (player.duration > 0) setDuration(player.duration);
      if (!resumed.current && event.currentTime >= start.current - 2) resumed.current = true;
      if (shouldSaveProgress(event.currentTime, start.current, resumed.current))
        report.current(event.currentTime, player.duration);
    });
    const end = player.addListener('playToEnd', () => {
      setEnded(true);
      if (player.duration > 0) {
        report.current(player.duration, player.duration, true);
        finished.current?.(player.duration);
      }
    });
    return () => {
      time.remove();
      end.remove();
    };
  }, [player]);

  useEffect(() => {
    if (isPlaying) setEnded(false);
  }, [isPlaying]);
  // Saves the place at once when the viewer stops watching (pause, background, leaving).
  // Android also reports "not playing" while it buffers; that is not a reason to save.
  const saveNow = () => {
    if (resumed.current) report.current(player.currentTime, player.duration, true);
  };

  // Going to the background pauses; leaving the screen saves the place.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      // Android may have paused the player already; the place is saved either way.
      if (player.playing) player.pause();
      saveNow();
    });
    return () => {
      subscription.remove();
      saveNow();
    };
  }, [player]);

  // Moving the picture between the page and the full-screen layer must not stop it.
  // Android keeps the native player's place when its view moves; the web makes a new
  // <video> element that starts at 0, so the place is restored there.
  const handover = useRef<{ at: number; playing: boolean } | null>(null);
  useEffect(() => {
    void setImmersive(fullscreen);
    const state = handover.current;
    if (!state) return;
    handover.current = null;
    const timer = setTimeout(() => {
      if (Platform.OS === 'web') player.currentTime = state.at;
      if (state.playing) player.play();
    }, 50);
    return () => clearTimeout(timer);
  }, [fullscreen, player]);
  const toggleFullscreen = (on: boolean) => {
    handover.current = { at: player.currentTime, playing: player.playing };
    setFullscreen(on);
  };
  useEffect(() => () => void setImmersive(false), []);

  const view = {
    position,
    duration,
    buffered,
    playing: isPlaying,
    buffering: status === 'loading' || (status === 'idle' && !ended),
    ended,
  };
  const seek = (seconds: number) => {
    player.currentTime = clampSeek(seconds, duration);
    resumed.current = true;
    setPosition(player.currentTime);
    if (ended && seconds < duration - 1) setEnded(false);
  };
  const controls = (
    <PlayerControls
      view={view}
      title={title}
      fullscreen={fullscreen}
      onTogglePlay={() => {
        if (player.playing) {
          player.pause();
          saveNow();
        } else player.play();
      }}
      onSeek={seek}
      onReplay={() => {
        seek(0);
        player.play();
      }}
      onToggleFullscreen={() => toggleFullscreen(!fullscreen)}
    />
  );
  const failure = status === 'error' && (
    <View
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: c.scrim,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        gap: 12,
      }}
    >
      <Label accessibilityRole="alert" style={{ color: c.white, textAlign: 'center' }}>
        {privateStream
          ? 'The video stopped loading. Check your connection and try again.'
          : (error?.message ?? 'The video could not be loaded. Check your connection.')}
      </Label>
      <Button
        compact
        title="Try again"
        onPress={() => {
          const at = player.currentTime || start.current;
          start.current = at;
          resumed.current = false;
          loadedUri.current = uri;
          void player.replaceAsync(toSource(uri)).catch(() => undefined);
          onRetry?.();
        }}
      />
    </View>
  );
  // One VideoView at a time: inline, or in the full-screen layer.
  const picture = (
    <VideoView
      player={player}
      style={{ flex: 1, backgroundColor: c.player }}
      nativeControls={false}
      contentFit="contain"
      allowsPictureInPicture={!privateStream}
    />
  );
  // In full screen the picture lives in the app-wide layer (fullscreen-host.tsx);
  // without a host (tests, previews) it simply stays inline.
  const layer = useFullscreenLayer();
  const inLayer = fullscreen && layer !== null;
  useEffect(() => {
    if (inLayer)
      layer(
        <>
          <StatusBar hidden />
          {picture}
          {controls}
          {failure}
        </>,
      );
  });
  useEffect(() => {
    if (!inLayer) layer?.(null);
  }, [inLayer, layer]);
  useEffect(() => () => layer?.(null), [layer]);
  // Android Back leaves full screen instead of the page.
  useEffect(() => {
    if (!fullscreen) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      toggleFullscreen(false);
      return true;
    });
    return () => back.remove();
  });
  return (
    <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: c.player }}>
      {!inLayer && picture}
      {!inLayer && controls}
      {!inLayer && failure}
    </View>
  );
}
