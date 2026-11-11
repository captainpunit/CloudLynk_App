import type { ComponentProps } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Label } from './typography';
import { usePalette } from '@/theme/tone';

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
  return (
    <View
      style={{
        minHeight: 50,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: p.surface,
        borderWidth: 1,
        borderColor: p.line,
        borderRadius: 25,
        paddingLeft: 16,
        gap: 10,
      }}
    >
      <Search size={19} color={p.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={p.muted}
        value={value}
        onChangeText={onChangeText}
        style={{ flex: 1, minHeight: 48, color: p.ink, fontSize: 15 }}
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

export function Field({
  label,
  error,
  ...props
}: ComponentProps<typeof TextInput> & { label: string; error?: string }) {
  const p = usePalette();
  return (
    <View style={{ gap: 7 }}>
      <Label style={{ fontSize: 13, fontWeight: '600' }}>{label}</Label>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={p.muted}
        style={[
          {
            borderWidth: 1,
            borderColor: error ? p.danger : p.line,
            borderRadius: 14,
            minHeight: 52,
            paddingHorizontal: 16,
            paddingVertical: 13,
            color: p.ink,
            backgroundColor: p.surface,
            fontSize: 15,
            textAlignVertical: props.multiline ? 'top' : 'center',
          },
          props.style,
        ]}
      />
      {error && (
        <Label accessibilityRole="alert" style={{ color: p.danger, fontSize: 12 }}>
          {error}
        </Label>
      )}
    </View>
  );
}
