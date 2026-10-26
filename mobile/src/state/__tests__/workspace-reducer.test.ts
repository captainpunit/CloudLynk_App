import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDemoWorkspace } from '../../data/demo/seed';
import { workspaceReducer } from '../workspace-reducer';
import { validateChannel } from '../../domain/format';
test('joining is idempotent and leaving retains other memberships', () => {
  const seed = { ...createDemoWorkspace(), joinedIds: ['other'] };
  const joined = workspaceReducer(
    workspaceReducer(seed, { type: 'membership', id: 'wander', joined: true }),
    { type: 'membership', id: 'wander', joined: true },
  );
  assert.deepEqual(joined.joinedIds, ['other', 'wander']);
  assert.deepEqual(
    workspaceReducer(joined, { type: 'membership', id: 'wander', joined: false }).joinedIds,
    ['other'],
  );
  assert.deepEqual(seed.joinedIds, ['other']);
});
test('folder deletion removes descendants but retains siblings', () => {
  const base = { kind: 'folder' as const, bytes: 0, name: 'Folder', createdAt: '' };
  const seed = {
    ...createDemoWorkspace(),
    files: [
      { ...base, id: 'root' },
      { ...base, id: 'child', parentId: 'root' },
      { ...base, id: 'grandchild', parentId: 'child' },
      { ...base, id: 'sibling' },
    ],
  };
  assert.deepEqual(
    workspaceReducer(seed, { type: 'file-deleted', id: 'root' }).files.map((file) => file.id),
    ['sibling'],
  );
});
test('ending Plus removes the preview entitlement', () =>
  assert.equal(
    workspaceReducer(
      { ...createDemoWorkspace(), demoPlanId: 'annual' },
      { type: 'demo-plan', id: null },
    ).demoPlanId,
    null,
  ));
test('channel submissions require meaningful names and descriptions', () => {
  assert.notEqual(validateChannel(' A ', 'a long description'), null);
  assert.notEqual(validateChannel('My channel', 'short'), null);
  assert.equal(validateChannel('My channel', 'A thoughtful collection of original stories.'), null);
});
test('watch progress cannot be negative', () =>
  assert.equal(
    workspaceReducer(createDemoWorkspace(), { type: 'progress', id: 'video', seconds: -10 })
      .progress.video,
    0,
  ));
