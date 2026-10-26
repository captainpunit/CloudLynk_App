import { View } from 'react-native';
import { Search, Sparkles, type LucideIcon } from 'lucide-react-native';
import { Label, Heading } from './typography';
import { Button } from './actions';
import { colors as c } from '@/theme/tokens';

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
    <View style={{ paddingVertical: 44, gap: 14, alignItems: 'center', paddingHorizontal: 16 }}>
      <View
        style={{
          width: 70,
          height: 70,
          borderRadius: 24,
          backgroundColor: c.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={28} color={c.primary} />
      </View>
      <Heading style={{ fontSize: 21, textAlign: 'center' }}>{title}</Heading>
      <Label style={{ color: c.muted, textAlign: 'center', maxWidth: 300 }}>{body}</Label>
      {action && onPress && <Button title={action} onPress={onPress} />}
    </View>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  return message ? (
    <View
      accessibilityRole="alert"
      style={{ padding: 15, borderRadius: 14, backgroundColor: c.dangerSoft }}
    >
      <Label style={{ color: c.danger, fontSize: 13 }}>{message}</Label>
    </View>
  ) : null;
}

export function PlusBadge() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: c.goldSoft,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
      }}
    >
      <Sparkles size={10} color="#8A6221" />
      <Label
        style={{
          fontSize: 9,
          fontWeight: '800',
          color: '#8A6221',
          lineHeight: 14,
          letterSpacing: 1,
        }}
      >
        PLUS
      </Label>
    </View>
  );
}
