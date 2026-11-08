import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { Label, Heading } from './typography';
import { IconButton } from './actions';
import { PressableScale } from './motion';
import { colors as c, elevation, layout, radius, space } from '@/theme/tokens';

/** Section header with an optional "see all" style link. */
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
        gap: space.sm,
      }}
    >
      <Heading level="headline" style={{ flexShrink: 1 }}>
        {title}
      </Heading>
      {action && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={action}
          onPress={onPress}
          hitSlop={8}
          style={{ minHeight: layout.touchTarget, flexDirection: 'row', alignItems: 'center' }}
        >
          <Label variant="callout" tone="primary" style={{ fontWeight: '600' }}>
            {action}
          </Label>
          <ChevronRight size={16} color={c.primary} />
        </PressableScale>
      )}
    </View>
  );
}

/** Card container. `card` floats on the canvas, `flat` sits in it, `cinema` is dark. */
export function Surface({
  children,
  variant = 'card',
  style,
}: {
  children: ReactNode;
  variant?: 'card' | 'flat' | 'cinema';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          borderRadius: radius.lg,
          padding: layout.cardPadding,
          gap: space.md,
          borderWidth: 1,
          backgroundColor: variant === 'cinema' ? c.cinemaSurface : c.surface,
          borderColor: variant === 'cinema' ? c.cinemaLine : c.line,
        },
        variant === 'card' && elevation.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Standard page: safe area, scroll, title row with optional back button and action. */
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
        gap: layout.blockGap,
        paddingHorizontal: layout.gutter,
        paddingTop: space.sm,
        paddingBottom: space.xxxl,
        width: '100%',
        maxWidth: layout.maxWidth,
        alignSelf: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        {back && (
          <IconButton
            icon={ArrowLeft}
            label="Go back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        )}
        <View style={{ flex: 1, gap: space.xxs }}>
          <Heading>{title}</Heading>
          {subtitle && (
            <Label variant="callout" tone="muted">
              {subtitle}
            </Label>
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
