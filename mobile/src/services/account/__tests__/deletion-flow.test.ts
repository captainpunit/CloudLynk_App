import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestVerifiedDeletion } from '../deletion-flow';

test('deletion requires typed confirmation before reauthentication or submission', async () => {
  await assert.rejects(
    requestVerifiedDeletion('alice', 'delete', {
      reauthenticate: async () => {
        assert.fail('must not authenticate');
      },
      request: async () => {
        assert.fail('must not delete');
      },
      signOut: async () => {
        assert.fail('must not sign out');
      },
    }),
    /Type DELETE/,
  );
});
test('a failed reauthentication never submits deletion', async () => {
  await assert.rejects(
    requestVerifiedDeletion('alice', 'DELETE', {
      reauthenticate: async () => {
        throw new Error('incorrect password');
      },
      request: async () => {
        assert.fail('must not delete');
      },
      signOut: async () => {
        assert.fail('must not sign out');
      },
    }),
    /incorrect password/,
  );
});
test('deletion cannot proceed under a different authenticated account', async () => {
  await assert.rejects(
    requestVerifiedDeletion('alice', 'DELETE', {
      reauthenticate: async () => 'bob',
      request: async () => {
        assert.fail('must not delete');
      },
      signOut: async () => {
        assert.fail('must not sign out');
      },
    }),
    /account changed/,
  );
});
test('server rejection leaves the session available for retry', async () => {
  await assert.rejects(
    requestVerifiedDeletion('alice', 'DELETE', {
      reauthenticate: async () => 'alice',
      request: async () => {
        throw new Error('temporarily unavailable');
      },
      signOut: async () => {
        assert.fail('must not sign out');
      },
    }),
    /temporarily unavailable/,
  );
});
test('accepted deletion remains accepted if local sign-out fails', async () => {
  const result = await requestVerifiedDeletion('alice', 'DELETE', {
    reauthenticate: async () => 'alice',
    request: async (confirmation) => {
      assert.equal(confirmation, 'DELETE');
      return { requestId: 'request-1', status: 'queued' };
    },
    signOut: async () => {
      throw new Error('offline');
    },
  });
  assert.equal(result.status, 'queued');
});
