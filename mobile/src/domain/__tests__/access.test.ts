import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accessMessages } from '../access';

test('every denial has a user-facing message', () => {
  for (const [decision, message] of Object.entries(accessMessages))
    assert.equal(message.length > 0, decision !== 'allowed', decision);
});
