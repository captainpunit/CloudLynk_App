-- Payment records outlive a deleted account, as the privacy policy and the account
-- deletion page say: tax law requires them. Before an account is erased, each paid or
-- refunded payment is copied here without anything that identifies the member (no user
-- ID, name or email): what was bought, for how much, when, and the payment reference.
create table public.payment_ledger (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('upi','google_play')),
  product_id text not null,
  plan_name text,
  amount_paise integer,
  tax_percent numeric,
  tax_state text,
  -- The UTR for UPI, the Google Play order ID for Play.
  reference text not null,
  status text not null,
  paid_at timestamptz,
  refunded_at timestamptz,
  erased_at timestamptz not null default now()
);
-- A retried erasure copies nothing twice.
create unique index payment_ledger_reference_idx on public.payment_ledger(source, reference);
alter table public.payment_ledger enable row level security;
revoke all on public.payment_ledger from anon, authenticated;
grant select on public.payment_ledger to authenticated;
create policy "admins read the payment ledger" on public.payment_ledger
  for select to authenticated using (public.is_admin());

create or replace function public.prepare_account_erasure(p_user_id uuid,p_request_id uuid,p_lease uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.account_deletion_requests where id=p_request_id and user_id=p_user_id and lease_id=p_lease and lease_until>now() for update;
  if not found then raise exception 'deletion_lease_lost'; end if;
  insert into public.payment_ledger(source,product_id,plan_name,amount_paise,tax_percent,tax_state,reference,status,paid_at,refunded_at)
    select 'upi',o.product_id,o.plan_name,o.amount_paise,o.tax_percent,o.tax_state,o.utr,o.status,o.decided_at,o.refunded_at
    from public.upi_orders o where o.user_id=p_user_id and o.status in ('paid','refunded') and o.utr is not null
    on conflict (source, reference) do nothing;
  insert into public.payment_ledger(source,product_id,reference,status,paid_at)
    select 'google_play',s.product_id,s.latest_order_id,s.status,coalesce(s.period_start,s.created_at)
    from public.subscriptions s where s.user_id=p_user_id and s.provider='google_play' and s.latest_order_id is not null
    on conflict (source, reference) do nothing;
  insert into public.erased_purchase_tokens(token_hash)
    select encode(extensions.digest(purchase_token,'sha256'),'hex') from public.subscriptions where user_id=p_user_id on conflict do nothing;
  delete from public.titles where owner_id=p_user_id;
  delete from public.channels where created_by=p_user_id;
  delete from public.app_installs where user_id=p_user_id;
  delete from public.meta_event_outbox where user_id=p_user_id;
  delete from public.payment_events where purchase_token in (select purchase_token from public.subscriptions where user_id=p_user_id);
  delete from public.content_reports where reporter_id=p_user_id;
end; $$;
