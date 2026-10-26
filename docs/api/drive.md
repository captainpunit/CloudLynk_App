# Cloud drive: meter, upload, list, download, delete

PRD: PR2 (FR02). Status: **implemented** (migration `20261025000000_cloud_drive.sql`,
function `drive-cleanup`). Tests: `supabase/tests/database/drive.test.sql`.

Every call uses the normal Supabase client (`@/lib/supabase`) with the user's
session. The app never sends sizes it has not measured, never picks a storage
path, and never writes the `files` table directly. The server measures the
stored object and decides what counts against the quota.

Files live in the private bucket `user-files` at `<user id>/<file id>`. The
path comes from the server; do not build it in the app.

## Errors

Every drive call that can fail returns a PostgREST error whose `error.message`
is one of these strings. Treat the list as a closed set; a new value is a
contract change.

| `error.message` | From | Meaning | What the app shows |
| --- | --- | --- | --- |
| `account_restricted` | reserve | Account suspended or banned | "Account restricted, contact support" |
| `invalid_name` | reserve | Empty after trimming, over 255 characters, or has `/`, `\` or control characters | Ask for another name |
| `invalid_type` | reserve | MIME type is not `type/subtype` | Send `application/octet-stream` if unknown |
| `invalid_size` | reserve | Size is 0 or missing | Do not upload empty files |
| `file_too_large` | reserve | Over `max_file_bytes` | "Files up to X" (from the meter) |
| `quota_exceeded` | reserve | Not enough free space (unfinished uploads count) | Storage full, link to Plans |
| `too_many_uploads` | reserve | 20 unfinished uploads already | Finish or cancel some first |
| `upload_incomplete` | finalize | No stored object yet | Upload again, then finalize |
| `size_mismatch` | finalize | Stored size is not the reserved size | Upload again with `upsert: true` |
| `upload_expired` | finalize | Upload window (24 h) passed | Start again with a new reserve |
| `file_not_found` | finalize | Not yours, unknown, or deleted | Remove it from the list |

Signed-out callers get a permission error (`42501`) on every call.

## `my_drive_usage` (RPC): storage meter

```ts
const { data, error } = await supabase.rpc("my_drive_usage").single();
```

```json
{
  "used_bytes": 7340132,
  "reserved_bytes": 0,
  "quota_bytes": 16106127360,
  "max_file_bytes": 2147483648,
  "can_upload": true
}
```

| Field | Meaning |
| --- | --- |
| `used_bytes` | Bytes in finished files |
| `reserved_bytes` | Bytes held by unfinished uploads (count against the quota until finished, cancelled or expired) |
| `quota_bytes` | Free quota, or the subscriber quota while a subscription is paid |
| `max_file_bytes` | Largest single file |
| `can_upload` | `false` when the account is restricted or the drive is full |

After a plan ends, files stay readable and downloadable. If usage is over the
free quota, `can_upload` is `false` and new uploads get `quota_exceeded`.
Nothing is deleted.

## Upload: reserve, transfer, finalize

### 1. `reserve_drive_upload` (RPC)

```ts
const { data, error } = await supabase
  .rpc("reserve_drive_upload", {
    p_name: "Holiday.jpg",          // shown in the drive, trimmed by the server
    p_mime_type: "image/jpeg",      // "application/octet-stream" if unknown
    p_size_bytes: 2483112,          // exact byte size of the file
  })
  .single();
```

```json
{
  "file_id": "6f1c2c1e-6a3e-4d0f-9a7b-1d2a8f0c9e11",
  "bucket": "user-files",
  "storage_path": "9b2e.../6f1c2c1e-6a3e-4d0f-9a7b-1d2a8f0c9e11",
  "expires_at": "2026-10-26T14:00:00+00:00"
}
```

The bytes are reserved at once, so parallel uploads cannot overfill the drive.
Keep `file_id` and `storage_path` in local retry state until finalize succeeds.

### 2. Transfer the file

Upload to exactly `bucket` / `storage_path`, before `expires_at`. Storage
refuses any other path.

Small files (up to 6 MB):

```ts
await supabase.storage
  .from(bucket)
  .upload(storage_path, fileBody, { contentType: mime, upsert: true });
