-- Who a channel is shown to. Members who came from an advert ("ads") see every channel;
-- everyone else ("organic", including visitors who are not signed in) never sees a channel
-- meant for ads members. The administrator chooses the audience of each channel.

alter table public.channels
  add column audience text not null default 'both'
    check (audience in ('organic','ads','both'));

-- A member's group. Members cannot change it: only mark_ad_audience (once, upwards) and an
-- administrator can. The column is left out of the profile columns members may update.
alter table public.profiles
  add column audience text not null default 'organic' check (audience in ('organic','ads')),
  add column audience_source text check (audience_source in ('install_referrer','ad_link','admin')),
  add column audience_set_at timestamptz;

-- True when the signed-in member may see channels meant for ads members.
create function public.sees_ads_content() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and audience = 'ads');
$$;

create or replace function public.can_read_channel(p_channel_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.channels c where c.id=p_channel_id and (
    public.is_admin() or c.created_by=auth.uid() or
    (c.status='published' and (c.audience<>'ads' or public.sees_ads_content()) and (not c.is_private or
      exists(select 1 from public.channel_members m where m.channel_id=c.id and m.user_id=auth.uid()) or
      exists(select 1 from public.channel_invitations i where i.channel_id=c.id and i.user_id=auth.uid())))));
$$;

-- Joining and watching follow the same rule as seeing: an ads channel is unavailable to an
-- organic member, even through an old membership or invitation.
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
  select exists(select 1 from public.channel_members where channel_id=p_channel_id and user_id=p_user_id) into v_member;
  if v_channel.is_private and not v_member and not exists(
    select 1 from public.channel_invitations where channel_id=p_channel_id and user_id=p_user_id
  ) then return 'private_channel'; end if;
  if v_channel.requires_subscription and not public.has_active_subscription(p_user_id) then return 'subscription_required'; end if;
  if p_action='watch' and not v_member then return 'membership_required'; end if;
  return 'allowed';
end; $$;

-- The app reports once that this member came from an advert: Google Play's install record
-- shows a Meta ad, or the app was opened from a CloudLynk ad link. It only ever moves a
-- member from organic to ads, and never overrides an administrator's choice.
create function public.mark_ad_audience(p_source text) returns text
language plpgsql security definer set search_path='' as $$
declare v_audience text;
begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if p_source is null or p_source not in ('install_referrer','ad_link') then
    raise exception 'invalid_audience_source';
  end if;
  update public.profiles set audience='ads', audience_source=p_source, audience_set_at=now()
    where id=auth.uid() and audience='organic' and audience_source is null;
  select audience into v_audience from public.profiles where id=auth.uid();
  return v_audience;
end; $$;

-- Administrator: choose who a channel is shown to.
create function public.set_channel_audience(p_channel_id uuid, p_audience text) returns public.channels
language plpgsql security definer set search_path='' as $$
declare v_channel public.channels;
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if p_audience is null or p_audience not in ('organic','ads','both') then
    raise exception 'invalid_audience';
  end if;
  update public.channels set audience=p_audience where id=p_channel_id returning * into v_channel;
  if not found then raise exception 'channel_unavailable'; end if;
  insert into public.audit_log(actor_id,action,target_kind,target_id,details)
    values(auth.uid(),'set_audience','channel',p_channel_id,jsonb_build_object('audience',p_audience));
  return v_channel;
end; $$;

-- Administrator: move a member between groups, for example someone who came from an
-- advert the app could not detect.
create function public.set_member_audience(p_user_id uuid, p_audience text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if p_audience is null or p_audience not in ('organic','ads') then
    raise exception 'invalid_audience';
  end if;
  update public.profiles set audience=p_audience, audience_source='admin', audience_set_at=now()
    where id=p_user_id;
  if not found then raise exception 'target_unavailable'; end if;
  insert into public.audit_log(actor_id,action,target_kind,target_id,details)
    values(auth.uid(),'set_audience','account',p_user_id,jsonb_build_object('audience',p_audience));
end; $$;

revoke all on function public.sees_ads_content(), public.mark_ad_audience(text),
  public.set_channel_audience(uuid,text), public.set_member_audience(uuid,text)
  from public, anon, authenticated;
grant execute on function public.sees_ads_content() to anon, authenticated;
grant execute on function public.mark_ad_audience(text), public.set_channel_audience(uuid,text),
  public.set_member_audience(uuid,text) to authenticated;
