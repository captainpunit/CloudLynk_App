import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { router, useIsFocused } from 'expo-router';
import { Caption, Label, Heading } from './typography';
import { IconButton } from './actions';
import { gutter } from '@/theme/tokens';
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
        gap: 8,
      }}
    >
      <Heading style={{ fontSize: 20, lineHeight: 27, letterSpacing: -0.4 }}>{title}</Heading>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          onPress={onPress}
          style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 }}
        >
          <Label style={{ fontSize: 14, fontWeight: '600', color: p.muted }}>{action}</Label>
          <ChevronRight size={16} color={p.muted} />
        </Pressable>
      )}
    </View>
  );
}

export function Surface({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const p = usePalette();
  return (
    <View
      style={{
        borderRadius: 20,
        padding: 18,
        backgroundColor: p.surface,
        borderWidth: 1,
        borderColor: p.line,
        gap: 12,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

/** A horizontal row that runs to the screen edges, for posters and channels. */
export function Rail({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -gutter }}
      contentContainerStyle={{ paddingHorizontal: gutter, gap }}
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, marker ? 'new' : '', detail].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: p.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon size={22} color={p.ink} strokeWidth={1.7} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Label style={{ fontWeight: '600' }}>{title}</Label>
          {marker && (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.ink }} />
          )}
        </View>
        {detail && <Caption numberOfLines={1}>{detail}</Caption>}
      </View>
      <ChevronRight size={18} color={p.muted} />
    </Pressable>
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
  const content = (
    <View
      style={{
        gap: 24,
        paddingHorizontal: gutter,
        paddingTop: 12,
        paddingBottom: 32,
        width: '100%',
        maxWidth: 720,
        alignSelf: 'center',
      }}
    >
      {(back || title || action) && (
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
