-- PR4: channel ownership, private invitations, reviewed catalogue and Stream assets.
alter table public.profiles add column can_publish boolean not null default false,
  add column birth_date date check (birth_date <= current_date);
grant update(birth_date) on public.profiles to authenticated;
alter table public.channels add column is_private boolean not null default false,
  add column category text not null default 'All' check (char_length(category) between 1 and 40),
  add column cover_url text check (cover_url is null or (char_length(cover_url) <= 2048 and cover_url ~ '^https://'));

create table public.channel_invitations (
  channel_id uuid not null references public.channels on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  invited_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  primary key(channel_id,user_id)
);
create index channel_invitations_user_idx on public.channel_invitations(user_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles on delete set null,
  action text not null,
  target_kind text not null,
  target_id uuid,
  reason text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log(created_at desc);

create function public.publisher_allowed(p_user_id uuid, p_channel_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p join public.channels c on c.id=p_channel_id
    where p.id=p_user_id and p.account_status='active'
      and (p.role='admin' or (p.can_publish and c.created_by=p.id)));
$$;
create function public.can_read_channel(p_channel_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.channels c where c.id=p_channel_id and (
    public.is_admin() or c.created_by=auth.uid() or
    (c.status='published' and (not c.is_private or
      exists(select 1 from public.channel_members m where m.channel_id=c.id and m.user_id=auth.uid()) or
      exists(select 1 from public.channel_invitations i where i.channel_id=c.id and i.user_id=auth.uid())))));
$$;
drop policy "anyone reads published channels" on public.channels;
create policy "read visible channels" on public.channels for select to anon, authenticated
  using ((select public.can_read_channel(id)));

-- Preserve PR1's rule order and extend it with private channel invitation checks.
create or replace function public.access_decision(p_user_id uuid,p_action text,p_channel_id uuid default null)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_status text; v_channel public.channels; v_member boolean;
begin
  if p_action is null or p_action not in ('purchase','join','watch') then
    raise exception 'unknown access action: %',p_action using errcode='22023';
  end if;
  if p_user_id is null then return 'sign_in_required'; end if;
  select account_status into v_status from public.profiles where id=p_user_id;
  if v_status is distinct from 'active' then return 'account_restricted'; end if;
  if p_action='purchase' then return 'allowed'; end if;
  select * into v_channel from public.channels where id=p_channel_id;
  if not found or v_channel.status<>'published' then return 'channel_unavailable'; end if;
  select exists(select 1 from public.channel_members where channel_id=p_channel_id and user_id=p_user_id) into v_member;
  if v_channel.is_private and not v_member and not exists(
    select 1 from public.channel_invitations where channel_id=p_channel_id and user_id=p_user_id
  ) then return 'private_channel'; end if;
  if v_channel.requires_subscription and not public.has_active_subscription(p_user_id) then return 'subscription_required'; end if;
  if p_action='watch' and not v_member then return 'membership_required'; end if;
  return 'allowed';
end; $$;

create function public.submit_channel(p_name text,p_description text,p_category text default 'All',p_cover_url text default null)
returns public.channels language plpgsql security definer set search_path='' as $$
declare v_user public.profiles; v_result public.channels;
begin
  select * into v_user from public.profiles where id=auth.uid() for update;
  if not found or v_user.account_status<>'active' then raise exception 'account_restricted' using errcode='42501'; end if;
  if v_user.role<>'admin' and not v_user.can_publish then raise exception 'publisher_required' using errcode='42501'; end if;
  if (select count(*) from public.channels where created_by=v_user.id and status='draft')>=20 then raise exception 'too_many_drafts'; end if;
  insert into public.channels(name,description,category,cover_url,is_private,requires_subscription,created_by)
    values(btrim(p_name),p_description,p_category,p_cover_url,true,false,v_user.id) returning * into v_result;
  return v_result;
end; $$;
create function public.invite_channel_member(p_channel_id uuid,p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.publisher_allowed(auth.uid(),p_channel_id) then raise exception 'publisher_required' using errcode='42501'; end if;
  if not exists(select 1 from public.channels where id=p_channel_id and is_private and status='published') then raise exception 'channel_unavailable'; end if;
  insert into public.channel_invitations(channel_id,user_id,invited_by) values(p_channel_id,p_user_id,auth.uid()) on conflict do nothing;
end; $$;

create table public.titles (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels on delete cascade,
  owner_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('movie','series','episode')),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text not null default '' check (char_length(description)<=10000),
  cover_url text check (cover_url is null or (char_length(cover_url)<=2048 and cover_url ~ '^https://')),
  min_age int not null check (min_age between 0 and 21),
  allowed_countries text[] not null default '{}' check (array_length(allowed_countries,1) is null or array_length(allowed_countries,1)<=250),
  status text not null default 'draft' check (status in ('draft','pending_review','published','rejected','archived')),
  season_id uuid,
  episode_number int check (episode_number>0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind='episode')=(season_id is not null and episode_number is not null)),
  check (kind='episode' or (season_id is null and episode_number is null)),
  unique(season_id,episode_number)
);
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.titles on delete cascade,
  number int not null check (number>0),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  created_at timestamptz not null default now(),
  unique(series_id,number)
);
alter table public.titles add foreign key(season_id) references public.seasons on delete cascade;
create index titles_catalogue_idx on public.titles(channel_id,status,published_at desc,id);
create index titles_owner_idx on public.titles(owner_id,status);
create index titles_season_idx on public.titles(season_id,episode_number);
create trigger titles_set_updated_at before update on public.titles for each row execute function public.set_updated_at();

