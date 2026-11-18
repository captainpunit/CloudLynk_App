import type { ComponentProps } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { text, type TextVariant } from '@/theme/tokens';
import { usePalette, type Palette } from '@/theme/tone';

/** Text colours, resolved against the current tone so they work on light and dark screens. */
const tones = {
  default: (p: Palette) => p.ink,
  muted: (p: Palette) => p.muted,
  danger: (p: Palette) => p.danger,
  success: (p: Palette) => p.success,
  warning: (p: Palette) => p.warning,
  plus: (p: Palette) => p.plusInk,
};
export type TextTone = keyof typeof tones;

/** All app text. `variant` picks a preset from the type scale; `style` refines it. */
export function Label({
  variant = 'body',
  tone = 'default',
  style,
  ...props
}: ComponentProps<typeof Text> & { variant?: TextVariant; tone?: TextTone }) {
  const p = usePalette();
  return <Text {...props} style={[text[variant], { color: tones[tone](p) }, style]} />;
}

/** Secondary text: metadata lines, hints and descriptions. */
export function Caption(props: ComponentProps<typeof Label>) {
  return <Label variant="caption" tone="muted" {...props} />;
}

/**
 * Headings carry the header role for screen readers and use Plus Jakarta Sans.
 * Change weight by changing `level`, never with fontWeight (see theme/tokens.ts).
 */
export function Heading({
  children,
  level = 'title',
  tone = 'default',
  numberOfLines,
  style,
}: {
  children: ComponentProps<typeof Text>['children'];
  level?: 'display' | 'title' | 'headline' | 'subhead';
  tone?: TextTone;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Label
      accessibilityRole="header"
      variant={level}
      tone={tone}
      numberOfLines={numberOfLines}
      style={style}
    >
      {children}
    </Label>
  );
}
