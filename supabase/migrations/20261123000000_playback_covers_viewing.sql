-- A playback grant now covers the whole viewing instead of 10 minutes. Swapping the stream
-- every 10 minutes made playback stutter, restarted paused videos and closed fullscreen.
-- The grant lasts the video's length plus 30 minutes for pauses (at least 10 minutes, at
-- most 6 hours), and still ends when the member's Plus ends on a subscription channel.
-- The app renews it in place if a viewing outlasts it.
create or replace function public.playback_grant(p_user_id uuid,p_title_id uuid)
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
  expires_at:=now()+least(interval '6 hours',greatest(interval '10 minutes',
    make_interval(secs=>v_asset.duration_seconds)+interval '30 minutes'));
  if exists(select 1 from public.channels where id=v_title.channel_id and requires_subscription) then
    select max(s.paid_until) into v_paid_until from public.subscriptions s
    where s.user_id=p_user_id and s.status in ('active','in_grace','cancelled') and s.paid_until>now();
    expires_at:=least(expires_at,v_paid_until);
  end if;
  stream_uid:=v_asset.stream_uid; duration_seconds:=v_asset.duration_seconds; countries:=v_countries;
  return next;
end; $$;
