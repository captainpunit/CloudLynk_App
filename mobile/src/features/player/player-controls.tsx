import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View, type GestureResponderEvent } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  ArrowLeft,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  type LucideIcon,
} from 'lucide-react-native';
import { Label } from '@/components/ui';
import { selectHaptic } from '@/lib/haptics';
import { clampSeek, formatTime, SKIP_SECONDS } from '@/domain/playback';
import { colors as c, motion } from '@/theme/tokens';

const DOUBLE_TAP_MS = 280;
const HIDE_AFTER_MS = 3500;

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
}: {
  view: PlayerView;
  title?: string;
  fullscreen: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onReplay: () => void;
  onToggleFullscreen: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ side: 'back' | 'forward'; id: number } | null>(null);
  const lastTap = useRef<{ at: number; side: 'back' | 'forward' } | null>(null);
  const singleTap = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const width = useRef(1);
  const pinned = !view.playing || view.ended || scrubbing !== null;
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
    const timer = setTimeout(() => setFlash(null), 650);
    return () => clearTimeout(timer);
  }, [flash]);

  function skip(direction: 1 | -1) {
    poke();
    onSeek(clampSeek(view.position + direction * SKIP_SECONDS, view.duration));
    setFlash({ side: direction > 0 ? 'forward' : 'back', id: Date.now() });
  }

  function onSurfacePress(event: GestureResponderEvent) {
    const side = event.nativeEvent.locationX < width.current / 2 ? 'back' : 'forward';
    const now = Date.now();
    const previous = lastTap.current;
    if (previous && now - previous.at < DOUBLE_TAP_MS && previous.side === side) {
      clearTimeout(singleTap.current);
      lastTap.current = null;
      selectHaptic();
      skip(side === 'forward' ? 1 : -1);
      return;
    }
    lastTap.current = { at: now, side };
    clearTimeout(singleTap.current);
    singleTap.current = setTimeout(() => setVisible((value) => !value), DOUBLE_TAP_MS);
  }

  const shown = scrubbing ?? view.position;
  return (
    <View
      style={{ position: 'absolute', inset: 0 }}
      onLayout={(event) => (width.current = event.nativeEvent.layout.width || 1)}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide player controls' : 'Show player controls'}
        onPress={onSurfacePress}
        style={{ position: 'absolute', inset: 0 }}
      />
      {flash && (
        <Animated.View
          key={flash.id}
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
              {flash.side === 'back' ? `−${SKIP_SECONDS}s` : `+${SKIP_SECONDS}s`}
            </Label>
          </View>
        </Animated.View>
      )}
      {visible && (
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
              </Label>
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
    </View>
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
