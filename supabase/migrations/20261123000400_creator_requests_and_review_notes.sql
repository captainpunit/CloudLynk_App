-- Creators hear about reviews, can ask for creator access, and repeat reports are kept.
-- 1. moderate_content tells the owner when a channel or video is published, rejected or
--    hidden, and stores the reason on the row (review_note) so the creator can read it.
-- 2. Members can ask for creator access from the app (creator_applications); granting or
--    revoking publishing closes their request and tells them.
-- 3. Reporting a title again reopens a report that was already resolved or dismissed.
alter table public.titles add column review_note text check (char_length(review_note)<=500);
alter table public.channels add column review_note text check (char_length(review_note)<=500);

create table public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  message text not null check (char_length(btrim(message)) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  decision_reason text check (char_length(decision_reason)<=500),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles on delete set null
);
-- One open request per member.
create unique index creator_applications_pending_idx on public.creator_applications(user_id) where status='pending';
alter table public.creator_applications enable row level security;
revoke all on public.creator_applications from anon, authenticated;
grant select on public.creator_applications to authenticated;
create policy "members read their own creator requests" on public.creator_applications
  for select to authenticated using (user_id=auth.uid() or public.is_admin());

create function public.request_creator_access(p_message text) returns public.creator_applications
language plpgsql security definer set search_path='' as $$
declare v_profile public.profiles; v_row public.creator_applications;
begin
  select * into v_profile from public.profiles where id=auth.uid();
  if not found or v_profile.account_status<>'active' then raise exception 'account_restricted' using errcode='42501'; end if;
  if v_profile.can_publish then raise exception 'already_creator'; end if;
  if char_length(btrim(coalesce(p_message,''))) not between 10 and 1000 then raise exception 'invalid_message'; end if;
  insert into public.creator_applications(user_id,message) values(auth.uid(),btrim(p_message))
    on conflict (user_id) where status='pending' do update set message=excluded.message,created_at=now()
    returning * into v_row;
  return v_row;
end; $$;
revoke all on function public.request_creator_access(text) from public, anon;
grant execute on function public.request_creator_access(text) to authenticated;

