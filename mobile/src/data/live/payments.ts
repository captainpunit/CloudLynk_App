import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import type { OrderStatus, UpiOrder } from '@/domain/payments';
import { call, checked } from './backend';
import { invokeBackend } from './invoke-backend';

export function mapOrder(row: Tables<'upi_orders'> | null): UpiOrder {
  if (!row) throw new Error('The request could not be completed. Refresh and try again.');
  return {
    id: row.id,
    productId: row.product_id,
    planName: row.plan_name,
    billingPeriod: row.billing_period,
    amountPaise: row.amount_paise,
    reference: row.reference,
    payeeVpa: row.payee_vpa,
    payeeName: row.payee_name,
    payUri: row.pay_uri,
    status: row.status as OrderStatus,
    utr: row.utr,
    attempts: row.attempts,
    reason: row.decision_reason,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
  };
}

/** The subscriber's most recent orders, newest first. */
export async function fetchMyOrders(userId: string, limit = 5): Promise<UpiOrder[]> {
  const rows = checked(
    await supabase
      .from('upi_orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  );
  return (rows ?? []).map(mapOrder);
}
/** Starts an order for a plan, or returns the one already open for the same offer. */
export async function startOrder(productId: string): Promise<UpiOrder> {
  return mapOrder(await call('create_upi_order', { p_product_id: productId }));
}
/** Stores what Google Play's choice screen returned, so the payment can be reported to Google. */
export async function attachPlayChoice(
  orderId: string,
  externalTransactionToken: string,
  state: string,
): Promise<UpiOrder> {
  return mapOrder(
    await call('attach_play_choice', {
      p_order_id: orderId,
      p_token: externalTransactionToken,
      p_state: state,
    }),
  );
}
/** Has the backend confirm a Google Play purchase with Google and grant the plan. */
export function verifyPlayProduct(productId: string, purchaseToken: string) {
  return invokeBackend<{ status: string; expiresAt: string }>('verify-play-product', {
    productId,
    purchaseToken,
  });
}
/** The ID Google Play ties a purchase to, so another account cannot claim it. */
export async function fetchPlayAccountId(userId: string): Promise<string> {
  const row = checked(
    await supabase.from('profiles').select('play_account_id').eq('id', userId).single(),
  );
  if (!row?.play_account_id)
    throw new Error('Your billing account is not ready. Try again in a moment.');
  return row.play_account_id;
}
export async function reportPayment(orderId: string, utr: string): Promise<UpiOrder> {
  return mapOrder(await call('submit_upi_payment', { p_order_id: orderId, p_utr: utr }));
}

// Administrator views. Row level security returns nothing to other accounts.

export type QueuedPayment = UpiOrder & { userId: string; payerName: string };
export const queuePageSize = 25;
/** Payments waiting for confirmation, oldest first so nobody waits behind newer reports. */
export async function fetchPaymentQueue(page: number): Promise<QueuedPayment[]> {
  const rows = checked(
    await supabase
      .from('upi_orders')
      .select('*, profiles(display_name)')
      .eq('status', 'submitted')
      .order('submitted_at')
      .order('id')
      .range(page * queuePageSize, page * queuePageSize + queuePageSize - 1),
  );
  return (rows ?? []).map((row) => ({
    ...mapOrder(row),
    userId: row.user_id,
    payerName: row.profiles?.display_name ?? 'Member',
  }));
}
/**
 * Confirmed payments, newest first, for refunds. A UTR narrows the list to that one payment.
 */
export async function fetchPaidPayments(utr?: string): Promise<QueuedPayment[]> {
  let query = supabase
    .from('upi_orders')
    .select('*, profiles(display_name)')
    .eq('status', 'paid')
    .order('decided_at', { ascending: false })
    .limit(queuePageSize);
  if (utr) query = query.eq('utr', utr);
  return (checked(await query) ?? []).map((row) => ({
    ...mapOrder(row),
    userId: row.user_id,
    payerName: row.profiles?.display_name ?? 'Member',
  }));
}
/** Records that a confirmed payment was returned to the member; ends the time it bought. */
export function refundPayment(orderId: string, reason: string) {
  return call('refund_upi_order', { p_order_id: orderId, p_reason: reason.trim() });
}
export function decidePayment(orderId: string, action: 'approve' | 'reject', reason?: string) {
  return call('decide_upi_order', {
    p_order_id: orderId,
    p_action: action,
    ...(reason?.trim() ? { p_reason: reason.trim() } : {}),
  });
}

export type PaymentSettings = Tables<'payment_settings'>;
export async function fetchPaymentSettings(): Promise<PaymentSettings | null> {
  return checked(await supabase.from('payment_settings').select('*').maybeSingle());
}
export function savePaymentSettings(input: {
  upiVpa: string;
  payeeName: string;
  merchantCode: string;
  enabled: boolean;
}) {
  return call('save_payment_settings', {
    p_upi_vpa: input.upiVpa,
    p_payee_name: input.payeeName,
    p_enabled: input.enabled,
    ...(input.merchantCode.trim() ? { p_merchant_code: input.merchantCode.trim() } : {}),
  });
}
/** GST included in plan prices; used to split a UPI payment when it is reported to Google. */
export function savePaymentTax(percent: number) {
  return call('set_payment_tax', { p_percent: percent });
}

export type PlanRow = Tables<'plans'>;
/** Every plan, including inactive ones (administrators only; others see active plans). */
export async function fetchAllPlans(): Promise<PlanRow[]> {
  return checked(await supabase.from('plans').select('*').order('product_id')) ?? [];
}
export function savePlan(input: {
  productId: string;
  name: string;
  billingPeriod: string;
  pricePaise: number;
  quotaBytes: number;
  active: boolean;
}) {
  return call('save_plan', {
    p_product_id: input.productId,
    p_name: input.name,
    p_billing_period: input.billingPeriod,
    p_price_paise: input.pricePaise,
    p_quota_bytes: input.quotaBytes,
    p_active: input.active,
  });
}
