import { useEffect } from 'react';
import { View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { Heading, Label, Screen } from '@/components/ui';
import { colors as c } from '@/theme/tokens';
import { env } from '@/lib/env';
import { plusSummary, shortDate } from '@/domain/format';
import { useWorkspace } from '@/state/workspace-provider';
import { logPlansViewed } from '@/services/meta/measurement';
import UpiCheckout from './upi-checkout';

/** Plans, prices and storage come from the backend `plans` table. */
export default function PremiumScreen() {
  const { state } = useWorkspace();
  const summary = plusSummary(state);
  useEffect(logPlansViewed, []);
  return (
    <Screen title={`${env.appName} Plus`} back>
      <View
        style={{
          backgroundColor: c.dark,
          borderRadius: 27,
          padding: 28,
          gap: 16,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            alignSelf: 'flex-start',
            borderRadius: 16,
            padding: 12,
            backgroundColor: c.glassFaint,
          }}
        >
          <Sparkles size={29} color={c.accent} />
        </View>
        <Heading style={{ color: c.white, fontSize: 35, lineHeight: 41 }}>
          {state.subscribed ? 'You have Plus' : 'Get Plus'}
        </Heading>
        <Label style={{ color: c.onDarkMuted, fontSize: 13 }}>
          {state.subscribedUntil
            ? `Active until ${shortDate(state.subscribedUntil)}.`
            : (summary ?? 'No plans are available right now.')}
        </Label>
      </View>
      <Heading style={{ fontSize: 22 }}>{state.subscribed ? 'Add more time' : 'Subscribe'}</Heading>
      <UpiCheckout />
    </Screen>
  );
}