create or replace function public.moderate_content(p_kind text,p_id uuid,p_action text,p_reason text default null,p_visibility text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_title public.titles; v_channel public.channels; v_note text;
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if p_action in ('reject','suspend','ban','resolve','dismiss','revoke') and nullif(btrim(p_reason),'') is null then raise exception 'reason_required'; end if;
  if p_kind='channel' and p_action in ('publish','hide') then
    if p_action='publish' and (p_visibility is null or p_visibility not in ('public','premium','private')) then raise exception 'invalid_visibility'; end if;
    v_note:=case when p_action='hide' then nullif(btrim(p_reason),'') end;
    update public.channels set status=case when p_action='publish' then 'published' else 'archived' end,
      is_private=case when p_action='publish' then p_visibility='private' else is_private end,
      requires_subscription=case when p_action='publish' then p_visibility='premium' else requires_subscription end,
      review_note=v_note where id=p_id returning * into v_channel;
    if v_channel.id is not null and v_channel.created_by is not null then
      perform public.notify_user(v_channel.created_by,
        case when p_action='publish' then 'Your channel is live' else 'Your channel was hidden' end,
        case when p_action='publish' then v_channel.name||' is published. You can now add videos.'
          else v_channel.name||' is no longer shown.'||coalesce(' Reason: '||v_note,'') end,
        jsonb_build_object('kind','channel_review','channel_id',p_id,'status',v_channel.status));
    end if;
  elsif p_kind='title' and p_action in ('publish','reject','hide') then
    select * into v_title from public.titles where id=p_id for update;
    if not found then raise exception 'title_unavailable'; end if;
    if p_action='publish' then
      if v_title.status<>'pending_review' then raise exception 'invalid_title_state'; end if;
      if not exists(select 1 from public.channels where id=v_title.channel_id and status='published') then raise exception 'channel_unavailable'; end if;
      if v_title.kind<>'series' and not exists(select 1 from public.stream_assets where title_id=p_id and state='ready' and signed_only and duration_seconds>0) then raise exception 'video_processing'; end if;
      if v_title.kind='episode' and not exists(select 1 from public.seasons s join public.titles t on t.id=s.series_id where s.id=v_title.season_id and t.status='published') then raise exception 'series_unavailable'; end if;
    end if;
    v_note:=case when p_action<>'publish' then nullif(btrim(p_reason),'') end;
    update public.titles set status=case p_action when 'publish' then 'published' when 'reject' then 'rejected' else 'archived' end,
      published_at=case when p_action='publish' then now() else published_at end,
      review_note=v_note where id=p_id returning * into v_title;
    perform public.notify_user(v_title.owner_id,
      case p_action when 'publish' then 'Your video is live' when 'reject' then 'Your video needs changes'
        else 'Your video was hidden' end,
      case p_action when 'publish' then v_title.name||' is published.'
        when 'reject' then v_title.name||' was not approved. Reason: '||v_note
        else v_title.name||' is no longer shown.'||coalesce(' Reason: '||v_note,'') end,
      jsonb_build_object('kind','title_review','title_id',p_id,'status',v_title.status));
  elsif p_kind='report' and p_action in ('resolve','dismiss') then
    update public.content_reports set status=case p_action when 'resolve' then 'resolved' else 'dismissed' end,resolved_at=now() where id=p_id;
  elsif p_kind='publisher' and p_action in ('grant','revoke') then
    update public.profiles set can_publish=(p_action='grant') where id=p_id;
    if found then
      update public.creator_applications set status=case when p_action='grant' then 'approved' else 'declined' end,
        decided_at=now(),decided_by=auth.uid(),decision_reason=p_reason
        where user_id=p_id and status='pending';
      perform public.notify_user(p_id,
        case when p_action='grant' then 'You can now publish' else 'Creator access' end,
        case when p_action='grant' then 'Your creator access is approved. Create your first channel from the + button.'
          else 'Your creator access was not approved.'||coalesce(' Reason: '||nullif(btrim(p_reason),''),'') end,
        jsonb_build_object('kind','creator_access','status',case when p_action='grant' then 'approved' else 'declined' end));
    end if;
  elsif p_kind='account' and p_action in ('suspend','ban','restore') then
    if p_id=auth.uid() then raise exception 'cannot_restrict_self'; end if;
    update public.profiles set account_status=case p_action when 'suspend' then 'suspended' when 'ban' then 'banned' else 'active' end where id=p_id;
  else raise exception 'invalid_moderation_action';
  end if;
  if not exists(
    select 1 from public.channels where p_kind='channel' and id=p_id
    union all select 1 from public.titles where p_kind='title' and id=p_id
    union all select 1 from public.content_reports where p_kind='report' and id=p_id
    union all select 1 from public.profiles where p_kind in ('publisher','account') and id=p_id
  ) then raise exception 'target_unavailable'; end if;
  insert into public.audit_log(actor_id,action,target_kind,target_id,reason,details)
    values(auth.uid(),p_action,p_kind,p_id,p_reason,jsonb_build_object('visibility',p_visibility));
end; $$;

create or replace function public.report_title(p_title_id uuid,p_reason text,p_details text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform 1 from public.profiles where id=auth.uid() and account_status='active' for update;
  if not found then raise exception 'account_restricted' using errcode='42501'; end if;
  if not public.can_read_title(p_title_id) then raise exception 'title_unavailable'; end if;
  if (select count(*) from public.content_reports where reporter_id=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'report_rate_limit'; end if;
  insert into public.content_reports(reporter_id,title_id,reason,details) values(auth.uid(),p_title_id,btrim(p_reason),p_details)
    -- Reporting again reopens a report an administrator already closed; it was lost before.
    on conflict(reporter_id,title_id) do update set reason=excluded.reason,details=excluded.details,
      status='open',resolved_at=null,created_at=now()
    returning id into v_id;
  return v_id;
end; $$;
