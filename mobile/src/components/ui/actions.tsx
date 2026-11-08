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
import { colors as c, layout, motion, radius, text } from '@/theme/tokens';

/** Round icon action. 44 px target; `dark` sits on cinema surfaces and imagery. */
export function IconButton({
  icon: Icon,
  onPress,
  label,
  dark = false,
}: {
  icon: LucideIcon;
  onPress: () => void;
  label: string;
  dark?: boolean;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.92}
      style={{
        width: layout.touchTarget,
        height: layout.touchTarget,
        borderRadius: radius.pill,
        backgroundColor: dark ? c.glassSoft : c.surface,
        borderWidth: 1,
        borderColor: dark ? c.glassLine : c.line,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Icon size={20} color={dark ? c.onCinema : c.ink} strokeWidth={1.8} />
    </PressableScale>
  );
}

type ButtonVariant = 'primary' | 'soft' | 'outline' | 'danger' | 'ghost';
const buttonColors: Record<ButtonVariant, { background: string; foreground: string }> = {
  primary: { background: c.primary, foreground: c.white },
  soft: { background: c.primarySoft, foreground: c.primary },
  outline: { background: c.surface, foreground: c.primary },
  danger: { background: c.danger, foreground: c.white },
  ghost: { background: 'transparent', foreground: c.primary },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
}) {
  const inactive = disabled || loading;
  const filled = variant === 'primary' || variant === 'danger' || variant === 'soft';
  const { background, foreground } = buttonColors[variant];
  const ink = disabled ? c.disabledInk : foreground;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      haptic={variant === 'primary' || variant === 'danger' ? 'tap' : undefined}
      style={{
        minHeight: size === 'md' ? 52 : 40,
        paddingHorizontal: size === 'md' ? 20 : 14,
        borderRadius: size === 'md' ? radius.md : radius.sm,
        borderWidth: variant === 'outline' ? 1 : 0,
        borderColor: c.line,
        backgroundColor: disabled && filled ? c.disabledSurface : background,
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
          {Icon && <Icon size={size === 'md' ? 18 : 16} color={ink} strokeWidth={2} />}
          <Label
            variant="button"
            style={{ color: ink, fontSize: size === 'md' ? 15 : 14 }}
            numberOfLines={1}
          >
            {title}
          </Label>
        </>
      )}
    </PressableScale>
  );
}

/** Selectable chip. The fill animates between states; touch area reaches 44 px. */
export function Pill({
  title,
  selected = false,
  onPress,
}: {
  title: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: motion.fast });
  }, [progress, selected]);
  const chip = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [c.surface, c.ink]),
    borderColor: interpolateColor(progress.value, [0, 1], [c.line, c.ink]),
  }));
  const label = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [c.muted, c.white]),
  }));
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      onPress={onPress}
      haptic="select"
      hitSlop={{ top: 2, bottom: 2 }}
    >
      <Animated.View
        style={[
          {
            minHeight: 40,
            paddingHorizontal: 16,
            justifyContent: 'center',
            borderWidth: 1,
            borderRadius: radius.pill,
          },
          chip,
        ]}
      >
        <Animated.Text style={[text.callout, { fontWeight: '600' }, label]}>{title}</Animated.Text>
      </Animated.View>
    </PressableScale>
  );
}

/** Thin divider using the line token. */
export function Divider() {
  return <View style={{ height: 1, backgroundColor: c.line }} />;
}
