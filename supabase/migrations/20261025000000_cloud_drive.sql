-- Private cloud drive (PRD FR02, PR2).
--
-- Upload flow:
--   1. reserve_drive_upload()  checks name, type, size and quota, and reserves the
--                              bytes atomically by adding a 'pending' files row.
--   2. The app uploads the object to the private 'user-files' bucket at the
--      returned path. Storage policies only accept a path that has a pending,
--      unexpired row owned by the caller, so the app can retry or resume.
--   3. finalize_drive_upload() reads the stored object's real size, checks it
--                              against the reservation and marks the row 'ready'.
--
-- Usage is always computed from the files rows (ready bytes plus unexpired
-- reservations), so there is no counter that can drift. Expired reservations
-- stop counting at once; the drive-cleanup job removes their objects and rows.
--
-- Deleting marks the row 'deleting': it leaves the drive and frees quota at once,
-- and the cleanup job removes the stored object (SQL may not delete storage
-- objects; only the Storage API can).
--
-- Error messages raised here are part of the API contract (docs/api/drive.md).

-- Limits ---------------------------------------------------------------------
-- One row. Placeholder values until the client confirms quotas (WORK_SPLIT.md,
-- "Before work starts"). Change them with an UPDATE; no code change is needed.
-- The largest allowed file is the bucket's file_size_limit (set below), so the
-- storage server and these functions use the same number.

create table public.drive_settings (
  id                     boolean primary key default true check (id),
  free_quota_bytes       bigint not null check (free_quota_bytes >= 0),
  subscriber_quota_bytes bigint not null check (subscriber_quota_bytes >= 0),
  upload_window          interval not null check (upload_window > interval '0'),
  max_pending_uploads    int not null check (max_pending_uploads > 0),
  updated_at             timestamptz not null default now()
);

create trigger drive_settings_set_updated_at
  before update on public.drive_settings
  for each row execute function public.set_updated_at();

insert into public.drive_settings (free_quota_bytes, subscriber_quota_bytes, upload_window, max_pending_uploads)
values (
  15::bigint * 1024 * 1024 * 1024,   -- 15 GiB, the allowance in the existing app README
  100::bigint * 1024 * 1024 * 1024,  -- placeholder until plans are priced (PR3)
  interval '24 hours',               -- time to finish (or resume) one upload
  20
);

-- Private bucket for drive files. Objects live at '<owner id>/<file id>'.
-- Supabase also has a project-wide upload limit (Storage settings); it must be
-- at least this value, and the Free plan caps it at 50 MB.
insert into storage.buckets (id, name, public, file_size_limit)
values ('user-files', 'user-files', false, 2::bigint * 1024 * 1024 * 1024) -- 2 GiB placeholder
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Files ----------------------------------------------------------------------

create table public.files (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 255 and name !~ '[/\\[:cntrl:]]'),
  mime_type    text not null,
  category     text not null check (category in ('image', 'video', 'audio', 'document', 'other')),
  size_bytes   bigint not null check (size_bytes > 0),  -- reserved size; measured size once ready
  storage_path text not null unique,
  status       text not null default 'pending' check (status in ('pending', 'ready', 'deleting')),
  expires_at   timestamptz,                             -- end of the upload window, pending only
  uploaded_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((status = 'pending') = (expires_at is not null))
);

create index files_owner_idx on public.files (owner_id, status, created_at desc);
create index files_pending_expiry_idx on public.files (expires_at) where status = 'pending';
create index files_deleting_idx on public.files (updated_at) where status = 'deleting';

create trigger files_set_updated_at
  before update on public.files
  for each row execute function public.set_updated_at();

