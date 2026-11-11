import { ActivityIndicator, Pressable } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Label } from './typography';
import { colors as c, plus } from '@/theme/tokens';
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: dark ? c.scrim : p.surface,
        borderWidth: 1,
        borderColor: dark ? c.glassLine : p.line,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon size={20} color={dark ? c.white : p.ink} strokeWidth={1.8} />
    </Pressable>
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
  const { background, foreground, border } = buttonColors(variant, p);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: compact ? 44 : 52,
        paddingHorizontal: compact ? 16 : 20,
        paddingVertical: compact ? 8 : 13,
        borderRadius: compact ? 22 : 26,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {Icon && <Icon size={compact ? 16 : 18} color={foreground} strokeWidth={2} />}
          <Label
            style={{ fontWeight: '700', color: foreground, fontSize: compact ? 14 : 15 }}
            numberOfLines={1}
          >
            {title}
          </Label>
        </>
      )}
    </Pressable>
  );
}

export function Pill({
  title,
  selected,
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 18,
        justifyContent: 'center',
        backgroundColor: selected ? p.ink : 'transparent',
        borderWidth: 1,
        borderColor: selected ? p.ink : p.line,
        borderRadius: 22,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Label style={{ fontSize: 14, color: selected ? p.canvas : p.ink, fontWeight: '600' }}>
        {title}
      </Label>
    </Pressable>
  );
}
