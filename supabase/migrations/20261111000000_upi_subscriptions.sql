-- UPI subscription payments.
--
-- A subscriber pays the merchant's UPI address through a `upi://pay` intent and
-- reports the 12-digit UTR. A raw UPI intent has no server callback, so the app
-- can never prove a payment: an administrator confirms each one against the bank
-- statement, and only that confirmation grants access. Confirmation writes an
-- ordinary `subscriptions` row, so access, storage quota and playback rules need
-- no UPI-specific code. A bank or PSP webhook can later call the same grant path.

-- Prices live in the backend now that Google Play no longer supplies them.
alter table public.plans
  add column price_paise integer check (price_paise is null or price_paise between 100 and 10000000);
create policy "admins read all plans" on public.plans for select to authenticated
  using ((select public.is_admin()));

-- One row: where subscribers send money.
create table public.payment_settings (
  id boolean primary key default true check (id),
  upi_vpa text check (upi_vpa ~ '^[A-Za-z0-9._-]{2,255}@[A-Za-z][A-Za-z0-9]{1,63}$'),
  payee_name text check (payee_name ~ '^[A-Za-z0-9][A-Za-z0-9 .-]{1,49}$'),
  merchant_code text check (merchant_code ~ '^[0-9]{4}$'),
  upi_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not upi_enabled or (upi_vpa is not null and payee_name is not null))
);
insert into public.payment_settings default values;
alter table public.payment_settings enable row level security;
create policy "admins read payment settings" on public.payment_settings for select to authenticated
  using ((select public.is_admin()));
revoke all on public.payment_settings from anon, authenticated;
grant select on public.payment_settings to authenticated;
create trigger payment_settings_set_updated_at before update on public.payment_settings
  for each row execute function public.set_updated_at();

-- Each order keeps the price, period and payee it was issued with, so later
-- plan or payee edits never change what a subscriber was asked to pay.
create table public.upi_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  product_id text not null references public.plans(product_id),
  plan_name text not null,
  billing_period text not null check (billing_period in ('P1M','P3M','P6M','P1Y')),
  amount_paise integer not null check (amount_paise between 100 and 10000000),
  reference text not null unique check (reference ~ '^[A-Z0-9]{12,35}$'),
  payee_vpa text not null,
  payee_name text not null,
  pay_uri text not null,
  status text not null default 'created'
    check (status in ('created','submitted','paid','rejected','expired')),
  utr text check (utr ~ '^[0-9]{12}$'),
  attempts smallint not null default 0 check (attempts between 0 and 3),
  decision_reason text check (decision_reason is null or char_length(decision_reason) between 1 and 500),
  subscription_id uuid references public.subscriptions on delete set null,
  expires_at timestamptz not null,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('submitted','paid') or utr is not null)
);
-- At most one open order and one order in review per subscriber: the review
-- queue cannot be flooded and stays proportional to real payers.
create unique index upi_orders_one_open_idx on public.upi_orders(user_id) where status='created';
create unique index upi_orders_one_review_idx on public.upi_orders(user_id) where status='submitted';
-- A bank reference can pay for one order only.
create unique index upi_orders_utr_idx on public.upi_orders(utr) where status in ('submitted','paid');
create index upi_orders_user_idx on public.upi_orders(user_id, created_at desc);
create index upi_orders_queue_idx on public.upi_orders(submitted_at, id) where status='submitted';
create index upi_orders_stale_idx on public.upi_orders(expires_at) where status='created';
-- Foreign keys are indexed so retiring a plan or erasing a subscription never scans orders.
create index upi_orders_product_idx on public.upi_orders(product_id);
create index upi_orders_subscription_idx on public.upi_orders(subscription_id) where subscription_id is not null;
create trigger upi_orders_set_updated_at before update on public.upi_orders
  for each row execute function public.set_updated_at();

alter table public.upi_orders enable row level security;
-- One policy, so each row is checked once; the sub-selects are evaluated once per query.
create policy "owners and admins read upi orders" on public.upi_orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
-- Orders change only through the functions below.
revoke all on public.upi_orders from anon, authenticated;
grant select on public.upi_orders to authenticated;

