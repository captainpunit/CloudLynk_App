begin;
create extension if not exists pgtap with schema extensions;
select plan(24);
create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.uid(p_name text) returns uuid language sql stable security definer as $$
  select id from auth.users where email=p_name||'@audience.test';
$$;
create function tests.act(p_name text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',json_build_object('sub',tests.uid(p_name),'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
end; $$;
create function tests.channel(p_name text) returns uuid language sql stable security definer as $$
  select id from public.channels where name=p_name;
$$;
grant execute on all functions in schema tests to anon, authenticated;

delete from public.titles;
delete from public.channels;
insert into auth.users(id,email) select gen_random_uuid(),name||'@audience.test'
  from unnest(array['admin','organic','adsuser','creator','linked']) name;
update public.profiles set role='admin' where id=tests.uid('admin');
-- Free, public channels, so only the audience decides who sees them.
insert into public.channels(name,status,audience,requires_subscription,is_private,created_by) values
  ('Organic only','published','organic',false,false,tests.uid('creator')),
  ('Ads only','published','ads',false,false,tests.uid('creator')),
  ('Everyone','published','both',false,false,tests.uid('creator'));
insert into public.titles(channel_id,owner_id,kind,name,min_age,status,published_at)
  select id,tests.uid('creator'),'movie',name||' video',0,'published',now() from public.channels;
-- An organic member who joined the ads channel before it was restricted.
insert into public.channel_members(channel_id,user_id) values(tests.channel('Ads only'),tests.uid('organic'));
update public.profiles set audience='ads',audience_source='install_referrer',audience_set_at=now()
  where id=tests.uid('adsuser');

-- Existing channels are shown to everyone.
select is((select column_default from information_schema.columns
  where table_name='channels' and column_name='audience'),'''both''::text','new and existing channels are shown to both groups');

-- What each group sees.
select tests.act('organic');
select is((select array_agg(name order by name) from public.channels),array['Everyone','Organic only'],'organic members do not see ads channels');
select is((select count(*) from public.titles where name='Ads only video'),0::bigint,'or their videos');
select is(public.my_access('watch',tests.channel('Ads only')),'channel_unavailable','an old membership does not let them watch');
select is(public.my_access('join',tests.channel('Ads only')),'channel_unavailable','or join');
select is(public.my_access('join',tests.channel('Everyone')),'allowed','channels for both are open to them');

select tests.act('adsuser');
select is((select count(*) from public.channels),3::bigint,'members from adverts see every channel');
select is((select count(*) from public.titles),3::bigint,'and every video');
select is(public.my_access('join',tests.channel('Ads only')),'allowed','and can join ads channels');

reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((select array_agg(name order by name) from public.channels),array['Everyone','Organic only'],'visitors who are not signed in count as organic');

select tests.act('creator');
select is((select count(*) from public.channels),3::bigint,'a creator always sees their own channels');

-- Members cannot choose their own group.
select tests.act('organic');
select throws_ok($$update public.profiles set audience='ads' where id=auth.uid()$$,'42501',null,'members cannot edit their group');
select throws_ok($$select public.mark_ad_audience('made_up')$$,'P0001','invalid_audience_source','only known sources are accepted');

-- The app reports an advert once.
select tests.act('linked');
select is(public.mark_ad_audience('ad_link'),'ads','an ad link makes the member an ads user');
select is((select count(*) from public.channels),3::bigint,'who then sees ads channels');
reset role;
select is((select audience_source from public.profiles where id=tests.uid('linked')),'ad_link','the source is recorded');

-- Administrators.
select tests.act('organic');
select throws_ok($$select public.set_channel_audience(tests.channel('Everyone'),'ads')$$,'42501','admin_required','members cannot change a channel''s audience');
select throws_ok($$select public.set_member_audience(auth.uid(),'ads')$$,'42501','admin_required','or anyone''s group');
select tests.act('admin');
select throws_ok($$select public.set_channel_audience(tests.channel('Everyone'),'nobody')$$,'P0001','invalid_audience','the audience must be organic, ads or both');
select is((public.set_channel_audience(tests.channel('Everyone'),'ads')).audience,'ads','the admin chooses who a channel is shown to');
select public.set_member_audience(tests.uid('linked'),'organic');
reset role;
select is((select audience from public.profiles where id=tests.uid('linked')),'organic','the admin can move a member back to organic');
select is((select count(*) from public.audit_log where action='set_audience'),2::bigint,'both changes are audited');
select tests.act('linked');
select is(public.mark_ad_audience('install_referrer'),'organic','the app cannot undo the admin''s choice');
select tests.act('organic');
select is((select array_agg(name order by name) from public.channels),array['Organic only'],'a channel moved to ads disappears for organic members');

select * from finish();
rollback;
