import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Workspace } from '../../domain/models';
import { workspaceReducer } from '../workspace-reducer';
import { validateChannel } from '../../domain/format';
// Same shape as emptyLiveWorkspace(); built inline so the test does not load the Supabase client.
const empty: Workspace = {
  version: 1,
  profile: null,
  channels: [],
  videos: [],
  files: [],
  joinedIds: [],
  savedIds: [],
  progress: {},
  noticesRead: true,
};
test('joining is idempotent and leaving retains other memberships', () => {
  const seed = { ...empty, joinedIds: ['other'] };
  const joined = workspaceReducer(
    workspaceReducer(seed, { type: 'membership', id: 'channel', joined: true }),
    { type: 'membership', id: 'channel', joined: true },
  );
  assert.deepEqual(joined.joinedIds, ['other', 'channel']);
  assert.deepEqual(
    workspaceReducer(joined, { type: 'membership', id: 'channel', joined: false }).joinedIds,
    ['other'],
  );
  assert.deepEqual(seed.joinedIds, ['other']);
});
test('saving is idempotent', () => {
  const saved = workspaceReducer(
    workspaceReducer(empty, { type: 'bookmark-set', id: 'title', saved: true }),
    { type: 'bookmark-set', id: 'title', saved: true },
  );
  assert.deepEqual(saved.savedIds, ['title']);
  assert.deepEqual(
    workspaceReducer(saved, { type: 'bookmark-set', id: 'title', saved: false }).savedIds,
    [],
  );
});
test('channel submissions require meaningful names and descriptions', () => {
  assert.notEqual(validateChannel(' A ', 'a long description'), null);
  assert.notEqual(validateChannel('My channel', 'short'), null);
  assert.equal(validateChannel('My channel', 'A thoughtful collection of original stories.'), null);
});
test('watch progress cannot be negative', () =>
  assert.equal(
    workspaceReducer(empty, { type: 'progress', id: 'video', seconds: -10 }).progress.video,
    0,
  ));
