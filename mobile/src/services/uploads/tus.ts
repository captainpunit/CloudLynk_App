export interface UploadSource {
  size: number;
  slice(start: number, end: number): Blob;
}
export async function transferTus(
  source: UploadSource,
  url: string,
  headers: Record<string, string>,
  progress: (fraction: number) => void,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
) {
  const chunkSize = 6 * 1024 * 1024;
  let failures = 0;
  while (true) {
    if (signal?.aborted) throw new Error('Upload paused. Select the same file to resume.');
    try {
      const head = await request(url, {
        method: 'HEAD',
        headers: { ...headers, 'Tus-Resumable': '1.0.0' },
        signal,
      });
      if (!head.ok) throw new Error('The upload could not resume. Please retry.');
      const rawOffset = head.headers.get('Upload-Offset');
      const offset = Number(rawOffset);
      if (
        rawOffset === null ||
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        offset > source.size
      ) {
        throw new Error('The upload returned an invalid position.');
      }
      progress(offset / source.size);
      if (offset === source.size) return;
      const end = Math.min(offset + chunkSize, source.size);
      const response = await request(url, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        body: source.slice(offset, end),
        signal,
      });
      if (!response.ok) throw new Error('Upload interrupted. Select the same file to retry.');
      const next = Number(response.headers.get('Upload-Offset'));
      if (next !== end) throw new Error('The upload position could not be confirmed.');
      failures = 0;
      progress(next / source.size);
    } catch (error) {
      if (signal?.aborted || ++failures >= 3) throw error;
      // HEAD before every retry recovers a PATCH whose acknowledgement was lost.
    }
  }
}
