import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  ArrowLeft,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Label } from '@/components/ui';
import { selectHaptic } from '@/lib/haptics';
import {
  clampSeek,
  formatTime,
  nextSkip,
  SKIP_SECONDS,
  SPEEDS,
  speedLabel,
  trackName,
} from '@/domain/playback';
import { colors as c, motion } from '@/theme/tokens';

const DOUBLE_TAP_MS = 280;
const HIDE_AFTER_MS = 3500;
/** How long a skip stays on screen; further taps on that side within it add 10 more. */
const SKIP_SHOWN_MS = 800;

/** A subtitle or audio track; the panel only ever hands back one it was given. */
export type Track = { id?: string; label?: string; name?: string; language?: string };

/** Choices in the settings panel. Subtitles and audio appear only when the video has them. */
export type PlayerSettings = {
  rate: number;
  subtitles: Track[];
  subtitle: Track | null;
  audios: Track[];
  audio: Track | null;
  /** Full screen only: fill the screen (cropping the edges) instead of fitting inside it. */
  fill: boolean;
};

export type PlayerSettingsActions = {
  onRate: (rate: number) => void;
  onSubtitle: (track: Track | null) => void;
  onAudio: (track: Track) => void;
  onToggleFill: () => void;
};

const sameTrack = (a: Track | null, b: Track | null) =>
  !!a &&
  !!b &&
  (a.id !== undefined ? a.id === b.id : a.language === b.language && a.label === b.label);

export type PlayerView = {
  position: number;
  duration: number;
  buffered: number;
  playing: boolean;
  buffering: boolean;
  ended: boolean;
};

/**
 * The layer over the picture, in the manner of a streaming app: one tap shows or hides the
 * controls, a double tap on the left or right skips back or forward, and the controls hide
 * themselves while the video plays.
 */
export function PlayerControls({
  view,
  title,
  fullscreen,
  onTogglePlay,
  onSeek,
  onReplay,
  onToggleFullscreen,
  settings,
  actions,
  onVisibleChange,
}: {
  view: PlayerView;
  title?: string;
  fullscreen: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onReplay: () => void;
  onToggleFullscreen: () => void;
  settings: PlayerSettings;
  actions: PlayerSettingsActions;
  /** Whether the bottom controls are on screen, so subtitles can make room for them. */
  onVisibleChange?: (shown: boolean) => void;
}) {
  const [visible, setVisible] = useState(true);
  const [menu, setMenu] = useState(false);
  const reportVisible = useRef(onVisibleChange);
  reportVisible.current = onVisibleChange;
  useEffect(() => reportVisible.current?.(visible && !menu), [visible, menu]);
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const [flash, setFlash] = useState<{
    side: 'back' | 'forward';
    amount: number;
    id: number;
  } | null>(null);
  const lastTap = useRef<{ at: number; side: 'back' | 'forward' } | null>(null);
  const singleTap = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pinned = !view.playing || view.ended || scrubbing !== null || menu;
  // Bumped by every control press, so the controls stay up a little longer after use.
  const [touched, setTouched] = useState(0);
  const poke = () => setTouched((value) => value + 1);

  // Hide while playing; stay up while paused, finished or seeking.
  useEffect(() => {
    if (!visible || pinned) return;
    const timer = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [visible, pinned, touched]);
  useEffect(() => {
    if (pinned) setVisible(true);
  }, [pinned]);
  useEffect(() => () => clearTimeout(singleTap.current), []);
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), SKIP_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  function skip(direction: 1 | -1) {
    poke();
    onSeek(clampSeek(view.position + direction * SKIP_SECONDS, view.duration));
    const side = direction > 0 ? 'forward' : 'back';
    setFlash((previous) => ({ ...nextSkip(previous, side), id: Date.now() }));
  }

  /** A skip by tapping the picture: the controls step aside so the count is all that shows. */
  function tapSkip(side: 'back' | 'forward') {
    clearTimeout(singleTap.current);
    lastTap.current = null;
    selectHaptic();
    setVisible(false);
    skip(side === 'forward' ? 1 : -1);
  }

  // Each half of the picture is its own tap area, so the side never depends on measuring.
  function onSurfacePress(side: 'back' | 'forward') {
    // While a skip is showing, each further tap on that side skips again.
    if (flash && flash.side === side) return tapSkip(side);
    const now = Date.now();
    const previous = lastTap.current;
    if (previous && now - previous.at < DOUBLE_TAP_MS && previous.side === side)
      return tapSkip(side);
    lastTap.current = { at: now, side };
    clearTimeout(singleTap.current);
    singleTap.current = setTimeout(() => setVisible((value) => !value), DOUBLE_TAP_MS);
  }

  const shown = scrubbing ?? view.position;
  return (
    <View style={{ position: 'absolute', inset: 0 }}>
      <View style={{ position: 'absolute', inset: 0, flexDirection: 'row' }}>
        {(['back', 'forward'] as const).map((side) => (
          <Pressable
            key={side}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide player controls' : 'Show player controls'}
            onPress={() => onSurfacePress(side)}
            style={{ flex: 1 }}
          />
        ))}
      </View>
      {flash && !visible && (
        <Animated.View
          key={flash.side}
          entering={FadeIn.duration(motion.fast)}
          exiting={FadeOut.duration(motion.base)}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            [flash.side === 'back' ? 'left' : 'right']: '12%',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: c.scrimSoft,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Label style={{ color: c.white, fontWeight: '700' }}>
              {flash.side === 'back' ? `−${flash.amount}s` : `+${flash.amount}s`}
            </Label>
          </View>
        </Animated.View>
      )}
      {visible && !menu && (
        <Animated.View
          entering={FadeIn.duration(motion.fast)}
          exiting={FadeOut.duration(motion.base)}
          pointerEvents="box-none"
          style={{ position: 'absolute', inset: 0, backgroundColor: c.scrimSoft }}
        >
          {fullscreen && (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                right: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <RoundButton icon={ArrowLeft} label="Exit full screen" onPress={onToggleFullscreen} />
              {!!title && (
                <Label numberOfLines={1} style={{ color: c.white, fontWeight: '700', flex: 1 }}>
                  {title}
                </Label>
              )}
            </View>
          )}
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              inset: 0,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: fullscreen ? 72 : 40,
            }}
          >
            <SkipButton direction={-1} onPress={() => skip(-1)} />
            {view.buffering && !view.ended ? (
              <View
                style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}
              >
                <ActivityIndicator size="large" color={c.white} />
              </View>
            ) : (
              <RoundButton
                big
                icon={view.ended ? RotateCcw : view.playing ? Pause : Play}
                label={view.ended ? 'Play again' : view.playing ? 'Pause' : 'Play'}
                onPress={() => {
                  poke();
                  (view.ended ? onReplay : onTogglePlay)();
                }}
              />
            )}
            <SkipButton direction={1} onPress={() => skip(1)} />
          </View>
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              left: fullscreen ? 24 : 12,
              right: fullscreen ? 24 : 12,
              bottom: fullscreen ? 16 : 4,
              gap: 2,
            }}
          >
            <SeekBar
              position={shown}
              duration={view.duration}
              buffered={view.buffered}
              onScrub={setScrubbing}
              onCommit={(seconds) => {
                setScrubbing(null);
                poke();
                onSeek(seconds);
              }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Label style={{ color: c.white, fontSize: 13, lineHeight: 18, flex: 1 }}>
                {formatTime(shown)}
                {view.duration > 0 ? `  /  ${formatTime(view.duration)}` : ''}
                {settings.rate !== 1 ? `   ${speedLabel(settings.rate)}` : ''}
              </Label>
              <RoundButton
                small
                icon={Settings}
                label="Playback settings"
                onPress={() => {
                  poke();
                  setMenu(true);
                }}
              />
              <RoundButton
                small
                icon={fullscreen ? Minimize : Maximize}
                label={fullscreen ? 'Exit full screen' : 'Full screen'}
                onPress={onToggleFullscreen}
              />
            </View>
          </View>
        </Animated.View>
      )}
      {menu && (
        <SettingsPanel
          settings={settings}
          actions={actions}
          fullscreen={fullscreen}
          onClose={() => setMenu(false)}
        />
      )}
    </View>
  );
}

