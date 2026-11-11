-- Google Play user choice billing (India).
-- On Google Play the member picks, on Google's own screen, between Google Play billing
-- and CloudLynk's UPI checkout.
--   * UPI chosen: Google gives the app an external transaction token. It is stored on the
--     order, and once an administrator confirms the payment the order is queued to be
--     reported to Google (play-external-report), as the programme requires.
--   * Google Play chosen: the plan is bought as a one-time Play product, verified by
--     verify-play-product, and granted by grant_play_product for the plan's period.

-- GST included in plan prices; Google needs the pre-tax and tax amounts separately.
alter table public.payment_settings
  add column tax_percent numeric(5,2) not null default 18 check (tax_percent between 0 and 50);

create function public.set_payment_tax(p_percent numeric) returns public.payment_settings
language plpgsql security definer set search_path='' as $$
declare v_row public.payment_settings;
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if p_percent is null or p_percent not between 0 and 50 then raise exception 'invalid_tax_percent'; end if;
  update public.payment_settings set tax_percent = p_percent returning * into v_row;
  insert into public.audit_log(actor_id, action, target_kind, details)
    values (auth.uid(), 'save', 'payment_settings', jsonb_build_object('tax_percent', p_percent));
  return v_row;
end; $$;

-- Indian states and union territories, spelled as Google's external transactions API expects.
create function public.valid_tax_state(p_state text) returns boolean
language sql immutable set search_path='' as $$
  select p_state = any(array[
    'ANDAMAN AND NICOBAR ISLANDS','ANDHRA PRADESH','ARUNACHAL PRADESH','ASSAM','BIHAR','CHANDIGARH',
    'CHHATTISGARH','DADRA AND NAGAR HAVELI AND DAMAN AND DIU','DELHI','GOA','GUJARAT','HARYANA',
    'HIMACHAL PRADESH','JAMMU AND KASHMIR','JHARKHAND','KARNATAKA','KERALA','LADAKH','LAKSHADWEEP',
    'MADHYA PRADESH','MAHARASHTRA','MANIPUR','MEGHALAYA','MIZORAM','NAGALAND','ODISHA','PUDUCHERRY',
    'PUNJAB','RAJASTHAN','SIKKIM','TAMIL NADU','TELANGANA','TRIPURA','UTTAR PRADESH','UTTARAKHAND',
    'WEST BENGAL']);
$$;

alter table public.upi_orders
  add column external_transaction_token text
    check (char_length(external_transaction_token) between 1 and 4096),
  add column tax_state text check (public.valid_tax_state(tax_state)),
  -- Google needs both to accept a report; neither or both.
  add constraint upi_orders_play_choice_check
    check ((external_transaction_token is null) = (tax_state is null));
-- A token authorises one transaction.
create unique index upi_orders_external_token_idx on public.upi_orders(external_transaction_token)
  where external_transaction_token is not null;

-- Records the choice Google's screen returned for an order that is not yet paid for.
create function public.attach_play_choice(p_order_id uuid, p_token text, p_state text)
returns public.upi_orders
language plpgsql security definer set search_path='' as $$
declare v_order public.upi_orders;
begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if p_token is null or char_length(p_token) not between 1 and 4096 then raise exception 'invalid_play_token'; end if;
  if p_state is null or not public.valid_tax_state(p_state) then raise exception 'invalid_state'; end if;
  select * into v_order from public.upi_orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then raise exception 'order_not_found'; end if;
  -- Reopening the same plan returns the open order, which keeps the token it was given.
  if v_order.external_transaction_token is not null then return v_order; end if;
  if v_order.status <> 'created' then raise exception 'order_closed'; end if;
  begin
    update public.upi_orders set external_transaction_token = p_token, tax_state = p_state
      where id = v_order.id returning * into v_order;
  exception when unique_violation then raise exception 'play_token_already_used';
  end;
  return v_order;
end; $$;

