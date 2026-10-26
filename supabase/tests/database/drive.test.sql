-- PR2 completion gate: quota reservation, upload finalize, ownership, delete
-- and cleanup for the private drive. Uploads are simulated by writing
-- storage.objects rows, which is what the Storage API does.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(58);

-- Helpers --------------------------------------------------------------------

create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.create_user(p_name text)
returns uuid
language sql
as $$
  insert into auth.users (id, email)
  values (gen_random_uuid(), p_name || '@test.local')
  returning id;
$$;

create function tests.user_id(p_name text)
returns uuid
language sql
stable
security definer
as $$
  select id from auth.users where email = p_name || '@test.local';
$$;

create function tests.act_as(p_name text)
returns void
language plpgsql
as $$
begin
  reset role;
  if p_name = 'guest' then
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    perform set_config('role', 'anon', true);
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', tests.user_id(p_name), 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end;
$$;

-- Reserves as the current user and returns the new file id.
create function tests.reserve(p_name text, p_size bigint, p_mime text default 'image/png')
returns uuid
language sql
as $$
  select file_id from public.reserve_drive_upload(p_name, p_mime, p_size);
$$;

-- Read-only view of every file row (bypasses RLS), for checks and paths.
create view tests.files_admin as select * from public.files;
grant select on tests.files_admin to authenticated;

-- Simulates the Storage API storing an object as the current user.
create function tests.upload(p_file_id uuid, p_size bigint, p_mime text default 'image/png')
returns void
language sql
as $$
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  select 'user-files', storage_path, auth.uid()::text,
         jsonb_build_object('size', p_size, 'mimetype', p_mime)
  from tests.files_admin
  where id = p_file_id;
$$;

create function tests.status(p_file_id uuid)
returns text
language sql
stable
security definer
as $$
  select coalesce((select status from public.files where id = p_file_id), 'gone');
$$;

create table tests.ids (label text primary key, id uuid);
grant all on tests.ids to authenticated;

-- Fixtures -------------------------------------------------------------------

do $$
begin
  perform tests.create_user(name)
  from unnest(array['alice', 'bob', 'subscriber', 'suspended', 'downgraded']) as name;

  insert into public.subscriptions (user_id, product_id, purchase_token, status, paid_until)
  values (tests.user_id('subscriber'), 'premium_monthly', 'token-subscriber', 'active', now() + interval '30 days');

  update public.profiles set account_status = 'suspended' where id = tests.user_id('suspended');

  -- Small numbers keep the arithmetic readable.
  update public.drive_settings
  set free_quota_bytes = 1000, subscriber_quota_bytes = 5000, max_pending_uploads = 3;
  update storage.buckets set file_size_limit = 2000 where id = 'user-files';
end;
$$;

-- Bucket ---------------------------------------------------------------------

select is((select public from storage.buckets where id = 'user-files'), false, 'user-files bucket is private');

-- Storage meter ----------------------------------------------------------------

select tests.act_as('alice');

select results_eq(
  'select used_bytes, reserved_bytes, quota_bytes, max_file_bytes, can_upload from public.my_drive_usage()',
  $$ values (0::bigint, 0::bigint, 1000::bigint, 2000::bigint, true) $$,
  'free user: empty drive with the free quota'
);

select tests.act_as('subscriber');
select is((select quota_bytes from public.my_drive_usage()), 5000::bigint, 'subscriber: gets the subscriber quota');

-- Validation -----------------------------------------------------------------

select tests.act_as('alice');

select throws_ok($$ select tests.reserve('a/b.png', 10) $$, '22023', 'invalid_name', 'name with a slash is rejected');
select throws_ok($$ select tests.reserve('   ', 10) $$, '22023', 'invalid_name', 'blank name is rejected');
select throws_ok($$ select tests.reserve(E'bad\nname', 10) $$, '22023', 'invalid_name', 'control characters are rejected');
select throws_ok($$ select tests.reserve(repeat('x', 256), 10) $$, '22023', 'invalid_name', 'names over 255 characters are rejected');
select throws_ok($$ select tests.reserve('a.png', 10, 'not a type') $$, '22023', 'invalid_type', 'malformed MIME type is rejected');
select throws_ok($$ select tests.reserve('a.png', 0) $$, '22023', 'invalid_size', 'zero size is rejected');
select throws_ok($$ select tests.reserve('a.png', 2001) $$, '22023', 'file_too_large', 'file over the bucket limit is rejected');

-- Reserve and upload ---------------------------------------------------------

insert into tests.ids select 'photo', tests.reserve('  Photo 1.png ', 600);