-- Search filter used by the drive screen. Derived from the MIME type.
create function public.drive_category(p_mime_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_mime_type like 'image/%' then 'image'
    when p_mime_type like 'video/%' then 'video'
    when p_mime_type like 'audio/%' then 'audio'
    when p_mime_type like 'text/%'
      or p_mime_type in ('application/pdf', 'application/rtf', 'application/msword',
                         'application/vnd.ms-excel', 'application/vnd.ms-powerpoint')
      or p_mime_type like 'application/vnd.openxmlformats-officedocument.%'
      or p_mime_type like 'application/vnd.oasis.opendocument.%' then 'document'
    else 'other'
  end;
$$;

-- Quota and usage ------------------------------------------------------------

-- Quota follows the same subscription rule as premium channels. After a
-- downgrade, existing files stay readable; only new uploads are refused while
-- usage is over the smaller quota (PRD downgrade proposal). Nothing is deleted.
create function public.drive_quota_bytes(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.has_active_subscription(p_user_id)
              then s.subscriber_quota_bytes
              else s.free_quota_bytes end
  from public.drive_settings s;
$$;

create function public.drive_max_file_bytes()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select file_size_limit from storage.buckets where id = 'user-files';
$$;

-- Bytes in ready files, and bytes held by unexpired reservations.
create function public.drive_usage(p_user_id uuid, out used_bytes bigint, out reserved_bytes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(size_bytes) filter (where status = 'ready'), 0)::bigint,
    coalesce(sum(size_bytes) filter (where status = 'pending' and expires_at > now()), 0)::bigint
  from public.files
  where owner_id = p_user_id;
$$;

-- Storage meter for the signed-in user.
create function public.my_drive_usage()
returns table (
  used_bytes     bigint,
  reserved_bytes bigint,
  quota_bytes    bigint,
  max_file_bytes bigint,
  can_upload     boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.used_bytes,
    u.reserved_bytes,
    q.quota_bytes,
    public.drive_max_file_bytes(),
    p.account_status = 'active' and u.used_bytes + u.reserved_bytes < q.quota_bytes
  from public.profiles p
  cross join lateral public.drive_usage(p.id) u
  cross join lateral (select public.drive_quota_bytes(p.id) as quota_bytes) q
  where p.id = auth.uid();
$$;

-- Upload ---------------------------------------------------------------------

create function public.reserve_drive_upload(p_name text, p_mime_type text, p_size_bytes bigint)
returns table (file_id uuid, bucket text, storage_path text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_status   text;
  v_settings public.drive_settings;
  v_name     text := btrim(p_name);
  v_mime     text := lower(btrim(coalesce(nullif(btrim(p_mime_type), ''), 'application/octet-stream')));
  v_usage    record;
  v_pending  int;
  v_file_id  uuid := gen_random_uuid();
  v_path     text;
  v_expires  timestamptz;
begin
  if v_user_id is null then
    raise exception 'sign_in_required' using errcode = '42501';
  end if;

  -- Locking the profile row serializes reservations per user, so two
  -- concurrent uploads cannot both fit into the same free space.
  select account_status into v_status
  from public.profiles
  where id = v_user_id
  for update;

  if v_status is distinct from 'active' then
    raise exception 'account_restricted' using errcode = '42501';
  end if;

  if v_name is null or char_length(v_name) not between 1 and 255 or v_name ~ '[/\\[:cntrl:]]' then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  if v_mime !~ '^[a-z0-9][a-z0-9.+-]*/[a-z0-9][a-z0-9.+-]*$' then
    raise exception 'invalid_type' using errcode = '22023';
  end if;

  if p_size_bytes is null or p_size_bytes <= 0 then
    raise exception 'invalid_size' using errcode = '22023';
  end if;

  if p_size_bytes > public.drive_max_file_bytes() then
    raise exception 'file_too_large' using errcode = '22023';
  end if;

  select * into v_settings from public.drive_settings;

  select count(*) into v_pending
  from public.files f
  where f.owner_id = v_user_id
    and f.status = 'pending'
    and f.expires_at > now();

  if v_pending >= v_settings.max_pending_uploads then
    raise exception 'too_many_uploads' using errcode = 'P0001';
  end if;

  select * into v_usage from public.drive_usage(v_user_id);

  if v_usage.used_bytes + v_usage.reserved_bytes + p_size_bytes > public.drive_quota_bytes(v_user_id) then
    raise exception 'quota_exceeded' using errcode = 'P0001';
  end if;

  v_path := v_user_id || '/' || v_file_id;
  v_expires := now() + v_settings.upload_window;

  insert into public.files (id, owner_id, name, mime_type, category, size_bytes, storage_path, status, expires_at)
  values (v_file_id, v_user_id, v_name, v_mime, public.drive_category(v_mime), p_size_bytes, v_path, 'pending', v_expires);

  return query select v_file_id, 'user-files'::text, v_path, v_expires;
end;
$$;

-- Marks an upload complete after checking the stored object. Calling it again
-- for a ready file returns the same row, so the app can safely retry.
create function public.finalize_drive_upload(p_file_id uuid)
returns public.files
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_file     public.files;
  v_metadata jsonb;
  v_mime     text;
begin
  if v_user_id is null then
    raise exception 'sign_in_required' using errcode = '42501';
  end if;

  -- Same lock order as reserve_drive_upload: profile, then file.
  perform 1 from public.profiles where id = v_user_id for update;

  select * into v_file
  from public.files
  where id = p_file_id
    and owner_id = v_user_id
  for update;

  if not found or v_file.status = 'deleting' then
    raise exception 'file_not_found' using errcode = 'P0002';
  end if;

  if v_file.status = 'ready' then
    return v_file;
  end if;

  if v_file.expires_at <= now() then
    raise exception 'upload_expired' using errcode = 'P0001';
  end if;

  select o.metadata into v_metadata
  from storage.objects o
  where o.bucket_id = 'user-files'
    and o.name = v_file.storage_path;

  if not found then
    raise exception 'upload_incomplete' using errcode = 'P0001';
  end if;

  if (v_metadata ->> 'size')::bigint is distinct from v_file.size_bytes then
    raise exception 'size_mismatch' using errcode = 'P0001';
  end if;

  -- Prefer the type the storage server recorded, if it is a usable one.
  v_mime := lower(coalesce(v_metadata ->> 'mimetype', ''));
  if v_mime !~ '^[a-z0-9][a-z0-9.+-]*/[a-z0-9][a-z0-9.+-]*$' or v_mime = 'application/octet-stream' then
    v_mime := v_file.mime_type;
  end if;

  update public.files
  set status      = 'ready',
      expires_at  = null,
      uploaded_at = now(),
      mime_type   = v_mime,
      category    = public.drive_category(v_mime)
  where id = v_file.id
  returning * into v_file;

  return v_file;
end;
$$;

-- Removes a file (or abandons an upload) for the signed-in owner. The file
-- leaves the drive and frees its quota at once. Idempotent: unknown ids,
-- other users' ids and repeated calls all succeed without changing anything.
create function public.delete_drive_file(p_file_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.files
  set status = 'deleting', expires_at = null
  where id = p_file_id
    and owner_id = auth.uid()
    and status in ('pending', 'ready');
$$;

-- Storage policies -----------------------------------------------------------
-- The app writes objects only to paths it reserved, reads only its own live
-- files, and cannot delete objects (delete_drive_file + cleanup do that).

create function public.drive_can_write_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.files
    where storage_path = p_name
      and owner_id = auth.uid()
      and status = 'pending'
      and expires_at > now()
  );
$$;

create function public.drive_can_read_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.files
    where storage_path = p_name
      and owner_id = auth.uid()
      and status in ('pending', 'ready')
  );
$$;

create policy "drive owners upload reserved files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'user-files' and (select public.drive_can_write_object(name)));

-- Needed to retry or resume an upload to the same path (upsert).
create policy "drive owners replace pending uploads" on storage.objects
  for update to authenticated
  using (bucket_id = 'user-files' and (select public.drive_can_write_object(name)))
  with check (bucket_id = 'user-files' and (select public.drive_can_write_object(name)));

create policy "drive owners read own files" on storage.objects
  for select to authenticated
  using (bucket_id = 'user-files' and (select public.drive_can_read_object(name)));

-- Cleanup (service role only) -----------------------------------------------

-- Returns objects the drive-cleanup job should remove: files being deleted,
-- expired reservations (marked 'deleting' here), and stored objects that no
-- longer have a files row, for example after an account was deleted.
-- file_id is null for those orphans.
create function public.drive_cleanup_batch(p_limit int default 100)
returns table (file_id uuid, storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.files f
  set status = 'deleting', expires_at = null
  where f.id in (
    select p.id
    from public.files p
    where p.status = 'pending'
      and p.expires_at <= now()
    order by p.expires_at
    limit p_limit
    for update skip locked
  );

  return query
  (
    select f.id, f.storage_path
    from public.files f
    where f.status = 'deleting'
    order by f.updated_at
    limit p_limit
  )
  union all
  (
    select null::uuid, o.name
    from storage.objects o
    where o.bucket_id = 'user-files'
      and o.created_at < now() - interval '1 hour'
      and not exists (select 1 from public.files f where f.storage_path = o.name)
    order by o.created_at
    limit p_limit
  );
end;
$$;

-- Called after the Storage API removed the objects. Only rows still marked
-- 'deleting' are removed, so a retry or a second worker changes nothing.
create function public.drive_cleanup_finish(p_file_ids uuid[])
returns int
language sql
security definer
set search_path = ''
as $$
  with removed as (
    delete from public.files
    where id = any (p_file_ids)
      and status = 'deleting'
    returning 1
  )
  select count(*)::int from removed;
$$;

-- Access ---------------------------------------------------------------------

alter table public.drive_settings enable row level security;
alter table public.files enable row level security;

create policy "users read own drive files" on public.files
  for select to authenticated
  using (owner_id = (select auth.uid()) and status in ('pending', 'ready'));

-- Files are written only through the functions above.
revoke all on public.drive_settings from anon, authenticated;
revoke all on public.files from anon, authenticated;
grant select on public.files to authenticated;

revoke all on function public.drive_category(text) from public, anon, authenticated;
revoke all on function public.drive_quota_bytes(uuid) from public, anon, authenticated;
revoke all on function public.drive_max_file_bytes() from public, anon, authenticated;
revoke all on function public.drive_usage(uuid) from public, anon, authenticated;
revoke all on function public.drive_cleanup_batch(int) from public, anon, authenticated;
revoke all on function public.drive_cleanup_finish(uuid[]) from public, anon, authenticated;
grant execute on function public.drive_quota_bytes(uuid) to service_role;
grant execute on function public.drive_usage(uuid) to service_role;
grant execute on function public.drive_cleanup_batch(int) to service_role;
grant execute on function public.drive_cleanup_finish(uuid[]) to service_role;

-- Storage policies run as the caller, so they need these two.
revoke all on function public.drive_can_write_object(text) from public, anon;
revoke all on function public.drive_can_read_object(text) from public, anon;
grant execute on function public.drive_can_write_object(text) to authenticated;
grant execute on function public.drive_can_read_object(text) to authenticated;

revoke all on function public.my_drive_usage() from public, anon;
revoke all on function public.reserve_drive_upload(text, text, bigint) from public, anon;
revoke all on function public.finalize_drive_upload(uuid) from public, anon;
revoke all on function public.delete_drive_file(uuid) from public, anon;
grant execute on function public.my_drive_usage() to authenticated;
grant execute on function public.reserve_drive_upload(text, text, bigint) to authenticated;
grant execute on function public.finalize_drive_upload(uuid) to authenticated;
grant execute on function public.delete_drive_file(uuid) to authenticated;
