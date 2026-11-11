-- Refunds. The money is returned from the bank or by Google; these functions record it,
-- end the access that payment bought, and tell Google when the payment had been reported.

alter table public.upi_orders
  drop constraint upi_orders_status_check,
  add constraint upi_orders_status_check
    check (status in ('created','submitted','paid','rejected','expired','refunded')),
  add column refunded_at timestamptz;
-- A refunded payment's bank reference stays used.
drop index public.upi_orders_utr_idx;
create unique index upi_orders_utr_idx on public.upi_orders(utr)
  where status in ('submitted','paid','refunded');

-- A reported payment can later need one refund report.
alter table public.play_external_reports
  add column kind text not null default 'create' check (kind in ('create','refund')),
  drop constraint play_external_reports_external_transaction_id_key,
  add constraint play_external_reports_transaction_kind_key unique (external_transaction_id, kind);
grant select (kind) on public.play_external_reports to authenticated;

create or replace function public.queue_play_external_report() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  v_percent numeric;
  v_pre_tax integer;
begin
  select tax_percent into v_percent from public.payment_settings;
  v_pre_tax := round(new.amount_paise * 100 / (100 + coalesce(v_percent, 0)));
  insert into public.play_external_reports(external_transaction_id, external_transaction_token,
      pre_tax_paise, tax_paise, tax_state, transaction_time)
    values ('upi-' || new.id, new.external_transaction_token, v_pre_tax,
      new.amount_paise - v_pre_tax, new.tax_state, coalesce(new.submitted_at, new.decided_at, now()))
  on conflict (external_transaction_id, kind) do nothing;
  return new;
end; $$;

-- Fixed-length payments are stacked: each new period starts where the member's current
-- time ends. period_start records that point, so a refund knows exactly which time the
-- payment bought. The profile row is locked by every function that grants time, so the
-- value read here is the one the grant itself stacked on.
alter table public.subscriptions add column period_start timestamptz;
-- Periods bought before this column existed: each began where the member's previous
-- period ended, or at the payment itself when there was none to stack on.
update public.subscriptions s set period_start = b.starts_at from (
  select id, greatest(created_at, coalesce(
    lag(paid_until) over (partition by user_id order by paid_until, created_at), created_at)) as starts_at
  from public.subscriptions where provider in ('upi','google_play_product')) b
where s.id = b.id;
create function public.set_period_start() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  select greatest(now(), coalesce(max(paid_until), now())) into new.period_start
    from public.subscriptions
    where user_id = new.user_id and status in ('active','in_grace','cancelled') and paid_until > now();
  return new;
end; $$;
create trigger subscriptions_period_start before insert on public.subscriptions
  for each row when (new.provider in ('upi','google_play_product') and new.period_start is null)
  execute function public.set_period_start();