```

Larger files: resumable upload (TUS, `tus-js-client`), which can continue
after the app is backgrounded or the network drops:

```ts
new tus.Upload(file, {
  endpoint: `${env.supabaseUrl}/storage/v1/upload/resumable`,
  headers: { authorization: `Bearer ${session.access_token}`, "x-upsert": "true" },
  uploadDataDuringCreation: true,
  removeFingerprintOnSuccess: true,
  metadata: { bucketName: bucket, objectName: storage_path, contentType: mime, cacheControl: "3600" },
  chunkSize: 6 * 1024 * 1024,     // must be 6 MB for Supabase
  onProgress: (sent, total) => setProgress(sent / total),
  onError, onSuccess,
}).start();
```

Retrying the same path with `upsert: true` (or `x-upsert: true`) is allowed
until the file is finalized.

### 3. `finalize_drive_upload` (RPC)

```ts
const { data: file, error } = await supabase.rpc("finalize_drive_upload", { p_file_id: file_id });
```

Returns the finished file row (same shape as the list below, `status: "ready"`).
The server reads the stored object's size and type, so the category may change
from what the reserve call guessed (for example `application/octet-stream`
stored as a PDF becomes `document`). Calling it again for a finished file
returns the same row, so it is safe to retry after a timeout.

### Cancel an upload

Call `delete_drive_file` with the `file_id`. The reservation is released at once.

## List and search

`files` is a normal table read. Signed-in users see only their own rows.

```ts
const { data, error } = await supabase
  .from("files")
  .select("id, name, mime_type, category, size_bytes, created_at, uploaded_at")
  .eq("status", "ready")
  .eq("category", "image")              // optional filter
  .ilike("name", `%${query}%`)          // optional search
  .order("created_at", { ascending: false })
  .range(page * 50, page * 50 + 49);    // 50 per page
```

```json
[
  {
    "id": "6f1c2c1e-6a3e-4d0f-9a7b-1d2a8f0c9e11",
    "name": "Holiday.jpg",
    "mime_type": "image/jpeg",
    "category": "image",
    "size_bytes": 2483112,
    "created_at": "2026-10-25T14:00:00+00:00",
    "uploaded_at": "2026-10-25T14:00:09+00:00"
  }
]
```

| Column | Values |
| --- | --- |
| `category` | `image`, `video`, `audio`, `document`, `other` (from the MIME type) |
| `status` | `pending` (unfinished upload, still yours to retry or cancel) or `ready` |

To show unfinished uploads after an app restart, read rows with
`status = "pending"` and `expires_at` in the future.

Folders are not in this contract. The drive is a flat list with category and
name search, as in the PRD. Folders would be a contract change.

## Download

```ts
const { data, error } = await supabase.storage
  .from("user-files")
  .createSignedUrl(file.storage_path, 60, { download: file.name });
// data.signedUrl: open or download it within 60 seconds
```

Select `storage_path` in the list query when you need it. Only the owner gets a
URL; anyone else gets `Object not found`. A deleted file can no longer get a URL.

## `delete_drive_file` (RPC)

```ts
const { error } = await supabase.rpc("delete_drive_file", { p_file_id: file.id });
```

Always succeeds for a signed-in user (also for unknown ids or a second call).
The file leaves the list and frees its quota at once. The stored object is
removed by the cleanup job within minutes.

## Mock for the app

Until the backend is deployed, mock these calls in `mobile/src/services/` with
the JSON above. Use the error strings from the table to test each state.

## For server code (Member 1)

| What | Where |
| --- | --- |
| Quotas, upload window, pending limit | `drive_settings` (one row). `update public.drive_settings set free_quota_bytes = ...` |
| Largest file | `storage.buckets.file_size_limit` for `user-files`. The project-wide upload limit (Dashboard, Storage settings) must be at least as large. The Free plan caps it at 50 MB. |
| Quota rule | `drive_quota_bytes(user_id)` uses `has_active_subscription`, so it follows PR3 automatically. |
| Cleanup | `drive-cleanup` edge function, header `x-cron-secret: $CRON_SECRET`. Removes objects of deleted files, expired uploads, and objects with no row (for example after account deletion). |

Schedule the cleanup every 10 minutes (SQL editor, after enabling the
`pg_cron` and `pg_net` extensions; store the secret in Vault first):

```sql
select vault.create_secret('<CRON_SECRET value>', 'cron_secret');

select cron.schedule('drive-cleanup', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/drive-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    )
  );
$$);
```
