-- Keep Storage access inside service RPCs; storage is not a public PostgREST schema.
create function public.account_erasure_objects(p_user_id uuid,p_request_id uuid,p_lease uuid,p_limit int default 100)
returns table(bucket_id text,name text) language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.account_deletion_requests where id=p_request_id and user_id=p_user_id
    and lease_id=p_lease and lease_until>now()) then raise exception 'deletion_lease_lost'; end if;
  return query select o.bucket_id,o.name from storage.objects o
    where o.owner_id=p_user_id::text or (o.bucket_id='user-files' and o.name like p_user_id::text||'/%')
    order by o.bucket_id,o.name limit greatest(1,least(p_limit,100));
end; $$;

-- Opaque hashes stop late Play notifications from recreating erased raw tokens.
create table public.erased_purchase_tokens (
  token_hash text primary key,
  expires_at timestamptz not null default now()+interval '90 days'
);
alter table public.erased_purchase_tokens enable row level security;
revoke all on public.erased_purchase_tokens from anon,authenticated;
create function public.is_erased_purchase_token(p_token text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.erased_purchase_tokens where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now());
$$;
create function public.guard_erased_purchase() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    if exists(select 1 from public.account_deletion_requests where user_id=old.user_id) then
      insert into public.erased_purchase_tokens(token_hash) values(encode(extensions.digest(old.purchase_token,'sha256'),'hex')) on conflict do nothing;
      delete from public.payment_events where purchase_token=old.purchase_token;
    end if;
    return old;
  end if;
  if public.is_erased_purchase_token(new.purchase_token) then raise exception 'purchase_erased' using errcode='42501'; end if;
  return new;
end; $$;
create trigger subscriptions_erasure_guard before insert or update or delete on public.subscriptions
  for each row execute function public.guard_erased_purchase();
create function public.scrub_erased_payment_event() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if public.is_erased_purchase_token(new.purchase_token) then
    new.purchase_token:=null;new.payload:='{"erased":true}';new.processed_at:=now();
  end if;
  return new;
end; $$;
create trigger payment_events_erasure_guard before insert or update on public.payment_events
  for each row execute function public.scrub_erased_payment_event();
create or replace function public.prepare_account_erasure(p_user_id uuid,p_request_id uuid,p_lease uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.account_deletion_requests where id=p_request_id and user_id=p_user_id and lease_id=p_lease and lease_until>now() for update;
  if not found then raise exception 'deletion_lease_lost'; end if;
  insert into public.erased_purchase_tokens(token_hash)
    select encode(extensions.digest(purchase_token,'sha256'),'hex') from public.subscriptions where user_id=p_user_id on conflict do nothing;
  delete from public.titles where owner_id=p_user_id;
  delete from public.channels where created_by=p_user_id;
  delete from public.app_installs where user_id=p_user_id;
  delete from public.meta_event_outbox where user_id=p_user_id;
  delete from public.payment_events where purchase_token in (select purchase_token from public.subscriptions where user_id=p_user_id);
  delete from public.content_reports where reporter_id=p_user_id;
end; $$;
create or replace function public.prune_operational_records() returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.job_runs where started_at<now()-interval '30 days';
  delete from public.account_deletion_requests where state='complete' and completed_at<now()-interval '30 days';
  delete from public.erased_purchase_tokens where expires_at<now();
end; $$;

create policy "admins read profiles" on public.profiles for select to authenticated using(public.is_admin());
create function public.audit_privileged_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_details jsonb;
begin
  if tg_table_name='profiles' then
    if (new.role,new.account_status,new.can_publish) is not distinct from (old.role,old.account_status,old.can_publish) then return new; end if;
    v_id:=new.id;v_details:=jsonb_build_object('role',new.role,'account_status',new.account_status,'can_publish',new.can_publish);
  else
    if tg_op='DELETE' then v_id:=old.id;v_details:='{}';
    else v_id:=new.id;v_details:=jsonb_build_object('status',new.status,'is_private',new.is_private,'requires_subscription',new.requires_subscription);
    end if;
  end if;
  insert into public.audit_log(actor_id,action,target_kind,target_id,details) values(auth.uid(),lower(tg_op),tg_table_name,v_id,v_details);
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;
create trigger audit_profile_privileges after update on public.profiles for each row execute function public.audit_privileged_change();
create trigger audit_channel_changes after insert or update or delete on public.channels for each row execute function public.audit_privileged_change();

revoke all on function public.account_erasure_objects(uuid,uuid,uuid,int),public.is_erased_purchase_token(text),
 public.guard_erased_purchase(),public.scrub_erased_payment_event(),public.audit_privileged_change() from public,anon,authenticated;
grant execute on function public.account_erasure_objects(uuid,uuid,uuid,int),public.is_erased_purchase_token(text) to service_role;
