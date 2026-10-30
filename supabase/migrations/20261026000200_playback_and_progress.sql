-- PR5: the only server grant used to issue signed playback tokens.
create function public.playback_grant(p_user_id uuid,p_title_id uuid)
returns table(stream_uid text,expires_at timestamptz,duration_seconds double precision,countries text[])
language plpgsql stable security definer set search_path='' as $$
declare v_title public.titles; v_parent public.titles; v_asset public.stream_assets;
  v_decision text; v_birth date; v_age int; v_countries text[]; v_paid_until timestamptz;
begin
  select * into v_title from public.titles where id=p_title_id;
  if not found or v_title.status<>'published' or v_title.kind='series' then raise exception 'title_unavailable' using errcode='42501'; end if;
  v_decision:=public.access_decision(p_user_id,'watch',v_title.channel_id);
  if v_decision<>'allowed' then raise exception '%',v_decision using errcode='42501'; end if;
  v_age:=v_title.min_age; v_countries:=v_title.allowed_countries;
  if v_title.kind='episode' then
    select t.* into v_parent from public.titles t join public.seasons s on s.series_id=t.id where s.id=v_title.season_id;
    if not found or v_parent.status<>'published' then raise exception 'title_unavailable' using errcode='42501'; end if;
    v_age:=greatest(v_age,v_parent.min_age);
    if cardinality(v_parent.allowed_countries)>0 then
      if cardinality(v_countries)>0 then
        v_countries:=array(select unnest(v_countries) intersect select unnest(v_parent.allowed_countries));
        if cardinality(v_countries)=0 then raise exception 'territory_unavailable' using errcode='42501'; end if;
      else v_countries:=v_parent.allowed_countries;
      end if;
    end if;
  end if;
  select birth_date into v_birth from public.profiles where id=p_user_id;
  if v_age>0 and (v_birth is null or extract(year from age(current_date,v_birth))<v_age) then
    raise exception 'age_restricted' using errcode='42501';
  end if;
  select * into v_asset from public.stream_assets where title_id=p_title_id;
  if not found or v_asset.state<>'ready' or not v_asset.signed_only or v_asset.duration_seconds is null then
    raise exception 'video_processing' using errcode='42501';
  end if;
  expires_at:=now()+interval '10 minutes';
  if exists(select 1 from public.channels where id=v_title.channel_id and requires_subscription) then
    select max(s.paid_until) into v_paid_until from public.subscriptions s
    where s.user_id=p_user_id and s.status in ('active','in_grace','cancelled') and s.paid_until>now();
    expires_at:=least(expires_at,v_paid_until);
  end if;
  stream_uid:=v_asset.stream_uid; duration_seconds:=v_asset.duration_seconds; countries:=v_countries;
  return next;
end; $$;

create table public.watch_progress (
  user_id uuid not null references public.profiles on delete cascade,
  title_id uuid not null references public.titles on delete cascade,
  position_seconds double precision not null check (position_seconds>=0 and position_seconds<'Infinity'::float8),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id,title_id)
);
create index watch_progress_recent_idx on public.watch_progress(user_id,updated_at desc);
create table public.saved_titles (
  user_id uuid not null references public.profiles on delete cascade,
  title_id uuid not null references public.titles on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,title_id)
);
create function public.save_watch_progress(p_title_id uuid,p_position_seconds double precision) returns public.watch_progress
language plpgsql security definer set search_path='' as $$
declare v_grant record; v_result public.watch_progress; v_position double precision;
begin
  if p_position_seconds is null or not (p_position_seconds>=0 and p_position_seconds<'Infinity'::float8) then raise exception 'invalid_position' using errcode='22023'; end if;
  select * into v_grant from public.playback_grant(auth.uid(),p_title_id);
  v_position:=least(p_position_seconds,v_grant.duration_seconds);
  insert into public.watch_progress(user_id,title_id,position_seconds,completed)
    values(auth.uid(),p_title_id,v_position,v_position>=v_grant.duration_seconds*0.95)
    on conflict(user_id,title_id) do update set position_seconds=excluded.position_seconds,completed=excluded.completed,updated_at=now()
    returning * into v_result;
  return v_result;
end; $$;
create function public.set_saved_title(p_title_id uuid,p_saved boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and account_status='active') then raise exception 'account_restricted' using errcode='42501'; end if;
  if p_saved then
    if not public.can_read_title(p_title_id) then raise exception 'title_unavailable'; end if;
    insert into public.saved_titles values(auth.uid(),p_title_id,now()) on conflict do nothing;
  else delete from public.saved_titles where user_id=auth.uid() and title_id=p_title_id;
  end if;
end; $$;
alter table public.watch_progress enable row level security;
alter table public.saved_titles enable row level security;
create policy "read own progress" on public.watch_progress for select to authenticated using(user_id=auth.uid());
create policy "read own saved titles" on public.saved_titles for select to authenticated using(user_id=auth.uid());
revoke all on public.watch_progress,public.saved_titles from anon,authenticated;
grant select on public.watch_progress,public.saved_titles to authenticated;
revoke all on function public.playback_grant(uuid,uuid),public.save_watch_progress(uuid,double precision),public.set_saved_title(uuid,boolean) from public,anon,authenticated;
grant execute on function public.playback_grant(uuid,uuid) to service_role;
grant execute on function public.save_watch_progress(uuid,double precision),public.set_saved_title(uuid,boolean) to authenticated;
