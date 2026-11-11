-- Meta ads: report a confirmed UPI payment as a conversion.
-- A trigger queues the event in the same transaction that marks the order paid, so a
-- conversion exists if and only if an administrator confirmed the money. The value is the
-- amount stored on the order. Nothing is queued without the member's tracking consent,
-- and meta-capi-dispatch checks consent again when it sends.
create function public.queue_upi_meta_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  v_install public.app_installs;
  v_first boolean;
begin
  select * into v_install from public.app_installs
    where user_id = new.user_id order by updated_at desc limit 1;
  if not found or not v_install.tracking_consent then return new; end if;
  -- Subscribe marks a member's first paid period; later periods are Purchase.
  select not exists(
    select 1 from public.upi_orders where user_id = new.user_id and status = 'paid' and id <> new.id
  ) into v_first;
  insert into public.meta_event_outbox(event_id, event_name, user_id, value, currency, payload)
  values('upi-order-' || new.id, case when v_first then 'Subscribe' else 'Purchase' end,
    new.user_id, new.amount_paise / 100.0, 'INR',
    jsonb_strip_nulls(jsonb_build_object(
      'upiOrderId', new.id, 'confirmedValue', true, 'eventTime', coalesce(new.decided_at, now()),
      'metaAnonId', v_install.meta_anon_id, 'extinfo', v_install.extinfo)))
  on conflict (event_id) do nothing;
  return new;
end; $$;
revoke all on function public.queue_upi_meta_event() from public, anon, authenticated;

create trigger upi_order_paid_meta_event after update of status on public.upi_orders
  for each row when (new.status = 'paid' and old.status is distinct from 'paid')
  execute function public.queue_upi_meta_event();
