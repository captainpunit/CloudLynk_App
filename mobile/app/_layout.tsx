import type { ReactNode } from 'react';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useFonts } from 'expo-font';
// Per-weight imports: the package root would bundle all 16 font files.
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { WorkspaceProvider, useWorkspace } from '@/state/workspace-provider';
import { Button, Heading, Label, Screen, easeOut } from '@/components/ui';
import { colors as c, layout, motion, night, radius, space } from '@/theme/tokens';
import { ToneProvider } from '@/theme/tone';
import { PushLifecycle } from '@/services/notifications/push-lifecycle';
import { AdConsentPrompt } from '@/features/privacy/ad-consent-prompt';
import { AdAudienceSync } from '@/services/attribution/ad-audience-sync';

export default function RootLayout() {
  // Headings and buttons use Plus Jakarta Sans. If it fails to load, the system font renders.
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // Native advertising modules are not imported at startup: AdConsentPrompt loads them
  // only after the member agrees (see services/meta/measurement.ts).
  return (
    <SafeAreaProvider>
      <WorkspaceProvider>
        <PushLifecycle />
        <AdAudienceSync />
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

/** Dark launch surface, the same colour as the splash screen, so opening never flashes white. */
function Launch({ children }: { children: ReactNode }) {
  return (
    <ToneProvider tone="dark">
      <StatusBar style="light" />
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 18,
          padding: 28,
          backgroundColor: night.canvas,
        }}
      >
        {children}
      </View>
    </ToneProvider>
  );
}

function AppNavigation({ fontsReady }: { fontsReady: boolean }) {
  const { ready, toast, error, state, refresh, refreshing } = useWorkspace();
  if (!ready || !fontsReady)
    return (
      <Launch>
        <ActivityIndicator color={night.ink} />
        <Label>Opening CloudLynk…</Label>
      </Launch>
    );
  // Nothing loaded at all (usually no connection): say so and offer to try again,
  // rather than showing empty screens that look as if there were no videos.
  if (error && !state.profile && !state.channels.length)
    return (
      <Launch>
        <Heading level="headline" style={{ textAlign: 'center' }}>
          We could not connect.
        </Heading>
        <Label style={{ textAlign: 'center' }}>{error}</Label>
        {/* The dark tone gives the button its light fill, so it stands out here. */}
        <Button title="Try again" loading={refreshing} onPress={() => void refresh()} />
      </Launch>
    );
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
      <AdConsentPrompt />
    </View>
  );
}

/** Short confirmation that rises above the tab bar and fades away. */
function Toast({ message }: { message: string | null }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        bottom: bottom + 88,
        left: layout.gutter,
        right: layout.gutter,
        alignItems: 'center',
      }}
    >
      {message && (
        // Raised and outlined so it stands out on both the dark and the light screens.
        <Animated.View
          key={message}
          entering={FadeInDown.duration(motion.base).easing(easeOut)}
          exiting={FadeOutDown.duration(motion.fast)}
          style={{
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: night.line,
            backgroundColor: night.raised,
            paddingVertical: space.md,
            paddingHorizontal: 15,
            maxWidth: 460,
          }}
        >
          <Label style={{ color: night.ink, fontSize: 13 }}>{message}</Label>
        </Animated.View>
      )}
    </View>
  );
}
