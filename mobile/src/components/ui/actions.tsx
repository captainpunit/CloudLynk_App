import { ActivityIndicator, Pressable } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Label } from './typography';
import { colors as c } from '@/theme/tokens';

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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: dark ? '#FFFFFF18' : c.surface,
        borderWidth: 1,
        borderColor: dark ? '#FFFFFF30' : c.line,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon size={20} color={dark ? c.white : c.ink} strokeWidth={1.7} />
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon: Icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'soft' | 'outline' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
}) {
  const filled = variant === 'primary' || variant === 'danger';
  const foreground = filled ? c.white : c.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        paddingHorizontal: 20,
        paddingVertical: 13,
        borderRadius: 15,
        borderWidth: variant === 'outline' ? 1 : 0,
        borderColor: c.line,
        backgroundColor:
          variant === 'primary'
            ? c.primary
            : variant === 'danger'
              ? c.danger
              : variant === 'soft'
                ? c.primarySoft
                : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {Icon && <Icon size={18} color={foreground} />}
          <Label style={{ fontWeight: '700', color: foreground }}>{title}</Label>
        </>
      )}
    </Pressable>
  );
}

export function Pill({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 42,
        paddingHorizontal: 18,
        justifyContent: 'center',
        backgroundColor: selected ? c.ink : c.surface,
        borderWidth: 1,
        borderColor: selected ? c.ink : c.line,
        borderRadius: 24,
      }}
    >
      <Label style={{ fontSize: 13, color: selected ? c.white : c.muted, fontWeight: '600' }}>
        {title}
      </Label>
    </Pressable>
  );
}
