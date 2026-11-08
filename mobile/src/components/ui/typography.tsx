import type { ComponentProps } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { colors as c, text, type TextVariant } from '@/theme/tokens';

const tones = {
  default: c.ink,
  muted: c.muted,
  primary: c.primary,
  danger: c.danger,
  success: c.success,
  inverse: c.white,
  onCinema: c.onCinema,
  onCinemaMuted: c.onCinemaMuted,
};
export type TextTone = keyof typeof tones;

/** All app text. `variant` picks a preset from the type scale; `style` refines it. */
export function Label({
  variant = 'body',
  tone = 'default',
  style,
  ...props
}: ComponentProps<typeof Text> & { variant?: TextVariant; tone?: TextTone }) {
  return <Text {...props} style={[text[variant], { color: tones[tone] }, style]} />;
}

/** Headings carry the header role for screen readers. */
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