create function public.check_catalogue_hierarchy() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_table_name='seasons' then
    if not exists(select 1 from public.titles where id=new.series_id and kind='series') then raise exception 'series_required'; end if;
  else
    if exists(select 1 from unnest(new.allowed_countries) c where c is null or c !~ '^[A-Z]{2}$') then raise exception 'invalid_country'; end if;
    if new.kind='episode' and not exists(select 1 from public.seasons s join public.titles t on t.id=s.series_id
      where s.id=new.season_id and t.channel_id=new.channel_id and t.kind='series') then raise exception 'invalid_episode_hierarchy'; end if;
  end if;
  return new;
end; $$;
create trigger seasons_validate before insert or update on public.seasons for each row execute function public.check_catalogue_hierarchy();
create trigger titles_validate before insert or update on public.titles for each row execute function public.check_catalogue_hierarchy();

create function public.can_read_title(p_title_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.titles t join public.channels c on c.id=t.channel_id where t.id=p_title_id and (
    public.is_admin() or t.owner_id=auth.uid() or (t.status='published' and c.status='published'
    and public.can_read_channel(c.id) and (t.kind<>'episode' or exists(
      select 1 from public.seasons s join public.titles parent on parent.id=s.series_id
      where s.id=t.season_id and parent.status='published')))));
$$;
create function public.save_title(p_channel_id uuid,p_kind text,p_name text,p_description text,p_min_age int,
  p_title_id uuid default null,p_season_id uuid default null,p_episode_number int default null,
  p_cover_url text default null,p_countries text[] default '{}') returns public.titles
language plpgsql security definer set search_path='' as $$
declare v_title public.titles; v_owner uuid;
begin
  perform 1 from public.profiles where id=auth.uid() for update;
  if not public.publisher_allowed(auth.uid(),p_channel_id) then raise exception 'publisher_required' using errcode='42501'; end if;
  select coalesce(created_by,auth.uid()) into v_owner from public.channels where id=p_channel_id;
  if p_title_id is null then
    if (select count(*) from public.titles where owner_id=v_owner and status='draft')>=100 then raise exception 'too_many_drafts'; end if;
    insert into public.titles(channel_id,owner_id,kind,name,description,min_age,season_id,episode_number,cover_url,allowed_countries)
    values(p_channel_id,v_owner,p_kind,btrim(p_name),p_description,p_min_age,p_season_id,p_episode_number,p_cover_url,p_countries) returning * into v_title;
  else
    select * into v_title from public.titles where id=p_title_id for update;
    if not found or v_title.channel_id<>p_channel_id or v_title.kind<>p_kind then raise exception 'title_unavailable'; end if;
    if v_title.status not in ('draft','rejected') then raise exception 'title_not_editable'; end if;
    update public.titles set name=btrim(p_name),description=p_description,min_age=p_min_age,season_id=p_season_id,
      episode_number=p_episode_number,cover_url=p_cover_url,allowed_countries=p_countries,status='draft'
      where id=p_title_id returning * into v_title;
  end if;
  return v_title;
