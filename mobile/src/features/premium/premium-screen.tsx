import { useEffect } from 'react';
import { Heading, Screen } from '@/components/ui';
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
  // What Plus gives sits under the title, so the plans and the pay button fit on one
  // screen of a normal phone.
  return (
    <Screen
      title={`${env.appName} Plus`}
      subtitle={
        state.subscribedUntil
          ? `You have Plus until ${shortDate(state.subscribedUntil)}.`
          : (summary ?? 'No plans are available right now.')
      }
      back
    >
      <Heading level="headline">{state.subscribed ? 'Add more time' : 'Choose a plan'}</Heading>
      <UpiCheckout />
    </Screen>
  );
}
