import { View } from 'react-native';
import Animated, { FadeIn as FadeInEntering, FadeOut } from 'react-native-reanimated';
import { CircleAlert, Search, Sparkles, type LucideIcon } from 'lucide-react-native';
import { Label, Heading } from './typography';
import { Button } from './actions';
import { FadeIn } from './motion';
import { colors as c, motion, radius, space } from '@/theme/tokens';

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
          borderRadius: radius.lg,
          backgroundColor: c.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: space.xs,
        }}
      >
        <Icon size={28} color={c.primary} strokeWidth={1.8} />
      </View>
      <Heading level="headline" style={{ textAlign: 'center' }}>
        {title}
      </Heading>
      <Label tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>
        {body}
      </Label>
      {action && onPress && (
        <View style={{ marginTop: space.sm, alignSelf: 'stretch' }}>
          <Button title={action} onPress={onPress} />
        </View>
      )}
    </FadeIn>
  );
}

/** Inline error banner. Announced to screen readers and faded in and out. */
export function ErrorNote({ message }: { message: string | null }) {
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
        padding: 14,
        borderRadius: radius.md,
        backgroundColor: c.dangerSoft,
      }}
    >
      <CircleAlert size={18} color={c.danger} style={{ marginTop: 1 }} />
      <Label variant="callout" tone="danger" style={{ flex: 1 }}>
        {message}
      </Label>
    </Animated.View>
  );
}

export function PlusBadge() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        backgroundColor: c.goldSoft,
        paddingHorizontal: space.sm,
        paddingVertical: 3,
        borderRadius: radius.xs,
      }}
    >
      <Sparkles size={11} color={c.goldInk} />
      <Label variant="overline" style={{ color: c.goldInk }}>
        Plus
      </Label>
    </View>
  );
}

const statusTones = {
  neutral: { background: c.surfaceSunken, foreground: c.muted },
  primary: { background: c.primarySoft, foreground: c.primary },
  success: { background: c.successSoft, foreground: c.success },
  warning: { background: c.warningSoft, foreground: c.warning },
  danger: { background: c.dangerSoft, foreground: c.danger },
};
export type StatusTone = keyof typeof statusTones;

/** Compact state label such as "Published", "Pending review" or "Processing". */
export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  const { background, foreground } = statusTones[tone];
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
