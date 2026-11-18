import { View } from 'react-native';
import Animated, { FadeIn as FadeInEntering, FadeOut } from 'react-native-reanimated';
import { CircleAlert, Search, type LucideIcon } from 'lucide-react-native';
import { Caption, Label, Heading } from './typography';
import { Button } from './actions';
import { FadeIn } from './motion';
import { motion, plus, radius, space } from '@/theme/tokens';
import { usePalette, type Palette } from '@/theme/tone';

export function EmptyState({
  icon: Icon = Search,
  title,
  body,
  action,
  onPress,
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
  action?: string;
  onPress?: () => void;
}) {
  const p = usePalette();
  return (
    <FadeIn
      style={{
        paddingVertical: space.section,
        paddingHorizontal: space.lg,
        gap: space.md,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: p.line,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={26} color={p.muted} strokeWidth={1.6} />
      </View>
      <Heading level="headline" style={{ textAlign: 'center' }}>
        {title}
      </Heading>
      <Caption style={{ textAlign: 'center', maxWidth: 300, fontSize: 14, lineHeight: 21 }}>
        {body}
      </Caption>
      {action && onPress && (
        <View style={{ marginTop: 6 }}>
          <Button title={action} onPress={onPress} compact />
        </View>
      )}
    </FadeIn>
  );
}

/** Inline error banner. Announced to screen readers and faded in and out. */
export function ErrorNote({ message }: { message: string | null }) {
  const p = usePalette();
  if (!message) return null;
  return (
    <Animated.View
      entering={FadeInEntering.duration(motion.base)}
      exiting={FadeOut.duration(motion.fast)}
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.sm,
        padding: 15,
        borderRadius: radius.md,
        backgroundColor: p.dangerSoft,
      }}
    >
      <CircleAlert size={18} color={p.danger} style={{ marginTop: 1 }} />
      <Label variant="callout" tone="danger" style={{ flex: 1 }}>
        {message}
      </Label>
    </Animated.View>
  );
}

/** The one mark for Plus content, the same on every surface. */
export function PlusBadge() {
  return (
    <View
      accessibilityLabel="Plus"
      style={{
        backgroundColor: plus.fill,
        paddingHorizontal: 7,
        borderRadius: radius.xs,
      }}
    >
      <Label style={{ fontSize: 12, lineHeight: 18, fontWeight: '800', color: plus.onFill }}>
        Plus
      </Label>
    </View>
  );
}

const statusTones = {
  neutral: (p: Palette) => ({ background: p.raised, foreground: p.muted }),
  success: (p: Palette) => ({ background: p.successSoft, foreground: p.success }),
  warning: (p: Palette) => ({ background: p.warningSoft, foreground: p.warning }),
  danger: (p: Palette) => ({ background: p.dangerSoft, foreground: p.danger }),
};
export type StatusTone = keyof typeof statusTones;

/** Compact state label such as "Published", "Pending review" or "Processing". */
export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  const { background, foreground } = statusTones[tone](usePalette());
  return (
    <View
      accessibilityLabel={label}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: background,
        paddingHorizontal: space.sm,
        paddingVertical: 3,
        borderRadius: radius.xs,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: foreground }} />
      <Label variant="overline" style={{ color: foreground }}>
        {label}
      </Label>
    </View>
  );
}
