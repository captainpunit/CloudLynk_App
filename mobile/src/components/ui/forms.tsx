import { useState, type ComponentProps } from 'react';
import { Pressable, TextInput, View, type ViewStyle } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Label } from './typography';
import { radius, text } from '@/theme/tokens';
import { usePalette, type Palette } from '@/theme/tone';

/**
 * Our focus ring replaces the browser's focus outline on web. `outline-style: auto`
 * ignores its width, so the style is set to solid with zero width. No effect on native.
 */
const noBrowserOutline = { outlineStyle: 'solid', outlineWidth: 0 } as const;

/** Border and focus ring shared by every input. */
function inputFrame(p: Palette, focused: boolean, invalid = false): ViewStyle {
  let borderColor = p.line;
  if (focused) borderColor = p.action;
  if (invalid) borderColor = p.danger;
  const ring = invalid ? p.dangerSoft : p.focusRing;
  return {
    borderWidth: 1,
    borderColor,
    backgroundColor: p.surface,
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
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        inputFrame(p, focused),
        {
          minHeight: 50,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radius.pill,
          paddingLeft: 16,
          gap: 10,
        },
      ]}
    >
      <Search size={19} color={focused ? p.ink : p.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={p.muted}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          text.body,
          { flex: 1, minHeight: 48, color: p.ink, lineHeight: undefined, ...noBrowserOutline },
        ]}
        returnKeyType="search"
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={17} color={p.muted} />
        </Pressable>
      )}
    </View>
  );
}

/** Labelled text input with a focus ring, optional helper text and an error message. */
export function Field({
  label,
  error,
  helper,
  onFocus,
  onBlur,
  ...props
}: ComponentProps<typeof TextInput> & { label: string; error?: string; helper?: string }) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Label style={{ fontSize: 13, fontWeight: '600' }}>{label}</Label>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={p.muted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          inputFrame(p, focused, Boolean(error)),
          text.body,
          {
            lineHeight: undefined,
            ...noBrowserOutline,
            borderRadius: radius.md,
            minHeight: 52,
            paddingHorizontal: 16,
            paddingVertical: 13,
            color: p.ink,
            textAlignVertical: props.multiline ? 'top' : 'center',
          },
          props.style,
        ]}
      />
      {error && (
        <Label accessibilityRole="alert" variant="caption" tone="danger" style={{ fontSize: 12 }}>
          {error}
        </Label>
      )}
      {!error && helper && (
        <Label variant="caption" tone="muted" style={{ fontSize: 12 }}>
          {helper}
        </Label>
      )}
    </View>
  );
}
