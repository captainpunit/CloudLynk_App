import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Heading, Label } from '@/components/ui';
import { colors as c } from '@/theme/tokens';
import { useWorkspace } from '@/state/workspace-provider';
import { captureInstallAttribution } from '@/services/attribution/installReferrer';
import {
  measurementAvailable,
  measurementChoice,
  saveMeasurementChoice,
  startMeasurement,
} from '@/services/meta/measurement';

/**
 * Asks a signed-in member once whether CloudLynk may measure its adverts, and restarts
 * measurement on later launches for members who agreed. The choice can be changed in
 * Settings. Renders nothing on builds without the advertising SDK.
 */
export function AdConsentPrompt() {
  const { state } = useWorkspace();
  const insets = useSafeAreaInsets();
  const userId = state.profile?.id;
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setAsking(false);
    if (!userId || !measurementAvailable) return;
    void measurementChoice(userId)
      .then((choice) => {
        if (!active) return;
        if (choice === 'allowed') void startMeasurement(userId).catch(() => undefined);
        setAsking(choice === 'unanswered');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId]);

  if (!asking || !userId) return null;

  async function answer(allowed: boolean) {
    setBusy(true);
    try {
      await captureInstallAttribution(allowed);
    } catch {
      // The choice is still remembered on this device; Settings can send it again.
      await saveMeasurementChoice(userId!, allowed).catch(() => undefined);
    }
    setBusy(false);
    setAsking(false);
  }

  return (
    <View
      accessibilityViewIsModal
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        gap: 12,
        padding: 20,
        paddingBottom: insets.bottom + 20,
        backgroundColor: c.white,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderTopWidth: 1,
        borderColor: c.line,
      }}
    >
      <Heading>Can we measure our adverts?</Heading>
      <Label>
        If you allow it, CloudLynk shares with Meta that this app was installed and when a
        subscription is paid, so we can tell which adverts work. We never share what you watch. You
        can change this in Settings at any time.
      </Label>
      <Button title="Allow" loading={busy} onPress={() => void answer(true)} />
      <Button
        title="No thanks"
        variant="outline"
        disabled={busy}
        onPress={() => void answer(false)}
      />
    </View>
  );
}
