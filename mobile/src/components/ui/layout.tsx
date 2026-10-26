import type { ReactNode } from 'react';
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { Label, Heading } from './typography';
import { IconButton } from './actions';
import { colors as c } from '@/theme/tokens';

export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Heading style={{ fontSize: 21, lineHeight: 28 }}>{title}</Heading>
      {action && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Label style={{ fontSize: 12, fontWeight: '700', color: c.primary }}>{action}</Label>
          <ArrowRight size={14} color={c.primary} />
        </Pressable>
      )}
    </View>
  );
}

export function Surface({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={{
        borderRadius: 20,
        padding: 18,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        gap: 12,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

export function Screen({
  children,
  title,
  subtitle,
  back = false,
  action,
  scroll = true,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
  scroll?: boolean;
}) {
  const content = (
    <View
      style={{
        gap: 24,
        paddingHorizontal: 22,
        paddingTop: 12,
        paddingBottom: 28,
        width: '100%',
        maxWidth: 720,
        alignSelf: 'center',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        {back && (
          <IconButton
            icon={ArrowLeft}
            label="Go back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        )}
        <View style={{ flex: 1 }}>
          <Heading>{title}</Heading>
          {subtitle && (
            <Label style={{ fontSize: 13, color: c.muted, marginTop: 3 }}>{subtitle}</Label>
          )}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.canvas }}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
