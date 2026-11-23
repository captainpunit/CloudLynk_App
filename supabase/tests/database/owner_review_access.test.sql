begin;
create extension if not exists pgtap with schema extensions;
select plan(8);
create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.uid(p_name text) returns uuid language sql stable security definer as $$
  select id from auth.users where email=p_name||'@review.test';
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

insert into auth.users(id,email) select gen_random_uuid(),name||'@review.test'
  from unnest(array['creator','admin','viewer','suspended_admin']) name;
update public.profiles set role='admin' where id in (tests.uid('admin'),tests.uid('suspended_admin'));
update public.profiles set account_status='suspended' where id=tests.uid('suspended_admin');
-- A published, private, Plus-only channel; the creator has no Plus and is not a member.
with c as (
  insert into public.channels(name,status,is_private,requires_subscription,created_by)
  values ('Creator only','published',true,true,tests.uid('creator')) returning id)
insert into tests.ids select 'channel', id from c;
with t as (
  insert into public.titles(channel_id,owner_id,kind,name,min_age,status)
  values ((select id from tests.ids where label='channel'),tests.uid('creator'),'movie','Waiting for review',18,'pending_review') returning id)
insert into tests.ids select 'pending', id from t;
insert into public.stream_assets(title_id,stream_uid,state,duration_seconds)
  values ((select id from tests.ids where label='pending'),'55555555555555555555555555555555','ready',600);

select tests.act('creator');
select is(public.my_access('watch',(select id from tests.ids where label='channel')),'allowed',
  'the owner can watch their own private Plus channel without Plus');
select tests.act('viewer');
select is(public.my_access('watch',(select id from tests.ids where label='channel')),'private_channel',
  'other members still need an invitation');
select tests.act('admin');
select isnt(public.my_access('join',(select id from tests.ids where label='channel')),'allowed',
  'administrators get no general viewing bypass');

reset role;
select lives_ok($$select * from public.playback_grant(tests.uid('admin'),(select id from tests.ids where label='pending'))$$,
  'an administrator can play a title before approving it');
select lives_ok($$select * from public.playback_grant(tests.uid('creator'),(select id from tests.ids where label='pending'))$$,
  'the creator can preview their own upload');
select throws_ok($$select * from public.playback_grant(tests.uid('viewer'),(select id from tests.ids where label='pending'))$$,
  '42501','title_unavailable','members cannot play a title in review');
select throws_ok($$select * from public.playback_grant(tests.uid('suspended_admin'),(select id from tests.ids where label='pending'))$$,
  '42501','title_unavailable','a suspended administrator cannot preview');
select ok((select expires_at>now()+interval '30 minutes' from public.playback_grant(tests.uid('admin'),(select id from tests.ids where label='pending'))),
  'a preview is not cut short by the reviewer''s own Plus');

select * from finish();
rollback;