select is(
  (select storage_path from tests.files_admin where id = (select id from tests.ids where label = 'photo')),
  tests.user_id('alice') || '/' || (select id from tests.ids where label = 'photo'),
  'reserve: object path is <owner id>/<file id>'
);
select is(
  (select name from public.files where id = (select id from tests.ids where label = 'photo')),
  'Photo 1.png',
  'reserve: name is trimmed and the pending file is visible to its owner'
);
select results_eq(
  'select used_bytes, reserved_bytes, can_upload from public.my_drive_usage()',
  $$ values (0::bigint, 600::bigint, true) $$,
  'reserve: bytes count as reserved'
);
select throws_ok($$ select tests.reserve('big.png', 401) $$, 'P0001', 'quota_exceeded',
  'reserve: a second upload cannot use reserved space');

select throws_ok(
  format('select public.finalize_drive_upload(%L)', (select id from tests.ids where label = 'photo')),
  'P0001', 'upload_incomplete', 'finalize: fails before the object is stored'
);

select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('user-files', %L) $$,
    tests.user_id('alice') || '/' || gen_random_uuid()),
  '42501', null, 'storage: cannot upload to a path that was not reserved'
);

select tests.act_as('bob');
select throws_ok(
  format($$ select tests.upload(%L, 600) $$, (select id from tests.ids where label = 'photo')),
  '42501', null, 'storage: cannot upload to another user''s reservation'
);

select tests.act_as('alice');
select lives_ok(
  format($$ select tests.upload(%L, 500) $$, (select id from tests.ids where label = 'photo')),
  'storage: owner uploads to the reserved path'
);
select throws_ok(
  format('select public.finalize_drive_upload(%L)', (select id from tests.ids where label = 'photo')),
  'P0001', 'size_mismatch', 'finalize: stored size must match the reservation'
);

select lives_ok(
  format($$ update storage.objects set metadata = '{"size": 600, "mimetype": "image/png"}'
            where bucket_id = 'user-files' and name = %L $$,
    (select storage_path from tests.files_admin where id = (select id from tests.ids where label = 'photo'))),
  'storage: owner can replace a pending upload (retry)'
);

select is(
  (select status from public.finalize_drive_upload((select id from tests.ids where label = 'photo'))),
  'ready', 'finalize: marks the file ready'
);
select is(
  (select status || ' ' || category || ' ' || size_bytes from public.finalize_drive_upload((select id from tests.ids where label = 'photo'))),
  'ready image 600', 'finalize: calling it again returns the same file'
);
select results_eq(
  'select used_bytes, reserved_bytes from public.my_drive_usage()',
  $$ values (600::bigint, 0::bigint) $$,
  'finalize: reserved bytes become used bytes'
);
select is((select count(*) from storage.objects where bucket_id = 'user-files'), 1::bigint,
  'storage: owner can read own object');

update storage.objects set metadata = '{"size": 1}'
where bucket_id = 'user-files'
  and name = (select storage_path from tests.files_admin where id = (select id from tests.ids where label = 'photo'));
select is(
  (select metadata ->> 'size' from storage.objects where bucket_id = 'user-files'),
  '600', 'storage: a ready file cannot be overwritten'
);

-- Document category, and the MIME type the storage server recorded wins.
insert into tests.ids select 'doc', tests.reserve('notes.pdf', 100, 'application/octet-stream');
select tests.upload((select id from tests.ids where label = 'doc'), 100, 'application/pdf');
select is(
  (select category from public.finalize_drive_upload((select id from tests.ids where label = 'doc'))),
  'document', 'finalize: category comes from the stored MIME type'
);

-- Ownership ------------------------------------------------------------------

select tests.act_as('bob');

select is((select count(*) from public.files), 0::bigint, 'other user: cannot list alice''s files');
select is((select count(*) from storage.objects where bucket_id = 'user-files'), 0::bigint,
  'other user: cannot read alice''s objects (no download URL)');
select throws_ok(
  format('select public.finalize_drive_upload(%L)', (select id from tests.ids where label = 'photo')),
  'P0002', 'file_not_found', 'other user: cannot finalize alice''s file'
);
select lives_ok(
  format('select public.delete_drive_file(%L)', (select id from tests.ids where label = 'photo')),
  'other user: delete call succeeds but does nothing'
);
select is(tests.status((select id from tests.ids where label = 'photo')), 'ready', 'other user: alice''s file is untouched');

-- Direct writes are blocked.
select throws_ok(
  $$ insert into public.files (owner_id, name, mime_type, category, size_bytes, storage_path, status)
     values (auth.uid(), 'x', 'image/png', 'image', 1, 'x', 'ready') $$,
  '42501', null, 'files: cannot insert rows directly'
);
select tests.act_as('alice');
select throws_ok(
  $$ update public.files set size_bytes = 1 $$,
  '42501', null, 'files: owner cannot change size or status directly'
);
select throws_ok(
  $$ update public.drive_settings set free_quota_bytes = 999999999 $$,
  '42501', null, 'settings: users cannot raise their quota'
);
select throws_ok(
  format('select public.drive_usage(%L)', tests.user_id('bob')),
  '42501', null, 'usage: users cannot read other users'' usage'
);

