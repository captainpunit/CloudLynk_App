-- Plans may last days as well as months (for example a 2-day trial or a 7-day plan).
-- A period is an ISO 8601 duration: P<n>D (1-99 days), P<n>M (1-12 months) or P1Y.
-- One function holds the rule so the tables and save_plan cannot drift apart.
create function public.valid_plan_period(p_period text) returns boolean
language sql immutable set search_path='' as $$
  select p_period ~ '^P([1-9][0-9]?D|([1-9]|1[0-2])M|1Y)$';
$$;

alter table public.plans
  drop constraint plans_billing_period_check,
  add constraint plans_billing_period_check check (public.valid_plan_period(billing_period));
alter table public.upi_orders
  drop constraint upi_orders_billing_period_check,
  add constraint upi_orders_billing_period_check check (public.valid_plan_period(billing_period));

create or replace function public.save_plan(
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
  if p_billing_period is null or not public.valid_plan_period(p_billing_period) then
    raise exception 'invalid_billing_period';
  end if;
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

revoke all on function public.valid_plan_period(text) from public, anon;
grant execute on function public.valid_plan_period(text) to authenticated, service_role;
