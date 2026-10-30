-- PR6: durable notification/deletion queues and observable scheduled workers.
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  installation_id uuid not null,
  token text not null unique check (token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$'),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(user_id,installation_id)
);
create table public.notices (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  user_id uuid not null references public.profiles on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 1000),
  data jsonb not null default '{}' check (jsonb_typeof(data)='object' and octet_length(data::text)<=1500),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(campaign_id,user_id)
);
create index notices_inbox_idx on public.notices(user_id,created_at desc);
create table public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices on delete cascade,
  token_id uuid not null references public.push_tokens on delete cascade,
  state text not null default 'queued' check (state in ('queued','waiting','delivered','failed')),
  ticket_id text,
  submitted_at timestamptz,
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  last_error text,
  unique(notice_id,token_id)
);
create index push_deliveries_due_idx on public.push_deliveries(next_attempt_at) where state in ('queued','waiting');
create function public.register_push_token(p_installation_id uuid,p_token text) returns void
language plpgsql security definer set search_path='' as $$
declare v_existing public.push_tokens;
begin
  perform 1 from public.profiles where id=auth.uid() and account_status='active' for update;
  if not found then raise exception 'account_restricted' using errcode='42501'; end if;
  if p_installation_id is null or p_token is null then raise exception 'invalid_push_token'; end if;
  delete from public.push_tokens where user_id=auth.uid() and installation_id=p_installation_id and token<>p_token;
  select * into v_existing from public.push_tokens where token=p_token for update;
  if found and v_existing.user_id<>auth.uid() then
    -- Device account switches must never deliver the previous account's inbox.
    delete from public.push_deliveries where token_id=v_existing.id;
  end if;
  if (select count(*) from public.push_tokens where user_id=auth.uid())>=10
    and not exists(select 1 from public.push_tokens where user_id=auth.uid() and token=p_token) then raise exception 'too_many_devices'; end if;
  insert into public.push_tokens(user_id,installation_id,token) values(auth.uid(),p_installation_id,p_token)
  on conflict(token) do update set user_id=excluded.user_id,installation_id=excluded.installation_id,enabled=true,updated_at=now();
end; $$;
create function public.unregister_push_token(p_installation_id uuid) returns void
language sql security definer set search_path='' as $$
  delete from public.push_tokens where user_id=auth.uid() and installation_id=p_installation_id;
$$;
create function public.mark_notice_read(p_notice_id uuid) returns void
language sql security definer set search_path='' as $$
  update public.notices set read_at=coalesce(read_at,now()) where id=p_notice_id and user_id=auth.uid();
$$;
create function public.send_notice(p_campaign_id uuid,p_user_ids uuid[],p_title text,p_body text,p_data jsonb default '{}') returns int
language plpgsql security definer set search_path='' as $$
declare v_count int;
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if p_campaign_id is null or p_user_ids is null or cardinality(p_user_ids) not between 1 and 500 then raise exception 'invalid_recipients'; end if;
  insert into public.notices(campaign_id,user_id,title,body,data)
    select p_campaign_id,p.id,btrim(p_title),p_body,p_data from public.profiles p
    where p.id=any(p_user_ids) and p.account_status='active' on conflict(campaign_id,user_id) do nothing;
  get diagnostics v_count=row_count;
  insert into public.push_deliveries(notice_id,token_id)
    select n.id,t.id from public.notices n join public.push_tokens t on t.user_id=n.user_id and t.enabled
    where n.campaign_id=p_campaign_id and n.user_id=any(p_user_ids) on conflict do nothing;
  insert into public.audit_log(actor_id,action,target_kind,target_id,details)
    values(auth.uid(),'send','notice_campaign',p_campaign_id,jsonb_build_object('recipients',v_count));
  return v_count;
