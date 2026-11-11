import type { ComponentProps, ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';
import { usePalette } from '@/theme/tone';

export function Label({ children, style, ...props }: ComponentProps<typeof Text>) {
  const p = usePalette();
  return (
    <Text {...props} style={[{ color: p.ink, fontSize: 15, lineHeight: 23 }, style]}>
      {children}
    </Text>
  );
}

/** Secondary text: metadata lines, hints and descriptions. */
export function Caption({ children, style, ...props }: ComponentProps<typeof Text>) {
  const p = usePalette();
  return (
    <Label {...props} style={[{ color: p.muted, fontSize: 13, lineHeight: 19 }, style]}>
      {children}
    </Label>
  );
}

export function Heading({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return (
    <Label
      accessibilityRole="header"
      style={{ fontSize: 26, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8, ...style }}
    >
      {children}
    </Label>
  );
}
