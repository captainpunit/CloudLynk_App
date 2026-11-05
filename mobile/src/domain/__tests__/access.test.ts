import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accessMessages } from '../access';
import { plusSummary, videoLabel } from '../format';
import type { Channel } from '../models';

test('Plus is only offered with active plans and states real values', () => {
  const channel = { status: 'published', visibility: 'premium' } as Channel;
  const plans = [
    { name: 'Monthly', billingPeriod: 'P1M', quotaBytes: 1024 ** 3 },
    { name: 'Yearly', billingPeriod: 'P1Y', quotaBytes: 2 * 1024 ** 3 },
  ];
  assert.equal(plusSummary({ plans: [], channels: [channel] }), null);
  assert.equal(plusSummary({ plans, channels: [] }), 'Up to 2.0 GB of storage.');
  assert.equal(
    plusSummary({ plans, channels: [channel] }),
    '1 Plus channel and up to 2.0 GB of storage.',
  );
});

test('title labels come from the title kind', () => {
  assert.equal(videoLabel({ kind: 'movie' }), 'Movie');
  assert.equal(videoLabel({ kind: 'episode', episodeNumber: 3 }), 'Episode 3');
});

test('every denial has a user-facing message', () => {
  for (const [decision, message] of Object.entries(accessMessages))
    assert.equal(message.length > 0, decision !== 'allowed', decision);
});
