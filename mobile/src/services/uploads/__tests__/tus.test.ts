import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blobSource, transferTus } from '../tus';

test('TUS resumes at the acknowledged server offset and never recreates an allocated upload', async () => {
  const source = blobSource(new Blob(['abcdefgh']));
  const requests: string[] = [];
  let offset = 3;
  await transferTus(
    source,
    'https://upload.test/allocated',
    {},
    () => {},
    undefined,
    async (_url, init) => {
      requests.push(init!.method!);
      if (init!.method === 'HEAD')
        return new Response(null, { headers: { 'Upload-Offset': String(offset) } });
      assert.equal(new Headers(init?.headers).get('Upload-Offset'), '3');
      assert.equal(await (init!.body as Blob).text(), 'defgh');
      offset = 8;
      return new Response(null, { status: 204, headers: { 'Upload-Offset': '8' } });
    },
  );
  assert.deepEqual(requests, ['HEAD', 'PATCH', 'HEAD']);
});
test('a lost PATCH response is recovered with HEAD without sending bytes twice', async () => {
  const source = blobSource(new Blob(['test']));
  let offset = 0,
    patches = 0;
  await transferTus(
    source,
    'https://upload.test/allocated',
    {},
    () => {},
    undefined,
    async (_url, init) => {
      if (init!.method === 'HEAD')
        return new Response(null, { headers: { 'Upload-Offset': String(offset) } });
      patches++;
      offset = 4;
      throw new Error('acknowledgement lost');
    },
  );
  assert.equal(patches, 1);
});
test('invalid server offsets fail without sending file data', async () => {
  let patches = 0;
  await assert.rejects(
    transferTus(
      blobSource(new Blob(['test'])),
      'https://upload.test/allocated',
      {},
      () => {},
      undefined,
      async (_url, init) => {
        if (init!.method === 'PATCH') patches++;
        return new Response(null, { headers: { 'Upload-Offset': '900' } });
      },
    ),
    /invalid position/,
  );
  assert.equal(patches, 0);
});
test('pausing aborts before a network request and leaves the allocation resumable', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    transferTus(
      blobSource(new Blob(['test'])),
      'https://upload.test/allocated',
      {},
      () => {},
      controller.signal,
      async () => {
        assert.fail('must not fetch');
      },
    ),
    /Upload paused/,
  );
});

test('a large file is read one chunk at a time, never whole', async () => {
  const size = 20 * 1024 * 1024;
  const reads: [number, number][] = [];
  let offset = 0;
  await transferTus(
    {
      size,
      async read(start, end) {
        // A source that would only pass if it is never asked for more than a chunk.
        assert.ok(end - start <= 6 * 1024 * 1024, `read of ${end - start} bytes`);
        reads.push([start, end]);
        return new Uint8Array(end - start);
      },
    },
    'https://upload.test/allocated',
    {},
    () => {},
    undefined,
    async (_url, init) => {
      if (init!.method === 'HEAD')
        return new Response(null, { headers: { 'Upload-Offset': String(offset) } });
      offset += (init!.body as Uint8Array).length;
      return new Response(null, { status: 204, headers: { 'Upload-Offset': String(offset) } });
    },
  );
  assert.equal(offset, size);
  assert.deepEqual(
    reads.map(([start]) => start),
    [0, 6, 12, 18].map((mb) => mb * 1024 * 1024),
  );
});
