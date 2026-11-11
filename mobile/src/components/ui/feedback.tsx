import { View } from 'react-native';
import { Search, type LucideIcon } from 'lucide-react-native';
import { Caption, Label, Heading } from './typography';
import { Button } from './actions';
import { plus } from '@/theme/tokens';
import { usePalette } from '@/theme/tone';

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
    <View style={{ paddingVertical: 40, gap: 12, alignItems: 'center', paddingHorizontal: 16 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          borderWidth: 1,
          borderColor: p.line,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={26} color={p.muted} strokeWidth={1.6} />
      </View>
      <Heading style={{ fontSize: 20, lineHeight: 27, textAlign: 'center' }}>{title}</Heading>
      <Caption style={{ textAlign: 'center', maxWidth: 300, fontSize: 14, lineHeight: 21 }}>
        {body}
      </Caption>
      {action && onPress && (
        <View style={{ marginTop: 6 }}>
          <Button title={action} onPress={onPress} compact />
        </View>
      )}
    </View>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  const p = usePalette();
  return message ? (
    <View
      accessibilityRole="alert"
      style={{ padding: 15, borderRadius: 14, backgroundColor: p.dangerSoft }}
    >
      <Label style={{ color: p.danger, fontSize: 14, lineHeight: 20 }}>{message}</Label>
    </View>
  ) : null;
}

/** The one mark for Plus content, the same on every surface. */
export function PlusBadge() {
  return (
    <View
      accessibilityLabel="Plus"
      style={{
        backgroundColor: plus.fill,
        paddingHorizontal: 7,
        borderRadius: 5,
      }}
    >
      <Label style={{ fontSize: 12, lineHeight: 18, fontWeight: '800', color: plus.onFill }}>
        Plus
      </Label>
    </View>
  );
}