end; $$;
create function public.save_season(p_series_id uuid,p_number int,p_name text) returns public.seasons
language plpgsql security definer set search_path='' as $$
declare v_channel uuid; v_season public.seasons;
begin
  select channel_id into v_channel from public.titles where id=p_series_id and kind='series';
  if not public.publisher_allowed(auth.uid(),v_channel) then raise exception 'publisher_required' using errcode='42501'; end if;
  insert into public.seasons(series_id,number,name) values(p_series_id,p_number,btrim(p_name))
    on conflict(series_id,number) do update set name=excluded.name returning * into v_season;
  return v_season;
end; $$;

-- No provider IDs/URLs in public titles. Only server code can write media state.
create table public.stream_assets (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null unique references public.titles on delete cascade,
  stream_uid text unique check (stream_uid ~ '^[a-f0-9]{32}$'),
  state text not null default 'allocating' check (state in ('allocating','uploading','processing','ready','error')),
  lease_id uuid,
  lease_until timestamptz,
  upload_url text,
  upload_expires_at timestamptz,
  duration_seconds double precision check (duration_seconds>0 and duration_seconds<'Infinity'::float8),
  signed_only boolean not null default true,
  error_code text,
  next_check_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger stream_assets_updated before update on public.stream_assets for each row execute function public.set_updated_at();
create index stream_assets_due_idx on public.stream_assets(next_check_at) where state in ('uploading','processing');
create view public.my_stream_uploads with (security_invoker=true) as
  select id,title_id,state,duration_seconds,error_code,upload_expires_at,updated_at from public.stream_assets;

create function public.reserve_stream_upload(p_user_id uuid,p_title_id uuid) returns public.stream_assets
language plpgsql security definer set search_path='' as $$
declare v_title public.titles; v_asset public.stream_assets;
begin
  select * into v_title from public.titles where id=p_title_id for update;
  if not found or v_title.kind='series' then raise exception 'title_unavailable'; end if;
  if not public.publisher_allowed(p_user_id,v_title.channel_id) then raise exception 'publisher_required' using errcode='42501'; end if;
  if v_title.status not in ('draft','rejected') then raise exception 'title_not_editable'; end if;
  select * into v_asset from public.stream_assets where title_id=p_title_id for update;
  if found then
    if v_asset.upload_url is not null and v_asset.upload_expires_at>now() and v_asset.state='uploading' then return v_asset; end if;
    if v_asset.lease_until>now() then raise exception 'upload_busy'; end if;
    if v_asset.stream_uid is not null then raise exception 'upload_already_allocated'; end if;
  end if;
  insert into public.stream_assets(title_id,lease_id,lease_until)
    values(p_title_id,gen_random_uuid(),now()+interval '3 minutes')
    on conflict(title_id) do update set lease_id=excluded.lease_id,lease_until=excluded.lease_until,state='allocating'
    returning * into v_asset;
  return v_asset;
end; $$;
create function public.bind_stream_upload(p_asset_id uuid,p_lease uuid,p_uid text,p_upload_url text,p_expires_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.stream_assets set stream_uid=p_uid,upload_url=p_upload_url,upload_expires_at=p_expires_at,
    state='uploading',lease_id=null,lease_until=null,next_check_at=now()+interval '10 minutes'
    where id=p_asset_id and lease_id=p_lease and lease_until>now();
  if not found then raise exception 'upload_lease_lost'; end if;
end; $$;
create function public.apply_stream_state(p_uid text,p_state text,p_duration double precision,p_signed boolean,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_title_id uuid;
begin
  if p_state not in ('uploading','processing','ready','error') then raise exception 'invalid_stream_state'; end if;
  update public.stream_assets set state=case when not p_signed then 'error' else p_state end,
    signed_only=p_signed,duration_seconds=p_duration,error_code=case when not p_signed then 'unsigned_asset' else left(p_error,100) end,
    upload_url=case when p_state in ('ready','error') then null else upload_url end,next_check_at=now()+interval '10 minutes'
    where stream_uid=p_uid returning title_id into v_title_id;
  -- Provider readiness never grants publication. Owner explicitly submits for review.
end; $$;
create function public.submit_title_review(p_title_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_title public.titles;
begin
  select * into v_title from public.titles where id=p_title_id for update;
  if not found or not public.publisher_allowed(auth.uid(),v_title.channel_id) then raise exception 'publisher_required' using errcode='42501'; end if;
  if v_title.status not in ('draft','rejected') then raise exception 'invalid_title_state'; end if;
  if v_title.kind<>'series' and not exists(select 1 from public.stream_assets where title_id=p_title_id and state='ready' and signed_only and duration_seconds>0) then raise exception 'video_processing'; end if;
  update public.titles set status='pending_review' where id=p_title_id;
end; $$;

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles on delete set null,
  title_id uuid references public.titles on delete set null,
  reason text not null check (char_length(btrim(reason)) between 1 and 100),
  details text not null default '' check (char_length(details)<=2000),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(reporter_id,title_id)
);
create index content_reports_open_idx on public.content_reports(created_at) where status='open';
create function public.report_title(p_title_id uuid,p_reason text,p_details text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform 1 from public.profiles where id=auth.uid() and account_status='active' for update;
  if not found then raise exception 'account_restricted' using errcode='42501'; end if;
  if not public.can_read_title(p_title_id) then raise exception 'title_unavailable'; end if;
  if (select count(*) from public.content_reports where reporter_id=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'report_rate_limit'; end if;
  insert into public.content_reports(reporter_id,title_id,reason,details) values(auth.uid(),p_title_id,btrim(p_reason),p_details)
    on conflict(reporter_id,title_id) do update set reason=excluded.reason,details=excluded.details
    returning id into v_id;
  return v_id;
end; $$;

create function public.moderate_content(p_kind text,p_id uuid,p_action text,p_reason text default null,p_visibility text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_title public.titles;
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if p_action in ('reject','suspend','ban','resolve','dismiss','revoke') and nullif(btrim(p_reason),'') is null then raise exception 'reason_required'; end if;
  if p_kind='channel' and p_action in ('publish','hide') then
    if p_action='publish' and (p_visibility is null or p_visibility not in ('public','premium','private')) then raise exception 'invalid_visibility'; end if;
    update public.channels set status=case when p_action='publish' then 'published' else 'archived' end,
      is_private=case when p_action='publish' then p_visibility='private' else is_private end,
      requires_subscription=case when p_action='publish' then p_visibility='premium' else requires_subscription end where id=p_id;
  elsif p_kind='title' and p_action in ('publish','reject','hide') then
    select * into v_title from public.titles where id=p_id for update;
    if not found then raise exception 'title_unavailable'; end if;
    if p_action='publish' then
      if v_title.status<>'pending_review' then raise exception 'invalid_title_state'; end if;
      if not exists(select 1 from public.channels where id=v_title.channel_id and status='published') then raise exception 'channel_unavailable'; end if;
      if v_title.kind<>'series' and not exists(select 1 from public.stream_assets where title_id=p_id and state='ready' and signed_only and duration_seconds>0) then raise exception 'video_processing'; end if;
      if v_title.kind='episode' and not exists(select 1 from public.seasons s join public.titles t on t.id=s.series_id where s.id=v_title.season_id and t.status='published') then raise exception 'series_unavailable'; end if;
    end if;
    update public.titles set status=case p_action when 'publish' then 'published' when 'reject' then 'rejected' else 'archived' end,
      published_at=case when p_action='publish' then now() else published_at end where id=p_id;
  elsif p_kind='report' and p_action in ('resolve','dismiss') then
    update public.content_reports set status=case p_action when 'resolve' then 'resolved' else 'dismissed' end,resolved_at=now() where id=p_id;
  elsif p_kind='publisher' and p_action in ('grant','revoke') then
    update public.profiles set can_publish=(p_action='grant') where id=p_id;
  elsif p_kind='account' and p_action in ('suspend','ban','restore') then
    if p_id=auth.uid() then raise exception 'cannot_restrict_self'; end if;
    update public.profiles set account_status=case p_action when 'suspend' then 'suspended' when 'ban' then 'banned' else 'active' end where id=p_id;
  else raise exception 'invalid_moderation_action';
  end if;
  if not found then raise exception 'target_unavailable'; end if;
  insert into public.audit_log(actor_id,action,target_kind,target_id,reason,details)
    values(auth.uid(),p_action,p_kind,p_id,p_reason,jsonb_build_object('visibility',p_visibility));
end; $$;

-- RLS and privileges. Clients write only through the reviewed RPCs above.
alter table public.channel_invitations enable row level security;
alter table public.titles enable row level security;
alter table public.seasons enable row level security;
alter table public.stream_assets enable row level security;
alter table public.content_reports enable row level security;
alter table public.audit_log enable row level security;
create policy "read own invitations" on public.channel_invitations for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy "read visible titles" on public.titles for select to anon, authenticated using(public.can_read_title(id));
create policy "read visible seasons" on public.seasons for select to anon, authenticated using(public.can_read_title(series_id));
create policy "publisher reads media status" on public.stream_assets for select to authenticated using(exists(
  select 1 from public.titles t where t.id=title_id and (t.owner_id=auth.uid() or public.is_admin())));
create policy "read own reports" on public.content_reports for select to authenticated using(reporter_id=auth.uid() or public.is_admin());
create policy "admins read audit" on public.audit_log for select to authenticated using(public.is_admin());
revoke all on public.channel_invitations, public.titles, public.seasons, public.stream_assets, public.content_reports, public.audit_log from anon, authenticated;
grant select on public.titles,public.seasons to anon,authenticated;
grant select on public.channel_invitations,public.content_reports,public.audit_log to authenticated;
-- Column privileges keep provider IDs, upload URLs and lease tokens server-only.
grant select(id,title_id,state,duration_seconds,error_code,upload_expires_at,updated_at) on public.stream_assets to authenticated;
grant select on public.my_stream_uploads to authenticated;

revoke all on function public.publisher_allowed(uuid,uuid),public.can_read_channel(uuid),public.can_read_title(uuid),
 public.submit_channel(text,text,text,text),public.invite_channel_member(uuid,uuid),
 public.save_title(uuid,text,text,text,int,uuid,uuid,int,text,text[]),public.save_season(uuid,int,text),
 public.check_catalogue_hierarchy(),public.reserve_stream_upload(uuid,uuid),public.bind_stream_upload(uuid,uuid,text,text,timestamptz),
 public.apply_stream_state(text,text,double precision,boolean,text),public.submit_title_review(uuid),
 public.report_title(uuid,text,text),public.moderate_content(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.can_read_channel(uuid),public.can_read_title(uuid) to anon,authenticated;
grant execute on function public.submit_channel(text,text,text,text),public.invite_channel_member(uuid,uuid),
 public.save_title(uuid,text,text,text,int,uuid,uuid,int,text,text[]),public.save_season(uuid,int,text),
 public.submit_title_review(uuid),public.report_title(uuid,text,text),public.moderate_content(text,uuid,text,text,text) to authenticated;
grant execute on function public.publisher_allowed(uuid,uuid),public.reserve_stream_upload(uuid,uuid),
 public.bind_stream_upload(uuid,uuid,text,text,timestamptz),public.apply_stream_state(text,text,double precision,boolean,text) to service_role;