/**
 * Speed, subtitles and audio, over the picture. Choosing applies at once and closes the
 * panel, as streaming apps do; tapping outside or the close button just closes it.
 */
function SettingsPanel({
  settings,
  actions,
  fullscreen,
  onClose,
}: {
  settings: PlayerSettings;
  actions: PlayerSettingsActions;
  fullscreen: boolean;
  onClose: () => void;
}) {
  const choose = (apply: () => void) => {
    selectHaptic();
    apply();
    onClose();
  };
  // Android Back closes the panel before it leaves full screen or the page.
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => back.remove();
  }, [onClose]);
  return (
    <Animated.View
      entering={FadeIn.duration(motion.fast)}
      exiting={FadeOut.duration(motion.fast)}
      style={{ position: 'absolute', inset: 0, backgroundColor: c.scrimHero }}
    >
      <View
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          zIndex: 1,
        }}
      >
        <RoundButton icon={X} label="Close playback settings" onPress={onClose} />
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: fullscreen ? 48 : 16,
          paddingTop: fullscreen ? 28 : 12,
          paddingBottom: 16,
          gap: fullscreen ? 20 : 12,
        }}
      >
        <Choices title="Speed">
          {SPEEDS.map((rate) => (
            <Chip
              key={rate}
              title={speedLabel(rate)}
              selected={settings.rate === rate}
              onPress={() => choose(() => actions.onRate(rate))}
            />
          ))}
        </Choices>
        {fullscreen && (
          <Choices title="Picture">
            <Chip
              title="Fit"
              selected={!settings.fill}
              onPress={() => choose(() => settings.fill && actions.onToggleFill())}
            />
            <Chip
              title="Fill screen"
              selected={settings.fill}
              onPress={() => choose(() => !settings.fill && actions.onToggleFill())}
            />
          </Choices>
        )}
        {settings.subtitles.length > 0 && (
          <Choices title="Subtitles">
            <Chip
              title="Off"
              selected={settings.subtitle === null}
              onPress={() => choose(() => actions.onSubtitle(null))}
            />
            {settings.subtitles.map((track, index) => (
              <Chip
                key={track.id ?? `${track.language}-${index}`}
                title={trackName(track)}
                selected={sameTrack(settings.subtitle, track)}
                onPress={() => choose(() => actions.onSubtitle(track))}
              />
            ))}
          </Choices>
        )}
        {settings.audios.length > 1 && (
          <Choices title="Audio">
            {settings.audios.map((track, index) => (
              <Chip
                key={track.id ?? `${track.language}-${index}`}
                title={trackName(track)}
                selected={sameTrack(settings.audio, track)}
                onPress={() => choose(() => actions.onAudio(track))}
              />
            ))}
          </Choices>
        )}
      </ScrollView>
    </Animated.View>
  );
}

