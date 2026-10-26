-- PR3: provider-verified subscriptions, public plans, attribution and leased outbox.
create extension if not exists pgcrypto with schema extensions;

alter table public.profiles add column play_account_id text
  generated always as (encode(extensions.digest(id::text, 'sha256'), 'hex')) stored;
create unique index profiles_play_account_idx on public.profiles(play_account_id);

create table public.plans (
  product_id text primary key,
  name text not null,
  billing_period text not null check (billing_period in ('P1M','P3M','P6M','P1Y')),
  quota_bytes bigint not null check (quota_bytes >= 0),
  benefits text[] not null default '{}',
  active boolean not null default false,
  created_at timestamptz not null default now()
);
-- No invented prices or live products: populate from the client's Play Console.
alter table public.plans enable row level security;
create policy "public reads active plans" on public.plans for select to anon, authenticated using (active);
revoke all on public.plans from anon, authenticated;
grant select on public.plans to anon, authenticated;

alter table public.subscriptions
  add column latest_order_id text,
  add column superseded_by text,
  add column next_check_at timestamptz not null default now(),
  add column sync_error text;
create index subscriptions_reconcile_idx on public.subscriptions(next_check_at) where superseded_by is null;
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- A lease is acquired BEFORE reading Google. Expired workers cannot commit stale state.
create table public.subscription_sync_locks (
  purchase_token text primary key,
  lease_id uuid not null,
  expires_at timestamptz not null
);
alter table public.subscription_sync_locks enable row level security;
revoke all on public.subscription_sync_locks from anon, authenticated;

