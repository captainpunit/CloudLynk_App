import assert from 'node:assert/strict';
import test from 'node:test';
import { planAuthEvent } from '../auth-events';

test('a session refreshed at launch reloads the workspace', () => {
  // Opening the app an hour after last use: nothing loaded yet, token refreshed on start.
  assert.deepEqual(planAuthEvent('TOKEN_REFRESHED', 'u1', null), { reset: true, reload: true });
  assert.deepEqual(planAuthEvent('SIGNED_IN', 'u1', null), { reset: true, reload: true });
});

test('a routine token refresh for the same member changes nothing', () => {
  assert.deepEqual(planAuthEvent('TOKEN_REFRESHED', 'u1', 'u1'), { reset: false, reload: false });
});

test('signing out or switching account clears and reloads', () => {
  assert.deepEqual(planAuthEvent('SIGNED_OUT', null, 'u1'), { reset: true, reload: true });
  assert.deepEqual(planAuthEvent('SIGNED_IN', 'u2', 'u1'), { reset: true, reload: true });
});

test('the restored session at launch is left to the launch load', () => {
  assert.deepEqual(planAuthEvent('INITIAL_SESSION', 'u1', null), { reset: false, reload: false });
});

test('a profile update reloads without clearing', () => {
  assert.deepEqual(planAuthEvent('USER_UPDATED', 'u1', 'u1'), { reset: false, reload: true });
});
