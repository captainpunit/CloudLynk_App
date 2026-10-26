import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDemoWorkspace } from '../../data/demo/seed';
import { parseWorkspace } from '../persistence';
test('workspace round-trips with memberships and entitlement intact', () => {
  const value = { ...createDemoWorkspace(), joinedIds: ['wander'], demoPlanId: 'annual' };
  assert.deepEqual(parseWorkspace(JSON.stringify(value)), value);
});
test('corrupt or future-version snapshots fail safely', () => {
  assert.equal(parseWorkspace('{broken'), null);
  assert.equal(parseWorkspace(JSON.stringify({ ...createDemoWorkspace(), version: 99 })), null);
});
test('malformed nested records cannot reach screen renderers', () => {
  assert.equal(
    parseWorkspace(JSON.stringify({ ...createDemoWorkspace(), channels: [{ name: null }] })),
    null,
  );
  assert.equal(
    parseWorkspace(JSON.stringify({ ...createDemoWorkspace(), progress: { test: -1 } })),
    null,
  );
});
test('old snapshots receive the additive reports field', () => {
  const value: Record<string, unknown> = { ...createDemoWorkspace() };
  delete value.reports;
  assert.deepEqual(parseWorkspace(JSON.stringify(value))?.reports, []);
});