create function public.claim_subscription_sync(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid(); v_result uuid;
begin
  insert into public.subscription_sync_locks values (p_token, v_id, now() + interval '3 minutes')
  on conflict (purchase_token) do update set lease_id = excluded.lease_id, expires_at = excluded.expires_at
  where public.subscription_sync_locks.expires_at < now()
  returning lease_id into v_result;
  return v_result;
end; $$;

create function public.release_subscription_sync(p_token text, p_lease uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.subscription_sync_locks where purchase_token = p_token and lease_id = p_lease;
$$;

create function public.resolve_play_owner(p_account_id text, p_linked_token text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_account uuid; v_linked uuid;
begin
  select id into v_account from public.profiles where play_account_id = p_account_id;
  select user_id into v_linked from public.subscriptions where purchase_token = p_linked_token;
  if v_account is not null and v_linked is not null and v_account <> v_linked then
    raise exception 'purchase_owner_mismatch' using errcode = '42501';
  end if;
  return coalesce(v_account, v_linked);
end; $$;

-- Subscription + attribution event commit together, with immutable token ownership.
create function public.apply_play_snapshot(
  p_token text, p_lease uuid, p_user_id uuid, p_snapshot jsonb, p_event jsonb default null
) returns public.subscriptions
language plpgsql security definer set search_path = '' as $$
declare v_row public.subscriptions; v_linked text := p_snapshot->>'linked_token'; v_old public.subscriptions;
begin
  perform 1 from public.subscription_sync_locks
  where purchase_token = p_token and lease_id = p_lease and expires_at > now() for update;
  if not found then raise exception 'sync_lease_lost'; end if;
  -- Shared lock order serializes replacement tokens for the same account.
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'purchase_owner_missing'; end if;
  select * into v_row from public.subscriptions where purchase_token = p_token for update;
  if found and v_row.user_id <> p_user_id then
    raise exception 'purchase_owner_mismatch' using errcode = '42501';
  end if;
  if v_row.superseded_by is not null then return v_row; end if;
  if v_linked is not null and v_linked <> p_token then
    select * into v_old from public.subscriptions where purchase_token = v_linked for update;
    if found and v_old.user_id <> p_user_id then
      raise exception 'purchase_owner_mismatch' using errcode = '42501';
    end if;
    -- Pending replacements do not end the old entitlement.
    if p_snapshot->>'status' in ('active','in_grace','cancelled') then
      update public.subscriptions set status = 'expired', paid_until = least(paid_until, now()), superseded_by = p_token
      where purchase_token = v_linked;
    end if;
  end if;
  insert into public.subscriptions(user_id, product_id, purchase_token, status, is_trial, paid_until, verified_at, latest_order_id, next_check_at)
  values(p_user_id, p_snapshot->>'product_id', p_token, p_snapshot->>'status',
    (p_snapshot->>'is_trial')::boolean, (p_snapshot->>'paid_until')::timestamptz, now(),
    p_snapshot->>'order_id', now() + interval '6 hours')
  on conflict (purchase_token) do update set
    product_id = excluded.product_id, status = excluded.status, is_trial = excluded.is_trial,
    paid_until = excluded.paid_until, verified_at = excluded.verified_at, latest_order_id = excluded.latest_order_id,
    next_check_at = excluded.next_check_at, sync_error = null
  returning * into v_row;
  if p_event is not null then
    insert into public.meta_event_outbox(event_id, event_name, user_id, value, currency, payload)
    values(p_event->>'event_id', p_event->>'event_name', p_user_id, (p_event->>'value')::numeric,
      p_event->>'currency', p_event->'payload') on conflict (event_id) do nothing;
  end if;
  return v_row;
end; $$;

-- Plans determine paid storage; legacy records keep the existing subscriber allowance.
create or replace function public.drive_quota_bytes(p_user_id uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select greatest(s.free_quota_bytes, coalesce((
    select max(coalesce(p.quota_bytes, s.subscriber_quota_bytes))
    from public.subscriptions sub left join public.plans p on p.product_id = sub.product_id
    where sub.user_id = p_user_id and sub.status in ('active','in_grace','cancelled') and sub.paid_until > now()
  ), s.free_quota_bytes)) from public.drive_settings s;
$$;

alter table public.app_installs
  add column installation_id uuid,
  add column tracking_consent boolean not null default false,
  add column extinfo jsonb,
  add column updated_at timestamptz not null default now();
create unique index app_installs_owner_install_idx on public.app_installs(user_id, installation_id);
create trigger app_installs_set_updated_at before update on public.app_installs
  for each row execute function public.set_updated_at();

alter table public.meta_event_outbox
  add column next_attempt_at timestamptz not null default now(),
  add column lease_id uuid,
  add column lease_until timestamptz;
create function public.claim_meta_events(p_limit int default 50) returns setof public.meta_event_outbox
language sql security definer set search_path = '' as $$
  update public.meta_event_outbox o set lease_id = gen_random_uuid(), lease_until = now() + interval '3 minutes', attempts = attempts + 1
  where o.id in (
    select id from public.meta_event_outbox where status = 'queued' and next_attempt_at <= now()
      and (lease_until is null or lease_until < now())
    order by next_attempt_at limit greatest(1, least(p_limit, 100)) for update skip locked
  ) returning o.*;
$$;
create function public.finish_meta_event(p_id uuid, p_lease uuid, p_error text default null) returns void
language sql security definer set search_path = '' as $$
  update public.meta_event_outbox set
    status = case when p_error is null then 'sent' when attempts >= 10 then 'failed' else 'queued' end,
    sent_at = case when p_error is null then now() else null end,
    last_error = left(p_error, 500), lease_id = null, lease_until = null,
    next_attempt_at = now() + make_interval(secs => least(21600, (30 * power(2, least(attempts, 10)))::int))
  where id = p_id and lease_id = p_lease;
$$;

revoke all on function public.claim_subscription_sync(text) from public, anon, authenticated;
revoke all on function public.release_subscription_sync(text,uuid) from public, anon, authenticated;
revoke all on function public.resolve_play_owner(text,text) from public, anon, authenticated;
revoke all on function public.apply_play_snapshot(text,uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.claim_meta_events(int) from public, anon, authenticated;
revoke all on function public.finish_meta_event(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.claim_subscription_sync(text), public.release_subscription_sync(text,uuid),
  public.resolve_play_owner(text,text), public.apply_play_snapshot(text,uuid,uuid,jsonb,jsonb),
  public.claim_meta_events(int), public.finish_meta_event(uuid,uuid,text) to service_role;
