-- Persist intent before calling Stream, including when the asset is later erased.
create table public.stream_allocation_intents (
  id uuid primary key,
  asset_id uuid not null,
  owner_id uuid not null,
  created_at timestamptz not null default now(),
  next_check_at timestamptz not null default now()+interval '4 minutes'
);
create index stream_allocation_due_idx on public.stream_allocation_intents(next_check_at);
alter table public.stream_allocation_intents enable row level security;
revoke all on public.stream_allocation_intents from anon,authenticated;

create or replace function public.drive_can_write_object(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.files f join public.profiles p on p.id=f.owner_id
    where f.storage_path=p_name and f.owner_id=auth.uid() and f.status='pending' and f.expires_at>now() and p.account_status='active');
$$;
create or replace function public.drive_can_read_object(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.files f where f.storage_path=p_name and f.owner_id=auth.uid() and f.status in ('pending','ready')
    and not exists(select 1 from public.account_deletion_requests d where d.user_id=f.owner_id and d.state<>'complete'));
$$;

create function public.can_read_season(p_season_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.seasons s join public.titles parent on parent.id=s.series_id where s.id=p_season_id and (
    public.is_admin() or parent.owner_id=auth.uid() or (public.can_read_title(parent.id) and exists(
      select 1 from public.titles t where t.season_id=s.id and t.status='published'))));
$$;
drop policy "read visible seasons" on public.seasons;
create policy "read visible seasons" on public.seasons for select to anon,authenticated using(public.can_read_season(id));
revoke all on function public.can_read_season(uuid) from public,anon,authenticated;
grant execute on function public.can_read_season(uuid) to anon,authenticated;
create or replace function public.save_season(p_series_id uuid,p_number int,p_name text) returns public.seasons
language plpgsql security definer set search_path='' as $$
declare v_channel uuid; v_season public.seasons;
begin
  select channel_id into v_channel from public.titles where id=p_series_id and kind='series';
  if not public.publisher_allowed(auth.uid(),v_channel) then raise exception 'publisher_required' using errcode='42501'; end if;
  select * into v_season from public.seasons where series_id=p_series_id and number=p_number for update;
  if found and not public.is_admin() and exists(select 1 from public.titles where season_id=v_season.id and status in ('pending_review','published')) then raise exception 'season_not_editable'; end if;
  insert into public.seasons(series_id,number,name) values(p_series_id,p_number,btrim(p_name))
    on conflict(series_id,number) do update set name=excluded.name returning * into v_season;
  return v_season;
end; $$;

alter function public.backend_health() rename to backend_health_base;
create function public.backend_health() returns jsonb language sql stable security definer set search_path='' as $$
  select public.backend_health_base() || jsonb_build_object(
    'overdue_stream_allocations',(select count(*) from public.stream_allocation_intents where created_at<now()-interval '1 hour'),
    'unprocessed_payment_events',(select count(*) from public.payment_events where processed_at is null and created_at<now()-interval '1 hour')
  );
$$;
revoke all on function public.backend_health() from public,anon,authenticated;
grant execute on function public.backend_health() to service_role;
