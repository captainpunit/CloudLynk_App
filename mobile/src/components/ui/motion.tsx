import { useEffect, type ReactNode } from 'react';
import {
  Pressable,
  type DimensionValue,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { selectHaptic, tapHaptic } from '@/lib/haptics';
import { motion, radius } from '@/theme/tokens';
import { usePalette } from '@/theme/tone';

/**
 * Motion kit. Reanimated animations follow the phone's Reduce Motion setting by
 * default (ReduceMotion.System): they jump to their end state instead of moving.
 */
export const easeOut = Easing.bezier(0.2, 0, 0, 1);
const pressSpring = { damping: 22, stiffness: 340, mass: 0.6 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that settles to a slightly smaller scale while pressed. */
export function PressableScale({
  style,
  haptic,
  scaleTo = motion.pressScale,
  onPressIn,
  onPressOut,
  onPress,
  ...props
}: Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  haptic?: 'tap' | 'select';
  scaleTo?: number;
}) {
  const scale = useSharedValue(1);
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        scale.value = withSpring(scaleTo, pressSpring);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, pressSpring);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic === 'tap') tapHaptic();
        if (haptic === 'select') selectHaptic();
        onPress?.(event);
      }}
      style={[style, pressed]}
    />
  );
}

/** Content that rises into place. `index` staggers lists; the delay stops growing after 6 items. */
export function FadeIn({
  children,
  index = 0,
  style,
}: {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.slow)
        .delay(Math.min(index, 6) * 40)
        .easing(easeOut)
        .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Placeholder block that pulses while content loads, in the current tone's colour.
 * Hidden from screen readers. Give it a height, or size it through `style`
 * (for example an aspectRatio).
 */
export function Skeleton({
  width = '100%',
  height,
  rounded = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const opacity = useSharedValue(0.55);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: rounded,
          backgroundColor: p.skeleton,
        },
        style,
        pulse,
      ]}
    />
  );
}
