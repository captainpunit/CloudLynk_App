/** Pure rules for plan prices, UPI bank references and what a subscriber can do with an order. */

export type OrderStatus = 'created' | 'submitted' | 'paid' | 'rejected' | 'expired' | 'refunded';

export interface UpiOrder {
  id: string;
  productId: string;
  planName: string;
  billingPeriod: string;
  amountPaise: number;
  reference: string;
  payeeVpa: string;
  payeeName: string;
  payUri: string;
  status: OrderStatus;
  utr: string | null;
  attempts: number;
  reason: string | null;
  expiresAt: string;
  createdAt: string;
  submittedAt: string | null;
}

/** Mirrors the backend limits in `submit_upi_payment`. */
export const maxReports = 3;
const reportWindowMs = 7 * 24 * 60 * 60 * 1000;

const units = { D: 'day', M: 'month', Y: 'year' } as const;
/** Reads an ISO 8601 plan period such as P7D, P1M or P1Y (the backend's `valid_plan_period`). */
function parsePeriod(period: string) {
  const match = /^P(\d+)([DMY])$/.exec(period);
  return match ? { count: Number(match[1]), unit: units[match[2] as keyof typeof units] } : null;
}
/** Plan lengths offered when an administrator creates a plan. */
export const billingPeriods = ['P2D', 'P7D', 'P1M', 'P3M', 'P6M', 'P1Y'];
/** The period as a unit of price: "month", "7 days". */
export function periodLabel(period: string): string {
  const parsed = parsePeriod(period);
  if (!parsed) return period;
  return parsed.count === 1 ? parsed.unit : `${parsed.count} ${parsed.unit}s`;
}
/** The period as a length of time: "1 month", "7 days". */
export function periodLength(period: string): string {
  const parsed = parsePeriod(period);
  if (!parsed) return period;
  return `${parsed.count} ${parsed.unit}${parsed.count === 1 ? '' : 's'}`;
}

/** Indian digit grouping, written out so every JavaScript engine prints the same price. */
export function rupees(paise: number): string {
  const whole = String(Math.floor(paise / 100));
  const head = whole.slice(0, -3).replace(/\B(?=(\d{2})+$)/g, ',');
  const rest = paise % 100;
  return `₹${head ? `${head},` : ''}${whole.slice(-3)}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}
export function planPrice(plan: { pricePaise: number; billingPeriod: string }): string {
  return `${rupees(plan.pricePaise)} / ${periodLabel(plan.billingPeriod)}`;
}
/** Whole paise from a typed rupee amount such as "99" or "99.50"; null when it is not a price. */
export function paiseFromRupees(input: string): number | null {
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const paise = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return paise >= 100 ? paise : null;
}

export function cleanUtr(input: string): string {
  return input.replace(/\s/g, '');
}
/** UPI apps show a 12-digit UTR (also called the UPI reference number) for every payment. */
export function isUtr(input: string): boolean {
  return /^\d{12}$/.test(cleanUtr(input));
}

/**
 * - `pay`: open order; pay it, then report the UTR.
 * - `report`: no longer payable, but a payment already made can still be reported or corrected.
 * - `review`: reported and waiting for an administrator.
 * - `done`: confirmed. `closed`: nothing more can happen with it.
 */
export type OrderStep = 'pay' | 'report' | 'review' | 'done' | 'closed';
export function orderStep(
  order: Pick<UpiOrder, 'status' | 'attempts' | 'expiresAt' | 'createdAt'>,
  now = Date.now(),
): OrderStep {
  if (order.status === 'paid') return 'done';
  if (order.status === 'submitted') return 'review';
  const reportable =
    order.attempts < maxReports && now - Date.parse(order.createdAt) < reportWindowMs;
  if (order.status === 'created' && Date.parse(order.expiresAt) > now) return 'pay';
  if (order.status === 'rejected' && reportable) return 'report';
  return 'closed';
}

/** Latest end date among subscriptions that currently grant access; null when none do. */
export function accessUntil(
  subscriptions: { status: string; paid_until: string | null }[],
  now = Date.now(),
): string | null {
  let latest: string | null = null;
  for (const row of subscriptions) {
    if (!['active', 'in_grace', 'cancelled'].includes(row.status) || !row.paid_until) continue;
    if (Date.parse(row.paid_until) <= now) continue;
    if (!latest || Date.parse(row.paid_until) > Date.parse(latest)) latest = row.paid_until;
  }
  return latest;
}

/**
 * Indian states and union territories. Google Play needs the member's state to report a
 * UPI payment made through its choice screen, because GST depends on it.
 */
export const indianStates = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;
export type IndianState = (typeof indianStates)[number];

/** The spelling the backend and Google expect. */
export const stateCode = (state: IndianState) => state.toUpperCase();

/** States whose name contains the typed text, for the picker. */
export function matchingStates(query: string): IndianState[] {
  const text = query.trim().toLowerCase();
  return text ? indianStates.filter((state) => state.toLowerCase().includes(text)) : [];
}
