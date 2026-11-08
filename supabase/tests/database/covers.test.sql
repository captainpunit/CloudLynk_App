-- Cover image uploads: who may upload, where, and what they can see afterwards.
-- Uploads are simulated by writing storage.objects rows, which is what the Storage API does.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

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

-- Stores a cover as the current user, the way the Storage API does.
create function tests.upload_cover(p_name text)
returns void
language sql
as $$
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('covers', p_name, auth.uid()::text, '{"size": 1000, "mimetype": "image/jpeg"}');
$$;

-- Path of a cover file inside a user's folder.
create function tests.cover_path(p_name text, p_file text default 'cover.jpg')
returns text
language sql
stable
as $$
  select tests.user_id(p_name) || '/' || p_file;
$$;

select tests.create_user('publisher');
select tests.create_user('admin');
select tests.create_user('member');
select tests.create_user('suspended');
update public.profiles set can_publish = true where id = tests.user_id('publisher');
update public.profiles set role = 'admin' where id = tests.user_id('admin');
update public.profiles set can_publish = true, account_status = 'suspended'
where id = tests.user_id('suspended');

-- Bucket ---------------------------------------------------------------------

select is((select public from storage.buckets where id = 'covers'), true,
  'bucket: covers are public so every viewer can load them');
select is((select file_size_limit from storage.buckets where id = 'covers'), 5::bigint * 1024 * 1024,
  'bucket: covers are limited to 5 MB');
select is((select allowed_mime_types from storage.buckets where id = 'covers'),
  array['image/jpeg', 'image/png', 'image/webp'],
  'bucket: only JPEG, PNG and WebP images are accepted');

-- Who may upload ---------------------------------------------------------------

select tests.act_as('publisher');
select lives_ok(format($$ select tests.upload_cover(%L) $$, tests.cover_path('publisher')),
  'upload: an approved publisher can upload into their own folder');

select tests.act_as('admin');
select lives_ok(format($$ select tests.upload_cover(%L) $$, tests.cover_path('admin')),
  'upload: an admin can upload into their own folder');

select tests.act_as('member');
select throws_ok(format($$ select tests.upload_cover(%L) $$, tests.cover_path('member')),
  '42501', null, 'upload: a member without publishing permission cannot upload');

select tests.act_as('publisher');
select throws_ok(format($$ select tests.upload_cover(%L) $$, tests.cover_path('admin', 'mine.jpg')),
  '42501', null, 'upload: a publisher cannot upload into another user''s folder');
select throws_ok(format($$ select tests.upload_cover(%L) $$, tests.cover_path('publisher', 'nested/cover.jpg')),
  '42501', null, 'upload: covers cannot be nested in subfolders');

select tests.act_as('suspended');
select throws_ok(format($$ select tests.upload_cover(%L) $$, tests.cover_path('suspended')),
  '42501', null, 'upload: a suspended publisher cannot upload');

select tests.act_as('guest');
select throws_ok(format($$ select tests.upload_cover(%L) $$, tests.cover_path('publisher', 'guest.jpg')),
  '42501', null, 'upload: guests cannot upload');

-- After upload -------------------------------------------------------------------

select tests.act_as('publisher');
select is((select count(*) from storage.objects where bucket_id = 'covers'), 1::bigint,
  'read: a publisher sees only their own covers');

with changed as (
  update storage.objects set metadata = '{"size": 1}'
  where bucket_id = 'covers' and name = tests.cover_path('publisher')
  returning 1
)
select is((select count(*) from changed), 0::bigint, 'write: covers cannot be overwritten');

-- The Storage API sets this flag before it deletes; without it every SQL delete is refused.
select set_config('storage.allow_delete_query', 'true', true);
with removed as (
  delete from storage.objects where bucket_id = 'covers' returning 1
)
select is((select count(*) from removed), 0::bigint, 'write: publishers cannot delete covers');
select set_config('storage.allow_delete_query', 'false', true);

reset role;
select is(
  (select owner_id from storage.objects where bucket_id = 'covers' and name = tests.cover_path('publisher')),
  tests.user_id('publisher')::text,
  'erasure: the uploader owns the cover, so account erasure removes it'
);
select is((select count(*) from storage.objects where bucket_id = 'covers'), 2::bigint,
  'covers: both permitted uploads are stored');
select is(
  (select count(*) from public.drive_cleanup_batch(100) d
   where d.storage_path in (tests.cover_path('publisher'), tests.cover_path('admin'))),
  0::bigint,
  'cleanup: the drive cleanup job never removes covers'
);

select * from finish();
rollback;
