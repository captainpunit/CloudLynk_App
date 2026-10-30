import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { WorkspaceProvider, useWorkspace } from '@/state/workspace-provider';
import { Button, Label, Screen } from '@/components/ui';
import { colors as c } from '@/theme/tokens';
import { PushLifecycle } from '@/services/notifications/push-lifecycle';

export default function RootLayout() {
  // Native advertising modules are deliberately not imported at startup.
  // Consent-gated production attribution belongs behind a separate adapter.
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
        <Label>We couldn’t open this screen. Your saved workspace is still on this device.</Label>
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
  const { ready, toast } = useWorkspace();
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 18,
          backgroundColor: c.canvas,
        }}
      >
        <ActivityIndicator color={c.primary} />
        <Label>Opening your workspace…</Label>
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
          <View style={{ borderRadius: 14, backgroundColor: c.ink, padding: 15, maxWidth: 460 }}>
            <Label style={{ color: c.white, fontSize: 13 }}>{toast}</Label>
          </View>
        )}
      </View>
    </View>
  );
}
