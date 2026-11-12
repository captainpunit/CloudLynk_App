import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { WorkspaceProvider, useWorkspace } from '@/state/workspace-provider';
import { Button, Label, Screen } from '@/components/ui';
import { colors as c, night } from '@/theme/tokens';
import { PushLifecycle } from '@/services/notifications/push-lifecycle';
import { AdConsentPrompt } from '@/features/privacy/ad-consent-prompt';

export default function RootLayout() {
  // Native advertising modules are not imported at startup: AdConsentPrompt loads them
  // only after the member agrees (see services/meta/measurement.ts).
  return (
    <SafeAreaProvider>
      <WorkspaceProvider>
        <PushLifecycle />
        <StatusBar style="dark" />
        <AppNavigation />
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

function AppNavigation() {
  const { ready, toast, error, state, refresh, refreshing } = useWorkspace();
  // Same colour as the splash screen, so opening the app never flashes white.
  const launch = {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    padding: 28,
    backgroundColor: night.canvas,
  } as const;
  if (!ready)
    return (
      <View style={launch}>
        <StatusBar style="light" />
        <ActivityIndicator color={night.ink} />
        <Label style={{ color: night.ink }}>Opening CloudLynk…</Label>
      </View>
    );
  // Nothing loaded at all (usually no connection): say so and offer to try again,
  // rather than showing empty screens that look as if there were no videos.
  if (error && !state.profile && !state.channels.length)
    return (
      <View style={launch}>
        <StatusBar style="light" />
        <Label style={{ color: night.ink, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
          We could not connect.
        </Label>
        <Label style={{ color: night.ink, textAlign: 'center' }}>{error}</Label>
        <Button title="Try again" loading={refreshing} onPress={() => void refresh()} />
      </View>
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
      <View
        pointerEvents="none"
        accessibilityLiveRegion="polite"
        style={{ position: 'absolute', bottom: 110, left: 22, right: 22, alignItems: 'center' }}
      >
        {toast && (
          // Raised and outlined so it stands out on both the dark and the light screens.
          <View
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: night.line,
              backgroundColor: night.raised,
              padding: 15,
              maxWidth: 460,
            }}
          >
            <Label style={{ color: night.ink, fontSize: 13 }}>{toast}</Label>
          </View>
        )}
      </View>
      <AdConsentPrompt />
    </View>
  );
}
