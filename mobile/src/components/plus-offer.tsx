import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Caption, Heading, Label, PlusBadge } from './ui';
import { usePalette } from '@/theme/tone';
import { plusSummary } from '@/domain/format';
import { periodLength, rupees } from '@/domain/payments';
import type { Plan } from '@/domain/models';
import { useWorkspace } from '@/state/workspace-provider';

/** "₹149 for 1 month", or "From ₹49 for 7 days" when there are several plans. */
export function plusPrice(plans: Plan[] = []): string | null {
  if (!plans.length) return null;
  const cheapest = plans.reduce((low, plan) => (plan.pricePaise < low.pricePaise ? plan : low));
  const price = `${rupees(cheapest.pricePaise)} for ${periodLength(cheapest.billingPeriod)}`;
  return plans.length > 1 ? `From ${price}` : price;
}

/**
 * What one subscription gets, with its real price, and the way to buy it. Shown wherever
 * Plus content is locked.
 */
export function PlusOffer({
  title = 'One subscription, every Plus channel',
  action = 'See plans',
}: {
  title?: string;
  action?: string;
}) {
  const { state } = useWorkspace();
  const p = usePalette();
  const price = plusPrice(state.plans);
  return (
    <View style={{ backgroundColor: p.plusSoft, borderRadius: 16, padding: 18, gap: 10 }}>
      <View style={{ flexDirection: 'row' }}>
        <PlusBadge />
      </View>
      <Heading style={{ fontSize: 20, lineHeight: 27, letterSpacing: -0.4 }}>{title}</Heading>
      <Caption style={{ color: p.ink, fontSize: 14, lineHeight: 21 }}>
        {plusSummary(state) ?? 'Plans are not on sale right now. Check back soon.'}
      </Caption>
      {price && (
        <Label style={{ color: p.plusInk, fontWeight: '700' }}>
          {`${price}. Pay by UPI. No automatic renewal.`}
        </Label>
      )}
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        <Button title={action} variant="plus" compact onPress={() => router.push('/premium')} />
      </View>
    </View>
  );
}
