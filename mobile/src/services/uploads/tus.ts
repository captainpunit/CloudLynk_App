/**
 * A file being uploaded. `read` returns only the bytes asked for: a video can be several
 * gigabytes, and reading the whole file for every chunk froze or crashed the app.
 */
export interface UploadSource {
  size: number;
  read(start: number, end: number): Promise<Blob | Uint8Array<ArrayBuffer>>;
  /** Releases the open file, if any. */
  close?(): void;
}

/** A browser file, or any Blob. Slicing a Blob reads nothing until it is sent. */
export function blobSource(blob: Blob): UploadSource {
  return { size: blob.size, read: async (start, end) => blob.slice(start, end) };
}
/** Thrown for a 401/403, so the caller can sign in again and carry on. */
class Unauthorized extends Error {}

/**
 * Sends a file with the tus resumable protocol, one chunk at a time.
 *
 * `headers` may be a function so each request carries a current sign-in token: a large
 * upload outlives the token it started with. When the server refuses the token, `reauth`
 * refreshes it and the transfer continues; that does not count as a failure.
 */
export async function transferTus(
  source: UploadSource,
  url: string,
  headers: Record<string, string> | (() => Promise<Record<string, string>>),
  progress: (fraction: number) => void,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
  reauth?: () => Promise<void>,
) {
  const chunkSize = 6 * 1024 * 1024;
  const current = typeof headers === 'function' ? headers : async () => headers;
  let failures = 0;
  let reauths = 0;
  while (true) {
    if (signal?.aborted) throw new Error('Upload paused. Select the same file to resume.');
    try {
      const head = await request(url, {
        method: 'HEAD',
        headers: { ...(await current()), 'Tus-Resumable': '1.0.0' },
        signal,
      });
      if (head.status === 401 || head.status === 403) throw new Unauthorized();
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
          ...(await current()),
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        body: await source.read(offset, end),
        signal,
      });
      if (response.status === 401 || response.status === 403) throw new Unauthorized();
      if (!response.ok) throw new Error('Upload interrupted. Select the same file to retry.');
      const next = Number(response.headers.get('Upload-Offset'));
      if (next !== end) throw new Error('The upload position could not be confirmed.');
      failures = 0;
      progress(next / source.size);
    } catch (error) {
      if (signal?.aborted) throw new Error('Upload paused. Select the same file to resume.');
      if (error instanceof Unauthorized && reauth && reauths < 3) {
        reauths += 1;
        await reauth();
        continue;
      }
      if (error instanceof Unauthorized)
        throw new Error('Your session ended. Sign in again, then select the same file to resume.');
      if (++failures >= 3) throw error;
      // HEAD before every retry recovers a PATCH whose acknowledgement was lost.
    }
  }
}
