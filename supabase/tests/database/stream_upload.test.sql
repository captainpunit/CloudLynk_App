begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.uid(p_name text) returns uuid language sql stable security definer as $$
  select id from auth.users where email=p_name||'@upload.test';
$$;
create function tests.act(p_name text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',json_build_object('sub',tests.uid(p_name),'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
end; $$;
create table tests.ids(label text primary key, id uuid);
grant all on tests.ids to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users(id,email) values (gen_random_uuid(),'creator@upload.test');
update public.profiles set can_publish=true where id=tests.uid('creator');
with c as (
  insert into public.channels(name,status,created_by) values ('Uploads','published',tests.uid('creator')) returning id)
insert into tests.ids select 'channel', id from c;
with t as (
  insert into public.titles(channel_id,owner_id,kind,name,min_age,status)
  values ((select id from tests.ids where label='channel'),tests.uid('creator'),'movie','First cut',0,'draft') returning id)
insert into tests.ids select 'title', id from t;

-- A 1000-byte video is allocated and starts uploading.
insert into tests.ids values('asset',(public.reserve_stream_upload(tests.uid('creator'),(select id from tests.ids where label='title'),1000)).id);
select public.bind_stream_upload((select id from tests.ids where label='asset'),
  (select lease_id from public.stream_assets where id=(select id from tests.ids where label='asset')),
  '66666666666666666666666666666666','https://upload.videodelivery.net/b',now()+interval '6 hours',1000);

select is((public.reserve_stream_upload(tests.uid('creator'),(select id from tests.ids where label='title'),1000)).upload_url,
  'https://upload.videodelivery.net/b','the same file resumes its upload');
select throws_ok($$select public.reserve_stream_upload(tests.uid('creator'),(select id from tests.ids where label='title'),2000)$$,
  'P0001','different_file','a different file never reuses an upload sized for another');
select is((public.reserve_stream_upload(tests.uid('creator'),(select id from tests.ids where label='title'))).upload_url,
  'https://upload.videodelivery.net/b','callers that do not send a size still resume');

select tests.act('creator');
select lives_ok($$select public.reset_stream_upload((select id from tests.ids where label='title'))$$,
  'the creator can replace an upload that is still running');
reset role;
select is((select count(*) from public.stream_assets where title_id=(select id from tests.ids where label='title')),
  0::bigint,'the unfinished upload is removed');
select is((select count(*) from public.stream_deletion_queue where stream_uid='66666666666666666666666666666666'),
  1::bigint,'and its provider video is queued for deletion');

select * from finish();
rollback;