-- Outbox of transactions to report to Google. It holds no personal data and has no link
-- to the account, so a report is still sent if the member deletes their account.
create table public.play_external_reports (
  id uuid primary key default gen_random_uuid(),
  external_transaction_id text not null unique,
  external_transaction_token text not null,
  pre_tax_paise integer not null check (pre_tax_paise >= 0),
  tax_paise integer not null check (tax_paise >= 0),
  tax_state text not null check (public.valid_tax_state(tax_state)),
  transaction_time timestamptz not null,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index play_external_reports_due_idx on public.play_external_reports(next_attempt_at)
  where status = 'queued';
alter table public.play_external_reports enable row level security;
revoke all on public.play_external_reports from anon, authenticated;
grant select (id, external_transaction_id, pre_tax_paise, tax_paise, tax_state, transaction_time,
  status, attempts, last_error, created_at, sent_at) on public.play_external_reports to authenticated;
create policy "admins read play reports" on public.play_external_reports
  for select to authenticated using ((select public.is_admin()));

-- Queued in the transaction that marks the order paid: confirmed if and only if reported.
create function public.queue_play_external_report() returns trigger
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
  on conflict (external_transaction_id) do nothing;
  return new;
end; $$;
create trigger upi_order_paid_play_report after update of status on public.upi_orders
  for each row when (new.status = 'paid' and old.status is distinct from 'paid'
    and new.external_transaction_token is not null)
  execute function public.queue_play_external_report();

create function public.claim_play_reports(p_limit int default 20) returns setof public.play_external_reports
language sql security definer set search_path='' as $$
  update public.play_external_reports r
    set lease_id = gen_random_uuid(), lease_until = now() + interval '3 minutes', attempts = attempts + 1
  where r.id in (
    select id from public.play_external_reports
    where status = 'queued' and next_attempt_at <= now() and (lease_until is null or lease_until < now())
    order by next_attempt_at limit greatest(1, least(p_limit, 100)) for update skip locked
  ) returning r.*;
$$;
-- Retries back off from one minute to one hour; after 30 attempts the row needs a person.
create function public.finish_play_report(p_id uuid, p_lease uuid, p_error text default null) returns void
language sql security definer set search_path='' as $$
  update public.play_external_reports set
    status = case when p_error is null then 'sent' when attempts >= 30 then 'failed' else 'queued' end,
    sent_at = case when p_error is null then now() else null end,
    last_error = left(p_error, 200), lease_id = null, lease_until = null,
    next_attempt_at = now() + make_interval(secs => least(3600, (60 * power(2, least(attempts, 6)))::int))
  where id = p_id and lease_id = p_lease;
$$;

-- Grants a plan bought as a one-time Google Play product. Called by verify-play-product
-- after Google confirms the purchase. Safe to repeat for the same purchase token.
-- p_test marks a licence tester's purchase: it grants access but is not a conversion.
create function public.grant_play_product(p_user_id uuid, p_product_id text, p_token text, p_order_id text,
  p_test boolean default false)
returns timestamptz
language plpgsql security definer set search_path='' as $$
declare
  v_plan public.plans;
  v_until timestamptz;
  v_install public.app_installs;
begin
  perform 1 from public.profiles where id = p_user_id and account_status = 'active' for update;
  if not found then raise exception 'account_restricted' using errcode='42501'; end if;
  select paid_until into v_until from public.subscriptions where purchase_token = p_token;
  if found then return v_until; end if;
  select * into v_plan from public.plans where product_id = p_product_id and active;
  if not found then raise exception 'plan_unavailable'; end if;
  select greatest(now(), coalesce(max(paid_until), now())) into v_until from public.subscriptions
    where user_id = p_user_id and status in ('active','in_grace','cancelled') and paid_until > now();
  v_until := v_until + v_plan.billing_period::interval;
  -- next_check_at = infinity: the subscription reconciler only understands Play subscriptions.
  insert into public.subscriptions(user_id, provider, product_id, purchase_token, status, paid_until,
      verified_at, latest_order_id, next_check_at)
    values (p_user_id, 'google_play_product', v_plan.product_id, p_token, 'active', v_until,
      now(), p_order_id, 'infinity');
  perform public.notify_user(p_user_id, 'Payment confirmed',
    v_plan.name || ' is active until ' || to_char(v_until at time zone 'Asia/Kolkata', 'FMDD Mon YYYY') || '.',
    jsonb_build_object('kind', 'play_product', 'product_id', v_plan.product_id, 'status', 'paid'));
  -- Meta conversion, with consent only. The value is the plan's price: the member paid
  -- Google the price of the Play product, which is set to match it.
  select * into v_install from public.app_installs
    where user_id = p_user_id order by updated_at desc limit 1;
  if found and v_install.tracking_consent and not coalesce(p_test, false) and v_plan.price_paise > 0 then
    insert into public.meta_event_outbox(event_id, event_name, user_id, value, currency, payload)
    values('play-product-' || encode(extensions.digest(p_token, 'sha256'), 'hex'),
      case when exists(select 1 from public.subscriptions where user_id = p_user_id and purchase_token <> p_token)
        then 'Purchase' else 'Subscribe' end,
      p_user_id, v_plan.price_paise / 100.0, 'INR',
      jsonb_strip_nulls(jsonb_build_object('confirmedValue', true, 'eventTime', now(),
        'metaAnonId', v_install.meta_anon_id, 'extinfo', v_install.extinfo)))
    on conflict (event_id) do nothing;
  end if;
  return v_until;
end; $$;

revoke all on function public.set_payment_tax(numeric) from public, anon;
revoke all on function public.attach_play_choice(uuid,text,text) from public, anon;
revoke all on function public.valid_tax_state(text) from public, anon;
revoke all on function public.queue_play_external_report() from public, anon, authenticated;
revoke all on function public.claim_play_reports(int) from public, anon, authenticated;
revoke all on function public.finish_play_report(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.grant_play_product(uuid,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.set_payment_tax(numeric), public.attach_play_choice(uuid,text,text),
  public.valid_tax_state(text) to authenticated, service_role;
grant execute on function public.claim_play_reports(int), public.finish_play_report(uuid,uuid,text),
  public.grant_play_product(uuid,text,text,text,boolean) to service_role;
