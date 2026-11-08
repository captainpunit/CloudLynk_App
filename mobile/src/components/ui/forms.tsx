import { useState, type ComponentProps } from 'react';
import { Pressable, TextInput, View, type ViewStyle } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Label } from './typography';
import { colors as c, radius, space, text } from '@/theme/tokens';

/**
 * Our focus ring replaces the browser's focus outline on web. `outline-style: auto`
 * ignores its width, so the style is set to solid with zero width. No effect on native.
 */
const noBrowserOutline = { outlineStyle: 'solid', outlineWidth: 0 } as const;

/** Border and focus ring shared by every input. */
function inputFrame(focused: boolean, invalid = false): ViewStyle {
  let borderColor = c.line;
  if (focused) borderColor = c.primary;
  if (invalid) borderColor = c.danger;
  const ring = invalid ? c.dangerSoft : c.focusRing;
  return {
    borderWidth: 1,
    borderColor,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    boxShadow: focused ? `0px 0px 0px 3px ${ring}` : undefined,
  };
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search videos, channels and more',
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        inputFrame(focused),
        {
          minHeight: 50,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          gap: space.sm,
        },
      ]}
    >
      <Search size={18} color={focused ? c.primary : c.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          text.body,
          { flex: 1, minHeight: 48, color: c.ink, lineHeight: undefined, ...noBrowserOutline },
        ]}
        returnKeyType="search"
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={8}
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.pill,
            backgroundColor: c.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={14} color={c.muted} />
        </Pressable>
      )}
    </View>
  );
}

/** Labelled text input with focus ring, optional helper text and error message. */
export function Field({
  label,
  error,
  helper,
  onFocus,
  onBlur,
  ...props
}: ComponentProps<typeof TextInput> & { label: string; error?: string; helper?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs + 2 }}>
      <Label variant="callout" style={{ fontWeight: '600' }}>
        {label}
      </Label>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          inputFrame(focused, Boolean(error)),
          text.body,
          {
            lineHeight: undefined,
            ...noBrowserOutline,
            minHeight: props.multiline ? 104 : 52,
            paddingHorizontal: 16,
            paddingVertical: 14,
            color: c.ink,
            textAlignVertical: props.multiline ? 'top' : 'center',
          },
          props.style,
        ]}
      />
      {error && (
        <Label accessibilityRole="alert" variant="caption" tone="danger">
          {error}
        </Label>
      )}
      {!error && helper && (
        <Label variant="caption" tone="muted">
          {helper}
        </Label>
      )}
    </View>
  );
}
