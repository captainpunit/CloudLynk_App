begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.uid(p_name text) returns uuid language sql stable security definer as $$
  select id from auth.users where email=p_name||'@creator.test';
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

insert into auth.users(id,email) select gen_random_uuid(),name||'@creator.test'
  from unnest(array['admin','hopeful','creator','viewer']) name;
update public.profiles set role='admin' where id=tests.uid('admin');
update public.profiles set can_publish=true where id=tests.uid('creator');
with c as (
  insert into public.channels(name,status,created_by) values ('Cooking','published',tests.uid('creator')) returning id)
insert into tests.ids select 'channel', id from c;
with t as (
  insert into public.titles(channel_id,owner_id,kind,name,min_age,status)
  values ((select id from tests.ids where label='channel'),tests.uid('creator'),'movie','Dal makhani',0,'pending_review') returning id)
insert into tests.ids select 'title', id from t;

-- 1. Asking for creator access.
select tests.act('hopeful');
select lives_ok($$select public.request_creator_access('I make home cooking videos every week.')$$,
  'a member can ask for creator access');
select lives_ok($$select public.request_creator_access('I make home cooking videos, now in Hindi too.')$$,
  'asking again updates the open request');
select is((select count(*) from public.creator_applications where user_id=auth.uid()),1::bigint,
  'one open request per member');
select tests.act('creator');
select throws_ok($$select public.request_creator_access('I already publish videos here.')$$,
  'P0001','already_creator','creators do not need to ask');
select tests.act('viewer');
select is((select count(*) from public.creator_applications),0::bigint,'members cannot read other requests');

select tests.act('admin');
select public.moderate_content('publisher',tests.uid('hopeful'),'grant');
reset role;
select is((select status from public.creator_applications where user_id=tests.uid('hopeful')),'approved',
  'granting publishing approves the request');
select is((select count(*) from public.notices where user_id=tests.uid('hopeful') and title='You can now publish'),1::bigint,
  'and tells the member');

-- 2. Review outcomes reach the creator, with the reason.
select tests.act('admin');
select public.moderate_content('title',(select id from tests.ids where label='title'),'reject','The audio is missing.');
reset role;
select is((select review_note from public.titles where id=(select id from tests.ids where label='title')),'The audio is missing.',
  'the rejection reason is kept on the video');
select is((select body from public.notices where user_id=tests.uid('creator') and title='Your video needs changes'),
  'Dal makhani was not approved. Reason: The audio is missing.','the creator is told why');
select tests.act('admin');
select public.moderate_content('channel',(select id from tests.ids where label='channel'),'hide','Copyright claim');
reset role;
select is((select count(*) from public.notices where user_id=tests.uid('creator') and title='Your channel was hidden'),1::bigint,
  'hiding a channel tells its owner');
select throws_ok($$select public.moderate_content('title',gen_random_uuid(),'hide','x')$$,
  'P0001','title_unavailable','a missing target is still refused');

-- 3. Reporting again reopens a closed report.
update public.channels set status='published' where id=(select id from tests.ids where label='channel');
update public.titles set status='published',published_at=now() where id=(select id from tests.ids where label='title');
select tests.act('viewer');
insert into tests.ids values('report',public.report_title((select id from tests.ids where label='title'),'spam'));
select tests.act('admin');
select public.moderate_content('report',(select id from tests.ids where label='report'),'dismiss','Not spam');
select tests.act('viewer');
select is(public.report_title((select id from tests.ids where label='title'),'misleading','Still wrong'),
  (select id from tests.ids where label='report'),'the same report is reused');
reset role;
select is((select status from public.content_reports where id=(select id from tests.ids where label='report')),'open',
  'and reopened for the administrators');

select * from finish();
rollback;
