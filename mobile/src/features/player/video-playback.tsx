import { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEvent } from 'expo';
import {
  useVideoPlayer,
  VideoView,
  type AudioTrack,
  type SubtitleTrack,
  type VideoSource,
} from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { Button, Label } from '@/components/ui';
import { clampSeek, isFinished, shouldSaveProgress } from '@/domain/playback';
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
  onRetry,
}: {
  uri: string;
  title?: string;
  resumeAt: number;
  /** Reports the position; `final` asks for an immediate save (pause, leaving, background). */
  onProgress: (seconds: number, duration: number, final?: boolean) => void;
  onFinished?: (duration: number) => void;
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
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const [position, setPosition] = useState(resumeAt);
  const [buffered, setBuffered] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ended, setEnded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fill, setFill] = useState(false);
  const [controlsShown, setControlsShown] = useState(true);
  const rate = useRef(1);
  const [shownRate, setShownRate] = useState(1);
  const { availableSubtitleTracks } = useEvent(player, 'availableSubtitleTracksChange', {
    availableSubtitleTracks: player.availableSubtitleTracks,
  });
  const { subtitleTrack } = useEvent(player, 'subtitleTrackChange', {
    subtitleTrack: player.subtitleTrack,
  });
  const { availableAudioTracks } = useEvent(player, 'availableAudioTracksChange', {
    availableAudioTracks: player.availableAudioTracks,
  });
  const { audioTrack } = useEvent(player, 'audioTrackChange', { audioTrack: player.audioTrack });

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
        // A new source starts at normal speed; keep the viewer's choice.
        player.playbackRate = rate.current;
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
      // Android can report "ended" while a stream is still loading or seeking to the resume
      // point; only a player that got going and is really at the end has finished.
      if (!resumed.current || !isFinished(player.currentTime, player.duration)) return;
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

  // Picture-in-picture: the video keeps playing in a small window over other apps.
  const inPip = useRef(false);
  // Set when this code paused the video for going to the background, so a small window that
  // opens a little later can take it up again.
  const pausedForBackground = useRef(false);
  const [pip, setPip] = useState(false);

  // Going to the background pauses, unless the video moved into its small window;
  // leaving the screen saves the place.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      clearTimeout(timer);
      if (state === 'active') {
        pausedForBackground.current = false;
        return;
      }
      saveNow();
      // Android reports "background" around the moment it opens the small window, in
      // either order, so the decision waits a moment.
      timer = setTimeout(() => {
        if (inPip.current || !player.playing) return;
        player.pause();
        pausedForBackground.current = true;
      }, 600);
    });
    return () => {
      clearTimeout(timer);
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
    const target = clampSeek(seconds, duration);
    player.currentTime = target;
    resumed.current = true;
    // The target, not player.currentTime: the native seek may not have landed yet, and quick
    // repeated skips count from here.
    setPosition(target);
    if (ended && seconds < duration - 1) setEnded(false);
  };
  const controls = (
    <PlayerControls
      onVisibleChange={setControlsShown}
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
      settings={{
        rate: shownRate,
        subtitles: availableSubtitleTracks,
        subtitle: subtitleTrack,
        audios: availableAudioTracks,
        audio: audioTrack,
        fill,
      }}
      actions={{
        onRate: (next) => {
          rate.current = next;
          player.playbackRate = next;
          setShownRate(next);
        },
        // The panel only hands back tracks taken from the player's own lists.
        onSubtitle: (track) => (player.subtitleTrack = track as SubtitleTrack | null),
        onAudio: (track) => (player.audioTrack = track as AudioTrack),
        onToggleFill: () => setFill((value) => !value),
      }}
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
        {/* Never the player's own error text: it is written for developers. */}
        The video stopped loading. Check your connection and try again.
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
  // Android draws subtitles a fixed distance above the bottom of the picture, where the
  // seek bar and time sit; while the controls show, the subtitles move up above them by the
  // height of that row (76 inline, 96 in full screen).
  const subtitleInset = controlsShown && !pip ? (fullscreen ? 96 : 76) : 0;
  // A CloudLynk addition to expo-video on Android (patches/expo-video+58.0.14.patch).
  const subtitleProps =
    Platform.OS === 'android' ? ({ subtitleBottomInset: subtitleInset } as object) : {};
  // One VideoView at a time: inline, or in the full-screen layer.
  const picture = (
    <VideoView
      player={player}
      style={{ flex: 1, backgroundColor: c.player }}
      nativeControls={false}
      contentFit={fullscreen && fill ? 'cover' : 'contain'}
      allowsPictureInPicture
      // Pressing Home moves the video into a small window (Android 12+). Kept steady while a
      // video is loaded: flipping it with every pause or buffer makes expo-video lose track
      // of which view goes into the window, and Android then shrinks the whole app instead.
      startsPictureInPictureAutomatically={duration > 0 && !ended}
      onPictureInPictureStart={() => {
        inPip.current = true;
        setPip(true);
        if (pausedForBackground.current) {
          pausedForBackground.current = false;
          player.play();
        }
      }}
      onPictureInPictureStop={() => {
        inPip.current = false;
        setPip(false);
        // Closing the small window stops the video in native code (the expo-video patch), since
        // only Android knows then whether the window closed or opened back into the app.
        saveNow();
      }}
      {...subtitleProps}
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
          {!pip && controls}
          {failure}
        </>,
      );
  });
  useEffect(() => {
    if (!inLayer) layer?.(null);
  }, [inLayer, layer]);
  useEffect(() => () => layer?.(null), [layer]);
  // Android Back leaves full screen instead of the page. Registered once per change, so the
  // settings panel (registered when it opens, later) gets Back first.
  const leaveFullscreen = useRef(() => toggleFullscreen(false));
  leaveFullscreen.current = () => toggleFullscreen(false);
  useEffect(() => {
    if (!fullscreen) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      leaveFullscreen.current();
      return true;
    });
    return () => back.remove();
  }, [fullscreen]);
  return (
    <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: c.player }}>
      {!inLayer && picture}
      {!inLayer && !pip && controls}
      {!inLayer && failure}
    </View>
  );
}
