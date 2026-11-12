import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, View } from 'react-native';
import { Button, ErrorNote, Field, Label, Surface } from '@/components/ui';
import { LegalLinks } from '@/components/legal-links';
import { colors as c } from '@/theme/tokens';
import { env } from '@/lib/env';
import { fileSize } from '@/domain/format';
import {
  cleanUtr,
  isUtr,
  maxReports,
  orderStep,
  periodLength,
  planPrice,
  rupees,
  stateCode,
  type IndianState,
  type UpiOrder,
} from '@/domain/payments';
import type { Plan } from '@/domain/models';
import { attachPlayChoice, fetchMyOrders, reportPayment, startOrder } from '@/data/live/payments';
import type { UpiChoice } from '@/services/billing/play-choice';
import { StatePicker } from './state-picker';
import { usePlayChoice } from './use-play-choice';
import { logCheckoutStarted } from '@/services/meta/measurement';
import { useWorkspace } from '@/state/workspace-provider';

/**
 * Plus checkout. The backend issues the UPI payment link and decides access: this screen
 * only opens the link, collects the UTR and shows where the order stands.
 *
 * On Google Play builds the member first sees Google's choice screen. Choosing Google
 * Play finishes there; choosing UPI returns here with a token, and the member gives
 * their state (Google needs it for GST) before paying.
 */
