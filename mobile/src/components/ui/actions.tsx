import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { LucideIcon } from 'lucide-react-native';
import { Label } from './typography';
import { PressableScale } from './motion';
import { colors as c, motion, plus, radius, text } from '@/theme/tokens';
import { usePalette, type Palette } from '@/theme/tone';

export function IconButton({
  icon: Icon,
  onPress,
  label,
  dark = false,
}: {
  icon: LucideIcon;
  onPress: () => void;
  label: string;
  /** Glass style for buttons laid over images. */
  dark?: boolean;
}) {
  const p = usePalette();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.92}
      style={{
        width: 46,
        height: 46,
        borderRadius: radius.pill,
        backgroundColor: dark ? c.scrim : p.surface,
        borderWidth: 1,
        borderColor: dark ? c.glassLine : p.line,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Icon size={20} color={dark ? c.white : p.ink} strokeWidth={1.8} />
    </PressableScale>
  );
}

type ButtonVariant = 'primary' | 'soft' | 'outline' | 'danger' | 'plus';

function buttonColors(variant: ButtonVariant, p: Palette) {
  switch (variant) {
    case 'primary':
      return { background: p.action, foreground: p.onAction, border: p.action };
    case 'danger':
      return { background: c.danger, foreground: c.white, border: c.danger };
    case 'plus':
      return { background: plus.fill, foreground: plus.onFill, border: plus.fill };
    case 'soft':
      return { background: p.raised, foreground: p.ink, border: p.raised };
    case 'outline':
      return { background: 'transparent', foreground: p.ink, border: p.line };
  }
}

/** Disabled buttons use their own colours, so they stay legible instead of fading out. */
function disabledColors(variant: ButtonVariant, p: Palette) {
  return variant === 'outline'
    ? { background: 'transparent', foreground: p.disabledInk, border: p.line }
    : { background: p.disabledSurface, foreground: p.disabledInk, border: p.disabledSurface };
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon: Icon,
  compact = false,
  label,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  /** A 44pt button for rows and inline actions. */
  compact?: boolean;
  /** Accessible name when the visible title needs context, such as the channel's name. */
  label?: string;
}) {
  const p = usePalette();
  const { background, foreground, border } = disabled
    ? disabledColors(variant, p)
    : buttonColors(variant, p);
  // A light tap confirms actions that commit something; soft and outline stay quiet.
  const confirms = variant === 'primary' || variant === 'danger' || variant === 'plus';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      haptic={confirms ? 'tap' : undefined}
      style={{
        minHeight: compact ? 44 : 52,
        paddingHorizontal: compact ? 16 : 20,
        paddingVertical: compact ? 8 : 13,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
      }}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {Icon && <Icon size={compact ? 16 : 18} color={foreground} strokeWidth={2} />}
          <Label
            variant="button"
            style={{ color: foreground, fontSize: compact ? 14 : 15 }}
            numberOfLines={1}
          >
            {title}
          </Label>
        </>
      )}
    </PressableScale>
  );
}

/** Selectable chip. The fill fades between states; the target is 44 px tall. */
export function Pill({
  title,
  selected = false,
  onPress,
  label,
}: {
  title: string;
  selected?: boolean;
  onPress: () => void;
  /** Accessible name when the title alone is ambiguous, such as "Show Plus channels". */
  label?: string;
}) {
  const p = usePalette();
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: motion.fast });
  }, [progress, selected]);
  // Unselected is the ink colour at zero alpha, so the fill fades in rather than
  // passing through grey.
  const chip = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [`${p.ink}00`, p.ink]),
    borderColor: interpolateColor(progress.value, [0, 1], [p.line, p.ink]),
  }));
  const ink = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [p.ink, p.canvas]),
  }));
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ selected }}
      onPress={onPress}
      haptic="select"
    >
      <Animated.View
        style={[
          {
            minHeight: 44,
            paddingHorizontal: 18,
            justifyContent: 'center',
            borderWidth: 1,
            borderRadius: radius.pill,
          },
          chip,
        ]}
      >
        <Animated.Text style={[text.callout, { fontWeight: '600' }, ink]}>{title}</Animated.Text>
      </Animated.View>
    </PressableScale>
  );
}

/** Hairline divider in the current tone. */
export function Divider() {
  const p = usePalette();
  return <View style={{ height: 1, backgroundColor: p.line }} />;
}
