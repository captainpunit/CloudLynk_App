import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accessMessages } from '../access';
import { plusSummary, videoLabel } from '../format';
import type { Channel } from '../models';

test('Plus is only offered with active plans and states real values', () => {
  const channel = { status: 'published', visibility: 'premium' } as Channel;
  const plans = [
    {
      productId: 'm',
      name: 'Monthly',
      billingPeriod: 'P1M',
      quotaBytes: 1024 ** 3,
      pricePaise: 9900,
    },
    {
      productId: 'y',
      name: 'Yearly',
      billingPeriod: 'P1Y',
      quotaBytes: 2 * 1024 ** 3,
      pricePaise: 99900,
    },
  ];
  assert.equal(plusSummary({ plans: [], channels: [channel] }), null);
  assert.equal(
    plusSummary({ plans, channels: [] }),
    'Watch every Plus channel, with up to 2.0 GB of storage.',
  );
  assert.equal(
    plusSummary({ plans: plans.map((plan) => ({ ...plan, quotaBytes: 0 })), channels: [channel] }),
    'Watch the Plus channel.',
  );
  assert.equal(
    plusSummary({ plans, channels: [channel] }),
    'Watch the Plus channel, with up to 2.0 GB of storage.',
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
