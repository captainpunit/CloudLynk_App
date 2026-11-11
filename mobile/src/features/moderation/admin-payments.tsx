import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, EmptyState, ErrorNote, Field, Label, Pill, Surface } from '@/components/ui';
import { colors as c } from '@/theme/tokens';
import { fileSize } from '@/domain/format';
import {
  billingPeriods,
  cleanUtr,
  isUtr,
  maxReports,
  paiseFromRupees,
  periodLength,
  planPrice,
  rupees,
} from '@/domain/payments';
import {
  decidePayment,
  fetchAllPlans,
  fetchPaidPayments,
  fetchPaymentQueue,
  fetchPaymentSettings,
  queuePageSize,
  refundPayment,
  savePaymentSettings,
  savePaymentTax,
  savePlan,
  type PlanRow,
  type QueuedPayment,
} from '@/data/live/payments';
import { useWorkspace } from '@/state/workspace-provider';

const gigabyte = 1024 ** 3;
const emptyPlan = {
  productId: '',
  name: '',
  billingPeriod: 'P1M',
  price: '',
  storageGb: '',
  active: true,
  existing: false,
};

/** Admin: confirm or refund reported UPI payments, and set where money goes and what plans cost. */
export default function AdminPayments() {
  const { refresh, notify } = useWorkspace();
  const [view, setView] = useState('To confirm');
  const [queue, setQueue] = useState<QueuedPayment[]>([]);
  const [page, setPage] = useState(0);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [reason, setReason] = useState('');
  const [paid, setPaid] = useState<QueuedPayment[]>([]);
  const [paidUtr, setPaidUtr] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [vpa, setVpa] = useState('');
  const [payee, setPayee] = useState('');
  const [merchantCode, setMerchantCode] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [tax, setTax] = useState('');
  const [plan, setPlan] = useState(emptyPlan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => setQueue(await fetchPaymentQueue(page)), [page]);
  const loadSetup = useCallback(async () => {
    const [settings, rows] = await Promise.all([fetchPaymentSettings(), fetchAllPlans()]);
    setVpa(settings?.upi_vpa ?? '');
    setPayee(settings?.payee_name ?? '');
    setMerchantCode(settings?.merchant_code ?? '');
    setEnabled(settings?.upi_enabled ?? false);
    setTax(String(settings?.tax_percent ?? ''));
    setPlans(rows);
  }, []);
  useEffect(() => {
    void loadQueue().catch(() => setError('Payments could not load. Please refresh.'));
  }, [loadQueue]);
  // Confirmed payments load when the Refunds view opens, and again for each search.
  const loadPaid = useCallback(async (utr = '') => setPaid(await fetchPaidPayments(utr)), []);
  useEffect(() => {
    if (view !== 'Refunds') return;
    void loadPaid().catch(() => setError('Payments could not load. Please refresh.'));
  }, [view, loadPaid]);
  useEffect(() => {
    void loadSetup().catch(() => setError('Payment setup could not load. Please refresh.'));
  }, [loadSetup]);

  async function run(work: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
      notify(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  function decide(order: QueuedPayment, action: 'approve' | 'reject') {
    void run(
      async () => {
        await decidePayment(order.id, action, reason);
        setReason('');
        await loadQueue();
      },
      action === 'approve' ? 'Payment confirmed. Plus is active.' : 'Payment rejected.',
    );
  }
  function refund(order: QueuedPayment) {
    void run(async () => {
      await refundPayment(order.id, refundReason);
      setRefundReason('');
      await loadPaid(isUtr(paidUtr) ? cleanUtr(paidUtr) : '');
    }, 'Marked refunded. That payment no longer gives Plus.');
  }
  function saveSettings() {
    void run(async () => {
      await savePaymentSettings({ upiVpa: vpa, payeeName: payee, merchantCode, enabled });
      await loadSetup();
    }, 'UPI details saved.');
  }
  function saveTax() {
    void run(async () => {
      await savePaymentTax(Number(tax));
      await loadSetup();
    }, 'GST rate saved.');
  }
  function submitPlan() {
    const pricePaise = paiseFromRupees(plan.price);
    const storage = Number(plan.storageGb);
    if (pricePaise === null) return setError('Enter a price in rupees, for example 99 or 99.50.');
    if (!plan.storageGb.trim() || !Number.isFinite(storage) || storage < 0)
      return setError('Enter the storage included with this plan, in GB.');
    void run(async () => {
      await savePlan({
        productId: plan.productId.trim(),
        name: plan.name.trim(),
        billingPeriod: plan.billingPeriod,
        pricePaise,
        quotaBytes: Math.round(storage * gigabyte),
        active: plan.active,
      });
      setPlan(emptyPlan);
      // The Plus screen reads plans from the shared workspace.
      await Promise.all([loadSetup(), refresh()]);
    }, 'Plan saved.');
  }

  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['To confirm', 'Refunds', 'UPI details', 'Plans'].map((value) => (
          <Pill
            key={value}
            title={value}
            selected={view === value}
            onPress={() => {
              setError(null);
              setView(value);
            }}
          />
        ))}
      </View>
      <ErrorNote message={error} />
      {view === 'To confirm' && (
        <>
          <Label style={{ color: c.muted, fontSize: 13 }}>
            Confirm a payment only after you find its UTR and exact amount in the bank statement.
            Confirming starts Plus for that member straight away.
          </Label>
          <Field
            label="Reason (required to reject; the member sees it)"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={500}
          />
          {queue.map((order) => (
            <Surface key={order.id}>
              <Label style={{ fontWeight: '700' }}>
                {rupees(order.amountPaise)} from {order.payerName}
              </Label>
              <Label>
                {order.planName}, {periodLength(order.billingPeriod)}
              </Label>
              <Label selectable>UTR {order.utr}</Label>
              <Label selectable style={{ color: c.muted, fontSize: 12 }}>
                Member {order.userId}
              </Label>
              <Label selectable style={{ color: c.muted, fontSize: 12 }}>
                Reference {order.reference} · paid to {order.payeeVpa}
              </Label>
              <Label style={{ color: c.muted, fontSize: 12 }}>
                Reported {order.submittedAt ? new Date(order.submittedAt).toLocaleString() : ''} ·
                report {order.attempts} of {maxReports}
              </Label>
              <Button
                title="Confirm payment received"
                disabled={busy}
                onPress={() => decide(order, 'approve')}
              />
              <Button
                title="Reject"
                variant="outline"
                disabled={busy || !reason.trim()}
                onPress={() => decide(order, 'reject')}
              />
            </Surface>
          ))}
          {!queue.length && (
            <EmptyState
              title={page ? 'No more payments' : 'Nothing to confirm'}
              body="Payments that members report appear here, oldest first."
            />
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Earlier"
                variant="outline"
                disabled={busy || page === 0}
                onPress={() => setPage((value) => value - 1)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Later"
                variant="outline"
                disabled={busy || queue.length < queuePageSize}
                onPress={() => setPage((value) => value + 1)}
              />
            </View>
          </View>
          <Button
            title="Refresh"
            variant="soft"
            loading={busy}
            onPress={() => void run(loadQueue, 'Payments refreshed.')}
          />
        </>
      )}
      {view === 'Refunds' && (
        <>
          <Label style={{ color: c.muted, fontSize: 13 }}>
            Send the money back from your bank or UPI app first, then mark the payment here. Marking
            it ends the Plus time that payment bought; it does not move any money.
          </Label>
          <Field
            label="Find a payment by UTR"
            value={paidUtr}
            onChangeText={setPaidUtr}
            keyboardType="number-pad"
            maxLength={12}
          />
          <Button
            title={paidUtr.trim() ? 'Find payment' : 'Show latest payments'}
            variant="soft"
            loading={busy}
            disabled={!!paidUtr.trim() && !isUtr(paidUtr)}
            onPress={() =>
              void run(
                () => loadPaid(cleanUtr(paidUtr)),
                paidUtr.trim() ? 'Search finished.' : 'Payments refreshed.',
              )
            }
          />
          <Field
            label="Reason for the refund (the member sees it)"
            value={refundReason}
            onChangeText={setRefundReason}
            multiline
            maxLength={500}
          />
          {paid.map((order) => (
            <Surface key={order.id}>
              <Label style={{ fontWeight: '700' }}>
                {rupees(order.amountPaise)} from {order.payerName}
              </Label>
              <Label>
                {order.planName}, {periodLength(order.billingPeriod)}
              </Label>
              <Label selectable>UTR {order.utr}</Label>
              <Label selectable style={{ color: c.muted, fontSize: 12 }}>
                Member {order.userId}
              </Label>
              <Label selectable style={{ color: c.muted, fontSize: 12 }}>
                Reference {order.reference} · paid to {order.payeeVpa}
              </Label>
              <Button
                title="Mark refunded"
                variant="outline"
                disabled={busy || !refundReason.trim()}
                onPress={() => refund(order)}
              />
            </Surface>
          ))}
          {!paid.length && (
            <EmptyState
              title="No confirmed payments"
              body={
                paidUtr.trim()
                  ? 'No confirmed payment has this UTR.'
                  : 'Payments you confirm appear here, newest first.'
              }
            />
          )}
        </>
      )}
      {view === 'UPI details' && (
        <Surface>
          <Label style={{ color: c.muted, fontSize: 13 }}>
            Members pay this UPI ID. Use a merchant UPI ID from your bank or UPI business app;
            personal IDs are often blocked or limited for app payments.
          </Label>
          <Field
            label="UPI ID"
            value={vpa}
            onChangeText={setVpa}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="business@bank"
          />
          <Field
            label="Name members see when paying"
            value={payee}
            onChangeText={setPayee}
            maxLength={50}
          />
          <Field
            label="Merchant category code (optional, 4 digits)"
            value={merchantCode}
            onChangeText={setMerchantCode}
            keyboardType="number-pad"
            maxLength={4}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pill title="Accept payments" selected={enabled} onPress={() => setEnabled(true)} />
            <Pill title="Pause payments" selected={!enabled} onPress={() => setEnabled(false)} />
          </View>
          <Button
            title="Save UPI details"
            loading={busy}
            disabled={!vpa.trim() || !payee.trim()}
            onPress={saveSettings}
          />
          <Field
            label="GST included in plan prices (percent)"
            value={tax}
            onChangeText={setTax}
            keyboardType="decimal-pad"
            maxLength={5}
          />
          <Label style={{ color: c.muted, fontSize: 13 }}>
            Used to report UPI payments made through Google Play. Ask your accountant; enter 0 if
            you do not charge GST.
          </Label>
          <Button
            title="Save GST rate"
            variant="outline"
            loading={busy}
            disabled={!/^\d{1,2}(\.\d{1,2})?$/.test(tax.trim())}
            onPress={saveTax}
          />
        </Surface>
      )}
      {view === 'Plans' && (
        <>
          {plans.map((row) => (
            <Surface key={row.product_id}>
              <Label style={{ fontWeight: '700' }}>
                {row.name} · {row.active ? 'On sale' : 'Hidden'}
              </Label>
              <Label>
                {row.price_paise === null
                  ? 'No price set, so it cannot be bought'
                  : planPrice({
                      pricePaise: row.price_paise,
                      billingPeriod: row.billing_period,
                    })}{' '}
                · {fileSize(row.quota_bytes)} of storage
              </Label>
              <Label selectable style={{ color: c.muted, fontSize: 12 }}>
                {row.product_id}
              </Label>
              <Button
                title="Edit plan"
                variant="soft"
                disabled={busy}
                onPress={() =>
                  setPlan({
                    productId: row.product_id,
                    name: row.name,
                    billingPeriod: row.billing_period,
                    price: row.price_paise === null ? '' : String(row.price_paise / 100),
                    storageGb: String(Math.round((row.quota_bytes / gigabyte) * 100) / 100),
                    active: row.active,
                    existing: true,
                  })
                }
              />
            </Surface>
          ))}
          <Surface>
            <Label style={{ fontWeight: '700' }}>
              {plan.existing ? `Edit ${plan.productId}` : 'Add a plan'}
            </Label>
            {!plan.existing && (
              <Field
                label="Plan ID (lowercase, cannot be changed later)"
                value={plan.productId}
                onChangeText={(productId) => setPlan({ ...plan, productId })}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={40}
                placeholder="plus_monthly"
              />
            )}
            <Field
              label="Plan name"
              value={plan.name}
              onChangeText={(name) => setPlan({ ...plan, name })}
              maxLength={40}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {billingPeriods.map((period) => (
                <Pill
                  key={period}
                  title={periodLength(period)}
                  selected={plan.billingPeriod === period}
                  onPress={() => setPlan({ ...plan, billingPeriod: period })}
                />
              ))}
            </View>
            <Field
              label="Price in rupees"
              value={plan.price}
              onChangeText={(price) => setPlan({ ...plan, price })}
              keyboardType="decimal-pad"
              maxLength={9}
            />
            <Field
              label="Storage included (GB)"
              value={plan.storageGb}
              onChangeText={(storageGb) => setPlan({ ...plan, storageGb })}
              keyboardType="decimal-pad"
              maxLength={7}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pill
                title="On sale"
                selected={plan.active}
                onPress={() => setPlan({ ...plan, active: true })}
              />
              <Pill
                title="Hidden"
                selected={!plan.active}
                onPress={() => setPlan({ ...plan, active: false })}
              />
            </View>
            <Label style={{ color: c.muted, fontSize: 12 }}>
              A new price applies to new payments only. Members who already paid keep what they paid
              for.
            </Label>
            <Button
              title="Save plan"
              loading={busy}
              disabled={!plan.productId.trim() || !plan.name.trim()}
              onPress={submitPlan}
            />
            {plan.existing && (
              <Button
                title="Cancel editing"
                variant="outline"
                disabled={busy}
                onPress={() => setPlan(emptyPlan)}
              />
            )}
          </Surface>
        </>
      )}
    </>
  );
}