function Choices({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={title} style={{ gap: 8 }}>
      <Label style={{ color: c.white, fontWeight: '700' }}>{title}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

function Chip({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ selected, checked: selected }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 36,
        paddingHorizontal: 14,
        borderRadius: 999,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: selected ? c.white : c.glassLine,
        backgroundColor: selected ? c.white : c.glassSoft,
        transform: [{ scale: pressed ? motion.pressScale : 1 }],
      })}
    >
      <Label
        numberOfLines={1}
        style={{
          color: selected ? c.player : c.white,
          fontSize: 14,
          lineHeight: 20,
          fontWeight: '600',
        }}
      >
        {title}
      </Label>
    </Pressable>
  );
}

function RoundButton({
  icon: Icon,
  label,
  onPress,
  big = false,
  small = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  big?: boolean;
  small?: boolean;
}) {
  const size = big ? 64 : small ? 40 : 44;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={small ? 6 : 4}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: big ? c.scrimSoft : 'transparent',
        transform: [{ scale: pressed ? motion.pressScale : 1 }],
      })}
    >
      <Icon
        size={big ? 34 : small ? 20 : 24}
        color={c.white}
        fill={big && Icon !== RotateCcw ? c.white : 'transparent'}
        strokeWidth={big ? 1.6 : 2}
      />
    </Pressable>
  );
}

function SkipButton({ direction, onPress }: { direction: 1 | -1; onPress: () => void }) {
  const Icon = direction < 0 ? RotateCcw : RotateCw;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        direction < 0 ? `Back ${SKIP_SECONDS} seconds` : `Forward ${SKIP_SECONDS} seconds`
      }
      onPress={onPress}
      style={({ pressed }) => ({
        width: 52,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? motion.pressScale : 1 }],
      })}
    >
      <Icon size={36} color={c.white} strokeWidth={1.6} />
      <View
        style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
      >
        <Label style={{ color: c.white, fontSize: 11, lineHeight: 14, fontWeight: '700' }}>
          {SKIP_SECONDS}
        </Label>
      </View>
    </Pressable>
  );
}

/** A thin bar that grows while dragged; seeks when released. */
function SeekBar({
  position,
  duration,
  buffered,
  onScrub,
  onCommit,
}: {
  position: number;
  duration: number;
  buffered: number;
  onScrub: (seconds: number | null) => void;
  onCommit: (seconds: number) => void;
}) {
  const width = useRef(1);
  const [active, setActive] = useState(false);
  const toSeconds = (x: number) => clampSeek((Math.max(0, x) / width.current) * duration, duration);
  const fraction = duration > 0 ? Math.min(1, position / duration) : 0;
  const loaded = duration > 0 ? Math.min(1, buffered / duration) : 0;
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Video position"
      accessibilityValue={{
        min: 0,
        max: Math.round(duration),
        now: Math.round(position),
        text: `${formatTime(position)} of ${formatTime(duration)}`,
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) =>
        onCommit(
          clampSeek(
            position + (event.nativeEvent.actionName === 'increment' ? 1 : -1) * SKIP_SECONDS,
            duration,
          ),
        )
      }
      onLayout={(event) => (width.current = event.nativeEvent.layout.width || 1)}
      onStartShouldSetResponder={() => duration > 0}
      onMoveShouldSetResponder={() => duration > 0}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => {
        setActive(true);
        onScrub(toSeconds(event.nativeEvent.locationX));
      }}
      onResponderMove={(event) => onScrub(toSeconds(event.nativeEvent.locationX))}
      onResponderRelease={(event) => {
        setActive(false);
        onCommit(toSeconds(event.nativeEvent.locationX));
      }}
      onResponderTerminate={() => {
        setActive(false);
        onScrub(null);
      }}
      style={{ height: 32, justifyContent: 'center' }}
    >
      <View
        pointerEvents="none"
        style={{
          height: active ? 6 : 4,
          borderRadius: 3,
          backgroundColor: c.glassSoft,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${loaded * 100}%`,
            backgroundColor: c.glassLine,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${fraction * 100}%`,
            backgroundColor: c.white,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: `${fraction * 100}%`,
          marginLeft: active ? -9 : -6,
          width: active ? 18 : 12,
          height: active ? 18 : 12,
          borderRadius: 9,
          backgroundColor: c.white,
        }}
      />
    </View>
  );
}
