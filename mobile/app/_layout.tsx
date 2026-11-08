import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useFonts } from 'expo-font';
// Per-weight imports: the package root would bundle all 16 font files.
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { Cloud } from 'lucide-react-native';
import { WorkspaceProvider, useWorkspace } from '@/state/workspace-provider';
import { Button, Label, Screen, easeOut } from '@/components/ui';
import { colors as c, elevation, layout, motion, radius, space } from '@/theme/tokens';
import { PushLifecycle } from '@/services/notifications/push-lifecycle';

export default function RootLayout() {
  // Headings use Plus Jakarta Sans. If it fails to load, the system font renders instead.
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // Native advertising modules are deliberately not imported at startup.
  // Consent-gated production attribution belongs behind a separate adapter.
  return (
    <SafeAreaProvider>
      <WorkspaceProvider>
        <PushLifecycle />
        <StatusBar style="dark" />
        <AppNavigation fontsReady={fontsLoaded || Boolean(fontError)} />
      </WorkspaceProvider>
    </SafeAreaProvider>
  );
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <Screen title="Let’s try that again.">
        <Label>We couldn’t open this screen. Your account data is safe on the server.</Label>
        <Button
          title="Try again"
          onPress={() => {
            void retry();
          }}
        />
      </Screen>
    </SafeAreaProvider>
  );
}

function AppNavigation({ fontsReady }: { fontsReady: boolean }) {
  const { ready, toast } = useWorkspace();
  if (!ready || !fontsReady) return <Opening />;
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.canvas },
          animation: 'slide_from_right',
        }}
      />
      <Toast message={toast} />
    </View>
  );
}

/** Brand mark that breathes while the workspace and fonts load. */
function Opening() {
  const pulse = useSharedValue(0.65);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);
  const breathe = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.96 + pulse.value * 0.04 }],
  }));
  return (
    <View
      accessibilityLabel="Opening your workspace"
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: space.lg,
        backgroundColor: c.canvas,
      }}
    >
      <Animated.View
        style={[
          {
            width: 64,
            height: 64,
            borderRadius: radius.lg,
            backgroundColor: c.primary,
            alignItems: 'center',
            justifyContent: 'center',
          },
          breathe,
        ]}
      >
        <Cloud size={30} color={c.white} strokeWidth={2} />
      </Animated.View>
      <Label variant="callout" tone="muted">
        Opening your workspace…
      </Label>
    </View>
  );
}

/** Short confirmation that rises above the tab bar and fades away. */
function Toast({ message }: { message: string | null }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: layout.gutter,
        right: layout.gutter,
        bottom: insets.bottom + 84,
        alignItems: 'center',
      }}
    >
      {message && (
        <Animated.View
          key={message}
          entering={FadeInDown.duration(motion.base).easing(easeOut)}
          exiting={FadeOutDown.duration(motion.fast)}
          style={[
            {
              borderRadius: radius.md,
              backgroundColor: c.ink,
              paddingVertical: space.md,
              paddingHorizontal: space.lg,
              maxWidth: 460,
            },
            elevation.floating,
          ]}
        >
          <Label variant="callout" tone="inverse">
            {message}
          </Label>
        </Animated.View>
      )}
    </View>
  );
}