end; $$;
create function public.claim_push_deliveries(p_limit int default 20) returns setof public.push_deliveries
language sql security definer set search_path='' as $$
  update public.push_deliveries d set lease_id=gen_random_uuid(),lease_until=now()+interval '3 minutes',
    attempts=attempts+case when state='queued' then 1 else 0 end
    where d.id in (select id from public.push_deliveries where state in ('queued','waiting') and next_attempt_at<=now()
      and (lease_until is null or lease_until<now()) order by next_attempt_at limit greatest(1,least(p_limit,100)) for update skip locked)
    returning d.*;
$$;
create function public.finish_push_delivery(p_id uuid,p_lease uuid,p_state text,p_ticket text default null,p_error text default null,p_disable boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare v_row public.push_deliveries;
begin
  select * into v_row from public.push_deliveries where id=p_id and lease_id=p_lease for update;
  if not found then return; end if;
  if p_state not in ('queued','waiting','delivered','failed') then raise exception 'invalid_delivery_state'; end if;
  if p_disable then update public.push_tokens set enabled=false where id=v_row.token_id; end if;
  update public.push_deliveries set
    state=case when p_state='queued' and attempts>=10 then 'failed' else p_state end,
    ticket_id=coalesce(p_ticket,ticket_id),submitted_at=case when p_ticket is not null then now() else submitted_at end,
    last_error=left(p_error,200),lease_id=null,lease_until=null,
    next_attempt_at=now()+case when p_state='waiting' then
      case when v_row.state='waiting' then interval '5 minutes' else interval '15 minutes' end
      else make_interval(secs=>least(21600,(30*power(2,least(attempts,10)))::int)) end
    where id=p_id;
end; $$;

create table public.stream_deletion_queue (
  stream_uid text primary key,
  owner_id uuid,
  state text not null default 'queued' check (state in ('queued','failed')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.stream_assets add column owner_id uuid;
update public.stream_assets a set owner_id=t.owner_id from public.titles t where t.id=a.title_id;
alter table public.stream_assets alter column owner_id set not null;
create function public.set_stream_owner() returns trigger language plpgsql set search_path='' as $$
begin
  select owner_id into new.owner_id from public.titles where id=new.title_id;
  return new;
end; $$;
create trigger stream_asset_owner before insert or update of title_id on public.stream_assets
  for each row execute function public.set_stream_owner();
create function public.queue_stream_erasure() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.stream_uid is not null then
    insert into public.stream_deletion_queue(stream_uid,owner_id) values(old.stream_uid,old.owner_id) on conflict do nothing;
  end if;
  return old;
end; $$;
create trigger stream_asset_erasure after delete on public.stream_assets for each row execute function public.queue_stream_erasure();
create function public.reset_stream_upload(p_title_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_title public.titles; v_asset public.stream_assets;
begin
  select * into v_title from public.titles where id=p_title_id for update;
  if not found or not public.publisher_allowed(auth.uid(),v_title.channel_id) then raise exception 'publisher_required' using errcode='42501'; end if;
  if v_title.status not in ('draft','rejected') then raise exception 'title_not_editable'; end if;
  select * into v_asset from public.stream_assets where title_id=p_title_id for update;
  if found and not (v_asset.state='error' or (v_asset.state='uploading' and v_asset.upload_expires_at<now()) or (v_asset.state='allocating' and v_asset.lease_until<now())) then raise exception 'upload_busy'; end if;
  delete from public.stream_assets where title_id=p_title_id;
  update public.titles set status='draft' where id=p_title_id;
end; $$;
create function public.claim_media_deletions(p_limit int default 20) returns setof public.stream_deletion_queue
language sql security definer set search_path='' as $$
  update public.stream_deletion_queue q set lease_id=gen_random_uuid(),lease_until=now()+interval '3 minutes',attempts=attempts+1
    where q.stream_uid in (select stream_uid from public.stream_deletion_queue where state='queued' and next_attempt_at<=now()
      and (lease_until is null or lease_until<now()) order by next_attempt_at limit greatest(1,least(p_limit,100)) for update skip locked)
    returning q.*;
$$;
create function public.finish_media_deletion(p_uid text,p_lease uuid,p_error text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_error is null then delete from public.stream_deletion_queue where stream_uid=p_uid and lease_id=p_lease;
  else update public.stream_deletion_queue set last_error=left(p_error,200),lease_id=null,lease_until=null,
    state=case when attempts>=10 then 'failed' else 'queued' end,
    next_attempt_at=now()+make_interval(secs=>least(21600,(30*power(2,least(attempts,10)))::int)) where stream_uid=p_uid and lease_id=p_lease;
  end if;
end; $$;

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  state text not null default 'queued' check (state in ('queued','complete','failed')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create function public.request_account_deletion(p_user_id uuid,p_session_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform 1 from public.profiles where id=p_user_id for update;
  if not found then raise exception 'account_unavailable'; end if;
  if not exists(select 1 from auth.sessions where id=p_session_id and user_id=p_user_id and created_at>now()-interval '15 minutes') then
    raise exception 'recent_sign_in_required' using errcode='42501'; end if;
  insert into public.account_deletion_requests(user_id) values(p_user_id)
    on conflict(user_id) do update set user_id=excluded.user_id returning id into v_id;
  update public.profiles set account_status='suspended',can_publish=false where id=p_user_id;
  update public.channels set status='archived' where created_by=p_user_id;
  update public.titles set status='archived' where owner_id=p_user_id;
  return v_id;
end; $$;
create function public.prevent_deletion_restore() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.account_status='active' and exists(select 1 from public.account_deletion_requests where user_id=new.id and state<>'complete') then raise exception 'deletion_pending'; end if;
  return new;
end; $$;
create trigger profiles_deletion_guard before update of account_status on public.profiles for each row execute function public.prevent_deletion_restore();
create function public.claim_account_deletions(p_limit int default 5) returns setof public.account_deletion_requests
language sql security definer set search_path='' as $$
  update public.account_deletion_requests q set lease_id=gen_random_uuid(),lease_until=now()+interval '3 minutes',attempts=attempts+1
    where q.id in (select id from public.account_deletion_requests where state='queued' and next_attempt_at<=now()
      and (lease_until is null or lease_until<now()) order by next_attempt_at limit greatest(1,least(p_limit,20)) for update skip locked)
    returning q.*;
$$;
create function public.prepare_account_erasure(p_user_id uuid,p_request_id uuid,p_lease uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.account_deletion_requests where id=p_request_id and user_id=p_user_id and lease_id=p_lease and lease_until>now() for update;
  if not found then raise exception 'deletion_lease_lost'; end if;
  -- Database metadata is removed first; media deletion is durable across cascades.
  delete from public.titles where owner_id=p_user_id;
  delete from public.channels where created_by=p_user_id;
  delete from public.app_installs where user_id=p_user_id;
  delete from public.meta_event_outbox where user_id=p_user_id;
  delete from public.payment_events where purchase_token in (select purchase_token from public.subscriptions where user_id=p_user_id);
  delete from public.content_reports where reporter_id=p_user_id;
end; $$;
create function public.finish_account_deletion(p_id uuid,p_lease uuid,p_complete boolean,p_error text default null) returns void
language sql security definer set search_path='' as $$
  update public.account_deletion_requests set state=case when p_complete then 'complete' else 'queued' end,
    user_id=case when p_complete then null else user_id end,completed_at=case when p_complete then now() else null end,
    lease_id=null,lease_until=null,last_error=left(p_error,200),next_attempt_at=now()+interval '5 minutes'
    where id=p_id and lease_id=p_lease;
$$;

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','error')),
  summary jsonb not null default '{}'
);
create index job_runs_recent_idx on public.job_runs(job_name,started_at desc);
create function public.backend_health() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'checked_at',now(),
    'overdue_subscriptions',(select count(*) from public.subscriptions where superseded_by is null and next_check_at<now()-interval '1 hour'),
    'failed_meta_events',(select count(*) from public.meta_event_outbox where status='failed'),
    'overdue_meta_events',(select count(*) from public.meta_event_outbox where status='queued' and next_attempt_at<now()-interval '15 minutes'),
    'failed_push_deliveries',(select count(*) from public.push_deliveries where state='failed'),
    'overdue_push_deliveries',(select count(*) from public.push_deliveries where state in ('queued','waiting') and next_attempt_at<now()-interval '15 minutes'),
    'failed_media_deletions',(select count(*) from public.stream_deletion_queue where state='failed'),
    'overdue_account_deletions',(select count(*) from public.account_deletion_requests where state<>'complete' and created_at<now()-interval '1 hour'),
    'stalled_uploads',(select count(*) from public.stream_assets where state in ('uploading','processing') and next_check_at<now()-interval '30 minutes'),
    'recent_worker_errors',(select count(*) from public.job_runs where status='error' and started_at>now()-interval '1 hour'),
    'missing_workers',(select coalesce(jsonb_agg(name),'[]'::jsonb) from unnest(array['subscription-reconcile','meta-capi-dispatch','drive-cleanup','stream-reconcile','media-cleanup','notification-dispatch','account-deletion-worker']) name
      where not exists(select 1 from public.job_runs j where j.job_name=name and j.status='success' and j.finished_at>now()-interval '30 minutes'))
  );
$$;
create function public.prune_operational_records() returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.job_runs where started_at<now()-interval '30 days';
  delete from public.account_deletion_requests where state='complete' and completed_at<now()-interval '30 days';
end; $$;

alter table public.push_tokens enable row level security;
alter table public.notices enable row level security;
alter table public.push_deliveries enable row level security;
alter table public.stream_deletion_queue enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.job_runs enable row level security;
create policy "read own push tokens" on public.push_tokens for select to authenticated using(user_id=auth.uid());
create policy "read own notices" on public.notices for select to authenticated using(user_id=auth.uid());
create policy "admins read worker runs" on public.job_runs for select to authenticated using(public.is_admin());
revoke all on public.push_tokens,public.notices,public.push_deliveries,public.stream_deletion_queue,public.account_deletion_requests,public.job_runs from anon,authenticated;
grant select on public.push_tokens,public.notices,public.job_runs to authenticated;
revoke all on function public.register_push_token(uuid,text),public.unregister_push_token(uuid),public.mark_notice_read(uuid),
 public.send_notice(uuid,uuid[],text,text,jsonb),public.claim_push_deliveries(int),public.finish_push_delivery(uuid,uuid,text,text,text,boolean),
 public.set_stream_owner(),public.queue_stream_erasure(),public.reset_stream_upload(uuid),public.claim_media_deletions(int),public.finish_media_deletion(text,uuid,text),
 public.request_account_deletion(uuid,uuid),public.prevent_deletion_restore(),public.claim_account_deletions(int),
 public.prepare_account_erasure(uuid,uuid,uuid),public.finish_account_deletion(uuid,uuid,boolean,text),public.backend_health(),public.prune_operational_records()
 from public,anon,authenticated;
grant execute on function public.register_push_token(uuid,text),public.unregister_push_token(uuid),public.mark_notice_read(uuid),
 public.send_notice(uuid,uuid[],text,text,jsonb),public.reset_stream_upload(uuid) to authenticated;
grant execute on function public.claim_push_deliveries(int),public.finish_push_delivery(uuid,uuid,text,text,text,boolean),
 public.claim_media_deletions(int),public.finish_media_deletion(text,uuid,text),public.request_account_deletion(uuid,uuid),
 public.claim_account_deletions(int),public.prepare_account_erasure(uuid,uuid,uuid),public.finish_account_deletion(uuid,uuid,boolean,text),
 public.backend_health(),public.prune_operational_records() to service_role;