export default function UpiCheckout() {
  const { state, requireIdentity, refresh, notify } = useWorkspace();
  const plans = state.plans ?? [];
  const userId = state.profile?.id;
  const [orders, setOrders] = useState<UpiOrder[]>([]);
  const [selected, setSelected] = useState('');
  const [choosing, setChoosing] = useState(false);
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<UpiChoice | null>(null);
  const [taxState, setTaxState] = useState<IndianState | null>(null);
  const play = usePlayChoice(userId, {
    onGranted: () => {
      notify('Payment confirmed. Plus is active.');
      void refresh();
    },
    onUpiChosen: (chosen) => {
      setError(null);
      setChoice(chosen);
    },
    onError: setError,
  });
  const request = useRef(0);
  // Taken before any await, so two quick taps cannot both start a payment.
  const working = useRef(false);
  // Changes when the signed-in account changes; late results for the old one are dropped.
  const account = useRef(0);
  useEffect(() => {
    account.current += 1;
    request.current += 1;
    setOrders([]);
    setChoice(null);
    setUtr('');
    setError(null);
  }, [userId]);

  const load = useCallback(async () => {
    const id = ++request.current;
    const rows = userId ? await fetchMyOrders(userId) : [];
    // A slower, older response must not replace a newer one.
    if (id === request.current) setOrders(rows);
  }, [userId]);
  useEffect(() => {
    void load().catch(() =>
      setError('Your payments could not load. Close this screen and open it again.'),
    );
    // Returning from the UPI app (or from the background) shows the latest state.
    const foreground = AppState.addEventListener('change', (status) => {
      if (status === 'active') void load().catch(() => {});
    });
    return () => {
      request.current += 1;
      foreground.remove();
    };
  }, [load]);

  const latest = orders[0];
  const step = latest ? orderStep(latest) : 'closed';
  const current = latest && !choosing && ['pay', 'report', 'review'].includes(step) ? latest : null;
  const plan = plans.find((item) => item.productId === selected) ?? plans[0];

  /** Runs one payment action at a time. `live()` is false once the account has changed. */
  async function run(work: (live: () => boolean) => Promise<void>) {
    if (working.current) return;
    working.current = true;
    const owner = account.current;
    const live = () => owner === account.current;
    setBusy(true);
    setError(null);
    try {
      await work(live);
    } catch (cause) {
      if (live()) setError(cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  function openUpi(order: UpiOrder) {
    if (Platform.OS === 'web') return;
    void Linking.openURL(order.payUri).catch(() =>
      setError(
        'No UPI app opened. Pay the exact amount to the UPI ID below from any UPI app, then enter the UTR.',
      ),
    );
  }
  /** Shows a new or reopened order and hands over to the UPI app. */
  function show(order: UpiOrder) {
    // A list fetched before this order existed must not replace it when it arrives.
    request.current += 1;
    setOrders((rows) => [order, ...rows.filter((row) => row.id !== order.id)]);
    setChoosing(false);
    setUtr('');
    openUpi(order);
  }
  function pay() {
    if (!requireIdentity() || !plan) return;
    void run(async (live) => {
      logCheckoutStarted(plan.productId);
      if (play.available) return play.buy(plan.productId);
      const order = await startOrder(plan.productId);
      if (live()) show(order);
    });
  }
  function payByUpi(chosen: UpiChoice, state: IndianState) {
    void run(async (live) => {
      const started = await startOrder(chosen.productId);
      const order = await attachPlayChoice(
        started.id,
        chosen.externalTransactionToken,
        stateCode(state),
      );
      if (!live()) return;
      show(order);
      setChoice(null);
    });
  }
  function report(order: UpiOrder) {
    void run(async (live) => {
      const updated = await reportPayment(order.id, cleanUtr(utr));
      if (!live()) return;
      request.current += 1;
      setOrders((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      setUtr('');
      notify('Payment reported. Plus starts once we confirm it.');
    });
  }
  function check() {
    void run(async () => {
      await Promise.all([load(), refresh()]);
    });
  }

  if (choice)
    return (
      <Surface>
        <Label style={{ fontWeight: '700', fontSize: 17 }}>Pay by UPI</Label>
        <Label style={{ color: c.muted, fontSize: 13 }}>
          Tell us your state before you pay. It is used only to work out the tax on this payment.
        </Label>
        <StatePicker value={taxState} onChange={setTaxState} />
        <ErrorNote message={error} />
        <Button
          title="Continue to UPI"
          loading={busy}
          disabled={!taxState}
          onPress={() => taxState && payByUpi(choice, taxState)}
        />
        <Button
          title="Back to plans"
          variant="outline"
          disabled={busy}
          onPress={() => setChoice(null)}
        />
      </Surface>
    );

  if (current && step === 'review')
    return (
      <Surface>
        <Label style={{ fontWeight: '700', fontSize: 17 }}>We are checking your payment</Label>
        <Label>
          {rupees(current.amountPaise)} for {current.planName}
        </Label>
        <Detail name="UTR" value={current.utr ?? ''} />
        <Label style={{ color: c.muted, fontSize: 13 }}>
          Plus starts when our team finds this payment in the bank record. You will get a notice as
          soon as it is confirmed.
        </Label>
        <ErrorNote message={error} />
        <Button title="Check again" variant="soft" loading={busy} onPress={check} />
      </Surface>
    );

  if (current)
    return (
      <Surface>
        {step === 'report' ? (
          <>
            <Label style={{ fontWeight: '700', fontSize: 17 }}>
              {current.status === 'rejected'
                ? 'Payment not confirmed'
                : 'This payment request has ended'}
            </Label>
            {!!current.reason && <Label>{current.reason}</Label>}
            <Label style={{ color: c.muted, fontSize: 13 }}>
              If you did pay {rupees(current.amountPaise)} for it, enter the UTR from your UPI app
              and we will check it. Otherwise start a new payment. You have{' '}
              {maxReports - current.attempts}{' '}
              {maxReports - current.attempts === 1 ? 'try' : 'tries'} left for this payment.
            </Label>
          </>
        ) : (
          <>
            <Label style={{ fontWeight: '700', fontSize: 17 }}>
              Pay {rupees(current.amountPaise)} to {current.payeeName}
            </Label>
            <Label style={{ color: c.muted, fontSize: 13 }}>
              {current.planName}, {periodLength(current.billingPeriod)} of Plus
            </Label>
            <Detail name="UPI ID" value={current.payeeVpa} />
            <Detail name="Amount" value={rupees(current.amountPaise)} />
            {Platform.OS === 'web' ? (
              <Label style={{ color: c.muted, fontSize: 13 }}>
                Pay this exact amount to the UPI ID from any UPI app, or open {env.appName} on your
                phone to pay in one tap.
              </Label>
            ) : (
              <Button title="Open UPI app" disabled={busy} onPress={() => openUpi(current)} />
            )}
          </>
        )}
        <Field
          label="UTR (12-digit reference on your UPI receipt)"
          value={utr}
          onChangeText={setUtr}
          keyboardType="number-pad"
          maxLength={14}
          placeholder="123456789012"
        />
        <ErrorNote message={error} />
        <Button
          title="I have paid, submit UTR"
          variant={step === 'report' ? 'primary' : 'soft'}
          loading={busy}
          disabled={!isUtr(utr)}
          onPress={() => report(current)}
        />
        <Button
          title={step === 'report' ? 'Start a new payment' : 'Choose a different plan'}
          variant="outline"
          disabled={busy}
          onPress={() => {
            setError(null);
            setChoosing(true);
          }}
        />
      </Surface>
    );

  if (!plans.length)
    return (
      <Surface>
        <Label>No plans are available right now.</Label>
      </Surface>
    );
  return (
    <View style={{ gap: 12 }}>
      <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
        {plans.map((item) => (
          <PlanOption
            key={item.productId}
            plan={item}
            selected={item.productId === plan?.productId}
            onPress={() => setSelected(item.productId)}
          />
        ))}
      </View>
      <ErrorNote message={error} />
      <Button
        title={
          !state.profile
            ? 'Sign in to subscribe'
            : !plan
              ? 'Subscribe'
              : play.available
                ? `Subscribe for ${rupees(plan.pricePaise)}`
                : `Pay ${rupees(plan.pricePaise)} with UPI`
        }
        loading={busy}
        onPress={pay}
      />
      <Label style={{ color: c.muted, fontSize: 12 }}>
        {play.available ? 'Choose Google Play or UPI on the next screen. ' : ''}
        Plus does not renew by itself. Pay again when your time ends; paying early adds to the time
        you have left. A UPI payment starts Plus after we confirm it.
      </Label>
      <LegalLinks />
    </View>
  );
}

function Detail({ name, value }: { name: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Label style={{ color: c.muted, fontSize: 13 }}>{name}</Label>
      <Label selectable style={{ fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Label>
    </View>
  );
}

function PlanOption({
  plan,
  selected,
  onPress,
}: {
  plan: Plan;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${plan.name}, ${planPrice(plan)}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderRadius: 18,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.primary : c.line,
        backgroundColor: selected ? c.primarySoft : c.surface,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected ? c.primary : c.muted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && (
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Label style={{ fontWeight: '700', fontSize: 16 }}>{plan.name}</Label>
        <Label style={{ color: c.muted, fontSize: 12 }}>
          {periodLength(plan.billingPeriod)} of Plus
          {plan.quotaBytes > 0 ? `, ${fileSize(plan.quotaBytes)} of storage` : ''}
        </Label>
      </View>
      <Label style={{ fontWeight: '700', fontSize: 16 }}>{planPrice(plan)}</Label>
    </Pressable>
  );
}