-- Inbox notice plus device push for one user.
create function public.notify_user(p_user_id uuid, p_title text, p_body text, p_data jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_notice uuid;
begin
  insert into public.notices(campaign_id, user_id, title, body, data)
    values (gen_random_uuid(), p_user_id, p_title, p_body, p_data) returning id into v_notice;
  insert into public.push_deliveries(notice_id, token_id)
    select v_notice, t.id from public.push_tokens t where t.user_id = p_user_id and t.enabled
    on conflict do nothing;
end; $$;

create function public.save_payment_settings(
  p_upi_vpa text, p_payee_name text, p_merchant_code text default null, p_enabled boolean default true
) returns public.payment_settings
language plpgsql security definer set search_path='' as $$
declare
  v_row public.payment_settings;
  v_vpa text := nullif(btrim(coalesce(p_upi_vpa, '')), '');
  v_name text := nullif(regexp_replace(btrim(coalesce(p_payee_name, '')), '\s+', ' ', 'g'), '');
  v_code text := nullif(btrim(coalesce(p_merchant_code, '')), '');
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if v_vpa is null or v_vpa !~ '^[A-Za-z0-9._-]{2,255}@[A-Za-z][A-Za-z0-9]{1,63}$' then
    raise exception 'invalid_upi_address';
  end if;
  if v_name is null or v_name !~ '^[A-Za-z0-9][A-Za-z0-9 .-]{1,49}$' then raise exception 'invalid_payee_name'; end if;
  if v_code is not null and v_code !~ '^[0-9]{4}$' then raise exception 'invalid_merchant_code'; end if;
  update public.payment_settings
    set upi_vpa = v_vpa, payee_name = v_name, merchant_code = v_code, upi_enabled = coalesce(p_enabled, false)
    where id
    returning * into v_row;
  insert into public.audit_log(actor_id, action, target_kind, details)
    values (auth.uid(), 'update', 'payment_settings',
      jsonb_build_object('upi_vpa', v_vpa, 'payee_name', v_name, 'merchant_code', v_code, 'upi_enabled', v_row.upi_enabled));
  return v_row;
end; $$;

create function public.save_plan(
  p_product_id text, p_name text, p_billing_period text, p_price_paise integer, p_quota_bytes bigint, p_active boolean
) returns public.plans
language plpgsql security definer set search_path='' as $$
declare
  v_row public.plans;
  v_id text := btrim(coalesce(p_product_id, ''));
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if v_id !~ '^[a-z0-9][a-z0-9_.]{0,39}$' then raise exception 'invalid_plan_id'; end if;
  if char_length(v_name) not between 2 and 40 then raise exception 'invalid_plan_name'; end if;
  if p_billing_period is null or p_billing_period not in ('P1M','P3M','P6M','P1Y') then raise exception 'invalid_billing_period'; end if;
  if p_price_paise is null or p_price_paise not between 100 and 10000000 then raise exception 'invalid_price'; end if;
  if p_quota_bytes is null or p_quota_bytes < 0 then raise exception 'invalid_quota'; end if;
  insert into public.plans(product_id, name, billing_period, price_paise, quota_bytes, active)
    values (v_id, v_name, p_billing_period, p_price_paise, p_quota_bytes, coalesce(p_active, false))
  on conflict (product_id) do update set name = excluded.name, billing_period = excluded.billing_period,
    price_paise = excluded.price_paise, quota_bytes = excluded.quota_bytes, active = excluded.active
  returning * into v_row;
  insert into public.audit_log(actor_id, action, target_kind, details)
    values (auth.uid(), 'save', 'plan', to_jsonb(v_row) - 'benefits' - 'created_at');
  return v_row;
end; $$;

-- Starts (or returns the still-open) order and the payment link for it.
create function public.create_upi_order(p_product_id text) returns public.upi_orders
language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := auth.uid();
  v_plan public.plans;
  v_settings public.payment_settings;
  v_order public.upi_orders;
  v_reference text;
begin
  if v_user is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  -- The profile lock serialises every order change for one subscriber.
  perform 1 from public.profiles where id = v_user and account_status = 'active' for update;
  if not found then raise exception 'account_restricted' using errcode='42501'; end if;
  select * into v_settings from public.payment_settings;
  if not coalesce(v_settings.upi_enabled, false) then raise exception 'payments_unavailable'; end if;
  select * into v_plan from public.plans where product_id = p_product_id and active and price_paise is not null;
  if not found then raise exception 'plan_unavailable'; end if;
  if exists (select 1 from public.upi_orders where user_id = v_user and status = 'submitted') then
    raise exception 'payment_in_review';
  end if;
  select * into v_order from public.upi_orders where user_id = v_user and status = 'created';
  if found then
    -- Asking again for the same offer returns the same order, so a retry or a
    -- double tap never creates a second payment reference.
    if v_order.expires_at > now() and v_order.product_id = v_plan.product_id
      and v_order.amount_paise = v_plan.price_paise and v_order.billing_period = v_plan.billing_period
      and v_order.payee_vpa = v_settings.upi_vpa then
      return v_order;
    end if;
    update public.upi_orders set status = 'expired' where id = v_order.id;
  end if;
  if (select count(*) from public.upi_orders where user_id = v_user and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too_many_orders';
  end if;
  v_reference := 'CL' || upper(encode(extensions.gen_random_bytes(10), 'hex'));
  insert into public.upi_orders(user_id, product_id, plan_name, billing_period, amount_paise, reference,
      payee_vpa, payee_name, pay_uri, expires_at)
    values (v_user, v_plan.product_id, v_plan.name, v_plan.billing_period, v_plan.price_paise, v_reference,
      v_settings.upi_vpa, v_settings.payee_name,
      'upi://pay?pa=' || v_settings.upi_vpa
        || '&pn=' || replace(v_settings.payee_name, ' ', '%20')
        || coalesce('&mc=' || v_settings.merchant_code, '')
        || '&tr=' || v_reference
        || '&tn=' || replace(left(btrim(regexp_replace(v_plan.name, '[^A-Za-z0-9 ]', '', 'g')), 40), ' ', '%20')
        || '&am=' || to_char(v_plan.price_paise / 100.0, 'FM99999990.00')
        || '&cu=INR',
      now() + interval '1 day')
    returning * into v_order;
  return v_order;
end; $$;

-- The subscriber reports the bank reference of the payment they made.
create function public.submit_upi_payment(p_order_id uuid, p_utr text) returns public.upi_orders
language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := auth.uid();
  v_order public.upi_orders;
  v_utr text := regexp_replace(coalesce(p_utr, ''), '\s', '', 'g');
begin
  if v_user is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if v_utr !~ '^[0-9]{12}$' then raise exception 'invalid_utr'; end if;
  perform 1 from public.profiles where id = v_user and account_status = 'active' for update;
  if not found then raise exception 'account_restricted' using errcode='42501'; end if;
  select * into v_order from public.upi_orders where id = p_order_id and user_id = v_user for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status = 'submitted' and v_order.utr = v_utr then return v_order; end if;
  -- A payment made just before an order lapsed or was replaced can still be
  -- reported for a week; a rejected order can be corrected (for example a typo).
  if v_order.status not in ('created','rejected','expired') or v_order.created_at < now() - interval '7 days' then
    raise exception 'order_closed';
  end if;
  if v_order.attempts >= 3 then raise exception 'too_many_attempts'; end if;
  if exists (select 1 from public.upi_orders where user_id = v_user and status = 'submitted') then
    raise exception 'payment_in_review';
  end if;
  begin
    update public.upi_orders
      set status = 'submitted', utr = v_utr, attempts = attempts + 1, submitted_at = now(),
        decided_at = null, decision_reason = null
      where id = v_order.id returning * into v_order;
  exception when unique_violation then
    raise exception 'utr_already_used';
  end;
  return v_order;
end; $$;

-- An administrator confirms or rejects a reported payment. Confirming is the
-- only way a UPI payment grants access.
create function public.decide_upi_order(p_order_id uuid, p_action text, p_reason text default null)
returns public.upi_orders
language plpgsql security definer set search_path='' as $$
declare
  v_order public.upi_orders;
  v_owner uuid;
  v_until timestamptz;
  v_subscription uuid;
  v_reason text := left(nullif(btrim(coalesce(p_reason, '')), ''), 500);
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if p_action is null or p_action not in ('approve','reject') then raise exception 'invalid_action'; end if;
  if p_action = 'reject' and v_reason is null then raise exception 'reason_required'; end if;
  select user_id into v_owner from public.upi_orders where id = p_order_id;
  if not found then raise exception 'order_not_found'; end if;
  -- Same lock order as the subscriber functions: profile first, then order.
  perform 1 from public.profiles where id = v_owner for update;
  select * into v_order from public.upi_orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status <> 'submitted' then raise exception 'order_not_pending'; end if;
  if p_action = 'approve' then
    -- Paying early extends from the current end date instead of losing days.
    select greatest(now(), coalesce(max(paid_until), now())) into v_until from public.subscriptions
      where user_id = v_owner and status in ('active','in_grace','cancelled') and paid_until > now();
    v_until := v_until + v_order.billing_period::interval;
    -- next_check_at = infinity keeps the Google Play reconciler away from this row.
    insert into public.subscriptions(user_id, provider, product_id, purchase_token, status, paid_until,
        verified_at, latest_order_id, next_check_at)
      values (v_owner, 'upi', v_order.product_id, 'upi:' || v_order.id, 'active', v_until,
        now(), v_order.reference, 'infinity')
      returning id into v_subscription;
    update public.upi_orders
      set status = 'paid', decided_at = now(), decision_reason = v_reason, subscription_id = v_subscription
      where id = v_order.id returning * into v_order;
    perform public.notify_user(v_owner, 'Payment confirmed',
      v_order.plan_name || ' is active until ' || to_char(v_until at time zone 'Asia/Kolkata', 'FMDD Mon YYYY') || '.',
      jsonb_build_object('kind', 'upi_order', 'order_id', v_order.id, 'status', 'paid'));
  else
    update public.upi_orders set status = 'rejected', decided_at = now(), decision_reason = v_reason
      where id = v_order.id returning * into v_order;
    perform public.notify_user(v_owner, 'Payment not confirmed',
      'We could not match your payment: ' || v_reason,
      jsonb_build_object('kind', 'upi_order', 'order_id', v_order.id, 'status', 'rejected'));
  end if;
  insert into public.audit_log(actor_id, action, target_kind, target_id, reason, details)
    values (auth.uid(), p_action, 'upi_order', v_order.id, v_reason,
      jsonb_build_object('user_id', v_owner, 'product_id', v_order.product_id,
        'amount_paise', v_order.amount_paise, 'reference', v_order.reference, 'paid_until', v_until));
  return v_order;
end; $$;

-- Housekeeping: lapse unpaid orders and drop ones that never carried a payment.
create or replace function public.prune_operational_records() returns void
language plpgsql security definer set search_path='' as $$
begin
  delete from public.job_runs where started_at<now()-interval '30 days';
  delete from public.account_deletion_requests where state='complete' and completed_at<now()-interval '30 days';
  delete from public.erased_purchase_tokens where expires_at<now();
  update public.upi_orders set status='expired' where status='created' and expires_at<now();
  delete from public.upi_orders where status='expired' and utr is null and created_at<now()-interval '30 days';
end; $$;

-- A reported payment nobody has checked for a day needs attention.
create or replace function public.backend_health() returns jsonb
language sql stable security definer set search_path='' as $$
  select public.backend_health_base() || jsonb_build_object(
    'overdue_stream_allocations',(select count(*) from public.stream_allocation_intents where created_at<now()-interval '1 hour'),
    'unprocessed_payment_events',(select count(*) from public.payment_events where processed_at is null and created_at<now()-interval '1 hour'),
    'unreviewed_upi_payments',(select count(*) from public.upi_orders where status='submitted' and submitted_at<now()-interval '1 day')
  );
$$;

revoke all on function public.notify_user(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.notify_user(uuid,text,text,jsonb) to service_role;
revoke all on function public.save_payment_settings(text,text,text,boolean),
  public.save_plan(text,text,text,integer,bigint,boolean), public.create_upi_order(text),
  public.submit_upi_payment(uuid,text), public.decide_upi_order(uuid,text,text) from public, anon;
grant execute on function public.save_payment_settings(text,text,text,boolean),
  public.save_plan(text,text,text,integer,bigint,boolean), public.create_upi_order(text),
  public.submit_upi_payment(uuid,text), public.decide_upi_order(uuid,text,text) to authenticated;
revoke all on function public.backend_health(), public.prune_operational_records() from public, anon, authenticated;
grant execute on function public.backend_health(), public.prune_operational_records() to service_role;
