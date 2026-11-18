import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { router, useIsFocused } from 'expo-router';
import { Caption, Label, Heading } from './typography';
import { IconButton } from './actions';
import { PressableScale } from './motion';
import { layout, radius, space } from '@/theme/tokens';
import { ToneProvider, usePalette, type Tone } from '@/theme/tone';

export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const p = usePalette();
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
          style={{
            minHeight: layout.touchTarget,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.xxs,
          }}
        >
          <Label style={{ fontSize: 14, fontWeight: '600', color: p.muted }}>{action}</Label>
          <ChevronRight size={16} color={p.muted} />
        </PressableScale>
      )}
    </View>
  );
}

export function Surface({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const p = usePalette();
  return (
    <View
      style={{
        borderRadius: radius.lg,
        padding: layout.cardPadding,
        backgroundColor: p.surface,
        borderWidth: 1,
        borderColor: p.line,
        gap: space.md,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

/** A horizontal row that runs to the screen edges, for posters and channels. */
export function Rail({ children, gap = space.md }: { children: ReactNode; gap?: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -layout.gutter }}
      contentContainerStyle={{ paddingHorizontal: layout.gutter, gap }}
    >
      {children}
    </ScrollView>
  );
}

/** A plain navigation row: icon, title, one line of detail and a chevron. */
export function ListRow({
  icon: Icon,
  title,
  detail,
  onPress,
  marker,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
  onPress: () => void;
  /** A small dot after the title, such as unread notices. */
  marker?: boolean;
}) {
  const p = usePalette();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[title, marker ? 'new' : '', detail].filter(Boolean).join(', ')}
      onPress={onPress}
      // Rows span the screen, so they shrink less than cards do.
      scaleTo={0.98}
      style={{
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: p.line,
      }}
    >
      <Icon size={22} color={p.ink} strokeWidth={1.7} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Label style={{ fontWeight: '600' }}>{title}</Label>
          {marker && (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.ink }} />
          )}
        </View>
        {detail && <Caption numberOfLines={1}>{detail}</Caption>}
      </View>
      <ChevronRight size={18} color={p.muted} />
    </PressableScale>
  );
}

/** Light status bar icons while a dark screen is in front. */
function LightStatusBar() {
  return useIsFocused() ? <StatusBar style="light" /> : null;
}

export function Screen({
  children,
  title,
  subtitle,
  back = false,
  action,
  scroll = true,
  tone = 'light',
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  /** Omit on screens whose content carries its own title, such as the player. */
  title?: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
  scroll?: boolean;
  tone?: Tone;
  /** Pull to refresh, for screens that show the catalogue. */
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <ToneProvider tone={tone}>
      {tone === 'dark' && <LightStatusBar />}
      <ScreenBody
        title={title}
        subtitle={subtitle}
        back={back}
        action={action}
        scroll={scroll}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        {children}
      </ScreenBody>
    </ToneProvider>
  );
}

function ScreenBody({
  children,
  title,
  subtitle,
  back,
  action,
  scroll,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  back: boolean;
  action?: ReactNode;
  scroll: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const p = usePalette();
  // Tab screens sit above the tab bar, which already clears the navigation bar.
  const bottomInset = useSafeAreaInsets().bottom * (back ? 1 : 0);
  const content = (
    <View
      style={{
        gap: layout.blockGap,
        paddingHorizontal: layout.gutter,
        paddingTop: space.md,
        // The system navigation bar draws over the app (edge to edge).
        paddingBottom: space.xxxl + bottomInset,
        width: '100%',
        maxWidth: layout.maxWidth,
        alignSelf: 'center',
      }}
    >
      {(back || title || action) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space.md,
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
            {title && <Heading>{title}</Heading>}
            {subtitle && <Caption style={{ marginTop: 3 }}>{subtitle}</Caption>}
          </View>
          {action}
        </View>
      )}
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: p.canvas }}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={p.ink}
                colors={[p.onAction]}
                progressBackgroundColor={p.action}
              />
            ) : undefined
          }
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
