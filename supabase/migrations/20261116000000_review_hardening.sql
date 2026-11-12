-- Fixes from the pre-launch security review.

-- 1. Drive: an unfinished upload counts as the larger of what was reserved and what was
-- actually stored, and stops being readable when its reservation runs out. Before, a
-- 1-byte reservation could hold and serve a 2 GB object outside the quota.
create or replace function public.drive_can_read_object(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.files f where f.storage_path=p_name and f.owner_id=auth.uid()
    and (f.status='ready' or (f.status='pending' and f.expires_at>now()))
    and not exists(select 1 from public.account_deletion_requests d where d.user_id=f.owner_id and d.state<>'complete'));
$$;
create or replace function public.drive_usage(p_user_id uuid, out used_bytes bigint, out reserved_bytes bigint)
language sql stable security definer set search_path='' as $$
  select
    coalesce(sum(f.size_bytes) filter (where f.status = 'ready'), 0)::bigint,
    coalesce(sum(greatest(
      case when f.expires_at > now() then f.size_bytes else 0 end,
      coalesce((o.metadata ->> 'size')::bigint, 0))) filter (where f.status = 'pending'), 0)::bigint
  from public.files f
  left join storage.objects o on o.bucket_id = 'user-files' and o.name = f.storage_path
  where f.owner_id = p_user_id;
$$;

-- 2. Audit log: deleting an account must not erase who did an audited action. The row
-- keeps the account's ID, which identifies nobody once the account is gone.
alter table public.audit_log drop constraint audit_log_actor_id_fkey;

-- 3. Video state only moves forward. A status check that read "uploading" just before
-- Cloudflare reported "ready" could otherwise mark a finished video as failed.
create or replace function public.apply_stream_state(p_uid text,p_state text,p_duration double precision,p_signed boolean,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_state not in ('uploading','processing','ready','error') then raise exception 'invalid_stream_state'; end if;
  update public.stream_assets set state=case when not p_signed then 'error' else p_state end,
    signed_only=p_signed,duration_seconds=p_duration,error_code=case when not p_signed then 'unsigned_asset' else left(p_error,100) end,
    upload_url=case when p_state in ('ready','error') then null else upload_url end,next_check_at=now()+interval '10 minutes'
    where stream_uid=p_uid and (state<>'ready' or p_state='ready' or not p_signed);
end; $$;

-- 4. A bank transfer pays for one period, once. Orders are deleted with their account,
-- so the UTRs of confirmed payments are kept here, where a deleted account cannot free
-- one for reuse.
create table public.used_utrs (
  utr text primary key,
  used_at timestamptz not null default now()
);
alter table public.used_utrs enable row level security;
insert into public.used_utrs(utr, used_at)
  select utr, coalesce(decided_at, now()) from public.upi_orders
  where utr is not null and status in ('paid','refunded') on conflict do nothing;

create function public.record_used_utr() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.used_utrs(utr) values (new.utr) on conflict do nothing;
  return new;
end; $$;
create trigger upi_order_paid_utr after update of status on public.upi_orders
  for each row when (new.status = 'paid' and new.utr is not null)
  execute function public.record_used_utr();

create function public.refuse_used_utr() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists (select 1 from public.used_utrs where utr = new.utr) then
    raise exception 'utr_already_used';
  end if;
  return new;
end; $$;
create trigger upi_order_utr_unused before update of utr on public.upi_orders
  for each row when (new.status = 'submitted' and new.utr is not null and new.utr is distinct from old.utr)
  execute function public.refuse_used_utr();

revoke all on function public.record_used_utr(), public.refuse_used_utr() from public, anon, authenticated;

-- 5. The tax rate of a payment is the rate when the member was asked to pay, not the
-- rate when an administrator later confirms it.
alter table public.upi_orders add column tax_percent numeric(5,2);
update public.upi_orders set tax_percent = (select tax_percent from public.payment_settings);
create function public.set_order_tax() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  select tax_percent into new.tax_percent from public.payment_settings;
  return new;
end; $$;
create trigger upi_order_tax before insert on public.upi_orders
  for each row execute function public.set_order_tax();
revoke all on function public.set_order_tax() from public, anon, authenticated;

create or replace function public.queue_play_external_report() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  v_pre_tax integer;
begin
  v_pre_tax := round(new.amount_paise * 100 / (100 + coalesce(new.tax_percent, 0)));
  insert into public.play_external_reports(external_transaction_id, external_transaction_token,
      pre_tax_paise, tax_paise, tax_state, transaction_time)
    values ('upi-' || new.id, new.external_transaction_token, v_pre_tax,
      new.amount_paise - v_pre_tax, new.tax_state, coalesce(new.submitted_at, new.decided_at, now()))
  on conflict (external_transaction_id, kind) do nothing;
  return new;
end; $$;
