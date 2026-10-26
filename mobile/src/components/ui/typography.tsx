import type { ComponentProps, ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';
import { colors as c } from '@/theme/tokens';

export function Label({ children, style, ...props }: ComponentProps<typeof Text>) {
  return (
    <Text {...props} style={[{ color: c.ink, fontSize: 15, lineHeight: 23 }, style]}>
      {children}
    </Text>
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
