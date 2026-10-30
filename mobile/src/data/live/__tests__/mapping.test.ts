import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Tables } from '@/lib/database.types';
import { mapChannel, mapFile, mapTitle, readPages } from '../mapping';

test('live channel mapping preserves private visibility, ownership and draft state', () => {
  const channel = mapChannel({
    id: 'channel',
    name: 'Private',
    description: '',
    is_private: true,
    requires_subscription: true,
    status: 'draft',
    category: 'Films',
    cover_url: null,
    created_by: 'owner',
  } as Tables<'channels'>);
  assert.equal(channel.visibility, 'private');
  assert.equal(channel.status, 'pending');
  assert.equal(channel.ownerId, 'owner');
  assert.equal(channel.cover, '');
});
test('live title mapping preserves episode hierarchy without public sample playback', () => {
  const title = mapTitle({
    id: 'episode',
    channel_id: 'channel',
    name: 'Episode',
    description: '',
    kind: 'episode',
    season_id: 'season',
    episode_number: 2,
    created_at: '2026-10-01',
    cover_url: null,
  } as Tables<'titles'>);
  assert.equal(title.seasonId, 'season');
  assert.equal(title.episodeNumber, 2);
  assert.equal(title.demoUri, undefined);
  assert.equal(title.cover, '');
});
test('private drive files retain server paths and pending status without local sample URIs', () => {
  const file = mapFile({
    id: 'file',
    name: 'Audio',
    category: 'audio',
    size_bytes: 10,
    storage_path: 'owner/file',
    mime_type: 'audio/mpeg',
    status: 'pending',
  } as Tables<'files'>);
  assert.equal(file.storagePath, 'owner/file');
  assert.equal(file.status, 'pending');
  assert.equal(file.uri, undefined);
});
test('pagination reads all pages instead of silently truncating the catalogue', async () => {
  const data = Array.from({ length: 450 }, (_, index) => index);
  const pages: number[] = [];
  const rows = await readPages(async (from, to) => {
    pages.push(from);
    return { data: data.slice(from, to + 1), error: null };
  });
  assert.deepEqual(rows, data);
  assert.deepEqual(pages, [0, 200, 400]);
});
test('a failed page does not become a successful partial catalogue', async () => {
  await assert.rejects(
    readPages(async () => ({ data: null, error: { message: 'network' } })),
    /Could not load/,
  );
});
