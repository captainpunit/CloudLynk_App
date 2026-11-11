import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  accessUntil,
  cleanUtr,
  isUtr,
  orderStep,
  paiseFromRupees,
  periodLength,
  planPrice,
  rupees,
} from '../payments';

test('prices use Indian grouping and drop empty paise', () => {
  assert.equal(rupees(9900), '₹99');
  assert.equal(rupees(9950), '₹99.50');
  assert.equal(rupees(99900), '₹999');
  assert.equal(rupees(129900), '₹1,299');
  assert.equal(rupees(12345600), '₹1,23,456');
  assert.equal(planPrice({ pricePaise: 9900, billingPeriod: 'P1M' }), '₹99 / month');
  assert.equal(planPrice({ pricePaise: 99900, billingPeriod: 'P1Y' }), '₹999 / year');
  assert.equal(periodLength('P1M'), '1 month');
  assert.equal(periodLength('P6M'), '6 months');
});

test('typed rupee amounts become whole paise', () => {
  assert.equal(paiseFromRupees('99'), 9900);
  assert.equal(paiseFromRupees(' 99.5 '), 9950);
  assert.equal(paiseFromRupees('0.50'), null);
  assert.equal(paiseFromRupees('99.999'), null);
  assert.equal(paiseFromRupees('abc'), null);
});

test('a UTR is twelve digits, spaces ignored', () => {
  assert.equal(cleanUtr('1234 5678 9012'), '123456789012');
  assert.equal(isUtr('1234 5678 9012'), true);
  assert.equal(isUtr('12345678901'), false);
  assert.equal(isUtr('12345678901a'), false);
});

test('order steps follow the backend rules', () => {
  const now = Date.parse('2026-11-11T10:00:00Z');
  const base = {
    attempts: 0,
    createdAt: '2026-11-11T09:00:00Z',
    expiresAt: '2026-11-12T09:00:00Z',
  };
  assert.equal(orderStep({ ...base, status: 'created' }, now), 'pay');
  assert.equal(
    orderStep({ ...base, status: 'created', expiresAt: '2026-11-11T09:30:00Z' }, now),
    'closed',
  );
  assert.equal(orderStep({ ...base, status: 'submitted', attempts: 1 }, now), 'review');
  assert.equal(orderStep({ ...base, status: 'rejected', attempts: 1 }, now), 'report');
  assert.equal(orderStep({ ...base, status: 'rejected', attempts: 3 }, now), 'closed');
  assert.equal(
    orderStep({ ...base, status: 'rejected', attempts: 1, createdAt: '2026-11-01T09:00:00Z' }, now),
    'closed',
  );
  assert.equal(orderStep({ ...base, status: 'paid', attempts: 1 }, now), 'done');
  assert.equal(orderStep({ ...base, status: 'expired' }, now), 'closed');
});

test('access lasts until the latest paid period that still counts', () => {
  const now = Date.parse('2026-11-11T10:00:00Z');
  assert.equal(accessUntil([], now), null);
  assert.equal(
    accessUntil(
      [
        { status: 'active', paid_until: '2026-12-11T10:00:00Z' },
        { status: 'active', paid_until: '2027-12-11T10:00:00Z' },
        { status: 'expired', paid_until: '2028-01-01T00:00:00Z' },
        { status: 'active', paid_until: '2026-11-01T00:00:00Z' },
      ],
      now,
    ),
    '2027-12-11T10:00:00Z',
  );
  assert.equal(accessUntil([{ status: 'pending', paid_until: null }], now), null);
});