-- Pending limit and expiry ---------------------------------------------------

insert into tests.ids select 'p1', tests.reserve('p1.png', 10);
insert into tests.ids select 'p2', tests.reserve('p2.png', 10);
insert into tests.ids select 'p3', tests.reserve('p3.png', 10);
select throws_ok($$ select tests.reserve('p4.png', 10) $$, 'P0001', 'too_many_uploads',
  'reserve: at most max_pending_uploads unfinished uploads');

reset role;
update public.files set expires_at = now() - interval '1 minute'
where id in (select id from tests.ids where label in ('p1', 'p2', 'p3'));
select tests.act_as('alice');

select is((select reserved_bytes from public.my_drive_usage()), 0::bigint, 'expiry: expired reservations stop counting');
select lives_ok($$ select tests.reserve('p4.png', 10) $$, 'expiry: expired reservations free the pending slots');
select throws_ok(
  format('select public.finalize_drive_upload(%L)', (select id from tests.ids where label = 'p1')),
  'P0001', 'upload_expired', 'expiry: an expired upload cannot be finalized'
);
select throws_ok(
  format($$ select tests.upload(%L, 10) $$, (select id from tests.ids where label = 'p2')),
  '42501', null, 'expiry: storage refuses uploads to an expired reservation'
);

-- Delete ---------------------------------------------------------------------

select lives_ok(
  format('select public.delete_drive_file(%L)', (select id from tests.ids where label = 'photo')),
  'delete: owner deletes a file'
);
select lives_ok(
  format('select public.delete_drive_file(%L)', (select id from tests.ids where label = 'photo')),
  'delete: deleting twice succeeds'
);
select is(
  (select count(*) from public.files where id = (select id from tests.ids where label = 'photo')),
  0::bigint, 'delete: file leaves the drive at once'
);
select is((select used_bytes from public.my_drive_usage()), 100::bigint, 'delete: quota is freed at once');
select is(
  (select count(*) from storage.objects
   where name = (select storage_path from tests.files_admin where id = (select id from tests.ids where label = 'photo'))),
  0::bigint, 'delete: object can no longer be read or downloaded'
);

-- Cleanup job ----------------------------------------------------------------

reset role;

-- An object with no files row, as left behind by a deleted account.
insert into storage.objects (bucket_id, name, metadata, created_at)
values ('user-files', 'orphan/object', '{"size": 5}', now() - interval '2 days');

create temp table batch as select * from public.drive_cleanup_batch(100);

select is(
  (select count(*) from batch where file_id is not null), 4::bigint,
  'cleanup: returns the deleted file and the three expired uploads'
);
select is(
  (select count(*) from batch where file_id is null and storage_path = 'orphan/object'), 1::bigint,
  'cleanup: returns orphaned objects without a file id'
);
select is(tests.status((select id from tests.ids where label = 'p1')), 'deleting', 'cleanup: expired uploads are marked deleting');
select is(tests.status((select id from tests.ids where label = 'doc')), 'ready', 'cleanup: ready files are left alone');
select is(
  public.drive_cleanup_finish(array(select file_id from batch where file_id is not null)),
  4, 'cleanup: finish removes the rows'
);
select is(
  public.drive_cleanup_finish(array(select file_id from batch where file_id is not null)),
  0, 'cleanup: finishing twice removes nothing more'
);

set local role authenticated;
select throws_ok($$ select * from public.drive_cleanup_batch(10) $$, '42501', null, 'cleanup: app users cannot call it');
reset role;

-- Account standing, guests, downgrade ----------------------------------------

select tests.act_as('suspended');
select throws_ok($$ select tests.reserve('a.png', 10) $$, '42501', 'account_restricted', 'suspended: cannot upload');
select is((select can_upload from public.my_drive_usage()), false, 'suspended: storage meter says uploads are off');

select tests.act_as('guest');
select throws_ok($$ select public.reserve_drive_upload('a.png', 'image/png', 10) $$, '42501', null, 'guest: cannot upload');

-- A subscriber with 3000 bytes stored whose plan ends keeps the files but
-- cannot upload more while over the free quota.
reset role;
insert into public.files (owner_id, name, mime_type, category, size_bytes, storage_path, status, uploaded_at)
values (tests.user_id('downgraded'), 'old.mp4', 'video/mp4', 'video', 3000, 'downgraded/old', 'ready', now());

select tests.act_as('downgraded');
select is((select count(*) from public.files), 1::bigint, 'downgrade: existing files stay listed');
select is((select can_upload from public.my_drive_usage()), false, 'downgrade: uploads are off while over quota');
select throws_ok($$ select tests.reserve('new.png', 10) $$, 'P0001', 'quota_exceeded', 'downgrade: new uploads are refused');

select * from finish();
rollback;
