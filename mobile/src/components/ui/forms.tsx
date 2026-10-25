import type { ComponentProps } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Label } from './typography';
import { colors as c } from '@/theme/tokens';

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search videos, channels and more',
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View
      style={{
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 15,
        paddingHorizontal: 15,
        gap: 10,
      }}
    >
      <Search size={19} color={c.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        value={value}
        onChangeText={onChangeText}
        style={{ flex: 1, minHeight: 50, color: c.ink, fontSize: 14 }}
        returnKeyType="search"
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <Pressable
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          style={{ padding: 8 }}
        >
          <X size={16} color={c.muted} />
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
  return (
    <View style={{ gap: 7 }}>
      <Label style={{ fontSize: 13, fontWeight: '600' }}>{label}</Label>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        style={[
          {
            borderWidth: 1,
            borderColor: error ? c.danger : c.line,
            borderRadius: 14,
            minHeight: 52,
            paddingHorizontal: 16,
            paddingVertical: 13,
            color: c.ink,
            backgroundColor: c.surface,
            fontSize: 15,
            textAlignVertical: props.multiline ? 'top' : 'center',
          },
          props.style,
        ]}
      />
      {error && (
        <Label accessibilityRole="alert" style={{ color: c.danger, fontSize: 12 }}>
          {error}
        </Label>
      )}
    </View>
  );
}
