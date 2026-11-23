-- Owners and administrators can open what they own or moderate.
-- 1. access_decision: a published channel's owner can join and watch it even when it is
--    private or Plus-only (owners were told "Only its owner can open it"). Administrators
--    get no general viewing bypass; they review through the preview below.
-- 2. playback_grant: administrators can play a title before approving it, and a creator
--    can play their own upload in any state (draft, in review, rejected).
create or replace function public.access_decision(p_user_id uuid,p_action text,p_channel_id uuid default null)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_profile public.profiles; v_channel public.channels; v_member boolean;
begin
  if p_action is null or p_action not in ('purchase','join','watch') then
    raise exception 'unknown access action: %',p_action using errcode='22023';
  end if;
  if p_user_id is null then return 'sign_in_required'; end if;
  select * into v_profile from public.profiles where id=p_user_id;
  if v_profile.account_status is distinct from 'active' then return 'account_restricted'; end if;
  if p_action='purchase' then return 'allowed'; end if;
  select * into v_channel from public.channels where id=p_channel_id;
  if not found or v_channel.status<>'published' then return 'channel_unavailable'; end if;
  if v_channel.audience='ads' and v_profile.audience<>'ads'
    and v_channel.created_by is distinct from p_user_id and v_profile.role<>'admin' then
    return 'channel_unavailable';
  end if;
  -- The owner can always open their own published channel: private, Plus-only or not joined.
  if v_channel.created_by=p_user_id then return 'allowed'; end if;
  select exists(select 1 from public.channel_members where channel_id=p_channel_id and user_id=p_user_id) into v_member;
  if v_channel.is_private and not v_member and not exists(
    select 1 from public.channel_invitations where channel_id=p_channel_id and user_id=p_user_id
  ) then return 'private_channel'; end if;
  if v_channel.requires_subscription and not public.has_active_subscription(p_user_id) then return 'subscription_required'; end if;
  if p_action='watch' and not v_member then return 'membership_required'; end if;
  return 'allowed';
end; $$;

create or replace function public.playback_grant(p_user_id uuid,p_title_id uuid)
returns table(stream_uid text,expires_at timestamptz,duration_seconds double precision,countries text[])
language plpgsql stable security definer set search_path='' as $$
declare v_title public.titles; v_parent public.titles; v_asset public.stream_assets;
  v_decision text; v_birth date; v_age int; v_countries text[]; v_paid_until timestamptz;
  v_preview boolean;
begin
  select * into v_title from public.titles where id=p_title_id;
  if not found or v_title.kind='series' then raise exception 'title_unavailable' using errcode='42501'; end if;
  -- A preview: an administrator reviewing a title, or its owner checking an upload, can
  -- play it in any state, without the channel's membership, Plus or age rules.
  v_preview:=exists(select 1 from public.profiles where id=p_user_id and account_status='active'
    and (role='admin' or id=v_title.owner_id));
  if not v_preview then
    if v_title.status<>'published' then raise exception 'title_unavailable' using errcode='42501'; end if;
    v_decision:=public.access_decision(p_user_id,'watch',v_title.channel_id);
    if v_decision<>'allowed' then raise exception '%',v_decision using errcode='42501'; end if;
  end if;
  v_age:=v_title.min_age; v_countries:=v_title.allowed_countries;
  if v_title.kind='episode' then
    select t.* into v_parent from public.titles t join public.seasons s on s.series_id=t.id where s.id=v_title.season_id;
    if not found or (v_parent.status<>'published' and not v_preview) then raise exception 'title_unavailable' using errcode='42501'; end if;
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
  if v_age>0 and not v_preview and (v_birth is null or extract(year from age(current_date,v_birth))<v_age) then
    raise exception 'age_restricted' using errcode='42501';
  end if;
  select * into v_asset from public.stream_assets where title_id=p_title_id;
  if not found or v_asset.state<>'ready' or not v_asset.signed_only or v_asset.duration_seconds is null then
    raise exception 'video_processing' using errcode='42501';
  end if;
  expires_at:=now()+least(interval '6 hours',greatest(interval '10 minutes',
    make_interval(secs=>v_asset.duration_seconds)+interval '30 minutes'));
  if not v_preview and exists(select 1 from public.channels where id=v_title.channel_id and requires_subscription) then
    select max(s.paid_until) into v_paid_until from public.subscriptions s
    where s.user_id=p_user_id and s.status in ('active','in_grace','cancelled') and s.paid_until>now();
    expires_at:=least(expires_at,v_paid_until);
  end if;
  stream_uid:=v_asset.stream_uid; duration_seconds:=v_asset.duration_seconds; countries:=v_countries;
  return next;
end; $$;
