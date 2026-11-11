import { useState } from 'react';
import { View } from 'react-native';
import { Field, Label, Pill } from '@/components/ui';
import { colors as c } from '@/theme/tokens';
import { matchingStates, type IndianState } from '@/domain/payments';

/** Type-to-find picker for the member's state; the list is too long to show at once. */
export function StatePicker({
  value,
  onChange,
}: {
  value: IndianState | null;
  onChange: (state: IndianState | null) => void;
}) {
  const [query, setQuery] = useState(value ?? '');
  const matches = value ? [] : matchingStates(query).slice(0, 6);
  return (
    <View style={{ gap: 10 }}>
      <Field
        label="Your state or union territory"
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          onChange(null);
        }}
        placeholder="Start typing, for example Guj"
        autoCapitalize="words"
      />
      {matches.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {matches.map((state) => (
            <Pill
              key={state}
              title={state}
              onPress={() => {
                setQuery(state);
                onChange(state);
              }}
            />
          ))}
        </View>
      )}
      {!value && query.trim().length > 1 && matches.length === 0 && (
        <Label style={{ color: c.muted, fontSize: 13 }}>No state matches that spelling.</Label>
      )}
    </View>
  );
}