-- Ends the time one payment bought. Payments made after it were stacked on top of its
-- end date, so they move earlier by the unused time that is taken away.
create function public.end_paid_period(p_subscription_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_sub public.subscriptions;
  v_removed interval;
begin
  -- Same lock order as the functions that grant time: profile first, then the row.
  perform 1 from public.profiles
    where id = (select user_id from public.subscriptions where id = p_subscription_id) for update;
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found or v_sub.status = 'refunded' then return null; end if;
  v_removed := v_sub.paid_until - greatest(now(), v_sub.period_start);
  update public.subscriptions set status = 'refunded', paid_until = least(paid_until, now())
    where id = v_sub.id;
  if v_removed > interval '0' then
    update public.subscriptions
      set paid_until = paid_until - v_removed, period_start = period_start - v_removed
      where user_id = v_sub.user_id and status in ('active','in_grace','cancelled')
        and period_start >= v_sub.paid_until;
  end if;
  return v_sub.user_id;
end; $$;

-- An administrator records that a confirmed UPI payment was returned to the member.
create function public.refund_upi_order(p_order_id uuid, p_reason text) returns public.upi_orders
language plpgsql security definer set search_path='' as $$
declare
  v_order public.upi_orders;
  v_owner uuid;
  v_reason text := left(nullif(btrim(coalesce(p_reason, '')), ''), 500);
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  select user_id into v_owner from public.upi_orders where id = p_order_id;
  if not found then raise exception 'order_not_found'; end if;
  -- Same lock order as the other order functions: profile first, then order.
  perform 1 from public.profiles where id = v_owner for update;
  select * into v_order from public.upi_orders where id = p_order_id for update;
  if v_order.status <> 'paid' then raise exception 'order_not_paid'; end if;
  perform public.end_paid_period(v_order.subscription_id);
  -- Meta is not told about a payment that was returned before the event went out.
  delete from public.meta_event_outbox where event_id = 'upi-order-' || v_order.id and status = 'queued';
  update public.upi_orders set status = 'refunded', refunded_at = now(), decision_reason = v_reason
    where id = v_order.id returning * into v_order;
  insert into public.play_external_reports(external_transaction_id, external_transaction_token,
      pre_tax_paise, tax_paise, tax_state, transaction_time, kind)
    select external_transaction_id, external_transaction_token, pre_tax_paise, tax_paise, tax_state,
      now(), 'refund'
    from public.play_external_reports
    where external_transaction_id = 'upi-' || v_order.id and kind = 'create'
  on conflict (external_transaction_id, kind) do nothing;
  perform public.notify_user(v_owner, 'Payment refunded',
    v_order.plan_name || ' was refunded: ' || v_reason,
    jsonb_build_object('kind', 'upi_order', 'order_id', v_order.id, 'status', 'refunded'));
  insert into public.audit_log(actor_id, action, target_kind, target_id, reason, details)
    values (auth.uid(), 'refund', 'upi_order', v_order.id, v_reason,
      jsonb_build_object('user_id', v_owner, 'product_id', v_order.product_id,
        'amount_paise', v_order.amount_paise, 'reference', v_order.reference));
  return v_order;
end; $$;

-- A refund is reported only after Google holds the payment it refers to.
create or replace function public.claim_play_reports(p_limit int default 20) returns setof public.play_external_reports
language sql security definer set search_path='' as $$
  -- Google cannot refund a payment it never accepted; stop waiting and flag it.
  update public.play_external_reports r set status = 'failed', last_error = 'payment_report_failed'
    where r.kind = 'refund' and r.status = 'queued' and exists(
      select 1 from public.play_external_reports c
      where c.external_transaction_id = r.external_transaction_id and c.kind = 'create' and c.status = 'failed');
  update public.play_external_reports r
    set lease_id = gen_random_uuid(), lease_until = now() + interval '3 minutes', attempts = attempts + 1
  where r.id in (
    select q.id from public.play_external_reports q
    where q.status = 'queued' and q.next_attempt_at <= now()
      and (q.lease_until is null or q.lease_until < now())
      and (q.kind = 'create' or exists(
        select 1 from public.play_external_reports c
        where c.external_transaction_id = q.external_transaction_id and c.kind = 'create' and c.status = 'sent'))
    order by q.next_attempt_at limit greatest(1, least(p_limit, 100)) for update skip locked
  ) returning r.*;
$$;

-- Google refunded or reversed a Play purchase (play-voided-sync). Ends that purchase's period.
create function public.void_play_purchase(p_token text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
  v_user := public.end_paid_period((select id from public.subscriptions
    where purchase_token = p_token and provider = 'google_play_product'));
  if v_user is null then return false; end if;
  delete from public.meta_event_outbox
    where event_id = 'play-product-' || encode(extensions.digest(p_token, 'sha256'), 'hex') and status = 'queued';
  perform public.notify_user(v_user, 'Payment refunded',
    'Google Play refunded a Plus purchase, so the time it added has ended.',
    jsonb_build_object('kind', 'play_product', 'status', 'refunded'));
  insert into public.audit_log(action, target_kind, details)
    values ('refund', 'play_product', jsonb_build_object('user_id', v_user));
  return true;
end; $$;

-- Monitoring: Google must receive each UPI payment within 24 hours of the payment.
create or replace function public.backend_health() returns jsonb
language sql stable security definer set search_path='' as $$
  select public.backend_health_base() || jsonb_build_object(
    'overdue_stream_allocations',(select count(*) from public.stream_allocation_intents where created_at<now()-interval '1 hour'),
    'unprocessed_payment_events',(select count(*) from public.payment_events where processed_at is null and created_at<now()-interval '1 hour'),
    'unreviewed_upi_payments',(select count(*) from public.upi_orders where status='submitted'
      and submitted_at<now()-(case when external_transaction_token is null then interval '1 day' else interval '12 hours' end)),
    'failed_play_reports',(select count(*) from public.play_external_reports where status='failed'),
    'overdue_play_reports',(select count(*) from public.play_external_reports where status='queued' and created_at<now()-interval '1 hour')
  );
$$;

revoke all on function public.end_paid_period(uuid), public.set_period_start() from public, anon, authenticated;
revoke all on function public.refund_upi_order(uuid,text) from public, anon;
revoke all on function public.void_play_purchase(text) from public, anon, authenticated;
grant execute on function public.refund_upi_order(uuid,text) to authenticated, service_role;
grant execute on function public.void_play_purchase(text) to service_role;
