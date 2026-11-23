import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accessMessages } from '../access';
import { plusSummary, videoLabel } from '../format';
import type { Channel } from '../models';

test('Plus is only offered with active plans and states real values', () => {
  const channel = { status: 'published', visibility: 'premium', name: 'Cricket Corner' } as Channel;
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
    'Watch every Plus channel, plus 2.0 GB of cloud storage.',
  );
  assert.equal(
    plusSummary({ plans: plans.map((plan) => ({ ...plan, quotaBytes: 0 })), channels: [channel] }),
    'Watch Cricket Corner.',
  );
  assert.equal(
    plusSummary({ plans, channels: [channel] }),
    'Watch Cricket Corner, plus 2.0 GB of cloud storage.',
  );
  const more = ['Tech Tak', 'Kitchen Stories', 'Daily News'].map(
    (name) => ({ ...channel, name }) as Channel,
  );
  assert.equal(
    plusSummary({ plans, channels: [channel, more[0]] }),
    'Watch Cricket Corner and Tech Tak, plus 2.0 GB of cloud storage.',
  );
  assert.equal(
    plusSummary({ plans, channels: [channel, ...more] }),
    'Watch Cricket Corner, Tech Tak and 2 more, plus 2.0 GB of cloud storage.',
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
